import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { v2 as cloudinary } from "cloudinary";
import logger from "../../config/logger";
import { AppError } from "../errors/AppError";
import { env } from "./env";

const isConfigured = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
);

if (isConfigured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

const assertConfigured = (): void => {
  if (!isConfigured) {
    throw new AppError("Cloudinary is not configured", 503);
  }
};

export type UploadedImage = {
  url: string;
  publicId: string;
};

const uploadToCloudinary = (buffer: Buffer, folder: string): Promise<UploadedImage> =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (error, result) => {
        if (error || !result) {
          const message =
            error && typeof error === "object" && "message" in error && typeof error.message === "string"
              ? error.message
              : "Image upload failed";
          reject(new AppError(message, 502));
          return;
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      },
    );

    Readable.from(buffer).pipe(stream);
  });

const extensionFor = (buffer: Buffer): string => {
  const head = buffer.subarray(0, 12).toString("hex");
  if (head.startsWith("89504e47")) return "png";
  if (buffer.subarray(0, 4).toString() === "RIFF") return "webp";
  return "jpg";
};

const saveLocalImage = async (buffer: Buffer, folder: string): Promise<UploadedImage> => {
  const safeFolder = folder.replace(/[^a-z0-9/_-]/gi, "") || "ecommerce";
  const filename = `${randomUUID()}.${extensionFor(buffer)}`;
  const directory = path.join(process.cwd(), "uploads", safeFolder);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, filename), buffer);

  const publicPath = `/uploads/${safeFolder}/${filename}`;
  return {
    url: `http://localhost:${env.PORT}${publicPath}`,
    publicId: `local:${publicPath}`,
  };
};

export const uploadImageBuffer = async (
  buffer: Buffer,
  folder = "ecommerce/products",
): Promise<UploadedImage> => {
  if (isConfigured) {
    try {
      return await uploadToCloudinary(buffer, folder);
    } catch (error) {
      if (env.NODE_ENV === "production") {
        throw error;
      }

      logger.warn("Cloudinary upload failed, saving the image locally", {
        message: error instanceof Error ? error.message : "Image upload failed",
      });
    }
  } else if (env.NODE_ENV === "production") {
    assertConfigured();
  }

  return saveLocalImage(buffer, folder);
};

export const deleteCloudinaryImages = async (publicIds: string[]): Promise<void> => {
  if (!isConfigured || publicIds.length === 0) {
    return;
  }

  await Promise.all(
    publicIds
      .filter((publicId) => !publicId.startsWith("local:"))
      .map((publicId) => cloudinary.uploader.destroy(publicId)),
  );
};

export { cloudinary };
