import crypto from "crypto";

// AES-256 settings
const ENCRYPTION_KEY = process.env.CODE_SECRET_KEY; // 32 characters
const IV_LENGTH = 16; // AES block size

// Encrypt user role code
export const encrypt = (text) => {
  const iv = crypto.randomBytes(IV_LENGTH); // A vector to make identical inputs produce different outputs
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  return iv.toString("hex") + ":" + encrypted;
}


// Decrypt user role code for the password generation later
export const decrypt = (text) => {
  const [ivHex, encrypted] = text.split(":");

  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}