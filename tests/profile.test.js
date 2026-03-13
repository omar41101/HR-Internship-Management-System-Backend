import request from "supertest";
import app from "../server.js";
import mongoose from "mongoose";
import User from "../models/User.js";
import UserRole from "../models/UserRole.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

dotenv.config({ path: ".env.test" });

const JWT_SECRET = process.env.JWT_SECRET || "HRCOOOM_TEST_2025_2026";

describe("Profile Viewing Tests (GET /api/users/:id)", () => {
    let adminUser, regularUser1, regularUser2, supervisorUser;
    let adminToken, user1Token, supervisorToken;
    let adminRole, employeeRole, supervisorRole;

    beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGO_URI_TEST);
        }
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    beforeEach(async () => {
        await User.deleteMany({});
        await UserRole.deleteMany({});

        // Create Roles
        adminRole = await UserRole.create({ name: "Admin" });
        employeeRole = await UserRole.create({ name: "Employee" });
        supervisorRole = await UserRole.create({ name: "Supervisor" });

        const hashedPassword = await bcrypt.hash("Password123", 10);

        // Create Admin User
        adminUser = await User.create({
            name: "Admin",
            lastName: "User",
            email: "admin@example.com",
            password: hashedPassword,
            address: "Admin Address",
            phoneNumber: "11111111",
            position: "Admin",
            role_id: adminRole._id,
            status: "Active"
        });
        adminToken = jwt.sign({ id: adminUser._id.toString(), role: "Admin" }, JWT_SECRET);

        // Create Supervisor User
        supervisorUser = await User.create({
            name: "Supervisor",
            lastName: "User",
            email: "supervisor@example.com",
            password: hashedPassword,
            address: "Supervisor Address",
            phoneNumber: "22222222",
            position: "Supervisor",
            role_id: supervisorRole._id,
            status: "Active"
        });
        supervisorToken = jwt.sign({ id: supervisorUser._id.toString(), role: "Supervisor" }, JWT_SECRET);

        // Create Regular User 1 (Supervised by Supervisor)
        regularUser1 = await User.create({
            name: "User",
            lastName: "One",
            email: "user1@example.com",
            password: hashedPassword,
            address: "User 1 Address",
            phoneNumber: "33333333",
            position: "Employee",
            role_id: employeeRole._id,
            supervisor_id: supervisorUser._id,
            status: "Active"
        });
        user1Token = jwt.sign({ id: regularUser1._id.toString(), role: "Employee" }, JWT_SECRET);

        // Create Regular User 2 (Not supervised by Supervisor)
        regularUser2 = await User.create({
            name: "User",
            lastName: "Two",
            email: "user2@example.com",
            password: hashedPassword,
            address: "User 2 Address",
            phoneNumber: "44444444",
            position: "Employee",
            role_id: employeeRole._id,
            status: "Active"
        });
    });

    it("Admin should be able to view any user profile", async () => {
        const res = await request(app)
            .get(`/api/users/${regularUser1._id}`)
            .set("Authorization", `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.email).toBe(regularUser1.email);
        expect(res.body.name).toBe(regularUser1.name);
    });

    it("User should be able to view their own profile", async () => {
        const res = await request(app)
            .get(`/api/users/${regularUser1._id}`)
            .set("Authorization", `Bearer ${user1Token}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.email).toBe(regularUser1.email);
    });

    it("Supervisor should be able to view their subordinate's profile", async () => {
        const res = await request(app)
            .get(`/api/users/${regularUser1._id}`)
            .set("Authorization", `Bearer ${supervisorToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.email).toBe(regularUser1.email);
    });

    it("Regular user should NOT be able to view another user's profile", async () => {
        const res = await request(app)
            .get(`/api/users/${regularUser2._id}`)
            .set("Authorization", `Bearer ${user1Token}`);

        expect(res.statusCode).toBe(403);
        expect(res.body.message).toBe("Unauthorized!");
    });

    it("Should return 404 if user does not exist", async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .get(`/api/users/${fakeId}`)
            .set("Authorization", `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(404);
        expect(res.body.message).toBe("User not found!");
    });

    it("Should return 401 if no token is provided", async () => {
        const res = await request(app)
            .get(`/api/users/${regularUser1._id}`);

        expect(res.statusCode).toBe(401);
        expect(res.body.message).toBe("No Token provided!");
    });

    it("Should return 401 if token is invalid", async () => {
        const res = await request(app)
            .get(`/api/users/${regularUser1._id}`)
            .set("Authorization", "Bearer invalidtoken");

        expect(res.statusCode).toBe(401);
        expect(res.body.message).toBe("Invalid or Expired token!");
    });
});
