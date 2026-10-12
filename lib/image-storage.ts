import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const maximumFileSize = 5 * 1024 * 1024;
const imageTypes = {
  "image/avif": {
    extension: "avif",
    signature: (bytes: Uint8Array) =>
      bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(4, 8)) === "ftyp" &&
      ["avif", "avis"].includes(String.fromCharCode(...bytes.slice(8, 12))),
  },
  "image/gif": {
    extension: "gif",
    signature: (bytes: Uint8Array) =>
      bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(String.fromCharCode(...bytes.slice(0, 6))),
  },
  "image/jpeg": {
    extension: "jpg",
    signature: (bytes: Uint8Array) =>
      bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  },
  "image/png": {
    extension: "png",
    signature: (bytes: Uint8Array) =>
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      String.fromCharCode(...bytes.slice(1, 4)) === "PNG" &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a,
  },
  "image/webp": {
    extension: "webp",
    signature: (bytes: Uint8Array) =>
      bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP",
  },
} as const;

type SupportedImageType = keyof typeof imageTypes;

export class ImageUploadError extends Error {}

function isSupportedImageType(value: string): value is SupportedImageType {
  return Object.hasOwn(imageTypes, value);
}

export async function storeImage(file: File): Promise<{
  fileName: string;
  url: string;
  contentType: SupportedImageType;
  size: number;
}> {
  if (!file.name || file.size === 0 || file.size > maximumFileSize) {
    throw new ImageUploadError("Image must be larger than 0 bytes and no larger than 5 MB.");
  }
  if (!isSupportedImageType(file.type)) {
    throw new ImageUploadError("Unsupported image type. Use PNG, JPEG, WebP, GIF, or AVIF.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const imageType = imageTypes[file.type];
  if (!imageType.signature(bytes)) {
    throw new ImageUploadError("The uploaded file is not a valid image.");
  }

  const fileName = `${randomUUID()}.${imageType.extension}`;
  const imageDirectory = path.join(process.cwd(), "public", "images");
  await mkdir(imageDirectory, { recursive: true });
  await writeFile(path.join(imageDirectory, fileName), bytes, { flag: "wx" });

  return {
    fileName,
    url: `/images/${fileName}`,
    contentType: file.type,
    size: file.size,
  };
}

export async function removeStoredImage(fileName: string): Promise<void> {
  if (!/^[0-9a-f-]{36}\.(avif|gif|jpg|png|webp)$/.test(fileName)) {
    throw new Error("Refusing to remove an invalid uploaded image path.");
  }
  await rm(path.join(process.cwd(), "public", "images", fileName));
}
