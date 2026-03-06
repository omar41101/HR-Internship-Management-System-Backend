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
export function validatePhoneNumber(code, number) {
  if (!code || !number) return null;

  try {
    // Combine the country code + phone number
    const fullPhoneNumber = `${code}${number}`;

    // Parse the number
    const parsed = phoneUtil.parseAndKeepRawInput(fullPhoneNumber);

    // Check validity
    if (!phoneUtil.isValidNumber(parsed)) return null;

    // Return formatted E.164 number (Ex: +21612345678)
    return phoneUtil.format(parsed, PNF.E164);
  } catch (err) {
    return null;
  }
}

// Basic URL validation (For the profile image urls)
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

// Random Code Generator (Password or OTP code generation)
export const generateRandomCode = (length = 8) => {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*";
  const allChars = uppercase + lowercase + numbers + symbols;

  let randomCode = "";

  // Ensure at least one of each required type for security
  randomCode += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
  randomCode += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
  randomCode += numbers.charAt(Math.floor(Math.random() * numbers.length));
  randomCode += symbols.charAt(Math.floor(Math.random() * symbols.length));

  // Fill the rest randomly
  for (let i = randomCode.length; i < length; i++) {
    randomCode += allChars.charAt(Math.floor(Math.random() * allChars.length));
  }

  // Shuffle the random part so the required chars aren't always at the start
  const shuffledCode = randomCode.split('').sort(() => 0.5 - Math.random()).join('');

  return shuffledCode;
}