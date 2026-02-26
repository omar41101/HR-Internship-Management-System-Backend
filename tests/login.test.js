// Importations
import request from "supertest";
import app from "../server.js";
import mongoose from "mongoose";
import User from "../models/User.js";
import UserRole from "../models/UserRole.js";
import bcrypt from "bcrypt";

// Connect to the Test Database
beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI_TEST);
});

// Clean up the database before each new test
beforeEach(async () => {
  await User.deleteMany({});
  await UserRole.deleteMany({});
});

// Close DB after all tests
afterAll(async () => {
  await mongoose.connection.close();
});

// Creation of a User Role and a User for the tests
const createTestUser = async () => {
  const role = await UserRole.create({ name: "Admin" });
  const password = "Admin123" + process.env.CODE_ADMIN;
  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    name: "Admin",
    lastName: "User",
    email: "admin@example.com",
    password: hashedPassword,
    address: "Sousse",
    phoneNumber: "12357489",
    bonus: 50,
    profileImageURL: "http://meeeee.com",
    bio: "HR Admin",
    faceData: "2222222",
    socialStatus: "Not Married",
    role_id: role._id,
  });

  return { user, role, password };
};

// Diffrent test scenarios
describe("POST /api/login", () => {
  // Scenario 1
  it("Successful Login (Correct Credentials)", async () => {
    const { password } = await createTestUser();

    const res = await request(app)
      .post("/api/login")
      .send({ email: "admin@example.com", password });

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("Success");
    expect(res.body.result).toHaveProperty("token");
    expect(res.body.result.role).toBe("Admin");
  });

  // Scenario 2
  it("Failed Login (Wrong Password)", async () => {
    await createTestUser();

    const res = await request(app)
      .post("/api/login")
      .send({ email: "admin@example.com", password: "wrongpassword" });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("Invalid Email or password!");
  });

  // Scenario 3
  it("Failed Login (Invalid non-existant Email)", async () => {
    const res = await request(app)
      .post("/api/login")
      .send({ email: "notfound@example.com", password: "any" });

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("User not found!");
  });

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
