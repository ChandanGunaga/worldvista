import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { env, features } from "./env";
import { HttpError } from "./http";

const ALLOWED: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Checks magic bytes so a renamed non-image can't be uploaded. */
function sniff(buf: Buffer): string | null {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}

/**
 * Stores an image and returns its public URL.
 * Uses Cloudinary when configured (recommended in production: container disks are ephemeral);
 * otherwise saves to UPLOAD_DIR, served by the API at /uploads.
 */
export async function storeImage(buf: Buffer, folder = "worldvista"): Promise<string> {
  const mime = sniff(buf);
  if (!mime || !ALLOWED[mime]) throw new HttpError(400, "Only JPEG, PNG or WebP images are allowed");

  if (features.cloudinary) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const toSign = `folder=${folder}&timestamp=${timestamp}${env.cloudinary.apiSecret}`;
    const signature = crypto.createHash("sha1").update(toSign).digest("hex");
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(buf)], { type: mime }));
    form.append("api_key", env.cloudinary.apiKey);
    form.append("timestamp", timestamp);
    form.append("folder", folder);
    form.append("signature", signature);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${env.cloudinary.cloudName}/image/upload`, { method: "POST", body: form });
    const data = (await res.json()) as { secure_url?: string; error?: { message?: string } };
    if (!res.ok || !data.secure_url) {
      console.error("Cloudinary upload failed", data.error?.message);
      throw new HttpError(502, "Image upload failed");
    }
    return data.secure_url;
  }

  const name = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}.${ALLOWED[mime]}`;
  const dir = path.resolve(env.uploadDir);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), buf);
  return `/uploads/${name}`;
}
