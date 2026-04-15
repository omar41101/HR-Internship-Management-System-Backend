// Validator functions that concern the userService 
import { passportRules } from "../constants/idRules.js";
import { countries } from "../constants/countries.js";
import AppError from "../utils/AppError.js";
import { errors } from "../errors/userErrors.js";
import pkg from "google-libphonenumber";
const { PhoneNumberUtil, PhoneNumberFormat } = pkg;

const phoneUtil = PhoneNumberUtil.getInstance();
const PNF = PhoneNumberFormat;

// Email validation with Regex 
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Check if a field is empty
export const isEmpty = (field) => {
  return !field || field.trim().length === 0;
};

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
    const regionCode = phoneUtil.getRegionCodeForNumber(phoneNumber) || code || "TN";

    // Special Validation of Tunisian phone numbers (must start with 2,4,5,9 and be 8 digits)
    if (regionCode === "TN") {
      const tunisianPhoneRegex = /^[2459][0-9]{7}$/;
      if (!tunisianPhoneRegex.test(nationalNumber)) {
        throw new AppError(
            errors.INVALID_PHONE_NUMBER.message,
            errors.INVALID_PHONE_NUMBER.code,
            errors.INVALID_PHONE_NUMBER.errorCode,
            errors.INVALID_PHONE_NUMBER.suggestion
        );
      }
    }

    const digitCount = nationalNumber.length;
    console.log(
      `[Phone-Validation-Process] National: ${nationalNumber}, Count: ${digitCount}`,
    );

    if (digitCount < 5 || digitCount > 15) {
      console.warn(
        `[Phone-Validation-FAIL] Invalid digit count: ${digitCount}`,
      );
      return null;
    }

    const formatted = phoneUtil.format(phoneNumber, PNF.E164);
    console.log(`[Phone-Validation-SUCCESS] Result: ${formatted}`);
    return formatted;
  } catch (error) {
    // if (error instanceof AppError) {
    //   throw error;
    // }
    // console.error("[Phone-Validation-ERROR]", error.message);
    // return null;
    // next(error);
  }
};

// Full phone number validation (format + error throwing in case of an invalid format)
export const fullPhoneNumberValidation = (countryCode, phoneNumber) => {
  const validatedPhoneNumber = validatePhoneNumber(countryCode, phoneNumber);

  if (!validatedPhoneNumber) {
    throw new AppError(
      errors.INVALID_PHONE_NUMBER.message,
      errors.INVALID_PHONE_NUMBER.code,
      errors.INVALID_PHONE_NUMBER.errorCode,
      errors.INVALID_PHONE_NUMBER.suggestion
    );
  }

  return validatedPhoneNumber;
};

// Length check (For the Bio)
export const isWithinRange = (str, min, max) => {
  if (!str) return true;
  return str.length >= min && str.length <= max;
};

