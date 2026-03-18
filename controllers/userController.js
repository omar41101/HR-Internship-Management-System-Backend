// Importations
import {
  uploadImageToCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinaryHelper.js";
import User from "../models/User.js";
import UserRole from "../models/UserRole.js";
import Department from "../models/Department.js";
import Document from "../models/Document.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { sendEmail } from "../utils/sendEmail.js";
import { Parser } from "json2csv";
import ExcelJS from "exceljs";
import crypto from "crypto";
import {
  isValidEmail,
  isEmpty,
  validatePhoneNumber,
  isWithinRange,
  generateRandomCode,
  validateCIN,
  validatePassport,
} from "../middleware/UserValidation.js";
import { countries } from "../middleware/countries.js"; // List of countries with their codes
import { logAuditAction } from "../utils/logger.js";
import AppError from "../utils/AppError.js";

dotenv.config();

// --------------------------------------------------------------------------- //
// -------------------------- HELPER FUNCTIONS ------------------------------- //
// --------------------------------------------------------------------------- //

const sendError = (res, message, code = 400) => {
  return res.status(code).json({ status: "Error", message });
};

const handleError = (res, err) => {
  console.error(err);
  return res.status(500).json({ status: "Error", message: err.message });
};

const validateUserStatus = (user) => {
  if (user.status === "Blocked" || user.status === "Inactive") {
    throw new AppError(
      `Your Account is ${user.status}. Please contact the Administration!`,
      403,
    );
  }
};

// --------------------------------------------------------------------------- //
// ---------------------------------- AUTH ----------------------------------- //
// --------------------------------------------------------------------------- //

// Login Functionality (All users can do it)
export const login = async (req, res, next) => {
  try {
    const { email, identifier: idFromReq, password } = req.body;
    const identifier = (idFromReq || email || "").trim().toLowerCase();
    const trimmedPassword = (password || "").trim();

    console.log(`[LOGIN-DEBUG] Login attempt for identifier: ${identifier}`);

    // Check the User existence by Email or CIN/Passport number
    const user = await User.findOne({
      $or: [
        { email: identifier },
        { "idNumber.number": identifier }
      ]
    });

    if (!user) {
      throw new AppError(
        "User not found!",
        404,
        "Verify that you have used the correct email address or ID number.",
      );
    }

    // Check if status blocked or inactive
    validateUserStatus(user);

    // Get the user role
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
        await user.save();
        throw new AppError(
          "Your Account is now Blocked. Please contact the Administration!",
          403,
        );
      }

      await user.save();

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
      { expiresIn: "24h" },
    );

    // Reset Login attempts
    user.loginAttempts = 0;
    await user.save();

    res.status(200).json({
      status: "Success",
      message: "Logged in successfully!",
      result: {
        token,
        userId: user._id,
        role: userRole.name,
        requiresFaceEnrollment: !user.faceEnrolled,
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

    const user = await User.findOne({ email });
    if (!user) throw new AppError("User not found!", 404);

    validateUserStatus(user);

    if (user.status === "Active")
      throw new AppError("Account Already Verified!", 400);

    if (!(await bcrypt.compare(code, user.verificationCode))) {
      throw new AppError("Invalid OTP Code!", 400);
    }

    if (user.verificationCodeExpires < Date.now()) {
      throw new AppError("OTP Code expired!", 400);
    }

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

    res.status(200).json({
      status: "Success",
      message: "Account Verified Successfully!",
      result: {
        token,
        userId: user._id,
        role: userRole?.name || "Employee",
        requiresPasswordChange: user.mustResetPassword,
        requiresFaceEnrollment: !user.faceEnrolled,
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
      subject: "HRcoM – New Verification Code",
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

    if (isEmpty(newPassword)) throw new AppError("New Password Missing!", 400);

    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword)) {
      throw new AppError(
        "Password must be at least 8 characters long, and contain at least one capital letter!",
        400,
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.mustResetPassword = false;
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
        requiresFaceEnrollment: !user.faceEnrolled,
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

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) throw new AppError("User not found!", 404);

    validateUserStatus(user);

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

    if (validateUserStatus(user, res)) return;

    if (isEmpty(newPassword)) return sendError(res, "Missing Password!");

    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword)) {
      return sendError(
        res,
        "Password must be at least 8 characters long, and contain at least one capital letter!",
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    user.status = "Active";
    user.mustResetPassword = false;
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
        requiresFaceEnrollment: !user.faceEnrolled,
      },
    });
  } catch (err) {
    res.status(500).json({
      status: "Error",
      message: err.message,
    });
  }
};

// --------------------------------------------------------------------------- //
// ----------------------------- USER MANAGEMENT ----------------------------- //
// --------------------------------------------------------------------------- //

// Add User Functionnality (Only the Admin can do it)
export const addUser = async (req, res, next) => {
  try {
    const {
      name,
      lastName,
      email,
      idType, // Passport or CIN
      idCountryCode, // Passport or CIN country code
      idNumber, // Passport or CIN number
      address,
      joinDate,
      countryCode, // Country code for the phone number
      phoneNumber,
      position,
      bonus,
      bio,
      leaveBalance,
      socialStatus,
      hasChildren,
      nbOfChildren,
      status, // Select List (Pending, Active, Inactive, Blocked)
      isAvailable,
      role,
      department,
      supervisor_full_name,
      profileImageURL,
    } = req.body;

    const trimmedEmail = (email || "").trim().toLowerCase();
    const trimmedIdNumber = (idNumber || "").trim();

    // Check user existence
    console.log(
      `[ADD-USER-DEBUG] Checking if user already exists: ${trimmedEmail} - ${trimmedIdNumber}`,
    );
    const existingUser = await User.findOne({
      $or: [{ email: trimmedEmail }, { "idNumber.number": trimmedIdNumber }],
    });
    if (existingUser) return sendError(res, "User Already Existing!", 401);

    console.log(
      `[ADD-USER-DEBUG] User does not exist, proceeding with creation!`,
    );

    // Validate the field inputs
    const errors = [];

    if (isEmpty(name))
      errors.push({ field: "name", message: "First name is required" });
    if (isEmpty(lastName))
      errors.push({ field: "lastName", message: "Last name is required" });
    if (isEmpty(address))
      errors.push({ field: "address", message: "Address is required" });
    if (isEmpty(position))
      errors.push({ field: "position", message: "Position is required" });

    if (!isValidEmail(email))
      errors.push({ field: "email", message: "Invalid email format" });
    if (validatePhoneNumber(countryCode, phoneNumber) === null) {
      errors.push({
        field: "phoneNumber",
        message: "Invalid phone number format",
      });
    }

    // CIN/Passport validation
    if (!["CIN", "Passport"].includes(idType)) {
      errors.push({
        field: "idType",
        message: "ID Type must be either CIN or Passport!",
      });
    }

    // P.S: The country code for the CIN is automatically = "TN"
    switch (idType) {
      case "CIN":
        if (!validateCIN(trimmedIdNumber)) {
          errors.push({ field: "idNumber", message: "Invalid CIN format!" });
        }
        break;

      case "Passport":
        if (
          !idCountryCode ||
          !countries.some((c) => c.code === idCountryCode)
        ) {
          errors.push({
            field: "idCountryCode",
            message: "Invalid country code for Passport!",
          });
        } else if (!validatePassport(trimmedIdNumber, idCountryCode)) {
          errors.push({
            field: "idNumber",
            message:
              "Invalid Passport format for the specified country: " +
              idCountryCode +
              "!",
          });
        }
        break;
    }

    if (bio && !isWithinRange(bio, 0, 500))
      errors.push({
        field: "bio",
        message: "Bio must be under 500 characters",
      });

    if (hasChildren && nbOfChildren <= 0)
      errors.push({
        field: "nbOfChildren",
        message: "Please specify the number of children",
      });
    if (nbOfChildren < 0)
      errors.push({
        field: "nbOfChildren",
        message: "Number of children cannot be negative",
      });
    if (bonus < 0)
      errors.push({ field: "bonus", message: "Bonus cannot be negative" });

    if (errors.length > 0) {
      console.log("[ADD-USER-DEBUG] Validation failed with errors:", errors);

      throw new AppError("Input validation failed!", 400, errors);
    }

    // Check Role validity
    const userrole = await UserRole.findOne({
      name: { $regex: new RegExp(`^${role}$`, "i") },
    });
    if (!userrole) throw new AppError("Invalid Role!", 400);

    // Get the role ID
    const roleId = userrole._id;
    console.log(`[ADD-USER-DEBUG] Role found: ${userrole.name} (${roleId})`);

    // --- Supervisor is now optional for the Intern and Employee (can use "Not assigned yet") ---
    // Check the validity of the supervisor
    let supervisorId = null;

    if (
      supervisor_full_name &&
      typeof supervisor_full_name === "string" &&
      supervisor_full_name.trim() !== "" &&
      supervisor_full_name !== "Not assigned yet"
    ) {
      console.log(
        `[ADD-USER-DEBUG] Attempting to look up supervisor: "${supervisor_full_name}"`,
      );

      const parts = supervisor_full_name.trim().split(/\s+/);
      const supervisor_name = parts[0];
      const supervisor_lastName = parts.slice(1).join(" ");

      const supervisor = await User.findOne({
        name: supervisor_name,
        lastName: supervisor_lastName,
      });

      if (!supervisor) throw new AppError("Supervisor not found!", 404);
      supervisorId = supervisor._id; // Get the supervisor ID
      console.log(`[ADD-USER-DEBUG] Supervisor found: ${supervisorId}`);
    } else {
      console.log(
        `[ADD-USER-DEBUG] Skipping supervisor lookup (name is empty or N/A)`,
      );
    }

    // Check the validity of the department
    let departmentId = null;

    if (department && department !== "Unassigned" && department !== "all") {
      const userdepartment = await Department.findOne({
        name: { $regex: new RegExp(`^${department}$`, "i") },
      });

      if (!userdepartment) throw new AppError("Invalid Department!", 400);
      departmentId = userdepartment._id; // Get the department ID
      console.log(
        `[ADD-USER-DEBUG] Department found: ${userdepartment.name} (${departmentId})`,
      );
    }

    // Get the full validated Phone number
    const validatedPhoneNumber = validatePhoneNumber(countryCode, phoneNumber);

    // Generate password (length = 8)
    const password = generateRandomCode();
    console.log(`[ADD-USER-DEBUG] Password generated: ${password}`);

    // Generate OTP code (length = 6)
    const otpCode = generateRandomCode(6);
    console.log(`[ADD-USER-DEBUG] OTP code generated: ${otpCode}`);

    // Hash Password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Hash OTP code
    const hashedOTP = await bcrypt.hash(otpCode, 10);

    // Handle profile image upload if provided as base64
    let finalProfileImageURL =
      typeof profileImageURL === "string" &&
      !profileImageURL.startsWith("data:image")
        ? profileImageURL
        : "";

    if (
      profileImageURL &&
      typeof profileImageURL === "string" &&
      profileImageURL.startsWith("data:image")
    ) {
      try {
        console.log(
          `[ADD-USER-DEBUG] Detected base64 image, uploading to Cloudinary...`,
        );
        const uploadResult = await uploadImageToCloudinary(
          profileImageURL,
          "hrcom/profile_images",
        );

        if (uploadResult && uploadResult.secure_url) {
          finalProfileImageURL = uploadResult.secure_url;
          console.log(
            `[ADD-USER-DEBUG] Upload success: ${finalProfileImageURL}`,
          );
        } else {
          console.error(
            "[ADD-USER-DEBUG] Upload result missing secure_url:",
            uploadResult,
          );
        }
      } catch (uploadErr) {
        console.error(
          "[ADD-USER-DEBUG] Cloudinary upload failed:",
          uploadErr.message,
        );
      }
    } else {
      console.log(
        `[ADD-USER-DEBUG] No base64 image detected in req.body.profileImageURL`,
      );
    }

    // Create user
    console.log(`[ADD-USER-DEBUG] Creating user in DB...`);
    const user = await User.create({
      name,
      lastName,
      email: trimmedEmail,
      idType,
      idNumber: {
        number: trimmedIdNumber,
        countryCode: idCountryCode,
      },
      password: hashedPassword,
      verificationCode: hashedOTP,
      verificationCodeExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      address,
      joinDate,
      phoneNumber: validatedPhoneNumber,
      position,
      bonus,
      bio,
      leaveBalance,
      socialStatus,
      hasChildren,
      nbOfChildren,
      status: status || "Pending",
      isAvailable,
      role_id: roleId,
      department_id: departmentId,
      supervisor_id: supervisorId,
      profileImageURL: finalProfileImageURL,
    });
    console.log(`[ADD-USER-DEBUG] User created successfully! ID: ${user._id}`);

    // Send Email to the User containing his password + OTP Code + Platform URL
    try {
      console.log(
        `[ADD-USER-DEBUG] Sending onboarding email to: ${trimmedEmail}`,
      );

      await sendEmail({
        to: user.email,
        subject: "Welcome to HRcoM! - Your Account Details",
        type: "addUser",
        name: user.name,
        password: password,
        code: otpCode,
      });

      console.log(`[ADD-USER-DEBUG] Email sent successfully.`);
    } catch (emailErr) {
      console.log(
        `[ADD-USER-DEBUG] EMAIL FAILED but user created:`,
        emailErr.message,
      );
    }

    // Logging the action
    try {
      await logAuditAction({
        adminId: req.user.id,
        action: "CREATE_USER",
        targetType: "User",
        targetId: user._id,
        targetName: `${user.name} ${user.lastName}`,
        ipAddress: req.ip,
      });
    } catch (logErr) {
      console.log("[AUDIT-LOG-ERROR]", logErr.message);
    }

    return res.status(201).json({
      status: "Success",
      message: "User created successfully!",
      result: user,
    });
  } catch (err) {
    next(err);
  }
};

// Update User (Only the Admin can do it) 
export const updateUser = async (req, res, next) => {
  try {

    let { id } = req.params;
    if (id === "current") {
      id = req.user.id;
    }
    const updateData = { ...req.body };

    const errors = [];

    if (updateData.email && !isValidEmail(updateData.email))
      errors.push({ field: "email", message: "Invalid email format" });

    if (
      updateData.phoneNumber &&
      validatePhoneNumber(updateData.countryCode, updateData.phoneNumber) === null
    ) {
      errors.push({
        field: "phoneNumber",
        message: "Invalid phone number format",
      });
    }
    
    const idNumber = updateData.idNumber?.number;
    const idCountryCode = updateData.idNumber?.countryCode;

    if (updateData.idType && !["CIN", "Passport"].includes(updateData.idType)) {
      errors.push({
        field: "idType",
        message: "ID Type must be either CIN or Passport!",
      });
    }

    switch (updateData.idType) {

      case "CIN":

        if (idNumber && !validateCIN(idNumber)) {
          errors.push({
            field: "idNumber",
            message: "Invalid CIN format!",
          });
        }

        if (updateData.idNumber) {
          updateData.idNumber.countryCode = "TN";
        }

        break;

      case "Passport":

        if (
          idCountryCode &&
          !countries.some((c) => c.code === idCountryCode)
        ) {
          errors.push({
            field: "idCountryCode",
            message: "Invalid country code for Passport!",
          });
        }

        else if (
          idNumber &&
          idCountryCode &&
          !validatePassport(idNumber, idCountryCode)
        ) {
          errors.push({
            field: "idNumber",
            message:
              "Invalid Passport format for the specified country: " +
              idCountryCode +
              "!",
          });
        }

        break;
    }

    if (errors.length > 0) {
      throw new AppError("Input validation failed!", 400, errors);
    }

    const user = await User.findByIdAndUpdate(id, updateData, {
      returnDocument: "after",
    });

    res.status(200).json({
      status: "Success",
      message: "User updated successfully.",
      data: user,
    });

  } catch (err) {
    next(err);
  }
};

// Delete User (Only for Admins)
export const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) throw new AppError("User not found!", 404);

    // Find all documents of the user
    const documents = await Document.find({ user_id: id });

    // Delete the user's document files from Cloudinary
    for (const doc of documents) {
      if (doc.filePublicId) {
        await deleteFromCloudinary(doc.filePublicId);
      }
    }

    // Delete documents from MongoDB
    await Document.deleteMany({ user_id: id });

    // Delete the user
    await User.findByIdAndDelete(id);

    res.status(200).json({
      status: "Success",
      message: "User and all associated documents deleted successfully!",
    });

    // Logging the action
    await logAuditAction({
      adminId: req.user.id,
      action: "DELETE_USER",
      targetType: "User",
      targetId: user._id,
      targetName: `${user.name} ${user.lastName}`,
      ipAddress: req.ip,
    });
  } catch (err) {
    next(err);
  }
};

