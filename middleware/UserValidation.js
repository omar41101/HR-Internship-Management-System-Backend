// Email validation with Regex method
export const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Check if a field is empty
export const isEmpty = (field) => {
    return field.length == 0;
}