import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import fs from 'fs';

dotenv.config();

const checkUsers = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/HRCoM');
        console.log('Connected to MongoDB');

        const users = await User.find({}, 'email idType idNumber');
        let output = `Total users found: ${users.length}\n\n`;

        users.forEach(user => {
            output += `User: ${user.email}\n`;
            output += `  idType: ${user.idType}\n`;
            output += `  idNumber: ${JSON.stringify(user.idNumber)}\n\n`;
        });

        fs.writeFileSync('check_results.txt', output);
        console.log('Results written to check_results.txt');

        process.exit(0);
    } catch (error) {
        console.error('Check failed:', error);
        process.exit(1);
    }
};

checkUsers();
