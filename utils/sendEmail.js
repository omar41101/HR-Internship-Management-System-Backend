import nodemailer from "nodemailer";
import { wrapEmailContent } from "./emailLayout.js";
import { getAddUserContent, getUpdateUserContent } from "./emailContent.js";

export const sendEmail = async ({ to, subject, type, name, password }) => {
  let bodyHtml;

  // Decide the content based on type
  if (type === "addUser") bodyHtml = getAddUserContent({ name, password });
  else if (type === "updateUser")
    bodyHtml = getUpdateUserContent({ name, password });
  else bodyHtml = `<p>Default message</p>`;

  const htmlContent = wrapEmailContent(bodyHtml);

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: 587,
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    await transporter.sendMail({
      from: `"HRcoM" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html: htmlContent,
    });

    console.log("Onboarding email sent to:", to);
  } catch (err) {
    console.error("Email sending failed:", err.message);
  }
};
