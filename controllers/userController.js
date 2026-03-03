// Importations
import User from "../models/User.js";
import UserRole from "../models/UserRole.js";
import Department from "../models/Department.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import {
  isValidEmail,
  isEmpty,
  validatePhoneNumber,
  isWithinRange,
  generatePassword,
} from "../middleware/UserValidation.js";
import { sendOnboardingEmail } from "../utils/sendEmail.js";

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

  // Get the Actual role codes
  const adminCode = (process.env.CODE_ADMIN || "").trim();
  const internCode = (process.env.CODE_INTERN || "").trim();
  const supervisorCode = (process.env.CODE_SUPERVISOR || "").trim();
  const employeeCode = (process.env.CODE_EMPLOYEE || "").trim();

  console.log(
    `[LOGIN-DEBUG] Extracted code: "${code}" | Expected: Admin:${adminCode}, Employee:${employeeCode}, Intern:${internCode}, Supervisor:${supervisorCode}`,
  );

  switch (code) {
    case adminCode:
      extractedRole = "Admin";
      break;

    case internCode:
      extractedRole = "Intern";
      break;

    case supervisorCode:
      extractedRole = "Supervisor";
      break;

    case employeeCode:
      extractedRole = "Employee";
      break;

    default:
      return res.status(401).json({
        status: "Error",
        message: "Invalid Email or password!",
      });
  }

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
      phoneNumber,
      position,
      bonus,
      profileImageURL,
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
    if (validatePhoneNumber(phoneNumber) === null)
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

    // Role check
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
    const roleId = userrole._id; // Get the role ID
    console.log(`[ADD-USER-DEBUG] Role found: ${userrole.name} (${roleId})`);

    // Generate password + code
    let password = "";
    switch (role) {
      case "Admin":
        password = generatePassword(process.env.CODE_ADMIN);
        break;

      case "Intern":
        password = generatePassword(process.env.CODE_INTERN);
        break;

      case "Supervisor":
        password = generatePassword(process.env.CODE_SUPERVISOR);
        break;

      case "Employee":
        password = generatePassword(process.env.CODE_EMPLOYEE);
        break;

      default:
        return res.status(401).json({
          status: "Error",
          message: "Invalid Role!",
        });
    }

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
      phoneNumber,
      position,
      bonus,
      profileImageURL,
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
      console.log(`[ADD-USER-DEBUG] Sending onboarding email to: ${trimmedEmail}`);

      await sendOnboardingEmail(trimmedEmail, name, password);

      console.log(`[ADD-USER-DEBUG] Email sent successfully.`);
    } catch (emailErr) {
      console.log(`[ADD-USER-DEBUG] EMAIL FAILED but user created:`, emailErr.message);
    }

    res.status(201).json({
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
      validatePhoneNumber(updateData.phoneNumber) === null
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
        const roleNameNormalized = roleDoc.name.toLowerCase();

        const adminCode = (process.env.CODE_ADMIN || "").trim();
        const internCode = (process.env.CODE_INTERN || "").trim();
        const supervisorCode = (process.env.CODE_SUPERVISOR || "").trim();
        const employeeCode = (process.env.CODE_EMPLOYEE || "").trim();

        if (roleNameNormalized === "Admin") code = adminCode;
        else if (roleNameNormalized === "Intern") code = internCode;
        else if (roleNameNormalized === "Supervisor") code = supervisorCode;
        else if (roleNameNormalized === "Employee") code = employeeCode;

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

    // Update the user
    const user = await User.findByIdAndUpdate(id, updateData, { new: true });

    // If role changed, send by Email the new credentials to the User
    if (roleChanged) {
       try {
        console.log(`[UPDATE-USER-DEBUG] Sending updated credentials to: ${user.email}`);

        await sendOnboardingEmail(user.email, user.name, newPasswordRaw);
      } catch (emailErr) {
        console.log(`[UPDATE-USER-DEBUG] Role updated but email failed:`, emailErr.message);
      }
    }

    res.status(200).json({
      status: "Success",
      message: roleChanged
        ? "User role updated and new credentials sent."
        : "User updated successfully.",
      data: user,
    });
  } catch (err) {
    res.status(500).json({ 
      status: "Error", 
      message: err.message 
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
        message: "User not found" 
      });
    }

    res.status(200).json({ 
      status: "Success", 
      message: "User deleted successfully" 
    });
  } catch (err) {
    res.status(500).json({ 
      status: "Error", 
      message: err.message 
    });
  }
};

// Search User (Only for Admins) STILL NOT DONE
export const searchUser = async (req, res) => {
  try {
  } catch (err) {
    res.status(500).json({
      status: "Error",
      message: err.message,
    });
  }
};

// Toggle User Status (Only for Admins) STILL NOT DONE

// Export User Status (Only for Admins) STILL NOT DONE
