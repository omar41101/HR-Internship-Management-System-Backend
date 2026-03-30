import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/HRCoM';

async function unblockUser() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected!');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    const blockedUsers = await usersCollection.find({ status: 'Blocked' }).toArray();
    console.log(`Found ${blockedUsers.length} blocked users.`);

    if (blockedUsers.length > 0) {
      const result = await usersCollection.updateMany(
        { status: 'Blocked' },
        { $set: { status: 'Active', loginAttempts: 0 } }
      );
      console.log(`Successfully unblocked ${result.modifiedCount} users.`);
    } else {
      console.log('No blocked users found.');
    }

    await mongoose.disconnect();
    console.log('Disconnected.');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

unblockUser();
