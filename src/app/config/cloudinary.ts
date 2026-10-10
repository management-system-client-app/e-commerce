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

const uploadToCloudinary = (
  buffer: Buffer,
  folder: string,
  resourceType: "image" | "video",
): Promise<UploadedImage> =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (error, result) => {
        if (error || !result) {
          const message =
            error && typeof error === "object" && "message" in error && typeof error.message === "string"
              ? error.message
              : `${resourceType === "video" ? "Video" : "Image"} upload failed`;
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

const isAvif = (buffer: Buffer): boolean => {
  if (buffer.subarray(4, 8).toString("ascii") !== "ftyp") {
    return false;
  }

  const boxSize = buffer.readUInt32BE(0);
  const boxEnd = Math.min(boxSize, buffer.length);
  if (boxSize < 16) {
    return false;
  }

  for (let offset = 8; offset + 4 <= boxEnd; offset += offset === 8 ? 8 : 4) {
    const brand = buffer.subarray(offset, offset + 4).toString("ascii");
    if (brand === "avif" || brand === "avis") {
      return true;
    }
  }

  return false;
};

const detectResourceType = (mimeType?: string, fileName?: string, buffer?: Buffer): "image" | "video" => {
  const loweredName = (fileName ?? "").toLowerCase();
  if (
    mimeType === "image/avif" ||
    loweredName.endsWith(".avif") ||
    (buffer !== undefined && isAvif(buffer))
  ) {
    return "image";
  }

  if (mimeType?.startsWith("video/")) return "video";
  if ([".mp4", ".webm", ".mov", ".m4v", ".ogv", ".avi", ".mkv"].some((extension) => loweredName.endsWith(extension))) {
    return "video";
  }

  if (buffer) {
    const isMp4 = buffer.subarray(4, 8).toString("ascii") === "ftyp";
    const isWebm = buffer.subarray(0, 4).toString("hex") === "1a45dfa3";
    if (isMp4 || isWebm) {
      return "video";
    }
  }

  return "image";
};

const extensionFor = (buffer: Buffer, mimeType?: string, fileName?: string): string => {
  const loweredName = (fileName ?? "").toLowerCase();
  if (mimeType === "image/avif" || loweredName.endsWith(".avif") || isAvif(buffer)) return "avif";
  if (/[.]mp4$/i.test(loweredName)) return "mp4";
  if (/[.]webm$/i.test(loweredName)) return "webm";
  if (/[.]mov$/i.test(loweredName) || /[.]quicktime$/i.test(loweredName)) return "mov";
  if (/[.]m4v$/i.test(loweredName)) return "m4v";
  if (/[.]ogv$/i.test(loweredName)) return "ogv";
  if (/[.]avi$/i.test(loweredName)) return "avi";
  if (/[.]mkv$/i.test(loweredName)) return "mkv";

  if (mimeType?.startsWith("video/")) {
    if (mimeType === "video/webm") return "webm";
    if (mimeType === "video/quicktime") return "mov";
    return "mp4";
  }

  const head = buffer.subarray(0, 12).toString("hex");
  if (head.startsWith("89504e47")) return "png";
  if (buffer.subarray(0, 4).toString() === "RIFF") return "webp";
  return "jpg";
};

const saveLocalImage = async (buffer: Buffer, folder: string, mimeType?: string, fileName?: string): Promise<UploadedImage> => {
  const safeFolder = folder.replace(/[^a-z0-9/_-]/gi, "") || "ecommerce";
  const filename = `${randomUUID()}.${extensionFor(buffer, mimeType, fileName)}`;
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
  mimeType?: string,
  fileName?: string,
): Promise<UploadedImage> => {
  const resourceType = detectResourceType(mimeType, fileName, buffer);

  if (isConfigured) {
    try {
      return await uploadToCloudinary(buffer, folder, resourceType);
    } catch (error) {
      if (env.NODE_ENV === "production") {
        throw error;
      }

      logger.warn("Cloudinary upload failed, saving the media locally", {
        message: error instanceof Error ? error.message : "Media upload failed",
      });
    }
  } else if (env.NODE_ENV === "production") {
    assertConfigured();
  }

  return saveLocalImage(buffer, folder, mimeType, fileName);
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
