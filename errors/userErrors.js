// User expected errors
export const errors = {
  // USER_NOT_FOUND is in commonErrors.js (Reason: Used in multiple services)
  USER_ALREADY_EXISTS: {
    message: "User already exists",
    code: 409,
    errorCode: "USER_ALREADY_EXISTS",
    suggestion: "Please use different credentials.",
  },
  FIRST_NAME_REQUIRED: {
    message: "First name is required",
    code: 400,
    errorCode: "FIRST_NAME_REQUIRED",
    suggestion: "Please provide the user's first name.",
  },
  LAST_NAME_REQUIRED: {
    message: "Last name is required",
    code: 400,
    errorCode: "LAST_NAME_REQUIRED",
    suggestion: "Please provide the user's last name.",
  },
  ADDRESS_REQUIRED: {
    message: "Address is required",
    code: 400,
    errorCode: "ADDRESS_REQUIRED",
    suggestion: "Please provide the user's address.",
  },
  POSITION_REQUIRED: {
    message: "Position is required",
    code: 400,
    errorCode: "POSITION_REQUIRED",
    suggestion: "Please provide the user's position.",
  },
  INVALID_EMAIL_FORMAT: {
    message: "Invalid Email format",
    code: 400,
    errorCode: "INVALID_EMAIL_FORMAT",
    suggestion: "Please enter a valid email address.",
  },
  EMAIL_UNAVAILABLE: {
    message: "Email is not available",
    code: 409,
    errorCode: "EMAIL_UNAVAILABLE",
    suggestion: "Please use a different email address.",
  },
  INVALID_SUPERVISOR_EMAIL_FORMAT: {
    message: "Invalid Supervisor Email format",
    code: 400,
    errorCode: "INVALID_SUPERVISOR_EMAIL_FORMAT",
    suggestion: "Please enter a valid supervisor email address.",
  },
  BIO_TOO_LONG: {
    message: "Bio must be under 500 characters",
    code: 400,
    errorCode: "BIO_TOO_LONG",
    suggestion: "Please shorten the bio to under 500 characters.",
  },
  INVALID_NUMBER_OF_CHILDREN: {
    message: "Invalid Number of children",
    code: 400,
    errorCode: "INVALID_NUMBER_OF_CHILDREN",
    suggestion: "Please specify a valid number of children.",
  },
  INVALID_BONUS: {
    message: "Invalid bonus value",
    code: 400,
    errorCode: "INVALID_BONUS",
    suggestion: "Please enter a valid bonus value.",
  },
  INVALID_PHONE_NUMBER: {
    message: "Invalid phone number",
    code: 400,
    errorCode: "INVALID_PHONE_NUMBER",
    suggestion: "Please enter a valid phone number.",
  },
  PHONE_NUMBER_UNAVAILABLE: {
    message: "Phone number is not available",
    code: 409,
    errorCode: "PHONE_NUMBER_UNAVAILABLE",
    suggestion: "Please use a different phone number.",
  },
  INVALID_ID_TYPE: {
    message: "ID Type must be either CIN or Passport!",
    code: 400,
    errorCode: "INVALID_ID_TYPE",
    suggestion: "Please specify a valid ID type (Passport or CIN).",
  },
  INVALID_CIN_FORMAT: {
    message: "Invalid CIN format",
    code: 400,
    errorCode: "INVALID_CIN_FORMAT",
    suggestion: "Please enter a valid CIN.",
  },
  INVALID_COUNTRY_CODE: {
    message: "Invalid country code",
    code: 400,
    errorCode: "INVALID_COUNTRY_CODE",
    suggestion: "Please enter a valid country code.",
  },
  INVALID_PASSPORT_FORMAT: {
    message: "Invalid Passport format",
    code: 400,
    errorCode: "INVALID_PASSPORT_FORMAT",
    suggestion:
      "Please enter a valid Passport number according to the specified country's format.",
  },
  UNAVAILABLE_ID_NUMBER: {
    message: "ID number is not available",
    code: 409,
    errorCode: "UNAVAILABLE_ID_NUMBER",
    suggestion: "Please use a different ID number.",
  },
  SUPERVISOR_NOT_FOUND: {
    message: "Supervisor not found",
    code: 404,
    errorCode: "SUPERVISOR_NOT_FOUND",
    suggestion: "Please check the validity of the supervisor.",
  },
  ROLE_NOT_FOUND: {
    message: "Role not found",
    code: 404,
    errorCode: "ROLE_NOT_FOUND",
    suggestion: "Please check the validity of the role.",
  },
  DEPARTMENT_NOT_FOUND: {
    message: "Department not found",
    code: 404,
    errorCode: "DEPARTMENT_NOT_FOUND",
    suggestion: "Please check the validity of the department.",
  },
  MISSING_FACE_DESCRIPTORS: {
    message: "Missing face descriptors",
    code: 400,
    errorCode: "MISSING_FACE_DESCRIPTORS",
    suggestion: "Please provide valid face descriptors for enrollment.",
  },
};
