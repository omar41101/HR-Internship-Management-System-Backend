// --- This file contains the personalized content of the emails sent by the system. --- //

// Email of adding a new user
export const getAddUserContent = ({ name, password }) => {
  return `
    <h2>Welcome to HRcoM!</h2>

    <p>Dear ${name},</p>
    <p>We are truly excited to have you on board among us in HRcoM!</p>
    <p>Your account has been created successfully! Please use the following credentials to login:</p>
    <p><strong>Password:</strong> ${password}</p>
    <p><strong>Platform URL:</strong> ${process.env.PLATFORM_URL}</p>
    </br>

    <h3>Once you login, you need to change your password for security reasons!</h3>
  `;
};

// Email of updating an existing user if the role is changed
export const getUpdateUserContent = ({ name, password }) => {
  return `
    <h2>Welcome back to HRcoM!</h2>

    <p>Dear ${name},</p>
    <p>We are pleased to inform you that your account has been updated!</p>
    <p>Please use the following credentials to login:</p>
    <p><strong>Password:</strong> ${password}</p>
    <p><strong>Platform URL:</strong> ${process.env.PLATFORM_URL}</p>
    </br>

    <h3>Once you login, you need to change your password for security reasons!</h3>
  `;
};

