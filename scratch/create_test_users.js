import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import User from '../models/User.js';
import UserRole from '../models/UserRole.js';
import Project from '../models/Project.js';
import Team from '../models/Team.js';
import Department from '../models/Department.js';
import LeaveType from '../models/LeaveType.js';

dotenv.config();

async function create() {
  await mongoose.connect(process.env.MONGO_URI);
  
  // Ensure roles exist
  let adminRole = await UserRole.findOne({ name: 'Admin' });
  if (!adminRole) adminRole = await UserRole.create({ name: 'Admin' });
  
  let empRole = await UserRole.findOne({ name: 'Employee' });
  if (!empRole) empRole = await UserRole.create({ name: 'Employee' });

  let supervisorRole = await UserRole.findOne({ name: 'Supervisor' });
  if (!supervisorRole) supervisorRole = await UserRole.create({ name: 'Supervisor' });
  
  const password = await bcrypt.hash('TestPassword123', 10);
  
  const admin = await User.findOneAndUpdate(
    { email: 'test_admin@test.com' },
    {
      name: 'Test', lastName: 'Admin', email: 'test_admin@test.com', password,
      gender: 'Male', role_id: adminRole._id, dateOfBirth: new Date('1990-01-01'),
      placeOfBirth: 'Test', idType: 'CIN', idNumber: { number: '111', countryCode: 'TN', issueDate: new Date(), issuePlace: 'Test' },
      address: 'Test', phoneNumber: '123', position: 'HR', employment: { contractJoinDate: new Date(), contractEndDate: new Date() },
      status: 'Active', mustResetPassword: false, faceEnrolled: true // Bypass OTP and password reset
    },
    { upsert: true, new: true }
  );

  const employee = await User.findOneAndUpdate(
    { email: 'test_emp@test.com' },
    {
      name: 'Test', lastName: 'Employee', email: 'test_emp@test.com', password,
      gender: 'Male', role_id: empRole._id, dateOfBirth: new Date('1995-01-01'),
      placeOfBirth: 'Test', idType: 'CIN', idNumber: { number: '222', countryCode: 'TN', issueDate: new Date(), issuePlace: 'Test' },
      address: 'Test', phoneNumber: '456', position: 'Dev', employment: { contractJoinDate: new Date(), contractEndDate: new Date() },
      status: 'Active', mustResetPassword: false, faceEnrolled: true // Bypass OTP and password reset
    },
    { upsert: true, new: true }
  );

  // Create a department
  let dept = await Department.findOne({ name: 'Test Dept' });
  if (!dept) dept = await Department.create({ name: 'Test Dept', description: 'Test' });

  // Create a team
  let team = await Team.findOne({ name: 'Test Team' });
  if (!team) team = await Team.create({
    name: 'Test Team',
    department: dept._id,
    members: [{ user: employee._id, role: 'Developer' }]
  });

  // Create a project
  await Project.findOneAndUpdate(
    { name: 'Test E2E Project' },
    {
      name: 'Test E2E Project',
      description: 'Project for Playwright testing',
      status: 'In Progress',
      priority: 'High',
      sector: 'Technology',
      startDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      team: team._id,
      supervisor: admin._id
    },
    { upsert: true }
  );

  // Ensure Leave Types exist for the frontend to load
  const leaveTypes = ['Annual Leave', 'Sick Leave', 'Personal', 'Maternity', 'Paternity', 'Unpaid'];
  for (const name of leaveTypes) {
    await LeaveType.findOneAndUpdate(
      { name },
      { name, defaultDays: 30 },
      { upsert: true }
    );
  }

  console.log('Test environment seeded with Active users.');
  await mongoose.disconnect();
}

create();