// Get all Users (Only for Admins) - with Filtering & Pagination
export const getAllUsers = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      department,
      role,
      status,
      search,
    } = req.query;

    const users = await User.find()
      .populate("role_id")
      .populate("department_id")
      .populate("supervisor_id");

    // Map users to a clean format
    const cleanUsers = users.map((user) => ({
      id: user._id,
      name: user.name,
      lastName: user.lastName,
      email: user.email,
      address: user.address,
      phoneNumber: user.phoneNumber,
      bonus: user.bonus,
      profileImageURL: user.profileImageURL,
      bio: user.bio,
      leaveBalance: user.leaveBalance,
      socialStatus: user.socialStatus,
      hasChildren: user.hasChildren,
      nbOfChildren: user.nbOfChildren,
      status: user.status,
      isAvailable: user.isAvailable,
      joinDate: user.joinDate,
      position: user.position,
      faceEnrolled: user.faceEnrolled,
      faceDescriptors: user.faceDescriptors,
      role: user.role_id
        ? { id: user.role_id._id, name: user.role_id.name }
        : null,
      department: user.department_id
        ? { id: user.department_id._id, name: user.department_id.name }
        : null,
      supervisor: user.supervisor_id
        ? {
            id: user.supervisor_id._id,
            name: user.supervisor_id.name,
            lastName: user.supervisor_id.lastName,
          }
        : null,
    }));

    res.status(200).json(cleanUsers);
  } catch (err) {
    next(err);
  }
};

