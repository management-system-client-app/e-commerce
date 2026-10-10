import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { uploadImageBuffer } from "../config/cloudinary";
import { AppError } from "../errors/AppError";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
  "video/ogg",
  "application/octet-stream",
]);
const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".m4v", ".ogv", ".avi"];
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".avif"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_HOME_MEDIA_BYTES = 100 * 1024 * 1024;
const MAX_PRODUCT_IMAGES = 6;

const hasAllowedExtension = (fileName: string, extensions: string[]) => {
  const lowered = fileName.toLowerCase();
  return extensions.some((extension) => lowered.endsWith(extension));
};

const isVideo = (file: Pick<Express.Multer.File, "mimetype" | "originalname">): boolean => {
  if (file.mimetype?.startsWith("video/")) return true;
  if (file.mimetype === "application/octet-stream") {
    return hasAllowedExtension(file.originalname, VIDEO_EXTENSIONS);
  }
  return hasAllowedExtension(file.originalname, VIDEO_EXTENSIONS);
};

const isImage = (file: Pick<Express.Multer.File, "mimetype" | "originalname">): boolean => {
  if (file.mimetype?.startsWith("image/")) return true;
  return hasAllowedExtension(file.originalname, IMAGE_EXTENSIONS);
};

const imageFileFilter: multer.Options["fileFilter"] = (_req, file, callback) => {
  if (ALLOWED_MIME_TYPES.has(file.mimetype) || isImage(file) || isVideo(file)) {
    callback(null, true);
    return;
  }

  callback(AppError.badRequest("Only JPEG, PNG, WebP, AVIF, MP4, WebM, and MOV videos are allowed"));
};

export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFileFilter,
  limits: {
    fileSize: MAX_IMAGE_BYTES,
    files: MAX_PRODUCT_IMAGES,
  },
});

const homeMediaUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFileFilter,
  limits: {
    fileSize: MAX_HOME_MEDIA_BYTES,
    files: 1,
  },
});

export const productImagesUpload = upload.array("images", MAX_PRODUCT_IMAGES);

/**
 * Multipart product creates send the JSON body in a `data` field and files in `images`.
 * Plain JSON requests are left unchanged.
 */
export const parseMultipartData = (req: Request, _res: Response, next: NextFunction): void => {
  const data = req.body?.data;

  if (typeof data !== "string") {
    next();
    return;
  }

  try {
    req.body = JSON.parse(data) as unknown;
    next();
  } catch {
    next(AppError.badRequest("Form data must be valid JSON"));
  }
};

export const singleImageUpload = upload.single("image");
const imageOnlyUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, callback) => {
    if (["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.mimetype)) {
      callback(null, true);
      return;
    }
    callback(AppError.badRequest("Only JPEG, PNG, WebP, and AVIF images are allowed"));
  },
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
});
export const singleImageOnlyUpload = imageOnlyUpload.single("image");
export const singleHomeMediaUpload = homeMediaUpload.single("image");

/** When a multipart request includes `image`, upload it and set `imageUrl` on the JSON body. */
export const applyUploadedImage =
  (folder: string) =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.file) {
      next();
      return;
    }

    try {
      const uploaded = await uploadImageBuffer(req.file.buffer, folder, req.file.mimetype, req.file.originalname);
      const body = req.body && typeof req.body === "object" ? req.body : {};
      req.body = { ...body, imageUrl: uploaded.url };
      next();
    } catch (error) {
      next(error);
    }
  };
