import './config-env.js'; // This must be first to load env vars before other imports
import mongoose from 'mongoose';
import { encrypt } from './utils/cryptoUtils.js';

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/HRCoM";

const repairRoles = async () => {
    try {
        console.log("CODE_SECRET_KEY loaded:", process.env.CODE_SECRET_KEY ? "YES" : "NO");
        if (process.env.CODE_SECRET_KEY) {
            console.log("Length:", process.env.CODE_SECRET_KEY.length);
        }

        await mongoose.connect(MONGO_URI);
        console.log("Connected to MongoDB for repair...");

        const userRoleSchema = new mongoose.Schema({
            name: String,
            code: String
        }, { collection: 'userroles' }); // Explicitly target the collection

        const UserRole = mongoose.model('UserRole_Repair', userRoleSchema);

        const roles = await UserRole.find();
        console.log(`Found ${roles.length} roles to check.`);

        const standardCodes = {
            "Admin": "978",
            "Intern": "564",
            "Supervisor": "357",
            "Employee": "159",
            "Not assigned": "000"
        };

        let repairedCount = 0;
        for (const role of roles) {
            console.log(`Checking role: ${role.name}`);

            if (role.code && role.code.includes(':')) {
                console.log(`[PASS] Role "${role.name}" already has an encrypted code.`);
                continue;
            }

            let codeToEncrypt = role.code;
            if (!codeToEncrypt && standardCodes[role.name]) {
                codeToEncrypt = standardCodes[role.name];
            }

            if (codeToEncrypt) {
                const encrypted = encrypt(codeToEncrypt);
                await UserRole.findByIdAndUpdate(role._id, { code: encrypted });
                console.log(`[FIXED] Encrypted code for role "${role.name}" (${codeToEncrypt})`);
                repairedCount++;
            } else {
                console.log(`[WARN] Role "${role.name}" has no defined code and no standard map. Skipping.`);
            }
        }

        console.log(`Repair complete! ${repairedCount} roles updated.`);
        process.exit(0);
    } catch (err) {
        console.error("Repair failed:", err);
        process.exit(1);
    }
};

repairRoles();
