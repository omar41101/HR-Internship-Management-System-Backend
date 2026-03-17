import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

const updateUser = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/HRCoM');
        console.log('Connected to MongoDB');

        const email = 'kutie@gmail.com';
        const cin = '14093456';

        const result = await User.updateOne(
            { email: email },
            { 
                $set: { 
                    idType: 'CIN',
                    idNumber: {
                        number: cin,
                        countryCode: 'TN'
                    }
                } 
            },
            { runValidators: false }
        );

        if (result.matchedCount > 0) {
            console.log(`Successfully updated CIN for ${email} to ${cin}`);
        } else {
            console.warn(`User with email ${email} not found.`);
        }

        process.exit(0);
    } catch (error) {
        console.error('Update failed:', error);
        process.exit(1);
    }
};

updateUser();
