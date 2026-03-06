// Importations
import User from "../models/User.js";
import UserRole from "../models/UserRole.js";
import Department from "../models/Department.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { sendEmail } from "../utils/sendEmail.js";
import { Parser } from "json2csv";
import ExcelJS from "exceljs";
import cloudinary from "../config/cloudinary.js";
import crypto from "crypto";
import {
  isValidEmail,
  isEmpty,
  validatePhoneNumber,
  isWithinRange,
  generateRandomCode,
} from "../middleware/UserValidation.js";
import { logAuditAction } from "../utils/logger.js";

dotenv.config();

// --------------------------------------------------------------------------- //
// ---------------------------------- AUTH ----------------------------------- //
// --------------------------------------------------------------------------- //

// Login Functionality (All users can do it)
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const trimmedEmail = (email || "").trim().toLowerCase();
    const trimmedPassword = (password || "").trim();

    console.log(`[LOGIN-DEBUG] Login attempt for: ${trimmedEmail}`);

    // Check the User existence
    const user = await User.findOne({ email: trimmedEmail });
    if (!user) {
      console.log(`[LOGIN-DEBUG] User not found: ${trimmedEmail}`);
      return res.status(404).json({
        status: "Error",
        message: "User not found!",
      });
    }

    // Check if status blocked or inactive
    if (user.status === "Blocked" || user.status === "Inactive") {
      return res.status(403).json({
        status: "Error",
        message:
          "Your Account is " +
          user.status +
          ". Please contact the Administration!",
      });
    }

    // Get the user role
    const userRole = await UserRole.findById(user.role_id);
    if (!userRole) {
      console.log(`[LOGIN-DEBUG] Role not found for user: ${trimmedEmail}`);
      return res.status(404).json({
        status: "Error",
        message: "User role not found!",
      });
    }

    // Compare password - hashPassword in DB
    const isMatch = await bcrypt.compare(trimmedPassword, user.password);
    if (!isMatch) {
      console.log(`[LOGIN-DEBUG] Password mismatch for: ${trimmedEmail}`);

      user.loginAttempts += 1;

      // The user has 3 login attempts before account blockage
      if (user.loginAttempts >= 3) {
        user.status = "Blocked";
        await user.save(); // Save the updated status

        return res.status(403).json({
          status: "Error",
          message:
            "Your Account is now Blocked. Please contact the Administration!",
        });
      }
      await user.save(); // Save the updated login attempts

      return res.status(401).json({
        status: "Error",
        message: "Invalid Email or password!",
      });
    }
    console.log(`[LOGIN-DEBUG] Password match for: ${trimmedEmail}`);

    // For the Frontend, if the account is not verified, we redirect to the OTP code form
    if (!user.status === "Active") {
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
      },
    });
  } catch (err) {
    return res.status(500).json({
      status: "Error",
      message: err.message,
    });
  }
};

// Verify User's OTP code
export const verifyUser = async (req, res) => {
  try {
    const { email, code } = req.body; // We get the email to search for the user's hashed code

    // Check user existence
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        status: "Error",
        message: "User not found!",
      });
    }

    // Check if status blocked or inactive
    if (user.status === "Blocked" || user.status === "Inactive") {
      return res.status(403).json({
        status: "Error",
        message:
          "Your Account is " +
          user.status +
          ". Please contact the Administration!",
      });
    }

    // Check if status already verified
    if (user.status === "Active") {
      return res.status(400).json({
        status: "Error",
        message: "Account Already Verified!",
      });
    }

    // Check code validity
    if (!(await bcrypt.compare(code, user.verificationCode))) {
      return res.status(400).json({
        status: "Error",
        message: "Invalid OTP Code!",
      });
    }

    // Check code expiration
    if (user.verificationCodeExpires < Date.now()) {
      return res.status(400).json({
        status: "Error",
        message: "OTP Code expired!",
      });
    }

    // Verify the user account
    user.status = "Active";
    user.verificationCode = null;
    user.verificationCodeExpires = null;

    user.mustResetPassword = true; // To redirect to the must reset password form in the frontend

    // Save the changes
    await user.save();

    res.status(200).json({
      status: "Success",
      message: "Account Verified Successfully!",
    });
  } catch (err) {
    return res.status(500).json({
      status: "Error",
      message: err.message,
    });
  }
};

