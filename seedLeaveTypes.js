
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import LeaveType from "./models/LeaveType.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const leaveTypes = [
  { 
    name: "Annual Leave", 
    defaultDays: 25, 
    deductFrom: "annual", 
    status: "Active",
    description: "Paid annual leave for vacation and rest."
  },
  { 
    name: "Sick Leave", 
    defaultDays: 15, 
    deductFrom: "sick", 
    status: "Active",
    description: "Leave for medical reasons or illness."
  },
  { 
    name: "Personal", 
    defaultDays: 3, 
    deductFrom: "personal", 
    status: "Active",
    description: "Leave for personal errands or short-term needs."
  },
  { 
    name: "Maternity", 
    defaultDays: 90, 
    deductFrom: "maternity", 
    status: "Active",
    gender: "Female",
    requiresChildBirth: true,
    description: "Leave for mothers following childbirth."
  },
  { 
    name: "Paternity", 
    defaultDays: 7, 
    deductFrom: "paternity", 
    status: "Active",
    gender: "Male",
    requiresChildBirth: true,
    description: "Leave for fathers following childbirth."
  },
  { 
    name: "Unpaid/Others", 
    defaultDays: 0, 
    deductFrom: "none", 
    status: "Active",
    isPaid: false,
    description: "Unpaid leave or other categories not covered elsewhere."
  },
];

async function seed() {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/HRCoM?replicaSet=rs0";
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB...");

    for (const type of leaveTypes) {
      const exists = await LeaveType.findOne({ name: type.name });
      if (!exists) {
        await LeaveType.create(type);
        console.log(`Inserted: ${type.name}`);
      } else {
        await LeaveType.findByIdAndUpdate(exists._id, type);
        console.log(`Updated: ${type.name}`);
      }
    }

    console.log("Seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }
}

seed();
