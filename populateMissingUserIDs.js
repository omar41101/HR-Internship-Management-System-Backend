import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

const populateMissingIDs = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/HRCoM');
        console.log('Connected to MongoDB');

        // Find users that don't have a valid idType or idNumber
        const users = await User.find({
            $or: [
                { idType: { $nin: ['CIN', 'Passport'] } },
                { idNumber: { $exists: false } },
                { "idNumber.number": { $exists: false } },
                { "idNumber.number": "" },
                { "idNumber.number": null },
                { "idNumber.countryCode": { $exists: false } },
                { "idNumber.countryCode": "" }
            ]
        });

        console.log(`Found ${users.length} users with missing IDs.`);

        for (const user of users) {
            const randomCIN = Math.floor(10000000 + Math.random() * 90000000).toString();
            
            user.idType = 'CIN';
            user.idNumber = {
                number: randomCIN,
                countryCode: 'TN' // Default for CIN
            };

            await user.save({ validateBeforeSave: false });
            console.log(`Updated user ${user.email} with random CIN: ${randomCIN}`);
        }

        console.log('Population complete.');
        process.exit(0);
    } catch (error) {
        console.error('Population failed:', error);
        process.exit(1);
    }
};

populateMissingIDs();