// Resend OTP Code (3 max per day)
export const resendVerificationCode = async (req, res) => {
  try {
    const { email } = req.body;
    const trimmedEmail = (email || "").trim().toLowerCase();

    // Check user existence
    const user = await User.findOne({ email: trimmedEmail });
    if (!user) {
      return res.status(404).json({
        status: "Error",
        message: "User not found!",
      });
    }

    // Check if status blocked or inactive
    if (user.status === "Blocked" || user.status === "Inactive") {
      return res.status(403).json({
        status: "Error",
        message:
          "Your Account is " +
          user.status +
          ". Please contact the Administration!",
      });
    }

    // Check user already verified
    if (user.status === "Active") {
      return res.status(400).json({
        status: "Error",
        message: "Account Already Verified!",
      });
    }

    const today = new Date();
    const lastResend = user.resendDate ? new Date(user.resendDate) : null; // The date of the last resend request

    // Check if it is a new day. If it is, reset counter
    if (!lastResend || today.toDateString() !== lastResend.toDateString()) {
      user.resendCount = 0;
      user.resendDate = today;
    }

    // Check the resend limit (3 emails per day)
    if (user.resendCount >= 3) {
      return res.status(429).json({
        status: "Error",
        message:
          "Maximum OTP resend limit reached for today (3). Try again tomorrow.",
      });
    }

    // Generate new OTP
    const otpCode = generateRandomCode(6);
    const hashedOTP = await bcrypt.hash(otpCode, 10);

    // Update user
    user.verificationCode = hashedOTP;
    user.verificationCodeExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
    user.resendCount += 1;
    user.resendDate = today;

    await user.save();

    // Send email
    try {
      await sendEmail({
        to: user.email,
        subject: "HRcoM – New Verification Code",
        type: "resendOTP",
        name: user.name,
        code: otpCode,
      });
    } catch (emailErr) {
      console.log("[RESEND-OTP-EMAIL-ERROR]", emailErr.message);
    }

    return res.status(200).json({
      status: "Success",
      message: "OTP code resent successfully!",
    });
  } catch (err) {
    return res.status(500).json({
      status: "Error",
      message: err.message,
    });
  }
};

// Reset the Password after the first login (Obligatory for all users at the first Login)
export const resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    // Check the user existence
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      return res.status(404).json({
        status: "Error",
        message: "User not found!",
      });
    }

    // Check if status blocked or inactive
    if (user.status === "Blocked" || user.status === "Inactive") {
      return res.status(403).json({
        status: "Error",
        message:
          "Your Account is " +
          user.status +
          ". Please contact the Administration!",
      });
    }

    // Check if mustReset the password
    if (!user.mustResetPassword) {
      return res.status(400).json({
        status: "Error",
        message: "Password Reset not required for this account!",
      });
    }

    // Check password emptiness
    if (isEmpty(newPassword)) {
      return res.status(400).json({
        status: "Error",
        message: "New Password Missing!",
      });
    }

    // Check the new password validity
    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword)) {
      return res.status(400).json({
        status: "Error",
        message:
          "Password must be at least 8 characters long, and contain at least one capital letter!",
      });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    user.mustResetPassword = false; // mark the password as reset
    await user.save();

    res.status(200).json({
      status: "Success",
      message: "Password Reset successfully!",
    });
  } catch (err) {
    res.status(500).json({
      status: "Error",
      message: err.message,
    });
  }
};

// Forget password Request
export const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    // Check the user existance
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      return res.status(404).json({
        status: "Error",
        message: "User not found!",
      });
    }

    // Check if status blocked or inactive
    if (user.status === "Blocked" || user.status === "Inactive") {
      return res.status(403).json({
        status: "Error",
        message:
          "Your Account is " +
          user.status +
          ". Please contact the Administration!",
      });
    }

    // Generate a random token (32 bytes) to be sent to the user email
    const token = crypto.randomBytes(32).toString("hex");
    console.log(
      `[FORGET-PASSWORD-REQUEST-DEBUG] Generated reset token for ${email}: ${token}`,
    );

    // Hash the token and store in DB
    user.resetPasswordToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour (Token validity)
    await user.save();

    // Create a reset URL to be sent to the user's email
    const resetURL = `${process.env.PLATFORM_URL}/reset-password?token=${token}&email=${user.email}`;

    // Send email
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
    res.status(500).json({
      status: "Error",
      message: err.message,
    });
  }
};

