const crypto = require('crypto');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Manually parse .env to be 100% sure what we are getting
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const lines = envContent.split('\n');
const env = {};
lines.forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value.length > 0) {
        env[key.trim()] = value.join('=').trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
    }
});

const ENCRYPTION_KEY = env.CODE_SECRET_KEY;
console.log("Raw Key:", ENCRYPTION_KEY);
console.log("Key Length:", ENCRYPTION_KEY ? ENCRYPTION_KEY.length : 0);

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
    console.error("CRITICAL: CODE_SECRET_KEY must be exactly 32 chars.");
    process.exit(1);
}

const IV_LENGTH = 16;

const encrypt = (text) => {
    if (!text) return "";
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    return iv.toString("hex") + ":" + encrypted;
};

const MONGO_URI = env.MONGO_URI || "mongodb://localhost:27017/HRCoM";

async function repair() {
    try {
        console.log("Connecting to:", MONGO_URI);
        await mongoose.connect(MONGO_URI);
        console.log("Connected!");

        const UserRole = mongoose.model('UserRole', new mongoose.Schema({
            name: String,
            code: String
        }, { collection: 'userroles' }));

        const roles = await UserRole.find();
        console.log(`Found ${roles.length} roles.`);

        for (const role of roles) {
            if (role.code && role.code.includes(':')) {
                console.log(`[SKIP] ${role.name} already encrypted.`);
                continue;
            }

            // Standard codes if missing
            const standardCodes = {
                "Admin": "978",
                "Intern": "564",
                "Supervisor": "357",
                "Employee": "159",
                "Not assigned": "000"
            };

            let code = role.code || standardCodes[role.name];
            if (code) {
                const encrypted = encrypt(code.toString());
                await UserRole.findByIdAndUpdate(role._id, { code: encrypted });
                console.log(`[FIXED] ${role.name} -> ${code}`);
            }
        }
        console.log("Done!");
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

repair();
