import mongoose from "mongoose";
import User from "../models/User.js";
import LeaveType from "../models/LeaveType.js";

const MONGO_URI = "mongo_uri_here"; // Replace with your actual MongoDB connection string

const runMigration = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to DB");

    const leaveTypes = await LeaveType.find({ status: "Active" });

    const users = await User.find();

    for (const user of users) {
      let updated = false;

      // ===== BASIC FIELDS =====
      if (!user.gender) {
        user.gender = "Male"; // or default
        updated = true;
      }

      if (!user.dateOfBirth) {
        user.dateOfBirth = new Date("1990-01-01");
        updated = true;
      }

      if (!user.placeOfBirth) {
        user.placeOfBirth = "Unknown";
        updated = true;
      }

      // ===== ID NUMBER =====
      if (!user.idNumber?.issueDate) {
        user.idNumber.issueDate = new Date("2000-01-01");
        updated = true;
      }

      if (!user.idNumber?.issuePlace) {
        user.idNumber.issuePlace = "Unknown";
        updated = true;
      }

      // ===== EMPLOYMENT =====
      if (!user.employment?.contractJoinDate) {
        user.employment = user.employment || {};
        user.employment.contractJoinDate = new Date();
        updated = true;
      }

      if (!user.employment?.contractEndDate) {
        user.employment.contractEndDate = new Date();
        updated = true;
      }

      // ===== LEAVE BALANCES =====
      if (!user.leaveBalances || user.leaveBalances.length === 0) {
        user.leaveBalances = leaveTypes.map((type) => ({
          typeId: type._id,
          remainingDays: type.defaultDays,
        }));
        updated = true;
      }

      if (updated) {
        await user.save();
        console.log(`✔ Updated user: ${user.email}`);
      }
    }

    console.log("🎉 Migration finished");
    process.exit();
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  }
};

runMigration();