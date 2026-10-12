import { createHmac, timingSafeEqual } from "node:crypto";

export function hashPasswordResetCode(userId: string, code: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  }

  return createHmac("sha256", secret).update(`${userId}:${code}`).digest("hex");
}

export function verifyPasswordResetCode(
  userId: string,
  code: string,
  expectedHash: string,
): boolean {
  const actualHash = Buffer.from(hashPasswordResetCode(userId, code), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actualHash.length === expected.length && timingSafeEqual(actualHash, expected);
}
