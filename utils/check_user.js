import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/HRCoM';

async function checkUser() {
  try {
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne({ email: 'malek@gmail.com' });
    if (user) {
      console.log('User found:');
      console.log(`ID: ${user._id}`);
      console.log(`Status: ${user.status}`);
      console.log(`Login Attempts: ${user.loginAttempts}`);
      console.log(`Must Reset Password: ${user.mustResetPassword}`);
    } else {
      console.log('User malek@gmail.com not found.');
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkUser();
