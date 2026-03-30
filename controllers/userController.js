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
  validatePhoneNumber,
  generateRandomCode,
  validateCIN,
  validatePassport,
  getPassportHint,
  validateUserData,
} from "../middleware/UserValidation.js";
import { countries } from "../middleware/countries.js"; // List of countries with their codes
import { logAuditAction } from "../utils/logger.js";
import { sendEmail } from "../utils/sendEmail.js";
import { sendError, handleError } from "../utils/ErrorFunctions.js";
import AppError from "../utils/AppError.js";

// --------------------------------------------------------------------------- //
// ---------------------------- HELPER FUNCTIONS ----------------------------- //
// --------------------------------------------------------------------------- //

// Full phone number validation helper function (format + uniqueness)
export const fullPhoneNumberValidation = async (countryCode, phoneNumber, userId = null) => {
  const validatedPhoneNumber = validatePhoneNumber(countryCode, phoneNumber);

  if (!validatedPhoneNumber) {
    throw new AppError("Invalid Phone Number Format!", 400);
  }

  // Check the phone number uniqueness
  const existingPhoneUser = await User.findOne({
    phoneNumber: validatedPhoneNumber,
  });

  if (existingPhoneUser && existingPhoneUser._id.toString() !== userId) {
    throw new AppError("Phone number not available!", 400);
  }

  return validatedPhoneNumber;
};

// Full CIN/Passport validation helper function (format + uniqueness)
export const fullCINPassportValidation = async (idType, idCountryCode, trimmedIdNumber, userId = null) => {
  // Check ID type validity
  if (!["CIN", "Passport"].includes(idType)) {
    throw new AppError("ID Type must be either CIN or Passport!", 400);
  }

  // Check the validity of IdNumber based on the ID type
  switch (idType) {
    case "CIN":
      if (!validateCIN(trimmedIdNumber)) {
        throw new AppError("Invalid CIN format!", 400);
      }
      break;

    case "Passport":
      if (
        !idCountryCode ||
        !countries.some((c) => c.code === idCountryCode)
      ) {
        throw new AppError("Invalid country code for Passport!", 400);
      } else if (!validatePassport(trimmedIdNumber, idCountryCode)) {
        const hint = getPassportHint(idCountryCode);
        throw new AppError(
          `Invalid Passport format! ${idCountryCode} Passport must match: ${hint}`,
          400,
        );
      }
      break;
  }

  const existingUser = await User.findOne({
    "idNumber.number": trimmedIdNumber,
    "idNumber.countryCode": idType === "CIN" ? "TN" : idCountryCode,
  });

  if (existingUser && existingUser._id.toString() !== userId) {
    throw new AppError("Identification number unavailable!", 400);
  }
};

// Check User Role validity helper function
export const validateUserRole = async (role, action) => {
  // Check user role existance
  const userrole = await UserRole.findOne({
    name: { $regex: new RegExp(`^${role}$`, "i") },
  });
  if (!userrole) throw new AppError("Invalid Role!", 400);

  // Get the role ID
  const roleId = userrole._id;
  console.log(`[${action}-USER-DEBUG] Role found: ${userrole.name} (${roleId})`);

  return roleId;
};

// Check supervisor validity helper function
export const validateSupervisor = async (supervisor_full_name, action) => {
  if (
    supervisor_full_name &&
    typeof supervisor_full_name === "string" &&
    supervisor_full_name.trim() !== "" &&
    supervisor_full_name !== "Not assigned yet"
  ) {
    console.log(
      `[${action}-USER-DEBUG] Attempting to look up supervisor: "${supervisor_full_name}"`,
    );

    // Split the supervisor's full name
    const parts = supervisor_full_name.trim().split(/\s+/);
    const supervisor_name = parts[0];
    const supervisor_lastName = parts.slice(1).join(" ");

    // Check the supervisor existance
    const supervisor = await User.findOne({
      name: supervisor_name,
      lastName: supervisor_lastName,
    });

    if (!supervisor) throw new AppError("Supervisor not found!", 404);

    // Get the supervisor ID
    const supervisorId = supervisor._id; 
    console.log(`[${action}-USER-DEBUG] Supervisor found: ${supervisorId}`);

    return supervisorId;
  } else {
    console.log(
      `[${action}-USER-DEBUG] Skipping supervisor lookup (name is empty or N/A)`,
    );
  }
};

