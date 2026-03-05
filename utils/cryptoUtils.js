import crypto from "crypto";

// AES-256 settings
const IV_LENGTH = 16; // AES block size

/**
 * Gets the encryption key from environment variables.
 * Returns a Buffer if valid, otherwise throws an error.
 */
const getEncryptionKey = () => {
  const key = process.env.CODE_SECRET_KEY;
  if (!key || key.length !== 32) {
    throw new Error(`CODE_SECRET_KEY must be exactly 32 characters. Current length: ${key?.length}`);
  }
  return Buffer.from(key);
};

/**
 * Encrypt a string using AES-256-CBC
 * Returns format: ivHex:encryptedHex
 */
export const encrypt = (text) => {
  if (!text) return "";

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", getEncryptionKey(), iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  return iv.toString("hex") + ":" + encrypted;
}

/**
 * Decrypt a string. Returns null if decryption fails or format is invalid.
 */
export const decrypt = (text) => {
  if (!text || typeof text !== "string" || !text.includes(":")) {
    return null; // Handle plain text or missing codes gracefully
  }

  try {
    const [ivHex, encrypted] = text.split(":");
    if (!ivHex || !encrypted) return null;

    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", getEncryptionKey(), iv);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (err) {
    // If decryption fails (e.g. wrong key or malformed data), return null instead of crashing
    return null;
  }
}