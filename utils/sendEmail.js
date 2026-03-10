import nodemailer from "nodemailer";
import { wrapEmailContent } from "./emailLayout.js";
import {
  getAddUserContent,
  getUpdateUserContent,
  getResendOTPContent,
  getForgetPasswordValidationContent,
} from "./emailContent.js";

export const sendEmail = async ({
  to,
  subject,
  type,
  name,
  password,
  code,
  resetLink,
  newRole,
}) => {
  let bodyHtml;

  // Decide the content based on type
  switch (type) {
    case "addUser":
      bodyHtml = getAddUserContent({ name, password, code });
      break;

    case "updateUser":
      bodyHtml = getUpdateUserContent({ name, password, code, newRole });
      break;

    case "resendOTP":
      bodyHtml = getResendOTPContent({ name, code });
      break;

    case "forgetPasswordRequest":
      bodyHtml = getForgetPasswordValidationContent({ name, resetLink });
      break;

    default:
      bodyHtml = `<p>Default message</p>`;
  }

  const htmlContent = wrapEmailContent(bodyHtml);

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      auth: {
        user: process.env.ETHEREAL_USER,
        pass: process.env.ETHEREAL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"HRcoM" <${process.env.ETHEREAL_USER}>`,
      to,
      subject,
      html: htmlContent,
    });

    console.log("Onboarding email sent to:", to);
  } catch (err) {
    console.error("Email sending failed:", err.message);
  }
};
