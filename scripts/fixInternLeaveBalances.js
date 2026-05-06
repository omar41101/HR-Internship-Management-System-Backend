import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js";
import UserRole from "../models/UserRole.js";
import LeaveType from "../models/LeaveType.js";

dotenv.config();

// Intern-specific leave policy (must match userService.js)
const INTERN_ALLOWED = ["Annual Leave", "Sick Leave", "Personal"];
const INTERN_DEFAULTS = {
  "Annual Leave": 13,
  "Sick Leave": 8,
  "Personal": 3,
};

async function fixInternBalances() {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/HRCoM?replicaSet=rs0";
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB...");

    // Find the intern role ID
    const internRole = await UserRole.findOne({ name: "Intern" });
    if (!internRole) {
      console.log("No 'Intern' role found in DB. Exiting.");
      process.exit(0);
    }

    // Get all active leave types
    const leaveTypes = await LeaveType.find({ status: "Active" });
    const internTypes = leaveTypes.filter((t) => INTERN_ALLOWED.includes(t.name));

    // Find all intern users
    const interns = await User.find({ role_id: internRole._id });
    console.log(`Found ${interns.length} intern(s). Resetting balances...`);

    for (const intern of interns) {
      intern.leaveBalances = internTypes.map((type) => ({
        typeId: type._id,
        remainingDays: INTERN_DEFAULTS[type.name] ?? type.defaultDays,
      }));
      await intern.save();
      console.log(`  ✓ Reset: ${intern.name} ${intern.lastName}`);
    }

    console.log("\nDone! All interns have been updated.");
    process.exit(0);
  } catch (error) {
    console.error("Fix failed:", error);
    process.exit(1);
  }
}

fixInternBalances();
