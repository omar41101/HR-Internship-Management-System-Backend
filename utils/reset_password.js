import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/HRCoM';

async function resetUserPassword() {
  try {
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    const hashedPassword = await bcrypt.hash('Password123!', 10);
    const result = await usersCollection.updateOne(
      { email: 'malek@gmail.com' },
      { $set: { password: hashedPassword, mustResetPassword: false, status: 'Active', loginAttempts: 0 } }
    );

    if (result.matchedCount > 0) {
      console.log('Successfully reset password for malek@gmail.com to: Password123!');
    } else {
      console.log('User malek@gmail.com not found.');
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

resetUserPassword();