// Check department validity helper function
export const validateDepartment = async (department, action) => {
  if (department && department !== "Unassigned" && department !== "all") {
    const userdepartment = await Department.findOne({
      name: { $regex: new RegExp(`^${department}$`, "i") },
    });

    if (!userdepartment) throw new AppError("Invalid Department!", 400);
    
    // Get the department ID
    const departmentId = userdepartment._id; 
    console.log(
      `[${action}-USER-DEBUG] Department found: ${userdepartment.name} (${departmentId})`,
    );

    return departmentId;
  }
}

// --------------------------------------------------------------------------- //
// ----------------------------- USER MANAGEMENT ----------------------------- //
// --------------------------------------------------------------------------- //

// Add User (Only the Admin can do it)
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

    const action = "ADD";

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

    // Backend Safety: Strict one-way association: Admin must be HR
    const roleCheck = (role || "").toLowerCase();
    const deptCheck = (department || "").toLowerCase();
    if (roleCheck === "admin" && deptCheck !== "hr") {
      return sendError(res, "Admin role must belong strictly to the HR department", 400);
    }

    // Validate common field Inputs (Don't require DB checks)
    validateUserData({
      name,
      lastName,
      trimmedEmail,
      address,
      position,
      bonus,
      bio,
      hasChildren,
      nbOfChildren,
    });

    // Get the full validated Phone number (After format and uniqueness checks)
    const validatedPhoneNumber = await fullPhoneNumberValidation(countryCode, phoneNumber);

    // CIN/Passport validation
    await fullCINPassportValidation(idType, idCountryCode, trimmedIdNumber);

    // Get the role Id if the Role is valid
    const roleId = await validateUserRole(role, action);

    // Check the validity of the supervisor (Optional field) and get the supervisor ID
    const supervisorId = await validateSupervisor(supervisor_full_name, action);

    // Check the validity of the department and get the department ID
    const departmentId = await validateDepartment(department, action);

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

    // Get the profile Image URL
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
    if (id === "current") id = req.user.id;

    const updateData = { ...req.body };
    const action = "UPDATE";

    // Check the user existence
    const existingUser = await User.findById(id);
    if (!existingUser) throw new AppError("User not found!", 404);

    // Check the email validity and the user existence
    if (updateData.email) {
      const trimmedEmail = updateData.email.trim().toLowerCase();

      if (!isValidEmail(trimmedEmail)) {
        return sendError(res, "Invalid Email Format!", 400);
      }

      const existingEmailUser = await User.findOne({ email: trimmedEmail });

      if (existingEmailUser && existingEmailUser._id.toString() !== id) {
        return sendError(res, "Unavailable Email!", 400);
      }

      updateData.email = trimmedEmail;
    }

    // Input validation for common fields (those that don't require DB checks)
    validateUserData({
      name: updateData.name,
      lastName: updateData.lastName,
      trimmedEmail: updateData.email,
      address: updateData.address,
      position: updateData.position,
      bonus: updateData.bonus,
      bio: updateData.bio,
      hasChildren: updateData.hasChildren,
      nbOfChildren: updateData.nbOfChildren,
    });

    // Check the phone number validity 
    if (updateData.phoneNumber) {
      updateData.phoneNumber = await fullPhoneNumberValidation(
        updateData.countryCode,
        updateData.phoneNumber,
        id 
      );
    }

    // Check the CIN/Passport validity
    if (updateData.idType || updateData.idNumber) {
      const trimmedIdNumber = updateData.idNumber?.number?.trim();
      const idCountryCode = updateData.idNumber?.countryCode;

      await fullCINPassportValidation(
        updateData.idType,
        idCountryCode,
        trimmedIdNumber,
        id
      );

      if (updateData.idType === "CIN" && updateData.idNumber) {
        updateData.idNumber.countryCode = "TN";
      }
    }

    // Check the role validity and send the role change email (updateDate.role only exists if the role is being changed)
    let roleChanged = false;
    let newRoleId = null;
    let newRoleName = "";

    // Get the id of the old role
    const oldRoleId = existingUser.role_id;

    if (updateData.role) {      
      // Validate the new role and get its ID
      newRoleId = await validateUserRole(updateData.role, action);

      // Check if the role is changed
      if (!oldRoleId.equals(newRoleId)) {
        roleChanged = true;

        const roleDoc = await UserRole.findById(newRoleId).select("name");
        newRoleName = roleDoc?.name || "";
        updateData.role_id = newRoleId;
      }

      delete updateData.role;
    }

    // Check the department validity
    if (updateData.department) {
      updateData.department_id = await validateDepartment(
        updateData.department,
        action
      );
      delete updateData.department;
    }

    // Check the supervisor validity and handle explicit unassigning
    if ("supervisor_full_name" in req.body) {
      const assignedName = req.body.supervisor_full_name;
      if (!assignedName || assignedName === "Not assigned yet") {
        updateData.supervisor_id = null;
      } else {
        updateData.supervisor_id = await validateSupervisor(
          assignedName,
          action
        );
      }
      delete updateData.supervisor_full_name;
    }

    // Update the Status of the user
    if (updateData.isActive !== undefined) {
      updateData.status = updateData.isActive ? "Active" : "Inactive";
      delete updateData.isActive;
    }

    // Update the user
    const user = await User.findByIdAndUpdate(id, updateData, {
      returnDocument: "after",
    })
      .populate("role_id")
      .populate("department_id")
      .populate("supervisor_id");

    // Send the update user email ONLY if role changed
    if (roleChanged) {
      try {
        console.log(
          `[UPDATE-USER-DEBUG] Sending Update user email to: ${user.email}`
        );

        await sendEmail({
          to: user.email,
          subject: "HRcoM! - Congratulations! Your Role Has Been Updated",
          type: "updateUser",
          name: user.name,
          newRole: newRoleName,
        });

        console.log(`[UPDATE-USER-DEBUG] Email sent successfully.`);
      } catch (emailErr) {
        console.log(
          `[UPDATE-USER-DEBUG] EMAIL FAILED:`,
          emailErr.message
        );
      }
    }

    // Create the audit log for this action
    await logAuditAction({
      adminId: req.user.id,
      action: "UPDATE_USER",
      targetType: "User",
      targetId: user._id,
      targetName: `${user.name} ${user.lastName}`,
      details: updateData,
      ipAddress: req.ip,
    });

    return res.status(200).json({
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
    } = req.query;

    const limit = 10;
    const parsedPage = parseInt(page); // The pages of users

    // Get total count for the frontend pagination 
    const totalUsers = await User.countDocuments();

    const users = await User.find()
      .populate("role_id")
      .populate("department_id")
      .populate("supervisor_id")
      .sort({ joinDate: -1 })         // Sort by the newest users first
      .skip((parsedPage - 1) * limit) // Skip the previous pages
      .limit(limit);                  // 10 Users per page limit

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

    res.status(200).json({
      status: "Success",
      page: parsedPage,
      limit: limit,
      totalPages: Math.ceil(totalUsers / limit),
      totalUsers,
      users: cleanUsers,
    });
  } catch (err) {
    next(err);
  }
};

