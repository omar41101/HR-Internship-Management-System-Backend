import libphonenumber from "google-libphonenumber";

const phoneUtil = libphonenumber.PhoneNumberUtil.getInstance();
const PNF = libphonenumber.PhoneNumberFormat;

// Email validation with Regex method
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Check if a field is empty (handles whitespace)
export const isEmpty = (field) => {
  return !field || field.trim().length === 0;
}

// Phone validation
export function validatePhoneNumber(phone) {
  if (!phone) return null;

  try {
    // Parse the number, will throw if invalid
    const number = phoneUtil.parseAndKeepRawInput(phone);

    if (!phoneUtil.isValidNumber(number)) return null;

    return phoneUtil.format(number, PNF.E164); // +216XXXXXXX
  } catch (err) {
    return null;
  }
}

// Basic URL validation
export const isValidURL = (url) => {
  if (!url) return true; // Optional field
  try {
    new URL(url);
    return true;
  } catch (_) {
    return false;
  }
}

// Length check (For the Bio)
export const isWithinRange = (str, min, max) => {
  if (!str) return true;
  return str.length >= min && str.length <= max;
}

// Generate a random secure password with the role code appended
export const generatePassword = (code, length = 12) => {
  const baseLength = length - code.length;
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*";
  const allChars = uppercase + lowercase + numbers + symbols;

  let password = "";

  // Ensure at least one of each required type for security
  password += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
  password += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
  password += numbers.charAt(Math.floor(Math.random() * numbers.length));
  password += symbols.charAt(Math.floor(Math.random() * symbols.length));

  // Fill the rest randomly
  for (let i = password.length; i < baseLength; i++) {
    password += allChars.charAt(Math.floor(Math.random() * allChars.length));
  }

  // Shuffle the random part so the required chars aren't always at the start
  const shuffledPreview = password.split('').sort(() => 0.5 - Math.random()).join('');

  return shuffledPreview + code;
}