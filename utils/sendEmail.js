import nodemailer from "nodemailer";

export const sendOnboardingEmail = async (to, name, password) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const html = `
      <div style="font-family: Arial; padding: 20px;">
        <h2>Welcome to HRcoM, ${name}!</h2>

        <p>Your account has been added successfully!</p>
        
        <p><strong>Your Login Email:</strong> ${to}</p>
        <p><strong>Your Password:</strong> ${password}</p>

        <br>
        Access the Platform via this link: <a href="${process.env.PLATFORM_URL}"
          style="display:inline-block; background:#4CAF50; color:#fff; padding:12px 20px; text-decoration:none; border-radius:5px;"> 
        </a>

        <br><br>

        <p>Best regards,<br>HRcoM</p>
      </div>
    `;

    await transporter.sendMail({
      from: `"HRcoM" <${process.env.SMTP_USER}>`,
      to,
      subject: "Your Account Login Details",
      html,
    });

    console.log("Onboarding email sent to:", to);
  } catch (err) {
    console.error("Email sending failed:", err.message);
  }
};