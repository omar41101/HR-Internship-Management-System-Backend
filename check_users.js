import mongoose from 'mongoose';
const MONGO_URI = 'mongodb://localhost:27017/HRCoM';

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const users = await User.find({}, { name: 1, lastName: 1, role: 1, supervisor_id: 1, role_id: 1, _id: 1 });
    
    users.forEach(u => {
      console.log(`${u.name} ${u.lastName} | ID: ${u._id} | Role: ${u.role} | RoleID: ${u.role_id} | SupervisorID: ${u.supervisor_id}`);
    });
    
  } catch (err) {
    console.error("DB connection error:", err);
  } finally {
    process.exit();
  }
}
run();
