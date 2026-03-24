// Imports
import {
  uploadImageToCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinaryHelper.js";
import User from "../models/User.js";
import UserRole from "../models/UserRole.js";
import Department from "../models/Department.js";
import Document from "../models/Document.js";
import bcrypt from "bcrypt";
import { Parser } from "json2csv";
import ExcelJS from "exceljs";
import {
  isValidEmail,
  isEmpty,
  validatePhoneNumber,
  isWithinRange,
  generateRandomCode,
  validateCIN,
  validatePassport,
  getPassportHint,
} from "../middleware/UserValidation.js";
import { countries } from "../middleware/countries.js"; // List of countries with their codes
import { logAuditAction } from "../utils/logger.js";
import { sendEmail } from "../utils/sendEmail.js";
import { sendError, handleError } from "../utils/ErrorFunctions.js";
import AppError from "../utils/AppError.js";


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
    if (existingUser) return sendError(res, "User Already Existing!", 409);

    console.log(
      `[ADD-USER-DEBUG] User does not exist, proceeding with creation!`,
    );

    // Validate the field inputs
    if (isEmpty(name)) return sendError(res, "First name is required!", 400);

    if (isEmpty(lastName)) return sendError(res, "Last name is required!", 400);

    if (isEmpty(address)) return sendError(res, "Address is required!", 400);

    if (isEmpty(position)) return sendError(res, "Position is required!", 400);

    if (!isValidEmail(email))
      return sendError(res, "Invalid Email Format!", 400);

    // Phone number validation and checking phone number uniqueness
    if (!validatePhoneNumber(countryCode, phoneNumber)) {
      return sendError(res, "Invalid Phone Number Format!", 400);
    }

    const existingPhoneUser = await User.findOne({
      phoneNumber: validatePhoneNumber(countryCode, phoneNumber),
    });
    if (existingPhoneUser) {
      return sendError(res, "Phone number not available!", 400);
    }

    // CIN/Passport validation
    if (!["CIN", "Passport"].includes(idType)) {
      return sendError(res, "ID Type must be either CIN or Passport!", 400);
    }

    // P.S: The country code for the CIN is automatically = "TN"
    switch (idType) {
      case "CIN":
        if (!validateCIN(trimmedIdNumber)) {
          return sendError(res, "Invalid CIN format!", 400);
        }
        break;

      case "Passport":
        if (
          !idCountryCode ||
          !countries.some((c) => c.code === idCountryCode)
        ) {
          return sendError(res, "Invalid country code for Passport!", 400);
        } else if (!validatePassport(trimmedIdNumber, idCountryCode)) {
          const hint = getPassportHint(idCountryCode);
          return sendError(
            res,
            `Invalid Passport format! ${idCountryCode} Passport must match: ${hint}`,
            400,
          );
        }
        break;
    }

    if (bio && !isWithinRange(bio, 0, 500))
      return sendError(res, "Bio must be under 500 characters!", 400);

    if (hasChildren && nbOfChildren <= 0)
      return sendError(res, "Please specify the number of children!", 400);
    if (nbOfChildren < 0)
      return sendError(res, "Invalid Number of children!", 400);

    if (bonus < 0) return sendError(res, "Invalid Bonus value!", 400);

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

    // No base64 handling here. Image upload uses a separate FormData endpoint (uploadProfileImage).
    let finalProfileImageURL =
      typeof profileImageURL === "string" ? profileImageURL : "";

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

    if (updateData.email) {
      if (!isValidEmail(updateData.email)) {
        return sendError(res, "Invalid Email Format!", 400);
      }

      const trimmedEmail = updateData.email.trim().toLowerCase();
      const existingEmailUser = await User.findOne({ email: trimmedEmail });

      // We check if the email belongs to another user. If an Admin is editing another user's profile,
      // id variable holds the target user's ID. If a user edits their own profile, id holds their ID.
      if (existingEmailUser && existingEmailUser._id.toString() !== id) {
        return res
          .status(400)
          .json({ status: "Error", message: "Email already in use!" });
      }

      updateData.email = trimmedEmail;
    }

    // Check phone number validity and uniqueness
    let updatedPhoneNumber = null;

    if (updateData.phoneNumber) {
      updatedPhoneNumber = validatePhoneNumber(
        updateData.countryCode,
        updateData.phoneNumber,
      );

      if (!updatedPhoneNumber) {
        return sendError(res, "Invalid Phone Number!", 400);
      } else {
        // Check phone number uniqueness
        const existingPhoneUser = await User.findOne({
          phoneNumber: updatedPhoneNumber,
        });

        if (existingPhoneUser && existingPhoneUser._id.toString() !== id) {
          return sendError(res, "Phone number not available!", 400);
        }

        // Save the updated version
        updateData.phoneNumber = updatedPhoneNumber;
      }
    }

    // Check ID number uniqueness and validity
    const idNumber = updateData.idNumber?.number;
    const idCountryCode = updateData.idNumber?.countryCode;

    if (updateData.idType && !["CIN", "Passport"].includes(updateData.idType)) {
      return sendError(res, "ID Type must be either CIN or Passport!", 400);
    }

    // Check if the updated ID number already exists for another user
    if (idNumber) {
      const existingUser = await User.findOne({
        "idNumber.number": idNumber,
        "idNumber.countryCode": idCountryCode || "TN",
      });

      if (existingUser && existingUser._id.toString() !== id) {
        return sendError(
          res,
          `Unable to process this ${updateData.idType} Number!`,
          400,
        );
      }
    }

    switch (updateData.idType) {
      case "CIN":
        if (idNumber && !validateCIN(idNumber)) {
          return sendError(res, "Invalid CIN format!", 400);
        }

        if (updateData.idNumber) {
          updateData.idNumber.countryCode = "TN";
        }
        break;

      case "Passport":
        if (idCountryCode && !countries.some((c) => c.code === idCountryCode)) {
          return sendError(res, "Invalid country code for Passport!", 400);
        } else if (
          idNumber &&
          idCountryCode &&
          !validatePassport(idNumber, idCountryCode)
        ) {
          const hint = getPassportHint(idCountryCode);
          return sendError(
            res,
            "Invalid Passport format for the specified country: " +
              idCountryCode +
              "!",
            400,
          );
        }
        break;
    }

    // Map role name to role_id
    if (updateData.role) {
      const userrole = await UserRole.findOne({
        name: { $regex: new RegExp(`^${updateData.role}$`, "i") },
      });
      if (userrole) {
        updateData.role_id = userrole._id;
      }
      delete updateData.role;
    }

    // Map department name to department_id
    if (updateData.department) {
      const userdepartment = await Department.findOne({
        name: { $regex: new RegExp(`^${updateData.department}$`, "i") },
      });
      if (userdepartment) {
        updateData.department_id = userdepartment._id;
      }
      delete updateData.department;
    }

    // Map supervisor name to supervisor_id
    if (updateData.supervisor_full_name) {
      const parts = updateData.supervisor_full_name.trim().split(/\s+/);
      const sName = parts[0];
      const sLastName = parts.slice(1).join(" ");

      const supervisor = await User.findOne({
        name: sName,
        lastName: sLastName,
      });
      if (supervisor) {
        updateData.supervisor_id = supervisor._id;
      }
      delete updateData.supervisor_full_name;
    }

    // Map isActive boolean to status string
    if (updateData.isActive !== undefined) {
      updateData.status = updateData.isActive ? "Active" : "Inactive";
      delete updateData.isActive;
    }

    const user = await User.findByIdAndUpdate(id, updateData, {
      returnDocument: "after",
    })
      .populate("role_id")
      .populate("department_id")
      .populate("supervisor_id");

    await logAuditAction({
      adminId: req.user.id,
      action: "UPDATE_USER",
      targetType: "User",
      targetId: user._id,
      targetName: `${user.name} ${user.lastName}`,
      details: updateData,
      ipAddress: req.ip,
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
      faceEnrollmentPromptRequired: user.faceEnrollmentPromptRequired,
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

// Get available active supervisors (Admin only)
export const getActiveSupervisors = async (req, res, next) => {
  try {
    // Get the Supervisor role ID
    const supervisorRoleId = await UserRole.findOne({
      name: "Supervisor",
    }).select("_id");

    // Search available active supervisors
    const supervisors = await User.find({
      status: "Active",
      role_id: supervisorRoleId,
    }).select("name lastName email");

    res.status(200).json({
      status: "Success",
      data: supervisors,
    });
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
      { header: "Address", key: "address", width: 25 },
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

    // Style the header (borders + background color)
    sheet.getRow(1).eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "89D2DC" },
      };
      cell.font = { bold: true };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });

    // Style data rows with borders (except the header)
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
    });

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
    user.faceEnrollmentPromptRequired = false;
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
    user.faceEnrollmentPromptRequired = true;
    await user.save();

    res.status(200).json({
      status: "Success",
      message: "Face ID reset successfully!",
    });
  } catch (err) {
    next(err);
  }
};


// --------------------------------------------------------------------------- //
// ------------------------ TEAM MEMBERS MANAGEMENT -------------------------- //
// --------------------------------------------------------------------------- //

// Get team members under a supervisor (Supervisor and Admin)
export const getTeamMembers = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if the user exists
    const existingUser = await User.findById(id);
    if (!existingUser) {
      return sendError(res, "User not found!", 404);
    }

    // Only the supervisor himself and the Admin can access the team members list
    if (req.user.role !== "Admin" && req.user._id.toString() !== id) {
      return sendError(res, "Unauthorized access to this team!", 403);
    }

    // Find all team members of the supervisor
    const teamMembers = await User.find({ supervisor_id: id })
      .populate("role_id", "name")   
      .populate("department_id", "name"); 

    res.status(200).json({
      status: "Success",
      data: teamMembers,
    });
  } catch (err) {
    next(err);
  }
};
