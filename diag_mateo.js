import mongoose from 'mongoose';
const MONGO_URI = 'mongodb://localhost:27017/HRCoM';

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
    
    const u = await User.findOne({ name: 'Mateo', lastName: 'Fernández' });
    if (u) {
      const sid = u.supervisor_id;
      console.log(`User: ${u.name} ${u.lastName}`);
      console.log(`supervisor_id: "${sid}"`);
      console.log(`supervisor_id type: ${typeof sid}`);
      console.log(`supervisor_id length: ${String(sid).length}`);
      
      const roleId = "69aecd81a9e0d8faf799303f";
      console.log(`Target Role ID: "${roleId}"`);
      console.log(`Target length: ${roleId.length}`);
      
      // Hex dump of characters
      const hexSid = Buffer.from(String(sid)).toString('hex');
      const hexTarget = Buffer.from(roleId).toString('hex');
      console.log(`Hex SID:    ${hexSid}`);
      console.log(`Hex Target: ${hexTarget}`);
      
    } else {
      console.log("User Mateo Fernández not found.");
    }
    
  } catch (err) {
    console.error("Diagnostic error:", err);
  } finally {
    process.exit();
  }
}
run();
