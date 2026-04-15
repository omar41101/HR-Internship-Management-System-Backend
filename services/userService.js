import User from "../models/User.js";
import UserRole from "../models/UserRole.js";
import Department from "../models/Department.js";
import Document from "../models/Document.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import {
  uploadImageToCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinaryHelper.js";
import {
  fullPhoneNumberValidation,
  fullCINPassportValidation,
  validateUserData,
  generateRandomCode,
} from "../middleware/UserValidation.js";
import { logAuditAction } from "../utils/logger.js";
import { sendEmail } from "../utils/sendEmail.js";
import AppError from "../utils/AppError.js";
import { Parser } from "json2csv";
import ExcelJS from "exceljs";

export const createUser = async (userData, creatorRole) => {
  const {
    name,
    email,
    password,
    phoneNumber,
    countryCode,
    department,
    role,
    gender,
    status,
    jobTitle,
    startDate,
    endDate,
    idType,
    idNumber,
    idCountryCode,
    address,
    emergencyContactName,
    emergencyContactPhone,
  } = userData;

  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw new AppError("Email already exists!", 400);
  }

  const validatedPhone = await fullPhoneNumberValidation(countryCode, phoneNumber);
  const validatedId = idNumber
    ? await fullCINPassportValidation(idType, idCountryCode, idNumber)
    : null;

  const userRole = await UserRole.findOne({ name: role });
  if (!userRole) {
    throw new AppError("Invalid role!", 400);
  }

  const dept = await Department.findOne({ name: department });
  if (!dept) {
    throw new AppError("Invalid department!", 400);
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const verificationCode = generateRandomCode(6);
  const hashedCode = await bcrypt.hash(verificationCode, 10);

  const newUser = new User({
    name,
    email: email.toLowerCase(),
    password: hashedPassword,
    phoneNumber: validatedPhone,
    role_id: userRole._id,
    department_id: dept._id,
    gender,
    status: status || "Active",
    jobTitle,
    startDate,
    endDate,
    idType,
    idNumber: validatedId,
    idCountryCode,
    address,
    emergencyContactName,
    emergencyContactPhone,
    verificationCode: hashedCode,
    verificationCodeExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    loginAttempts: 0,
  });

  await newUser.save();

  await sendEmail({
    to: newUser.email,
    subject: "HRcoM - Verify your account",
    type: "verifyEmail",
    name: newUser.name,
    code: verificationCode,
  });

  await logAuditAction(creatorRole, "CREATE_USER", newUser._id, { name: newUser.name, email: newUser.email });

  return newUser;
};

export const updateUser = async (userId, updateData, updaterRole) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("User not found!", 404);
  }

  if (updateData.phoneNumber && updateData.countryCode) {
    updateData.phoneNumber = await fullPhoneNumberValidation(
      updateData.countryCode,
      updateData.phoneNumber,
      userId
    );
  }

  if (updateData.idNumber && updateData.idType && updateData.idCountryCode) {
    updateData.idNumber = await fullCINPassportValidation(
      updateData.idType,
      updateData.idCountryCode,
      updateData.idNumber,
      userId
    );
  }

  if (updateData.role) {
    const userRole = await UserRole.findOne({ name: updateData.role });
    if (!userRole) {
      throw new AppError("Invalid role!", 400);
    }
    updateData.role_id = userRole._id;
    delete updateData.role;
  }

  if (updateData.department) {
    const dept = await Department.findOne({ name: updateData.department });
    if (!dept) {
      throw new AppError("Invalid department!", 400);
    }
    updateData.department_id = dept._id;
    delete updateData.department;
  }

  Object.assign(user, updateData);
  await user.save();

  await logAuditAction(updaterRole, "UPDATE_USER", userId, updateData);

  return user;
};

export const deleteUser = async (userId, deleterRole) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("User not found!", 404);
  }

  if (user.profilePicture?.publicId) {
    await deleteFromCloudinary(user.profilePicture.publicId);
  }

  await Document.deleteMany({ user_id: userId });
  await user.deleteOne();

  await logAuditAction(deleterRole, "DELETE_USER", userId, { name: user.name });

  return user;
};

export const exportUsers = async (format = "csv") => {
  const users = await User.find()
    .populate("role_id", "name")
    .populate("department_id", "name");

  const data = users.map((user) => ({
    Name: user.name,
    Email: user.email,
    Phone: user.phoneNumber,
    Role: user.role_id?.name,
    Department: user.department_id?.name,
    Status: user.status,
    JobTitle: user.jobTitle,
    StartDate: user.startDate,
  }));

  if (format === "excel") {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Users");

    worksheet.columns = [
      { header: "Name", key: "Name", width: 20 },
      { header: "Email", key: "Email", width: 30 },
      { header: "Phone", key: "Phone", width: 15 },
      { header: "Role", key: "Role", width: 15 },
      { header: "Department", key: "Department", width: 20 },
      { header: "Status", key: "Status", width: 10 },
      { header: "Job Title", key: "JobTitle", width: 20 },
      { header: "Start Date", key: "StartDate", width: 15 },
    ];

    data.forEach((row) => worksheet.addRow(row));

    return workbook;
  }

  const parser = new Parser({
    fields: ["Name", "Email", "Phone", "Role", "Department", "Status", "JobTitle", "StartDate"],
  });
  return parser.parse(data);
};
