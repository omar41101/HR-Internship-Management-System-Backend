import mongoose from "mongoose";
import dotenv from "dotenv";
import UserRole from "../models/UserRole.js";
import Department from "../models/Department.js";

dotenv.config();

async function checkMetadata() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  const roles = await UserRole.find();
  console.log("Roles count:", roles.length);
  roles.forEach(r => console.log(`- ${r.name}`));

  const depts = await Department.find();
  console.log("Departments count:", depts.length);
  depts.forEach(d => console.log(`- ${d.name}`));

  await mongoose.disconnect();
}

checkMetadata();
