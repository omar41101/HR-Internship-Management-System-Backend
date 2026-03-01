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
  generatePassword,
} from "../middleware/UserValidation.js";
import { sendOnboardingEmail } from "../utils/sendEmail.js";

dotenv.config();

// Login Functionality (All users can do it) : STILL NOT DONE
export const login = async (req, res) => {
  const { email, password } = req.body; // Get the credentials submitted

  // Check the User existance in the Database
  const user = await User.findOne({ email: email });
  if (!user) {
    return res.status(404).json({
      status: "Error",
      message: "User not found!",
    });
  }

  // Compare password - hashed password
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({
      status: "Error",
      message: "Invalid Email or password!",
    });
  }

  // Extract role from the password
  let extractedRole = "";
  const code = password.slice(-3);
  switch (code) {
    case process.env.CODE_ADMIN:
      extractedRole = "Admin";
      break;

    case process.env.CODE_INTERN:
      extractedRole = "Intern";
      break;

    case process.env.CODE_SUPERVISOR:
      extractedRole = "Supervisor";
      break;

    case process.env.CODE_EMPLOYEE:
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
  if (!userRole || userRole.name !== extractedRole) {
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

    // Check for missing required fields
    const requiredFields = [
      "name",
      "lastName",
      "email",
      "address",
      "phoneNumber",
      "position",
      "socialStatus",
      "hasChildren",
      "nbOfChildren",
      "role",
      "department",
    ];
    // "joinDate",

    const missing = requiredFields.filter(
      (field) => req.body[field] === undefined || req.body[field] === null,
    );
    const empty =
      isEmpty(name) &&
      isEmpty(lastName) &&
      isEmpty(address) &&
      isEmpty(position);

    if (missing.length > 0 || empty) {
      return res.status(400).json({
        status: "Error",
        message: "Missing required fields",
        missing,
      });
    }

    // Check if the user is already in the DB
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(401).json({
        status: "Error",
        message: "User Already Existing!",
      });
    }

    // Check the validity of the email
    if (!isValidEmail(email)) {
      return res.status(400).json({
        status: "Error",
        message: "Invalid Email!",
      });
    }

    // Check the validity of the role
    const userrole = await UserRole.findOne({ name: role });
    if (!userrole) {
      return res.status(401).json({
        status: "Error",
        message: "Invalid Role!",
      });
    }
    const roleId = userrole._id; // Get the role ID

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

    // Check for the existance of the supervisor's name if the role is Intern or Employee
    if ((role === "Intern" || role === "Employee") && !supervisor_full_name) {
      return res.status(400).json({
        status: "Error",
        message: "Supervisor name is required!",
      });
    }

    // Get the supervisor's ID
    const [supervisor_name, supervisor_lastName] =
      supervisor_full_name.split(" ");
    const supervisor = await User.findOne({
      name: supervisor_name,
      lastName: supervisor_lastName,
    });
    if (!supervisor) {
      return res.status(404).json({
        status: "Error",
        message: "Supervisor not found!",
      });
    }
    const supervisorId = supervisor._id;

    // Check the validity of the department
    const userdepartment = await Department.findOne({ name: department });
    if (!userdepartment) {
      return res.status(401).json({
        status: "Error",
        message: "Invalid Department!",
      });
    }
    const departmentId = userdepartment._id; // Get the Department ID

    // Check the validity of the phone number
    if (phoneNumber.length !== 8 || !/^\d{8}$/.test(phoneNumber)) {
      return res.status(400).json({
        message: "Invalid Phone Number!",
      });
    }

    // Hash Password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Add user to the DB
    const user = await User.create({
      name,
      lastName,
      email,
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

    // Send an Email to the user (password + platform link)
    await sendOnboardingEmail(email, name, password);

    return res.status(201).json({
      status: "Success",
      data: { user },
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
    const users = await User.find();
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
    const user = await User.findById(req.params.id);
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

// Update User (Only the Admin can do it)   STILL NOT DONE
export const updateUser = async (req, res) => {};

// Delete User (Only for Admins) STILL Not DONE
export const deleteUser = async (req, res) => {
  try {
  } catch (err) {
    res.status(500).json({
      status: "Error",
      message: err.message,
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

// Toggle User Status (Only for Admins)

// Export User Status (Only for Admins)
