import { Readable } from "node:stream";
import { v2 as cloudinary } from "cloudinary";
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

export const uploadImageBuffer = (
  buffer: Buffer,
  folder = "ecommerce/products",
): Promise<UploadedImage> => {
  assertConfigured();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (error, result) => {
        if (error || !result) {
          reject(error ?? AppError.internal("Image upload failed"));
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
};

export const deleteCloudinaryImages = async (publicIds: string[]): Promise<void> => {
  if (!isConfigured || publicIds.length === 0) {
    return;
  }

  await Promise.all(publicIds.map((publicId) => cloudinary.uploader.destroy(publicId)));
};

export { cloudinary };
