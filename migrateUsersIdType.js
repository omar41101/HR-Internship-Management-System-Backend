import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

const migrate = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/HRCoM');
        console.log('Connected to MongoDB');

        const users = await User.find({
            $or: [
                { idType: { $exists: false } },
                { "idNumber.number": { $exists: false } },
                { "idNumber.number": "" }
            ]
        });

        console.log(`Found ${users.length} users to migrate.`);

        for (const user of users) {
          // Check if idType exists, if not set it to CIN
          if (!user.idType) {
            user.idType = 'CIN';
          }

          // Check if idNumber.number exists, if not set a safe placeholder based on their email or index
          if (!user.idNumber || !user.idNumber.number || user.idNumber.number === "") {
            // Using a temporary 8-digit number derived from their name or random to avoid validation issues
            // Normally we'd want real data, but this unblocks the login
            const randomId = Math.floor(10000000 + Math.random() * 90000000).toString();
            
            user.idNumber = {
              number: randomId,
              countryCode: user.idType === 'CIN' ? 'TN' : 'US'
            };
            console.log(`Migrated user ${user.email} with placeholder ID: ${randomId}`);
          }

          await user.save({ validateBeforeSave: false }); // Bypass validation for the migration
        }

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

migrate();
