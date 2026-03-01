// Email validation with Regex method
export const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Check if a field is empty
export const isEmpty = (field) => {
    return field.length == 0;
}

// Generate a random password with the code
export const generatePassword = (code, length = 7) => {
  const baseLength = length - code.length;
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let password = "";

  for (let i = 0; i < baseLength; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return password + code;
}