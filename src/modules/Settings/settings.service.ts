import {
  cacheGetOrSet,
  CATALOG_CACHE_TTL_SECONDS,
  invalidateCache,
} from "../../app/config/cache";
import { prisma } from "../../app/config/prisma";
import type { UpdateSettingsInput } from "./settings.validation";

const STORE_ID = "store";

const emptySettings = {
  storeName: "Store",
  supportEmail: null,
  supportPhone: null,
  address: null,
  facebookUrl: null,
  instagramUrl: null,
  bkashNumber: null,
  nagadNumber: null,
  rocketNumber: null,
  collageManImageUrl: null,
  collageWomanImageUrl: null,
  collageChildImageUrl: null,
  collageAccessoriesImageUrl: null,
};

const getSettings = async () => {
  return cacheGetOrSet("content", "settings", CATALOG_CACHE_TTL_SECONDS, async () => {
    const settings = await prisma.storeSetting.findUnique({
      where: { id: STORE_ID },
    });

    if (!settings) {
      return emptySettings;
    }

    return {
      storeName: settings.storeName,
      supportEmail: settings.supportEmail,
      supportPhone: settings.supportPhone,
      address: settings.address,
      facebookUrl: settings.facebookUrl,
      instagramUrl: settings.instagramUrl,
      bkashNumber: settings.bkashNumber,
      nagadNumber: settings.nagadNumber,
      rocketNumber: settings.rocketNumber,
      collageManImageUrl: settings.collageManImageUrl,
      collageWomanImageUrl: settings.collageWomanImageUrl,
      collageChildImageUrl: settings.collageChildImageUrl,
      collageAccessoriesImageUrl: settings.collageAccessoriesImageUrl,
    };
  });
};

const updateSettings = async (input: UpdateSettingsInput) => {
  const current = await prisma.storeSetting.findUnique({ where: { id: STORE_ID } });
  const settings = await prisma.storeSetting.upsert({
    where: { id: STORE_ID },
    update: input,
    create: {
      id: STORE_ID,
      storeName: input.storeName ?? current?.storeName ?? emptySettings.storeName,
      supportEmail: input.supportEmail,
      supportPhone: input.supportPhone,
      address: input.address,
      facebookUrl: input.facebookUrl,
      instagramUrl: input.instagramUrl,
      bkashNumber: input.bkashNumber,
      nagadNumber: input.nagadNumber,
      rocketNumber: input.rocketNumber,
      collageManImageUrl: input.collageManImageUrl,
      collageWomanImageUrl: input.collageWomanImageUrl,
      collageChildImageUrl: input.collageChildImageUrl,
      collageAccessoriesImageUrl: input.collageAccessoriesImageUrl,
    },
  });

  await invalidateCache("content");

  return {
    storeName: settings.storeName,
    supportEmail: settings.supportEmail,
    supportPhone: settings.supportPhone,
    address: settings.address,
    facebookUrl: settings.facebookUrl,
    instagramUrl: settings.instagramUrl,
    bkashNumber: settings.bkashNumber,
    nagadNumber: settings.nagadNumber,
    rocketNumber: settings.rocketNumber,
    collageManImageUrl: settings.collageManImageUrl,
    collageWomanImageUrl: settings.collageWomanImageUrl,
    collageChildImageUrl: settings.collageChildImageUrl,
    collageAccessoriesImageUrl: settings.collageAccessoriesImageUrl,
  };
};

export const settingsService = {
  getSettings,
  updateSettings,
};
