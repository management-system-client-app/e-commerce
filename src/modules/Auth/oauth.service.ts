import { createHash, randomBytes } from "node:crypto";
import type { CookieOptions, Request, Response } from "express";
import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../app/config/prisma";
import { env } from "../../app/config/env";
import { AppError } from "../../app/errors/AppError";
import { hashPassword } from "../../utils/bcrypt";
import { generateAccessToken } from "../../utils/generateToken";

const OAUTH_STATE_COOKIE = "oauth_state";
const STATE_MAX_AGE_MS = 10 * 60 * 1000;

type Provider = "GOOGLE" | "FACEBOOK";

type ProviderProfile = {
  provider: Provider;
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
};

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  avatarUrl: true,
  isEmailVerified: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

const cookieOptions = (): CookieOptions => ({
  httpOnly: true,
  signed: true,
  sameSite: "lax",
  secure: env.NODE_ENV === "production",
  maxAge: STATE_MAX_AGE_MS,
  path: "/",
});

const apiBaseUrl = (req: Request): string => `${req.protocol}://${req.get("host")}`;

const frontendBase = (): string => env.FRONTEND_URL.replace(/\/$/, "");

const requireGoogleConfig = (): { clientId: string; clientSecret: string } => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new AppError("Google login is not configured", 503);
  }

  return { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET };
};

const requireFacebookConfig = (): { appId: string; appSecret: string } => {
  if (!env.FACEBOOK_APP_ID || !env.FACEBOOK_APP_SECRET) {
    throw new AppError("Facebook login is not configured", 503);
  }

  return { appId: env.FACEBOOK_APP_ID, appSecret: env.FACEBOOK_APP_SECRET };
};

const redirectUri = (req: Request, provider: Provider): string => {
  const path = provider === "GOOGLE" ? "google" : "facebook";
  return `${apiBaseUrl(req)}/api/v1/auth/${path}/callback`;
};

type HttpResponse = {
  ok: boolean;
  text: () => Promise<string>;
};

const asHttp = (response: unknown): HttpResponse => response as HttpResponse;

const readJson = async (response: HttpResponse): Promise<Record<string, unknown>> => {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
};

const asString = (value: unknown): string => (typeof value === "string" ? value : "");

const clipName = (value: string, fallback: string): string => {
  const trimmed = value.trim().slice(0, 80);
  return trimmed.length > 0 ? trimmed : fallback;
};

const avatarUrlOf = (value: string): string | null => {
  if (!value.startsWith("https://") && !value.startsWith("http://")) {
    return null;
  }

  return value.slice(0, 500);
};

const createState = (provider: Provider): string =>
  `${provider}.${randomBytes(24).toString("hex")}`;

const setStateCookie = (res: Response, state: string): void => {
  res.cookie(OAUTH_STATE_COOKIE, state, cookieOptions());
};

const clearStateCookie = (res: Response): void => {
  res.clearCookie(OAUTH_STATE_COOKIE, {
    path: "/",
    httpOnly: true,
    signed: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
  });
};

const assertState = (req: Request, provider: Provider): void => {
  const queryState = typeof req.query.state === "string" ? req.query.state : "";
  const cookieState = req.signedCookies?.[OAUTH_STATE_COOKIE];
  const saved = typeof cookieState === "string" ? cookieState : "";

  if (!queryState || queryState !== saved || !queryState.startsWith(`${provider}.`)) {
    throw AppError.unauthorized("Login session expired. Start Google or Facebook login again.");
  }
};

const successRedirect = (token: string): string =>
  `${frontendBase()}/auth/callback#token=${encodeURIComponent(token)}`;

const failureRedirect = (message: string): string =>
  `${frontendBase()}/auth/callback?error=${encodeURIComponent(message)}`;

const startGoogle = (req: Request): string => {
  const { clientId } = requireGoogleConfig();
  const state = createState("GOOGLE");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(req, "GOOGLE"),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
};

const startFacebook = (req: Request): string => {
  const { appId } = requireFacebookConfig();
  const state = createState("FACEBOOK");
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri(req, "FACEBOOK"),
    response_type: "code",
    scope: "email,public_profile",
    state,
  });

  return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
};

const stateFromUrl = (url: string): string => {
  const state = new URL(url).searchParams.get("state");

  if (!state) {
    throw AppError.internal("Login state was not created");
  }

  return state;
};

const exchangeGoogle = async (req: Request, code: string): Promise<ProviderProfile> => {
  const { clientId, clientSecret } = requireGoogleConfig();
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri(req, "GOOGLE"),
      grant_type: "authorization_code",
    }),
  });
  const tokenBody = await readJson(asHttp(tokenResponse));
  const accessToken = asString(tokenBody.access_token);

  if (!asHttp(tokenResponse).ok || !accessToken) {
    throw new AppError("Google login failed", 502);
  }

  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const profile = await readJson(asHttp(profileResponse));

  if (!asHttp(profileResponse).ok) {
    throw new AppError("Google login failed", 502);
  }

  const emailVerified = profile.email_verified === true || profile.email_verified === "true";

  return {
    provider: "GOOGLE",
    providerUserId: asString(profile.sub),
    email: asString(profile.email).toLowerCase(),
    emailVerified,
    firstName: clipName(asString(profile.given_name), "Customer"),
    lastName: clipName(asString(profile.family_name), "User"),
    avatarUrl: avatarUrlOf(asString(profile.picture)),
  };
};

