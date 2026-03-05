import request from "supertest";
import app from "../server.js";
import mongoose from "mongoose";
import User from "../models/User.js";
import UserRole from "../models/UserRole.js";
import AuditLog from "../models/AuditLog.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { encrypt } from "../utils/cryptoUtils.js";

// Ensure a valid key for cryptoUtils in tests
process.env.CODE_SECRET_KEY = process.env.CODE_SECRET_KEY || "12345678901234567890123456789012";

describe("Audit Logging Tests", () => {
    let adminToken;
    let adminUser;

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
        await AuditLog.deleteMany({});

        // Create an Admin user for logging
        const adminRole = await UserRole.create({
            name: "Admin",
            code: encrypt("978")
        });
        const hashedPassword = await bcrypt.hash("Admin123978", 10);
        adminUser = await User.create({
            name: "Admin",
            lastName: "User",
            email: "admin@test.com",
            password: hashedPassword,
            address: "Test City",
            phoneNumber: "12345678",
            position: "Admin",
            role_id: adminRole._id,
        });

        adminToken = jwt.sign({ id: adminUser._id, role: "Admin" }, process.env.JWT_SECRET);
    });

    it("should create an audit log entry when a user is created", async () => {
        const newUser = {
            name: "New",
            lastName: "Employee",
            email: "employee@test.com",
            address: "Work City",
            countryCode: "+216",
            phoneNumber: "98765432",
            position: "Developer",
            role: "Employee",
            department: "Unassigned",
        };

        // Create the "Employee" role with valid encrypted code
        await UserRole.create({
            name: "Employee",
            code: encrypt("159")
        });

        const res = await request(app)
            .post("/api/users")
            .set("Authorization", `Bearer ${adminToken}`)
            .send(newUser);

        if (res.statusCode !== 201) {
            console.log("Error Response Body:", res.body);
        }
        expect(res.statusCode).toBe(201);

        // Verify Audit Log
        const log = await AuditLog.findOne({ action: "CREATE_USER" });
        expect(log).not.toBeNull();
        expect(log.admin_id.toString()).toBe(adminUser._id.toString());
        expect(log.target_type).toBe("User");
    });

    it("should create an audit log entry when a user is deleted", async () => {
        const targetUser = await User.create({
            name: "To",
            lastName: "Delete",
            email: "delete@test.com",
            password: "pass",
            address: "X",
            phoneNumber: "0000",
            position: "X",
        });

        const res = await request(app)
            .delete(`/api/users/${targetUser._id}`)
            .set("Authorization", `Bearer ${adminToken}`);

        expect(res.statusCode).toBe(200);

        const log = await AuditLog.findOne({ action: "DELETE_USER" });
        expect(log).not.toBeNull();
        expect(log.target_id.toString()).toBe(targetUser._id.toString());
        expect(log.target_name).toBe("To Delete");
    });
});