// Add/Update common user validation (These fields don't require DB checks)
export const validateUserData = (data) => {
  const {
    name,
    lastName,
    trimmedEmail,
    trimmedSupervisorEmail,
    address,
    position,
    bonus,
    bio,
    hasChildren,
    nbOfChildren,
  } = data;

  // Validate the input fields
  if (name && isEmpty(name)) throw new AppError(
    errors.FIRST_NAME_REQUIRED.message,
    errors.FIRST_NAME_REQUIRED.code,
    errors.FIRST_NAME_REQUIRED.errorCode,
    errors.FIRST_NAME_REQUIRED.suggestion
  );

  if (lastName && isEmpty(lastName)) throw new AppError(
    errors.LAST_NAME_REQUIRED.message,
    errors.LAST_NAME_REQUIRED.code,
    errors.LAST_NAME_REQUIRED.errorCode,
    errors.LAST_NAME_REQUIRED.suggestion
  );

  if (address && isEmpty(address)) throw new AppError(
    errors.ADDRESS_REQUIRED.message,
    errors.ADDRESS_REQUIRED.code,
    errors.ADDRESS_REQUIRED.errorCode,
    errors.ADDRESS_REQUIRED.suggestion
  );

  if (position && isEmpty(position)) throw new AppError(
    errors.POSITION_REQUIRED.message,
    errors.POSITION_REQUIRED.code,
    errors.POSITION_REQUIRED.errorCode,
    errors.POSITION_REQUIRED.suggestion
  );

  if (trimmedEmail && !isValidEmail(trimmedEmail)) throw new AppError(
    errors.INVALID_EMAIL_FORMAT.message,
    errors.INVALID_EMAIL_FORMAT.code,
    errors.INVALID_EMAIL_FORMAT.errorCode,
    errors.INVALID_EMAIL_FORMAT.suggestion
  );

  if (trimmedSupervisorEmail && !isValidEmail(trimmedSupervisorEmail)) throw new AppError(
    errors.INVALID_SUPERVISOR_EMAIL_FORMAT.message,
    errors.INVALID_SUPERVISOR_EMAIL_FORMAT.code,
    errors.INVALID_SUPERVISOR_EMAIL_FORMAT.errorCode,
    errors.INVALID_SUPERVISOR_EMAIL_FORMAT.suggestion
  );
  
  if (bio && !isWithinRange(bio, 0, 500))
    throw new AppError(
      errors.BIO_TOO_LONG.message,
      errors.BIO_TOO_LONG.code,
      errors.BIO_TOO_LONG.errorCode,
      errors.BIO_TOO_LONG.suggestion
    );

  if (hasChildren && nbOfChildren <= 0)
    throw new AppError(
      errors.INVALID_NUMBER_OF_CHILDREN.message,
      errors.INVALID_NUMBER_OF_CHILDREN.code,
      errors.INVALID_NUMBER_OF_CHILDREN.errorCode,
      errors.INVALID_NUMBER_OF_CHILDREN.suggestion
    );

  if (bonus && bonus < 0) throw new AppError(
    errors.INVALID_BONUS.message,
    errors.INVALID_BONUS.code,
    errors.INVALID_BONUS.errorCode,
    errors.INVALID_BONUS.suggestion
  );
};

// Tunisian CIN validation
export const validateCIN = (cin) => {
  const cinRegex = /^[0-1][0-9]{7}$/;
  return cinRegex.test(cin);
};

// Passport validation based on country-specific rules
export const validatePassport = (passportNumber, countryCode) => {
  if (!passportNumber || !countryCode) return false;

  // Normalize Input
  passportNumber = passportNumber.trim().toUpperCase();

  const ruleObj = passportRules[countryCode] || passportRules.GENERIC;
  return ruleObj.regex.test(passportNumber);
};

// Get Passport hint/description for a country (For frontend purposes)
export const getPassportHint = (countryCode) => {
  const ruleObj = passportRules[countryCode] || passportRules.GENERIC;
  return ruleObj.description;
};

// Full CIN/Passport validation helper function (format + uniqueness)
export const fullCINPassportValidation = (idType, idCountryCode, trimmedIdNumber, userId = null) => {
  // Check ID type validity
  if (!["CIN", "Passport"].includes(idType)) {
    throw new AppError(
      errors.INVALID_ID_TYPE.message,
      errors.INVALID_ID_TYPE.code,
      errors.INVALID_ID_TYPE.errorCode,
      errors.INVALID_ID_TYPE.suggestion
    );
  }
  // Check the validity of IdNumber based on the ID type
  switch (idType) {
    case "CIN":
      if (!validateCIN(trimmedIdNumber)) {
        throw new AppError(
          errors.INVALID_CIN_FORMAT.message,
          errors.INVALID_CIN_FORMAT.code,
          errors.INVALID_CIN_FORMAT.errorCode,
          errors.INVALID_CIN_FORMAT.suggestion
        );
      }
      break;

    case "Passport":
      if (!idCountryCode || !countries.some((c) => c.code === idCountryCode)) {
        throw new AppError(
          errors.INVALID_COUNTRY_CODE.message,
          errors.INVALID_COUNTRY_CODE.code,
          errors.INVALID_COUNTRY_CODE.errorCode,
          errors.INVALID_COUNTRY_CODE.suggestion
        );
      }
      if (!validatePassport(trimmedIdNumber, idCountryCode)) {
        const hint = getPassportHint(idCountryCode);
        throw new AppError(
          errors.INVALID_PASSPORT_FORMAT.message + (hint ? ` (${hint})` : ""),
          errors.INVALID_PASSPORT_FORMAT.code,
          errors.INVALID_PASSPORT_FORMAT.errorCode,
          errors.INVALID_PASSPORT_FORMAT.suggestion
        );
      }
      break;
  }
};