// Forget password reset
export const forgetPassword = async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;

    // Hash the incoming token to compare with DB
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Check the user existence and Reqest validation (token match and not expired)
    const user = await User.findOne({
      email: email.trim().toLowerCase(),
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }, // token not expired
    });

    if (!user) {
      return res.status(400).json({
        status: "Error",
        message: "Invalid or Expired password reset token!",
      });
    }

    // Check if status blocked or inactive
    if (user.status === "Blocked" || user.status === "Inactive") {
      return res.status(403).json({
        status: "Error",
        message:
          "Your Account is " +
          user.status +
          ". Please contact the Administration!",
      });
    }

    // Check password if empty
    if (isEmpty(newPassword)) {
      return res.status(400).json({
        status: "Error",
        message: "Missing Password!",
      });
    }

    // Check the new password validity
    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword)) {
      return res.status(400).json({
        status: "Error",
        message:
          "Password must be at least 8 characters long, and contain at least one capital letter!",
      });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;

    // Clear reset token fields
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;

    await user.save();

    res.status(200).json({
      status: "Success",
      message: "Password Reset Successfully!",
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
export const addUser = async (req, res) => {
  try {
    const {
      name,
      lastName,
      email,
      address,
      joinDate,
      countryCode,
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
    } = req.body;

    const trimmedEmail = (email || "").trim().toLowerCase();
    console.log(`[ADD-USER-DEBUG] Called for: ${trimmedEmail}, Role: ${role}`);

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
    if (validatePhoneNumber(countryCode, phoneNumber) === null)
      errors.push({
        field: "phoneNumber",
        message: "Invalid phone number format",
      });

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

      return res.status(400).json({
        status: "Error",
        message: "Input validation failed!",
        errors,
      });
    }

    // Check user existence
    console.log(
      `[ADD-USER-DEBUG] Checking if user already exists: ${trimmedEmail}`,
    );
    const existingUser = await User.findOne({ email: trimmedEmail });
    if (existingUser) {
      console.log(`[ADD-USER-DEBUG] User already exists: ${trimmedEmail}`);

      return res.status(401).json({
        status: "Error",
        message: "User Already Existing!",
      });
    }

    console.log(
      `[ADD-USER-DEBUG] User does not exist, proceeding with creation!`,
    );

    // Check Role validity
    const userrole = await UserRole.findOne({
      name: { $regex: new RegExp(`^${role}$`, "i") },
    });
    if (!userrole) {
      console.log(`[ADD-USER-DEBUG] Invalid role: ${role}`);

      return res.status(401).json({
        status: "Error",
        message: "Invalid Role!",
      });
    }

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

      if (!supervisor) {
        console.log(
          `[ADD-USER-DEBUG] Supervisor lookup failed for: ${supervisor_name} ${supervisor_lastName}`,
        );

        return res.status(404).json({
          status: "Error",
          message: "Supervisor not found!",
        });
      }
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

      if (!userdepartment) {
        return res.status(401).json({
          status: "Error",
          message: "Invalid Department!",
        });
      }
      departmentId = userdepartment._id; // Get the department ID
      console.log(
        `[ADD-USER-DEBUG] Department found: ${userdepartment.name} (${departmentId})`,
      );
    }

    // Get the full validated Phone number
    const validatedPhoneNumber = validatePhoneNumber(countryCode, phoneNumber);

    // Generate password (length = 8)
    const password = generateRandomCode();

    // Generate OTP code (length = 6)
    const otpCode = generateRandomCode(6);

    // Hash Password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Hash OTP code
    const hashedOTP = await bcrypt.hash(otpCode, 10);

    // Create user
    console.log(`[ADD-USER-DEBUG] Creating user in DB...`);
    const user = await User.create({
      name,
      lastName,
      email: trimmedEmail,
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
    res.status(500).json({
      status: "Error",
      message: err.message,
    });
  }
};

// Get All Users Functionnality (Only the Admin can do it)
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
      .populate("role_id")
      .populate("department_id")
      .populate("supervisor_id");

    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({
      status: "Error",
      message: err.message,
    });
  }
};

// Get a User by Id
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate("role_id")
      .populate("department_id")
      .populate("supervisor_id");

    if (!user) {
      return res.status(404).json({
        status: "Error",
        message: "User not found!",
      });
    }

    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({
      status: "Error",
      message: err.message,
    });
  }
};

