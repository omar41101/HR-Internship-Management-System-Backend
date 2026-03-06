// --- This file contains the personalized content of the emails sent by the system. --- //

// Email of adding a new user
export const getAddUserContent = ({ name, password, code }) => {
  return `
    <h2>Welcome to HRcoM!</h2>

    <p>Dear ${name},</p>
    <p>We are truly excited to have you on board among us in HRcoM!</p>
    <p>Your account has been created successfully! Please use the following credentials to login:</p>
    <p><strong>Password:</strong> ${password}</p>
    <p><strong>OTP Code:</strong> ${code}</p>
    <p><strong>Platform URL:</strong> ${process.env.PLATFORM_URL}</p>

    <p> <strong> Please note that for security reasons, this verification code will expire in 24 hours! </strong> </p>
    </br>
  
    <p> <strong> Next Steps: </strong> </p>
    <p> 
      1. Go to the HRcoM platform. </br>
      2. Log in using your email and the temporary password provided above. </br>
      3. Enter the verification code when prompted to activate your account. </br>
      4. Reset your password. </br>
    </p>

    <p> <strong> Important Notes: </strong> </p>
    <p>
      - Do not share this email or your credentials with anyone. </br>
      - After logging in, you have to reset your password. 
    </p>
  `;
};

// Email of updating an existing user if the role is changed
export const getUpdateUserContent = ({ name, password, code }) => {
  return `
    <h2>Welcome back to HRcoM!</h2>

    <p>Dear ${name},</p>
    <p>We are pleased to inform you that your account has been updated!</p>
    <p>Please use the following credentials to login:</p>
    <p><strong>Password:</strong> ${password}</p>
    <p><strong>OTP Code:</strong> ${code}</p>
    <p><strong>Platform URL:</strong> ${process.env.PLATFORM_URL}</p>
    </br>

    <h3>Once you login, you need to re-enter the OTP Code and reset the password for security reasons!</h3>
  `;
};

// Email of resending OTP code
export const getResendOTPContent = ({ name, code }) => {
  return `
    <p> Dear ${name},</p>
    <p>You requested a new verification code to activate your HRcoM account.</p>
    <p>Your new verification code is:</p>
    <p><strong>OTP Code: </strong> ${code}</p>

    Please note that this code will expire in 24 hours!
  `;
};
