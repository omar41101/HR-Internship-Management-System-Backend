// Imports
import User from "../models/User.js";
import UserRole from "../models/UserRole.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";
import dotenv from "dotenv";
import { sendEmail } from "../utils/sendEmail.js";
import AppError from "../utils/AppError.js";
import { sendError } from "../utils/ErrorFunctions.js";
import { isEmpty, generateRandomCode } from "../middleware/UserValidation.js";

dotenv.config();

// --------------------------------------------------------------------------- //
// -------------------------- HELPER FUNCTIONS ------------------------------- //
// --------------------------------------------------------------------------- //

// Validate if the user account is blocked or inactive
const validateUserStatus = (user) => {
  if (user.status === "Blocked" || user.status === "Inactive") {
    throw new AppError(
      `Your Account is ${user.status}. Please contact the Administration!`,
      403,
    );
  }
};

// Goal: Only show the face enrollment prompt only once on the first login.
const consumeFaceEnrollmentPrompt = (user) => {
  return user.faceEnrollmentPromptRequired === true;
};

// --------------------------------------------------------------------------- //
// ---------------------------- AUTH FUNCTIONS ------------------------------- //
// --------------------------------------------------------------------------- //

// Login Functionality
export const login = async (req, res, next) => {
  try {
    const { email, password, identifier } = req.body;
    const trimmedEmail = (email || identifier || "").trim().toLowerCase();
    const trimmedPassword = (password || "").trim();

    console.log(`[LOGIN-DEBUG] Login attempt for Email: ${trimmedEmail}`);

    // Check the User existence
    const user = await User.findOne({ email: trimmedEmail });

    if (!user) {
      throw new AppError(
        "User not found!",
        404,
        "Invalid Email or password provided!",
      );
    }

    // Check if status blocked or inactive
    validateUserStatus(user);

    // Get the user role (For the JWT token generation)
    const userRole = await UserRole.findById(user.role_id);
    if (!userRole) {
      throw new AppError("User role not found!", 404);
    }

    // Compare password - hashPassword in DB
    const isMatch = await bcrypt.compare(trimmedPassword, user.password);
    if (!isMatch) {
      console.log(`[LOGIN-DEBUG] Password mismatch for: ${trimmedEmail}`);

      user.loginAttempts += 1;

      // The user has 3 login attempts before account blockage
      if (user.loginAttempts >= 3) {
        user.status = "Blocked";
        // Skip full validation here in case legacy users
        // are missing newly required fields like idNumber.
        await user.save({ validateBeforeSave: false }); 
        throw new AppError(
          "Your Account is now Blocked. Please contact the Administration!",
          403,
        );
      }

      await user.save({ validateBeforeSave: false });

      throw new AppError(
        "Invalid Email or password!",
        401,
        "Please check your credentials and try again.",
      );
    }

    // For the Frontend, if the account is not verified, we redirect to the OTP code form
    if (user.status !== "Active") {
      return res.status(200).json({
        status: "Success but OTPVerificationRequired",
        message: "Account not verified!",
      });
    }

    // Before access the user's Dashboard, Reset the password if not already done
    if (user.mustResetPassword) {
      return res.status(200).json({
        status: "Success but MustResetPassword",
        message: "Please Reset your password before continuing!",
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, role: userRole.name },
      process.env.JWT_SECRET,
      { expiresIn: "10h" },
    );

    const requiresFaceEnrollment = consumeFaceEnrollmentPrompt(user);

    // Reset Login attempts
    user.loginAttempts = 0;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      status: "Success",
      message: "Logged in successfully!",
      result: {
        token,
        userId: user._id,
        role: userRole.name,
        requiresFaceEnrollment,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Verify User's OTP code
export const verifyUser = async (req, res, next) => {
  try {
    const { email, code } = req.body;

    // Check user existance
    const user = await User.findOne({ email });
    if (!user) throw new AppError("User not found!", 404);

    // Check if account status blocked or inactive
    validateUserStatus(user);

    if (user.status === "Active")
      throw new AppError("Account Already Verified!", 400);

    if (!(await bcrypt.compare(code, user.verificationCode))) {
      throw new AppError("Invalid OTP Code!", 400);
    }

    if (user.verificationCodeExpires < Date.now()) {
      throw new AppError("OTP Code expired!", 400);
    }

    // Activate the user account
    user.status = "Active";
    user.verificationCode = null;
    user.verificationCodeExpires = null;
    user.mustResetPassword = true;
    await user.save();

    const userRole = await UserRole.findById(user.role_id);
    const token = jwt.sign(
      { id: user._id, role: userRole?.name || "Employee" },
      process.env.JWT_SECRET,
      { expiresIn: "24h" },
    );

    const requiresFaceEnrollment = consumeFaceEnrollmentPrompt(user);
    await user.save();

    res.status(200).json({
      status: "Success",
      message: "Account Verified Successfully!",
      result: {
        token,
        userId: user._id,
        role: userRole?.name || "Employee",
        requiresPasswordChange: user.mustResetPassword,
        requiresFaceEnrollment,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Resend OTP Code
export const resendVerificationCode = async (req, res, next) => {
  try {
    const { email } = req.body;
    const trimmedEmail = (email || "").trim().toLowerCase();

    const user = await User.findOne({ email: trimmedEmail });
    if (!user) throw new AppError("User not found!", 404);

    validateUserStatus(user);

    if (user.status === "Active")
      throw new AppError("Account Already Verified!", 400);

    const today = new Date();
    const lastResend = user.resendDate ? new Date(user.resendDate) : null;

    if (!lastResend || today.toDateString() !== lastResend.toDateString()) {
      user.resendCount = 0;
      user.resendDate = today;
    }

    if (user.resendCount >= 3) {
      throw new AppError(
        "Maximum OTP resend limit reached for today (3). Try again tomorrow.",
        429,
      );
    }

    const otpCode = generateRandomCode(6);
    const hashedOTP = await bcrypt.hash(otpCode, 10);

    user.verificationCode = hashedOTP;
    user.verificationCodeExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    user.resendCount += 1;
    user.resendDate = today;
    await user.save();

    await sendEmail({
      to: user.email,
      subject: "HRcoM - New Verification Code",
      type: "resendOTP",
      name: user.name,
      code: otpCode,
    });

    return res.status(200).json({
      status: "Success",
      message: "OTP code resent successfully!",
    });
  } catch (err) {
    next(err);
  }
};

// Reset Password
export const resetPassword = async (req, res, next) => {
  try {
    const { email, newPassword } = req.body;

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) throw new AppError("User not found!", 404);

    validateUserStatus(user);

    if (!user.mustResetPassword) {
      throw new AppError("Password Reset not required for this account!", 400);
    }

    // Validate the new password
    if (isEmpty(newPassword)) throw new AppError("New Password Missing!", 400);

    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword)) {
      throw new AppError(
        "Password must be at least 8 characters long, and contain at least one capital letter!",
        400,
      );
    }

    // Hash the new password and reset the password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.mustResetPassword = false;
    const requiresFaceEnrollment = consumeFaceEnrollmentPrompt(user);
    await user.save();

    const userRole = await UserRole.findById(user.role_id);
    const token = jwt.sign(
      { id: user._id, role: userRole?.name || "Employee" },
      process.env.JWT_SECRET,
      { expiresIn: "24h" },
    );

    res.status(200).json({
      status: "Success",
      message: "Password Reset successfully!",
      result: {
        token,
        userId: user._id,
        role: userRole?.name || "Employee",
        requiresFaceEnrollment,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Forget Password Request
export const requestPasswordReset = async (req, res, next) => {
  try {
    const { email } = req.body;

    // Check user existance
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) throw new AppError("User not found!", 404);

    // Check if account status blocked or inactive
    validateUserStatus(user);

    // Generate a random unique token
    const token = crypto.randomBytes(32).toString("hex");
    console.log(
      `[FOREGET-PASSWORD-DEBUG] Password reset request for: ${user.email}: ${token}`,
    );
    user.resetPasswordToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000;
    await user.save();

    // Generate the password reset URL
    const resetURL = `${process.env.PLATFORM_URL}/reset-password?token=${token}&email=${user.email}`;

    await sendEmail({
      to: user.email,
      subject: "HRcoM Password Reset",
      type: "forgetPasswordRequest",
      name: user.name,
      resetLink: resetURL,
    });

    res.status(200).json({
      status: "Success",
      message: "Password reset link sent to your email!",
    });
  } catch (err) {
    next(err);
  }
};

// Forget Password Reset
export const forgetPassword = async (req, res, next) => {
  try {
    const { email, token, newPassword } = req.body;
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user)
      return sendError(res, "Invalid or Expired password reset token!");

    // Check if account status blocked or inactive
    if (validateUserStatus(user, res)) return;

    // Validate the new password
    if (isEmpty(newPassword)) return sendError(res, "Missing Password!");

    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword)) {
      return sendError(
        res,
        "Password must be at least 8 characters long, and contain at least one capital letter!",
      );
    }

    // Hash the new password and reset the password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    user.status = "Active";
    user.mustResetPassword = false;
    const requiresFaceEnrollment = consumeFaceEnrollmentPrompt(user);
    await user.save();

    const userRole = await UserRole.findById(user.role_id);
    const tokenGen = jwt.sign(
      { id: user._id, role: userRole?.name || "Employee" },
      process.env.JWT_SECRET,
      { expiresIn: "24h" },
    );

    res.status(200).json({
      status: "Success",
      message: "Password Reset Successfully!",
      result: {
        token: tokenGen,
        userId: user._id,
        role: userRole?.name || "Employee",
        requiresFaceEnrollment,
      },
    });
  } catch (err) {
    res.status(500).json({
      status: "Error",
      message: err.message,
    });
  }
};