// Update User (Only the Admin can do it)
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params; // Get the user ID
    const updateData = { ...req.body }; // Get the updated data
    console.log(
      `[UPDATE-USER-DEBUG] Update Request for user ${id}, Target Role: ${updateData.role}`,
    );

    // Input Validation
    const errors = [];
    if (updateData.email && !isValidEmail(updateData.email))
      errors.push({ field: "email", message: "Invalid email format" });
    if (
      updateData.phoneNumber &&
      validatePhoneNumber(updateData.countryCode, updateData.phoneNumber) ===
        null
    )
      errors.push({
        field: "phoneNumber",
        message: "Invalid phone number format",
      });
    if (updateData.bio && !isWithinRange(updateData.bio, 0, 500))
      errors.push({
        field: "bio",
        message: "Bio must be under 500 characters",
      });
    if (updateData.bonus !== undefined && updateData.bonus < 0)
      errors.push({ field: "bonus", message: "Bonus cannot be negative" });

    // Children validation
    if (
      updateData.hasChildren === true &&
      (updateData.nbOfChildren === undefined || updateData.nbOfChildren <= 0)
    ) {
      errors.push({
        field: "nbOfChildren",
        message: "Please specify the number of children",
      });
    }
    if (updateData.nbOfChildren !== undefined && updateData.nbOfChildren < 0)
      errors.push({
        field: "nbOfChildren",
        message: "Number of children cannot be negative",
      });

    if (errors.length > 0) {
      return res.status(400).json({
        status: "Error",
        message: "Input validation failed!",
        errors,
      });
    }

    // Check for the user existence
    const existingUser = await User.findById(id).populate("role_id");
    if (!existingUser) {
      return res.status(404).json({
        status: "Error",
        message: "User not found!",
      });
    }

    let roleChanged = false;
    let newPasswordRaw = "";

    // Check for the role change validity
    if (updateData.role) {
      const newRoleName = updateData.role;
      const currentRoleName = existingUser.role_id
        ? existingUser.role_id.name
        : "";

      if (newRoleName.toLowerCase() !== currentRoleName.toLowerCase()) {
        roleChanged = true;

        const roleDoc = await UserRole.findOne({
          name: { $regex: new RegExp(`^${newRoleName}$`, "i") },
        });

        if (!roleDoc) {
          return res.status(400).json({
            status: "Error",
            message: "Invalid Role!",
          });
        }

        updateData.role_id = roleDoc._id; // Get the new role ID

        console.log(
          `[UPDATE-USER-DEBUG] Role changed from "${currentRoleName}" to "${roleDoc.name}".`,
        );
      } else {
        console.log(`[UPDATE-USER-DEBUG] Role unchanged: "${currentRoleName}"`);
      }
    }

    // Check for the department change validity
    if (updateData.department) {
      if (
        updateData.department === "Unassigned" ||
        updateData.department === "" ||
        updateData.department === "all"
      ) {
        updateData.department_id = null;
      } else {
        const dept = await Department.findOne({
          name: { $regex: new RegExp(`^${updateData.department}$`, "i") },
        });

        if (!dept) {
          return res.status(400).json({
            status: "Error",
            message: "Invalid Department!",
          });
        }

        updateData.department_id = dept._id; // Get the new department ID
      }
    }

    // Check for the supervisor change validity
    if (updateData.supervisor_full_name !== undefined) {
      if (
        updateData.supervisor_full_name === "" ||
        updateData.supervisor_full_name === "Not assigned yet" ||
        updateData.supervisor_full_name === null
      ) {
        updateData.supervisor_id = null;
      } else {
        const parts = updateData.supervisor_full_name.trim().split(/\s+/);
        const firstName = parts[0];
        const lastName = parts.slice(1).join(" ");

        const supervisor = await User.findOne({ name: firstName, lastName });
        if (!supervisor) {
          return res.status(400).json({
            status: "Error",
            message: "Invalid Supervisor!",
          });
        }

        updateData.supervisor_id = supervisor._id; // Get the new supervisor ID
      }
    }

    // Get the full validated phone number
    updateData.phoneNumber = validatePhoneNumber(
      updateData.countryCode,
      updateData.phoneNumber,
    );

    // Generate NEW password and a NEW OTP code
    newPasswordRaw = generateRandomCode();
    const newCode = generateRandomCode(6);

    // Hash the new password and OTP Code
    updateData.password = await bcrypt.hash(newPasswordRaw, 10);
    updateData.verificationCode = await bcrypt.hash(newCode, 10);
    updateData.verificationCodeExpires = new Date(
      Date.now() + 24 * 60 * 60 * 1000,
    ); // 24 hours
    updateData.status = "Pending";

    // Update the user
    const user = await User.findByIdAndUpdate(id, updateData, {
      returnDocument: "after",
    });

    // If role changed, send by Email the new credentials to the User
    if (roleChanged) {
      try {
        console.log(
          `[UPDATE-USER-DEBUG] Sending updated credentials to: ${user.email}`,
        );

        await sendEmail({
          to: user.email,
          subject: "HRcoM Account Update",
          type: "updateUser",
          name: user.name,
          password: newPasswordRaw,
          code: newCode,
        });
      } catch (emailErr) {
        console.log(
          `[UPDATE-USER-DEBUG] Role updated but email failed:`,
          emailErr.message,
        );
      }
    }

    res.status(200).json({
      status: "Success",
      message: roleChanged
        ? "User role updated and new credentials sent."
        : "User updated successfully.",
      data: user,
    });

    // Logging the action
    await logAuditAction({
      adminId: req.user.id,
      action: "UPDATE_USER",
      targetType: "User",
      targetId: user._id,
      targetName: `${user.name} ${user.lastName}`,
      details: req.body, // Log the changes requested
      ipAddress: req.ip,
    });
  } catch (err) {
    res.status(500).json({
      status: "Error",
      message: err.message,
    });
  }
};

