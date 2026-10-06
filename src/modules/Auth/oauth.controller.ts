import type { Request, Response } from "express";
import { AppError } from "../../app/errors/AppError";
import { cartService } from "../Cart/cart.service";
import { clearCartSessionCookie, readCartSessionId } from "../Cart/cart.session";
import { oauthService } from "./oauth.service";

const begin = (res: Response, url: string): void => {
  oauthService.setStateCookie(res, oauthService.stateFromUrl(url));
  res.redirect(url);
};

const startGoogle = async (req: Request, res: Response): Promise<void> => {
  begin(res, oauthService.startGoogle(req));
};

const startFacebook = async (req: Request, res: Response): Promise<void> => {
  begin(res, oauthService.startFacebook(req));
};

const finish = async (
  req: Request,
  res: Response,
  providerName: "Google" | "Facebook",
  login: () => Promise<{ token: string; user: { id: string } }>,
): Promise<void> => {
  try {
    const result = await login();
    oauthService.clearStateCookie(res);

    const sessionId = readCartSessionId(req);

    if (sessionId) {
      await cartService.mergeGuestCart(result.user.id, sessionId);
      clearCartSessionCookie(res);
    }

    res.redirect(oauthService.successRedirect(result.token));
  } catch (error) {
    oauthService.clearStateCookie(res);
    const message =
      error instanceof AppError ? error.message : `${providerName} login failed`;
    res.redirect(oauthService.failureRedirect(message));
  }
};

const googleCallback = (req: Request, res: Response): Promise<void> =>
  finish(req, res, "Google", () => oauthService.handleGoogleCallback(req));

const facebookCallback = (req: Request, res: Response): Promise<void> =>
  finish(req, res, "Facebook", () => oauthService.handleFacebookCallback(req));

export const oauthController = {
  startGoogle,
  startFacebook,
  googleCallback,
  facebookCallback,
};
