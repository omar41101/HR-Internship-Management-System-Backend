import mongoose from 'mongoose';
const MONGO_URI = 'mongodb://localhost:27017/HRCoM';

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
    
    // Malek Ben Salah (Supervisor) User ID
    const supervisorUserId = "69a96f51507cc83743613597";
    // Supervisor Role ID (the one incorrectly stored)
    const supervisorRoleId = "69aecd81a9e0d8faf799303f";
    
    console.log(`--- DB FIX: MIGRATING supervisor_id ---`);
    
    // Use $or to match both ObjectId and string
    const query = {
      $or: [
        { supervisor_id: new mongoose.Types.ObjectId(supervisorRoleId) },
        { supervisor_id: supervisorRoleId }
      ]
    };
    
    const result = await User.updateMany(
      query,
      { $set: { supervisor_id: new mongoose.Types.ObjectId(supervisorUserId) } }
    );
    
    console.log(`Migration Complete!`);
    console.log(`Matched: ${result.matchedCount}`);
    console.log(`Modified: ${result.modifiedCount}`);
    
    if (result.matchedCount > 0) {
      const updatedUsers = await User.find({ supervisor_id: new mongoose.Types.ObjectId(supervisorUserId) });
      console.log(`\nUpdated Team Members for Malek (${supervisorUserId}):`);
      updatedUsers.forEach(u => {
        if (u._id.toString() !== supervisorUserId) {
          console.log(`  - ${u.name} ${u.lastName} (${u._id})`);
        }
      });
    }
    
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    process.exit();
  }
}
run();
