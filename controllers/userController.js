// Importations
import User from "../models/User.js";
import UserRole from "../models/UserRole.js";
import Department from "../models/Department.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { sendEmail } from "../utils/sendEmail.js";
import { decrypt } from "../utils/cryptoUtils.js";
import { Parser } from "json2csv";
import ExcelJS from "exceljs";
import cloudinary from "../config/cloudinary.js";
import {
  isValidEmail,
  isEmpty,
  validatePhoneNumber,
  isWithinRange,
  generatePassword,
} from "../middleware/UserValidation.js";
import { logAuditAction } from "../utils/logger.js";

dotenv.config();

// Login Functionality (All users can do it)
export const login = async (req, res) => {
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

  // Compare password
  const isMatch = await bcrypt.compare(trimmedPassword, user.password);
  if (!isMatch) {
    console.log(`[LOGIN-DEBUG] Password mismatch for: ${trimmedEmail}`);
    return res.status(401).json({
      status: "Error",
      message: "Invalid Email or password!",
    });
  }
  console.log(`[LOGIN-DEBUG] Password match for: ${trimmedEmail}`);

  // Extract role from the password
  let extractedRole = "";
  const code = trimmedPassword.slice(-3);

  // Extract the role from the password
  const roleCodes = await UserRole.find({}, { name: 1, code: 1 }); // Only fetch the role name and role code

  // Find the role that matches the extracted code
  const matchedRole = roleCodes.find((role) => {
    try {
      const decryptedCode = decrypt(role.code);
      return decryptedCode === code;
    } catch (err) {
      return false;
    }
  });

  if (!matchedRole) {
    console.log(`[LOGIN-DEBUG] No matching role found for code: ${code}`);
    return res.status(401).json({
      status: "Error",
      message: "Invalid Email or password!",
    });
  }
  extractedRole = matchedRole.name;

  // Get the user's actual role
  const userRole = await UserRole.findOne({ _id: user.role_id });
  if (
    !userRole ||
    userRole.name.toLowerCase() !== extractedRole.toLowerCase()
  ) {
    console.log(
      `[DEBUG] Role mismatch: User has "${userRole?.name}", extracted "${extractedRole}" from password`,
    );
    return res.status(401).json({
      status: "Error",
      message: "Invalid Email or password!",
    });
  }

  // Generate JWT token
  const token = jwt.sign(
    { id: user._id, role: userRole.name },
    process.env.JWT_SECRET,
    { expiresIn: "24h" },
  );

  res.json({
    status: "Success",
    result: {
      token,
      userId: user._id,
      role: userRole.name,
    },
    message: "Logged in successfully!",
  });
};

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
      isActive,
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

    // Get and Decrypt the user role code
    const roleCode = decrypt(userrole.code);

    // Generate password + code
    const password = generatePassword(roleCode);

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

    // Hash Password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    console.log(`[ADD-USER-DEBUG] Creating user in DB...`);
    const user = await User.create({
      name,
      lastName,
      email: trimmedEmail,
      password: hashedPassword,
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
      isActive,
      isAvailable,
      role_id: roleId,
      department_id: departmentId,
      supervisor_id: supervisorId,
    });
    console.log(`[ADD-USER-DEBUG] User created successfully! ID: ${user._id}`);

    // Send Email to the User containing his password + Platform URL
    try {
      console.log(
        `[ADD-USER-DEBUG] Sending onboarding email to: ${trimmedEmail}`,
      );

      await sendEmail({
        to: user.email,
        subject: "Welcome to HRcoM!",
        type: "addUser",
        name: user.name,
        password: password,
      });

      console.log(`[ADD-USER-DEBUG] Email sent successfully.`);
    } catch (emailErr) {
      console.log(
        `[ADD-USER-DEBUG] EMAIL FAILED but user created:`,
        emailErr.message,
      );
    }

    res.status(201).json({
      status: "Success",
      message: "User created successfully!",
      result: user,
    });

    // Logging the action
    await logAuditAction({
      adminId: req.user.id,
      action: "CREATE_USER",
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

// Get All Users Functionnality (Only the Admin can do it)
export const getAllUsers = async (req, res) => {
  try {
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
      isActive: user.isActive,
      isAvailable: user.isAvailable,
      joinDate: user.joinDate,
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
    // Format the user data
    const formattedUser = user
      ? {
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
        isActive: user.isActive,
        isAvailable: user.isAvailable,
        joinDate: user.joinDate,
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
      }
      : null;

    res.status(200).json(formattedUser);
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
      validatePhoneNumber(updateData.countryCode, updateData.phoneNumber) === null
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
        message: "User not found",
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
            message: "Invalid Role",
          });
        }

        updateData.role_id = roleDoc._id; // Get the new role ID

        // Generate NEW password for the NEW role code
        let code = "";
        try {
          code = decrypt(roleDoc.code); // Decrypt the role code
        } catch (err) {
          console.log(
            `[UPDATE-USER-DEBUG] Error decrypting role code for ${roleDoc.name}: ${err.message}`,
          );
        }

        if (!code) {
          console.log(
            `[UPDATE-USER-DEBUG] WARNING: No code found for role: ${roleDoc.name}`,
          );
        }

        newPasswordRaw = generatePassword(code);
        updateData.password = await bcrypt.hash(newPasswordRaw, 10); // Hash the new password

        console.log(
          `[UPDATE-USER-DEBUG] Role changed from "${currentRoleName}" to "${roleDoc.name}". New code: "${code}", Password generated.`,
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
            message: "Invalid Department",
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
            message: "Invalid Supervisor",
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

    // Update the user
    const user = await User.findByIdAndUpdate(id, updateData, { returnDocument: "after" });

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
      if (status === "Active") query.isActive = true;
      else if (status === "Inactive") query.isActive = false;
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
        message: "User not found",
      });
    }

    // Toggle the user's status
    user.isActive = !user.isActive;
    await user.save();

    res.status(200).json({
      status: "Success",
      message: `User has been ${user.isActive ? "activated" : "deactivated"}`,
      data: { id: user._id, isActive: user.isActive },
    });

    // Logging the action
    await logAuditAction({
      adminId: req.user.id,
      action: "TOGGLE_STATUS",
      targetType: "User",
      targetId: user._id,
      targetName: `${user.name} ${user.lastName}`,
      details: { isActive: user.isActive },
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
    const formattedUsers = users.map(user => ({
      name: user.name,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role_id?.name,
      department: user.department_id?.name,
      isActive: user.isActive ? "true" : "false",
      joinDate: new Date(user.joinDate).toLocaleDateString("en-GB")
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
      "isActive",
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
      message: err.message
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
      { header: "Active", key: "isActive", width: 10 },
      { header: "Join Date", key: "joinDate", width: 15 },
    ];

    users.forEach((user) =>
      sheet.addRow({
        ...user,
        role: user.role_id?.name,
        department: user.department_id?.name,
        isActive: user.isActive ? "True" : "False",
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
      message: err.message
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
        message: "User not found",
      });
    }

    // Check if the image is provided
    if (!req.file) {
      return res.status(400).json({
        status: "Error",
        message: "No file uploaded",
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
        }
      );

      stream.end(req.file.buffer); // Upload buffer directly
    });

    // Update the user's profileImageURL 
    const user = await User.findByIdAndUpdate(
      userId,
      { profileImageURL: result.secure_url },
      { returnDocument: 'after' }
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
