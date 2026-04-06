<<<<<<< HEAD
// Importations
import request from "supertest";
import app from "../server.js";
import mongoose from "mongoose";
import User from "../models/User.js";
import UserRole from "../models/UserRole.js";
import bcrypt from "bcrypt";
=======
// Imports
import request from "supertest";
import app from "../server.js";
import mongoose from "mongoose";
import bcrypt from "bcrypt";

import User from "../models/User.js";
import UserRole from "../models/UserRole.js";
import Department from "../models/Department.js";
>>>>>>> sprint1

// Connect to the Test Database
beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI_TEST);
});

<<<<<<< HEAD
// Clean up the database before each new test
beforeEach(async () => {
  await User.deleteMany({});
  await UserRole.deleteMany({});
});

// Close DB after all tests
=======
// Clean up the database before each test
beforeEach(async () => {
  await User.deleteMany({});
  await UserRole.deleteMany({});
  await Department.deleteMany({});
});

// Close DB connection after all tests
>>>>>>> sprint1
afterAll(async () => {
  await mongoose.connection.close();
});

<<<<<<< HEAD
// Creation of a User Role and a User for the tests
const createTestUser = async () => {
  const role = await UserRole.create({ name: "Admin" });
  const password = "Admin123" + process.env.CODE_ADMIN;
=======
// Helper function to create a test user
const createTestUser = async () => {
  const role = await UserRole.create({
    name: "Admin",
    description: "HR Admin Test Role",
  });

  const department = await Department.create({
    name: "HR",
    description: "Human Resources Department",
  });

  const password = "Admin123";
>>>>>>> sprint1
  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    name: "Admin",
    lastName: "User",
    email: "admin@example.com",
<<<<<<< HEAD
    password: hashedPassword,
    address: "Sousse",
    phoneNumber: "12357489",
    bonus: 50,
    profileImageURL: "http://meeeee.com",
    bio: "HR Admin",
    faceData: "2222222",
    socialStatus: "Not Married",
    role_id: role._id,
=======
    idType: "CIN",
    idNumber: {
      number: "12145678",
      countryCode: "TN",
    },
    address: "Sousse",
    joinDate: Date.now(),
    password: hashedPassword,
    countryCode: "TN",
    phoneNumber: "97123456",
    position: "HR Admin",
    bonus: 50,
    profileImageURL: "",
    bio: "HR Admin",
    socialStatus: "Not Married",
    status: "Active",
    role_id: role._id,
    department_id: department._id,
    loginAttempts: 0,
    verificationCode: null,
    verificationCodeExpires: null,
    mustResetPassword: false,
>>>>>>> sprint1
  });

  return { user, role, password };
};

<<<<<<< HEAD
// Diffrent test scenarios
describe("POST /api/login", () => {
  // Scenario 1
=======
// LOGIN TESTS
describe("POST /api/login", () => {

  // Scenario 1: Successful Login
>>>>>>> sprint1
  it("Successful Login (Correct Credentials)", async () => {
    const { password } = await createTestUser();

    const res = await request(app)
      .post("/api/login")
<<<<<<< HEAD
      .send({ email: "admin@example.com", password });
=======
      .send({
        email: "admin@example.com",
        password,
      });
>>>>>>> sprint1

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("Success");
    expect(res.body.result).toHaveProperty("token");
    expect(res.body.result.role).toBe("Admin");
  });

<<<<<<< HEAD
  // Scenario 2
=======
  // Scenario 2: Wrong password
>>>>>>> sprint1
  it("Failed Login (Wrong Password)", async () => {
    await createTestUser();

    const res = await request(app)
      .post("/api/login")
<<<<<<< HEAD
      .send({ email: "admin@example.com", password: "wrongpassword" });
=======
      .send({
        email: "admin@example.com",
        password: "wrongpassword",
      });
>>>>>>> sprint1

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("Invalid Email or password!");
  });

<<<<<<< HEAD
  // Scenario 3
  it("Failed Login (Invalid non-existant Email)", async () => {
    const res = await request(app)
      .post("/api/login")
      .send({ email: "notfound@example.com", password: "any" });
=======
  // Scenario 3: User does not exist (wrong email)
  it("Failed Login (User Not Found): Wrong Email", async () => {
    const res = await request(app)
      .post("/api/login")
      .send({
        email: "notfound@example.com",
        password: "any",
      });
>>>>>>> sprint1

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("User not found!");
  });

<<<<<<< HEAD
  // Scenario 4
  it("Failed Login (Role Mismatch)", async () => {
    // Create an Intern
    const roleIntern = await UserRole.create({
      name: "Intern",
      description: "DotJcoM MERN Stack developer Intern",
    });
    const passwordIntern = "Intern357" + process.env.CODE_INTERN;
    const hashedPassword = await bcrypt.hash(passwordIntern, 10);

    const user = await User.create({
      name: "Test",
      lastName: "Intern",
      email: "intern@example.com",
      password: hashedPassword,
      address: "Sousse",
      phoneNumber: "32148975",
      bonus: 0,
      profileImageURL: "",
      bio: "Intern",
      faceData: "12345",
      socialStatus: "Not Married",
      role_id: roleIntern._id,
    });

    const res = await request(app)
      .post("/api/login")
      .send({ email: "intern@example.com", password: "Admin123978" });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("Invalid Email or password!");
    expect(roleIntern.name).not.toBe("Admin");
  });
});
=======
  // Scenario 4: Account gets blocked after 3 failed attempts
  it("Blocks account after 3 failed login attempts (Wrong password 3 times)", async () => {
    await createTestUser();

    for (let i = 0; i < 3; i++) {
      await request(app)
        .post("/api/login")
        .send({
          email: "admin@example.com",
          password: "wrongpassword",
        });
    }

    const user = await User.findOne({ email: "admin@example.com" });

    expect(user.status).toBe("Blocked");
  });

  // Scenario 5: Account not verified (OTP required)
  it("Requires OTP verification if account is not active", async () => {
    const { user } = await createTestUser();

    // Un-activate the account to trigger OTP verification requirement
    user.status = "Pending";
    await user.save();

    const res = await request(app)
      .post("/api/login")
      .send({
        email: "admin@example.com",
        password: "Admin123",
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("Success but OTPVerificationRequired");
  });

  // Scenario 6: Must reset password
  it("Requires password reset if mustResetPassword is true", async () => {
    const { user } = await createTestUser();

    // Trigger password reset requirement
    user.mustResetPassword = true;
    await user.save();

    const res = await request(app)
      .post("/api/login")
      .send({
        email: "admin@example.com",
        password: "Admin123",
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("Success but MustResetPassword");
  });

});
>>>>>>> sprint1
