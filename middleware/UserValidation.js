import { passportRules } from "./passportRules.js";
import pkg from "google-libphonenumber";
const { PhoneNumberUtil, PhoneNumberFormat } = pkg;

const phoneUtil = PhoneNumberUtil.getInstance();
const PNF = PhoneNumberFormat;

// Email validation with Regex method
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Check if a field is empty (handles whitespace)
export const isEmpty = (field) => {
  return !field || field.trim().length === 0;
}

// Phone number validation 
export const validatePhoneNumber = (code, number) => {
  if (!number) return null;
  console.log(`[Phone-Validation-Start] Code: ${code}, Number: ${number}`);
  try {
    let phoneNumber;
    if (number.startsWith("+")) {
      phoneNumber = phoneUtil.parseAndKeepRawInput(number);
    } else {
      phoneNumber = phoneUtil.parseAndKeepRawInput(number, code || "TN");
    }

    const nationalNumber = phoneNumber.getNationalNumber().toString();
    const digitCount = nationalNumber.length;
    console.log(`[Phone-Validation-Process] National: ${nationalNumber}, Count: ${digitCount}`);

    if (digitCount < 5 || digitCount > 15) {
      console.warn(`[Phone-Validation-FAIL] Invalid digit count: ${digitCount}`);
      return null;
    }

    const formatted = phoneUtil.format(phoneNumber, PNF.E164);
    console.log(`[Phone-Validation-SUCCESS] Result: ${formatted}`);
    return formatted;
  } catch (error) {
    console.error("[Phone-Validation-ERROR]", error.message);
    return null;
  }
};

// Tunisian CIN validation
export const validateCIN = (cin) => {
  const cinRegex = /^[0-1][0-9]{7}$/;
  return cinRegex.test(cin);
}

// Passport validation based on country-specific rules
export const validatePassport = (passportNumber, countryCode) => {
  if (!passportNumber || !countryCode) return false;

  // Normalize Input
  passportNumber = passportNumber.trim().toUpperCase();

  const rule = passportRules[countryCode];

  if (!rule) {
    // Fallback for unknown countries (Generic Rules)
    return /^[A-Z0-9]{6,9}$/.test(passportNumber);
  }

  return rule.test(passportNumber);
};

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
