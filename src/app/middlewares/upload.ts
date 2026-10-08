import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { uploadImageBuffer } from "../config/cloudinary";
import { AppError } from "../errors/AppError";

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PRODUCT_IMAGES = 5;

const imageFileFilter: multer.Options["fileFilter"] = (_req, file, callback) => {
  if (IMAGE_MIME_TYPES.has(file.mimetype)) {
    callback(null, true);
    return;
  }

  callback(AppError.badRequest("Only JPEG, PNG, and WebP images are allowed"));
};

export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFileFilter,
  limits: {
    fileSize: MAX_IMAGE_BYTES,
    files: MAX_PRODUCT_IMAGES,
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

/** When a multipart request includes `image`, upload it and set `imageUrl` on the JSON body. */
export const applyUploadedImage =
  (folder: string) =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.file) {
      next();
      return;
    }

    try {
      const uploaded = await uploadImageBuffer(req.file.buffer, folder);
      const body = req.body && typeof req.body === "object" ? req.body : {};
      req.body = { ...body, imageUrl: uploaded.url };
      next();
    } catch (error) {
      next(error);
    }
  };