const exchangeFacebook = async (req: Request, code: string): Promise<ProviderProfile> => {
  const { appId, appSecret } = requireFacebookConfig();
  const tokenParams = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri(req, "FACEBOOK"),
    code,
  });
  const tokenResponse = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?${tokenParams.toString()}`,
  );
  const tokenBody = await readJson(asHttp(tokenResponse));
  const accessToken = asString(tokenBody.access_token);

  if (!asHttp(tokenResponse).ok || !accessToken) {
    throw new AppError("Facebook login failed", 502);
  }

  const profileParams = new URLSearchParams({
    fields: "id,email,first_name,last_name,picture.type(large)",
    access_token: accessToken,
  });
  const profileResponse = await fetch(`https://graph.facebook.com/me?${profileParams.toString()}`);
  const profile = await readJson(asHttp(profileResponse));

  if (!asHttp(profileResponse).ok) {
    throw new AppError("Facebook login failed", 502);
  }

  const picture = profile.picture;
  const pictureUrl =
    picture && typeof picture === "object" && !Array.isArray(picture)
      ? asString((picture as { data?: { url?: unknown } }).data?.url)
      : "";

  return {
    provider: "FACEBOOK",
    providerUserId: asString(profile.id),
    email: asString(profile.email).toLowerCase(),
    emailVerified: asString(profile.email).length > 0,
    firstName: clipName(asString(profile.first_name), "Customer"),
    lastName: clipName(asString(profile.last_name), "User"),
    avatarUrl: avatarUrlOf(pictureUrl),
  };
};

const finishLogin = async (userId: string) => {
  const lastLoginAt = new Date();
  const user = await prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt },
    select: userSelect,
  });

  return {
    token: generateAccessToken({
      sub: user.id,
      email: user.email,
      role: "USER",
    }),
    user: {
      ...user,
      lastLoginAt,
    },
  };
};

const signInWithProfile = async (profile: ProviderProfile) => {
  if (!profile.providerUserId || !profile.email.includes("@")) {
    throw AppError.badRequest(
      profile.provider === "FACEBOOK"
        ? "Facebook did not share an email address. Allow email access and try again."
        : "Google did not share an email address.",
    );
  }

  if (!profile.emailVerified) {
    throw AppError.badRequest("That account email is not verified");
  }

  const linked = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerUserId: {
        provider: profile.provider,
        providerUserId: profile.providerUserId,
      },
    },
    select: { user: { select: { id: true, isActive: true } } },
  });

  if (linked) {
    if (!linked.user.isActive) {
      throw AppError.forbidden("This account is disabled");
    }

    return finishLogin(linked.user.id);
  }

  const existing = await prisma.user.findUnique({
    where: { email: profile.email },
    select: { id: true, isActive: true, avatarUrl: true },
  });

  if (existing) {
    if (!existing.isActive) {
      throw AppError.forbidden("This account is disabled");
    }

    await prisma.oAuthAccount.create({
      data: {
        provider: profile.provider,
        providerUserId: profile.providerUserId,
        userId: existing.id,
      },
    });

    if (!existing.avatarUrl && profile.avatarUrl) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { avatarUrl: profile.avatarUrl, isEmailVerified: true },
      });
    } else {
      await prisma.user.update({
        where: { id: existing.id },
        data: { isEmailVerified: true },
      });
    }

    return finishLogin(existing.id);
  }

  const passwordHash = await hashPassword(createHash("sha256").update(randomBytes(32)).digest("hex"));
  const created = await prisma.user.create({
    data: {
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      passwordHash,
      avatarUrl: profile.avatarUrl,
      isEmailVerified: true,
      oauthAccounts: {
        create: {
          provider: profile.provider,
          providerUserId: profile.providerUserId,
        },
      },
    },
    select: { id: true },
  });

  return finishLogin(created.id);
};

const callbackCode = (req: Request, provider: Provider): string => {
  const providerError = typeof req.query.error === "string" ? req.query.error : "";

  if (providerError === "access_denied") {
    throw AppError.badRequest(
      provider === "GOOGLE" ? "Google login was cancelled" : "Facebook login was cancelled",
    );
  }

  if (providerError) {
    throw new AppError(provider === "GOOGLE" ? "Google login failed" : "Facebook login failed", 502);
  }

  assertState(req, provider);

  const code = typeof req.query.code === "string" ? req.query.code : "";

  if (!code) {
    throw AppError.badRequest("Login code is missing");
  }

  return code;
};

const handleGoogleCallback = async (req: Request) => {
  const code = callbackCode(req, "GOOGLE");
  return signInWithProfile(await exchangeGoogle(req, code));
};

const handleFacebookCallback = async (req: Request) => {
  const code = callbackCode(req, "FACEBOOK");
  return signInWithProfile(await exchangeFacebook(req, code));
};

export const oauthService = {
  startGoogle,
  startFacebook,
  stateFromUrl,
  setStateCookie,
  clearStateCookie,
  successRedirect,
  failureRedirect,
  handleGoogleCallback,
  handleFacebookCallback,
};