// Get User by ID
export const getUserById = async (req, res, next) => {
  try {
    let { id } = req.params;
    if (id === "current") {
      id = req.user.id;
    }
    const user = await User.findById(id)
      .populate("role_id")
      .populate("department_id")
      .populate("supervisor_id");

    if (!user) throw new AppError("User not found!", 404);

    res.status(200).json({
      status: "Success",
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

// Search User (Only for Admins)
export const searchUser = async (req, res, next) => {
  try {
    // The user query (Search by name/lastname and email)
    const { q } = req.query;

    // Search
    const users = await User.find({
      $or: [
        { name: { $regex: q, $options: "i" } },
        { lastName: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
      ],
    })
      .populate("role_id")
      .populate("department_id")
      .populate("supervisor_id", "name lastName email"); // To get the role, department and supervisor names in the response

    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({
      status: "Error",
      message: err.message,
    });
  }
};

// Filter users by Role, Department or status (only for Admins)
export const filterUsers = async (req, res, next) => {
  try {
    const { role, department, status } = req.query; // Get the filters wanted

    let roleId, departmentId;

    // Get Role ID if role filter exists
    if (role) {
      // Check the role existence
      const roleDoc = await UserRole.findOne({
        name: { $regex: `^${role}$`, $options: "i" },
      });

      if (!roleDoc) return sendError(res, "Role not found!");
      roleId = roleDoc._id;
    }

    // Get Department ID if department filter exists
    if (department) {
      // Check the department existence
      const deptDoc = await Department.findOne({
        name: { $regex: `^${department}$`, $options: "i" },
      });

      if (!deptDoc) return sendError(res, "Department not found!");
      departmentId = deptDoc._id;
    }

    // Build the query dynamically
    const query = {};
    if (roleId) query.role_id = roleId;
    if (departmentId) query.department_id = departmentId;
    if (status) {
      if (status === "Active") query.status = "Active";
      else if (status === "Inactive") query.status = "Inactive";
      else if (status === "Blocked") query.status = "Blocked";
      else if (status === "Pending") query.status = "Pending";
    }

    // Execute query and populate relevant fields
    const users = await User.find(query)
      .populate("role_id")
      .populate("department_id")
      .populate("supervisor_id", "name lastName email")
      .lean(); // Convert to plain JSON for the frontend later

    res.status(200).json({ status: "Success", data: users });
  } catch (err) {
    return handleError(res, err);
  }
};

// Toggle User Status(Active/Inactive) (Only for Admins)
export const toggleUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) throw new AppError("User not found!", 404);

    // Toggle the user's status
    user.status = user.status === "Active" ? "Inactive" : "Active";
    await user.save();

    res.status(200).json({
      status: "Success",
      message: `User has been ${user.status === "Active" ? "Activated" : "Deactivated"} successfully!`,
      data: { id: user._id, status: user.status },
    });

    // Logging the action
    await logAuditAction({
      adminId: req.user.id,
      action: "TOGGLE_STATUS",
      targetType: "User",
      targetId: user._id,
      targetName: `${user.name} ${user.lastName}`,
      details: { status: user.status },
      ipAddress: req.ip,
    });
  } catch (err) {
    next(err);
  }
};

// Export User to CSV format (Only for Admins)
export const exportUsersToCSV = async (req, res, next) => {
  try {
    // Get the list of users
    const users = await User.find()
      .populate("role_id", "name")
      .populate("department_id", "name")
      .populate("supervisor_id", "name lastName email")
      .lean(); // Transform to JSON for the frontend

    // Map users to pre-format date and booleans
    const formattedUsers = users.map((user) => ({
      name: user.name,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      position: user.position,
      role: user.role_id?.name,
      department: user.department_id?.name,
      isActive: user.status,
      joinDate: new Date(user.joinDate).toLocaleDateString("en-GB"),
    }));

    // Specify the fields to export
    const fields = [
      "name",
      "lastName",
      "email",
      "address",
      "phoneNumber",
      "position",
      "role",
      "department",
      "status",
      "joinDate",
    ];

    const parser = new Parser({ fields });
    const csv = parser.parse(formattedUsers);

    res.header("Content-Type", "text/csv");
    res.attachment("users.csv");
    res.send(csv);
  } catch (err) {
    next(err);
  }
};

// Export User to Excel format (Only for Admins)
export const exportUsersToExcel = async (req, res, next) => {
  try {
    // Get the list of users
    const users = await User.find()
      .populate("role_id", "name")
      .populate("department_id", "name")
      .populate("supervisor_id", "name lastName email")
      .lean();

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Users");

    sheet.columns = [
      { header: "Name", key: "name", width: 20 },
      { header: "Last Name", key: "lastName", width: 20 },
      { header: "Email", key: "email", width: 30 },
      { header: "Address", key: "address", width: 15 },
      { header: "Phone", key: "phoneNumber", width: 15 },
      { header: "Position", key: "position", width: 20 },
      { header: "Role", key: "role", width: 15 },
      { header: "Department", key: "department", width: 20 },
      { header: "Status", key: "status", width: 10 },
      { header: "Join Date", key: "joinDate", width: 15 },
    ];

    users.forEach((user) =>
      sheet.addRow({
        ...user,
        role: user.role_id?.name,
        department: user.department_id?.name,
        status: user.status,
      }),
    );

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", "attachment; filename=users.xlsx");

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
};

// Upload Profile Image to Cloudinary
export const uploadProfileImage = async (req, res, next) => {
  try {
    const userId = req.params.id;

    const existingUser = await User.findById(userId);
    if (!existingUser) throw new AppError("User not found!", 404);

    if (!req.file) return sendError(res, "No file uploaded!");

    // Delete the old profile image from Cloudinary if it exists
    if (existingUser.profileImagePublicId) {
      await deleteFromCloudinary(existingUser.profileImagePublicId, "image");
    }

    // Upload new profile image to Cloudinary
    const result = await uploadImageToCloudinary(
      req.file.buffer,
      "hrcom/profile_images",
    );

    // Update the user's profile image info
    const user = await User.findByIdAndUpdate(
      userId,
      {
        profileImageURL: result.secure_url,
        profileImagePublicId: result.public_id,
      },
      { returnDocument: "after" },
    );

    // Audit log
    await logAuditAction({
      adminId: req.user.id,
      action: "UPLOAD_IMAGE",
      targetType: "User",
      targetId: user._id,
      targetName: `${user.name} ${user.lastName}`,
      details: {
        profileImageURL: result.secure_url,
        profileImagePublicId: result.public_id,
      },
      ipAddress: req.ip,
    });

    res.status(200).json({
      status: "Success",
      message: "Profile image updated successfully!",
      profileImageURL: result.secure_url,
      profileImagePublicId: result.public_id,
      user,
    });
  } catch (err) {
    next(err);
  }
};

// Remove Profile Image
export const removeProfileImage = async (req, res, next) => {
  try {
    const userId = req.params.id;

    const existingUser = await User.findById(userId);
    if (!existingUser) throw new AppError("User not found!", 404);

    // Delete image from Cloudinary
    if (existingUser.profileImagePublicId) {
      await deleteFromCloudinary(existingUser.profileImagePublicId);
    }

    const user = await User.findByIdAndUpdate(
      userId,
      {
        profileImageURL: "",
        profileImagePublicId: "",
      },
      { returnDocument: "after" },
    );

    await logAuditAction({
      adminId: req.user.id,
      action: "REMOVE_IMAGE",
      targetType: "User",
      targetId: user._id,
      targetName: `${user.name} ${user.lastName}`,
      ipAddress: req.ip,
    });

    res.status(200).json({
      status: "Success",
      message: "Profile Image removed successfully!",
      user,
    });
  } catch (err) {
    next(err);
  }
};

// Face Enrollment functionality
export const enrollFace = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { descriptors } = req.body;

    if (
      !descriptors ||
      !Array.isArray(descriptors) ||
      descriptors.length === 0
    ) {
      throw new AppError("Face descriptors missing or invalid!", 400);
    }

    const user = await User.findById(id);
    if (!user) throw new AppError("User not found!", 404);

    // Save the descriptors to the user's profile
    user.faceDescriptors = descriptors;
    user.faceEnrolled = true;
    await user.save();

    res.status(200).json({
      status: "Success",
      message: "Face enrolled successfully!",
    });
  } catch (err) {
    next(err);
  }
};

// Face reset functionality
export const resetFace = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) throw new AppError("User not found!", 404);

    // Clear face descriptors and set faceEnrolled to false
    user.faceDescriptors = [];
    user.faceEnrolled = false;
    await user.save();

    res.status(200).json({
      status: "Success",
      message: "Face ID reset successfully!",
    });
  } catch (err) {
    next(err);
  }
};
