import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { AppError } from "@wp-agent-studio/shared";

export type EncryptedSecret = { encryptedValue: string; iv: string; authTag: string; keyVersion: number };

export function decodeMasterKey(value = process.env.ENCRYPTION_KEY): Buffer {
  if (!value) throw new AppError("ENCRYPTION_KEY_MISSING", "ENCRYPTION_KEY est requis", 500);
  const key = Buffer.from(value, "base64");
  if (key.length !== 32) throw new AppError("ENCRYPTION_KEY_INVALID", "ENCRYPTION_KEY doit contenir exactement 32 octets encodés en base64", 500);
  return key;
}

export function encryptSecret(value: unknown, key = decodeMasterKey(), associatedData = "wp-agent-studio:v1"): EncryptedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(associatedData));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return { encryptedValue: encrypted.toString("base64"), iv: iv.toString("base64"), authTag: cipher.getAuthTag().toString("base64"), keyVersion: 1 };
}

export function decryptSecret<T>(secret: EncryptedSecret, key = decodeMasterKey(), associatedData = "wp-agent-studio:v1"): T {
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(secret.iv, "base64"));
    decipher.setAAD(Buffer.from(associatedData));
    decipher.setAuthTag(Buffer.from(secret.authTag, "base64"));
    const clear = Buffer.concat([decipher.update(Buffer.from(secret.encryptedValue, "base64")), decipher.final()]);
    return JSON.parse(clear.toString("utf8")) as T;
  } catch {
    throw new AppError("SECRET_DECRYPTION_FAILED", "Impossible de déchiffrer l’intégration", 500);
  }
}
