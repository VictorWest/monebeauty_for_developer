import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";

export class SensitiveDataConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SensitiveDataConfigurationError";
  }
}

function encryptionKey() {
  const raw = process.env.SENSITIVE_DATA_ENCRYPTION_KEY?.trim();
  if (!raw)
    throw new SensitiveDataConfigurationError(
      "SENSITIVE_DATA_ENCRYPTION_KEY is required",
    );

  const isHex = /^[a-f\d]{64}$/i.test(raw);
  const isBase64 = /^[A-Za-z0-9+/]{43}=$/.test(raw);
  if (!isHex && !isBase64)
    throw new SensitiveDataConfigurationError(
      "SENSITIVE_DATA_ENCRYPTION_KEY must be valid base64 or hexadecimal",
    );

  const key = Buffer.from(raw, isHex ? "hex" : "base64");
  if (key.length !== 32)
    throw new SensitiveDataConfigurationError(
      "SENSITIVE_DATA_ENCRYPTION_KEY must encode exactly 32 bytes",
    );
  return key;
}

export function assertSensitiveDataEncryptionConfigured() {
  encryptionKey();
}

export function isSensitiveDataEncryptionConfigured() {
  try {
    assertSensitiveDataEncryptionConfigured();
    return true;
  } catch {
    return false;
  }
}

export function encryptSensitiveText(plaintext: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return [
    VERSION,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptSensitiveText(envelope: string) {
  const [version, ivValue, tagValue, ciphertext] = envelope.split(":");
  if (version !== VERSION || !ivValue || !tagValue || !ciphertext)
    throw new Error("Invalid encrypted sensitive-data envelope");
  const decipher = createDecipheriv(
    ALGORITHM,
    encryptionKey(),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function encryptSensitiveJson(value: unknown) {
  return encryptSensitiveText(JSON.stringify(value));
}

export function decryptSensitiveJson<T>(envelope: string): T {
  return JSON.parse(decryptSensitiveText(envelope)) as T;
}
