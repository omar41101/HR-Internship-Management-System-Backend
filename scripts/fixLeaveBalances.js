
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js";
import LeaveType from "../models/LeaveType.js";

dotenv.config();

async function fixBalances() {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/HRCoM?replicaSet=rs0";
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB...");

    const activeTypes = await LeaveType.find({ status: "Active" });
    const users = await User.find({});

    console.log(`Found ${activeTypes.length} active leave types.`);
    console.log(`Checking ${users.length} users...`);

    let updatedCount = 0;

    for (const user of users) {
      let changed = false;
      
      // Initialize if empty
      if (!user.leaveBalances || user.leaveBalances.length === 0) {
        user.leaveBalances = activeTypes.map(type => ({
          typeId: type._id,
          remainingDays: type.defaultDays
        }));
        changed = true;
      } else {
        // Add missing types if some were added later
        for (const type of activeTypes) {
          const hasType = user.leaveBalances.find(b => b.typeId.toString() === type._id.toString());
          if (!hasType) {
            user.leaveBalances.push({
              typeId: type._id,
              remainingDays: type.defaultDays
            });
            changed = true;
          }
        }
      }

      if (changed) {
        await user.save();
        updatedCount++;
      }
    }

    console.log(`Updated ${updatedCount} users with missing leave balances.`);
    process.exit(0);
  } catch (error) {
    console.error("Fix failed:", error);
    process.exit(1);
  }
}

fixBalances();