// Delete User (Only for Admins)
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndDelete(id);

    // Check for user existence
    if (!user) {
      return res.status(404).json({
        status: "Error",
        message: "User not found",
      });
    }

    res.status(200).json({
      status: "Success",
      message: "User deleted successfully",
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
    res.status(500).json({
      status: "Error",
      message: err.message,
    });
  }
};

// Search User (Only for Admins)
export const searchUser = async (req, res) => {
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
export const filterUsers = async (req, res) => {
  try {
    const { role, department, status } = req.query; // Get the filters wanted

    let roleId, departmentId;

    // Get Role ID if role filter exists
    if (role) {
      // Check the role existence
      const roleDoc = await UserRole.findOne({
        name: { $regex: `^${role}$`, $options: "i" },
      });

      if (!roleDoc) {
        return res.status(400).json({
          status: "Error",
          message: "Role not found!",
        });
      }
      roleId = roleDoc._id;
    }

    // Get Department ID if department filter exists
    if (department) {
      // Check the department existence
      const deptDoc = await Department.findOne({
        name: { $regex: `^${department}$`, $options: "i" },
      });

      if (!deptDoc) {
        return res.status(400).json({
          status: "Error",
          message: "Department not found!",
        });
      }
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

    res.status(200).json({
      status: "Success",
      data: users,
    });
  } catch (err) {
    res.status(500).json({
      status: "Error",
      message: err.message,
    });
  }
};

// Toggle User Status(Active/Inactive) (Only for Admins)
export const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    // Check for user existence
    if (!user) {
      return res.status(404).json({
        status: "Error",
        message: "User not found!",
      });
    }

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
    res.status(500).json({
      status: "Error",
      message: err.message,
    });
  }
};

// Export User to CSV format (Only for Admins)
export const exportUsersToCSV = async (req, res) => {
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
    res.status(500).json({
      status: "Error",
      message: err.message,
    });
  }
};

// Export User to Excel format (Only for Admins)
export const exportUsersToExcel = async (req, res) => {
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
    res.status(500).json({
      status: "Error",
      message: err.message,
    });
  }
};

// Upload Profile Image to Cloudinary
export const uploadProfileImage = async (req, res) => {
  try {
    const userId = req.params.id;

    // Check for user existence
    const existingUser = await User.findById(userId);
    if (!existingUser) {
      return res.status(404).json({
        status: "Error",
        message: "User not found!",
      });
    }

    // Check if the image is provided
    if (!req.file) {
      return res.status(400).json({
        status: "Error",
        message: "No file uploaded!",
      });
    }

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "hrcom/profile_images",
          resource_type: "image",
        },
        (error, uploadResult) => {
          if (error) reject(error);
          else resolve(uploadResult);
        },
      );

      stream.end(req.file.buffer); // Upload buffer directly
    });

    // Update the user's profileImageURL
    const user = await User.findByIdAndUpdate(
      userId,
      { profileImageURL: result.secure_url },
      { returnDocument: "after" },
    );

    res.status(200).json({
      status: "Success",
      message: "Profile image updated successfully!",
      profileImageURL: result.secure_url,
      user,
    });

    // Logging the action
    await logAuditAction({
      adminId: req.user.id,
      action: "UPLOAD_IMAGE",
      targetType: "User",
      targetId: user._id,
      targetName: `${user.name} ${user.lastName}`,
      ipAddress: req.ip,
    });
  } catch (err) {
    res.status(500).json({
      status: "Error",
      message: err.message,
    });
  }
};
