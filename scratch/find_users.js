import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import UserRole from '../models/UserRole.js';

dotenv.config();

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const roles = await UserRole.find();
  console.log('Roles:', roles.map(r => r.name));
  
  const adminRole = roles.find(r => r.name === 'Admin' || r.name === 'HR');
  const empRole = roles.find(r => r.name === 'Employee');
  
  const admin = await User.findOne({ role_id: adminRole?._id });
  const employee = await User.findOne({ role_id: empRole?._id });
  
  console.log('Admin Email:', admin?.email);
  console.log('Employee Email:', employee?.email);
  
  await mongoose.disconnect();
}

check();