// Get available active supervisors (Admin only)
export const getActiveSupervisors = async (req, res, next) => {
  try {
    let { page = 1 } = req.query;

    const limit = 10;
    const parsedPage = Math.max(parseInt(page) || 1, 1);

    // Get the Supervisor role ID
    const supervisorRole = await UserRole.findOne({ name: "Supervisor" }).select("_id");
    if (!supervisorRole) {
      return res.status(404).json({ 
        status: "Error",
        message: "Supervisor role not found!" 
      });
    }

    // Count the total active supervisors
    const totalSupervisors = await User.countDocuments({
      status: "Active",
      role_id: supervisorRole._id,
    });

    // Fetch the paginated supervisors (10 per page)
    const supervisors = await User.find({
      status: "Active",
      role_id: supervisorRole._id,
    })
      .select("name lastName email")
      .skip((parsedPage - 1) * limit)
      .limit(limit)
      .sort({ name: 1 }); 

    res.status(200).json({
      status: "Success",
      page: parsedPage,
      limit: limit,
      totalPages: Math.ceil(totalSupervisors / limit),
      totalSupervisors,
      data: supervisors,
    });
  } catch (err) {
    next(err);
  }
};

// Get the 3 recent supervisors (For the dropdown in the Edit/update user form)
export const getRecentSupervisors = async (req, res, next) => {
  try {
    // Get Supervisor role ID
    const supervisorRole = await UserRole.findOne({ name: "Supervisor" }).select("_id");
    if (!supervisorRole) {
      return res.status(404).json({ 
        status: "Error", 
        message: "Supervisor role not found!" 
      });
    }

    // Find the 3 most recent active supervisors
    const supervisors = await User.find({
      role_id: supervisorRole._id,
      status: "Active",
    })
      .select("name lastName email")
      .sort({ joinDate: -1 }) // Get the newest supervisors first
      .limit(3); // Limit to only 3 supervisors

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
    const { q = "", page = 1} = req.query;

    const limit = 10; // 10 users per page max
    const parsedPage = Math.max(parseInt(page), 1); 

    // Build the search query
    const query = {
      $or: [
        { name: { $regex: q, $options: "i" } },
        { lastName: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
      ],
    };

    // Count the total users of the search query for pagination purposes
    const totalUsers = await User.countDocuments(query);

    // Fetch the paginated users
    const users = await User.find(query)
      .populate("role_id")
      .populate("department_id")
      .populate("supervisor_id", "name lastName email")
      .skip((parsedPage - 1) * limit) // Skip the previous pages
      .limit(limit)
      .sort({ joinDate: -1 }); // Sort by the newest users first
    

    res.status(200).json({
      status: "Success",
      message: "User Search results",
      result: users,
      meta: {
        page: parsedPage,
        totalPages: Math.ceil(totalUsers / limit),
        totalUsers,
      }
    });
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
    const { role, department, status, page = 1 } = req.query; // Get the filters wanted

    const limit = 10; // 10 users per page maximum
    const parsedPage = Math.max(parseInt(page), 1); 

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
      const allowedStatus = ["Active", "Inactive", "Blocked", "Pending"];
      if (!allowedStatus.includes(status)) {
        return sendError(res, "Invalid status!");
      }
      query.status = status;
    }

    // Count the total filtered users
    const totalUsers = await User.countDocuments(query);

    // Fetch the paginated filtered users
    const users = await User.find(query)
      .populate("role_id")
      .populate("department_id")
      .populate("supervisor_id", "name lastName email")
      .skip((parsedPage - 1) * limit)
      .limit(limit)
      .lean(); // Convert to plain JSON for the frontend later

    res.status(200).json({
      status: "Success",
      page: parsedPage,
      limit: limit,
      totalPages: Math.ceil(totalUsers / limit),
      totalUsers,
      data: users,
    });
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
    const { id } = req.params; // Supervisor ID
    const { page = 1} = req.query;

    const limit = 10; // 10 team members per page
    const parsedPage = Math.max(parseInt(page), 1);

    // Check if the user exists
    const existingUser = await User.findById(id);
    if (!existingUser) {
      return sendError(res, "User not found!", 404);
    }

    // Only the supervisor himself and the Admin can access the team members list
    if (req.user.role !== "Admin" && req.user._id.toString() !== id) {
      return sendError(res, "Unauthorized access to this team!", 403);
    }

    // Build the query
    const query = { supervisor_id: id };

    // Count the total team members
    const totalMembers = await User.countDocuments(query);

    // Find the paginated list of team members of the supervisor (10 per page)
    const teamMembers = await User.find(query)
      .populate("role_id", "name")
      .populate("department_id", "name")
      .skip((parsedPage - 1) * limit)
      .limit(limit)
      .sort({ joinDate: -1 });

    res.status(200).json({
      status: "Success",
      page: parsedPage,
      limit: limit,
      totalPages: Math.ceil(totalMembers / limit),
      totalMembers,
      data: teamMembers,
    });
  } catch (err) {
    next(err);
  }
};
