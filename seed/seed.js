// -------------------------------------------------------------------------------------------- //
// ------- SEED SCRIPT FOR IMPORTANNT DATA INSERTION IN THE DATABASE FOR NEW DEVELOPERS ------- //
// -------------------------------------------------------------------------------------------- //

import mongoose from "mongoose";
import UserRole from "../models/UserRole.js";
import Department from "../models/Department.js";
import LeaveType from "../models/LeaveType.js";
import DocumentType from "../models/DocumentType.js";

const MONGO_URI = process.env.MONGO_URI;

const seedDB = async () => {
  try {
    await mongoose.connect(MONGO_URI);

    console.log("Seeding the database...");

    // ========================
    // 1. USER ROLES
    // ========================
    const roles = ["Supervisor", "Admin", "Intern", "Employee"];

    for (const role of roles) {
      await UserRole.updateOne(
        { name: role },
        { name: role },
        { upsert: true }
      );
    }

    // ========================
    // 2. DEPARTMENTS
    // ========================
    const departments = ["IT", "HR", "Finance", "Marketing", "Law"];

    for (const dept of departments) {
      await Department.updateOne(
        { name: dept },
        { name: dept },
        { upsert: true }
      );
    }

    // ========================
    // 3. LEAVE TYPES
    // ========================
    const leaveTypes = [
      { name: "Sick leave", isPaid: true },
      { name: "Unpaid leave", isPaid: false },
      { name: "Maternity/paternity leave", isPaid: true },
      { name: "Emergency leave", isPaid: true },
      { name: "Holidays", isPaid: true },
      { name: "Permission", isPaid: false },
    ];

    for (const lt of leaveTypes) {
      await LeaveType.updateOne(
        { name: lt.name },
        lt,
        { upsert: true }
      );
    }

    // ========================
    // 4. DOCUMENT TYPES
    // ========================
    const documentTypes = ["Personal", "Contract", "Report", "Certificate"];

    for (const doc of documentTypes) {
      await DocumentType.updateOne(
        { name: doc },
        { name: doc },
        { upsert: true }
      );
    }

    console.log("Database seeded successfully!");
    process.exit();
  } catch (error) {
    console.error("Seeding error:", error);
    process.exit(1);
  }
};

seedDB();