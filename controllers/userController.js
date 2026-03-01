// Importations
import User from "../models/User.js";
import UserRole from "../models/UserRole.js";
import Department from "../models/Department.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { isValidEmail, isEmpty } from "../middleware/UserValidation.js";

dotenv.config();

// Login Functionality (All users can do it)
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
      password,
      address,
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
    } = req.body;

    // Check for missing required fields
    const requiredFields = [
      "name",
      "lastName",
      "email",
      "password",
      "address",
      "phoneNumber",
      "position",
      "socialStatus",
      "hasChildren",
      "nbOfChildren",
      "role",
      "department",
    ];

    const missing = requiredFields.filter((field) => !req.body[field]);
    const empty =
      isEmpty(name) &&
      isEmpty(lastName) &&
      isEmpty(address) &&
      isEmpty(position);
    if (missing.length > 0 || empty) {
      return res.status(400).json({
        status: "Error",
        message: "Missing required fields",
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

    // Check the validity of the phone number
    if (phoneNumber.length !== 8 || !/^\d{8}$/.test(phoneNumber)) {
      return res.status(400).json({
        message: "Invalid Phone Number!",
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

    // Check the validity of the password
    if (password.length < 7 || !/[A-Z]/.test(password)) {
      return res.status(400).json({
        message:
          "Password must be at least 7 characters long and contain at least one capital letter!",
      });
    }

    // Check if the code exists
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
          message: "The password must include the secret code!",
        });
    }

    // Check the code matches the role
    if (extractedRole !== role) {
      return res.status(401).json({
        status: "Error",
        message: "Mismatched Role!",
      });
    }

    // Check the validity of the department
    const userdepartment = await Department.findOne({ name: department });
    if (!userdepartment) {
      return res.status(401).json({
        status: "Error",
        message: "Invalid Department!",
      });
    }
    const departmentId = userdepartment._id; // Get the Department ID

    // Hash Password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Add user to the DB
    const user = await User.create({
      name,
      lastName,
      email,
      password: hashedPassword,
      address,
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
    });

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
  } 
  catch (err) {
    res.status(500).json({
      status: "Error",
      message: err.message,
    });
  }
};

// Update User (Only the Admin can do it)
export const updateUser = async (req, res) => {
  
};
