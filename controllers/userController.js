// Importations
import User from "../models/User.js";
import UserRole from "../models/UserRole.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
// import {isValidEmail} from "../middleware/EmailValidation";

dotenv.config();

// Login Functionality (All users can do it)
export const login = async (req, res) => {
  const {email, password} = req.body; // Get the credentials submitted

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
    return res.status(404).json({
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
      return res.status(404).json({
        status: "Error",
        message: "Invalid Email or password!",
      });
  }

  // Get the user's actual role
  const userRole = await UserRole.findOne({ _id: user.role_id });
  if (!userRole || userRole.name !== extractedRole) {
    return res.status(404).json({
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

// Add User (Just for testing the login functionnality for now : NOT COMPLETED)
export const addUser = async (req, res) => {
  try {
    const {
      name,
      lastName,
      email,
      password,
      address,
      phoneNumber,
      bonus,
      profileImageURL,
      bio,
      leaveBalance,
      faceData,
      socialStatus,
      hasChildren,
      nbOfChildren,
      isActive,
      isAvailable,
      role_id,
    } = req.body;

    // Check if the user is already in the DB
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        status: "Error",
        message: "User Already Existing!",
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
      phoneNumber,
      bonus,
      profileImageURL,
      bio,
      leaveBalance,
      faceData,
      socialStatus,
      hasChildren,
      nbOfChildren,
      isActive,
      isAvailable,
      role_id,
    });

    return res.status(201).json({
        status: "Success",
        data: {user}
    });
  } 
  catch (err) {
    res.status(500).json({
      status: "Error",
      message: err.message,
    });
  }
};
