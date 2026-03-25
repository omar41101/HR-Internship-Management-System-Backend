import mongoose from 'mongoose';
const MONGO_URI = 'mongodb://localhost:27017/HRCoM';

async function run() {
  try {
    await mongoose.connect(MONGO_URI);
    
    // We specify the collection names explicitly to be sure
    const UserRole = mongoose.model('UserRole', new mongoose.Schema({}, { strict: false }), 'userroles');
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
    
    const roles = await UserRole.find({});
    console.log("--- ROLES ---");
    roles.forEach(r => console.log(`${r.name}: ${r._id}`));
    
    const supervisorRole = roles.find(r => r.name.toLowerCase() === 'supervisor');
    
    if (supervisorRole) {
      const sRoleId = supervisorRole._id.toString();
      console.log(`\n--- AUDIT: SEARCHING FOR ROLE ID ${sRoleId} in supervisor_id ---`);
      const usersWithIssue = await User.find({ supervisor_id: new mongoose.Types.ObjectId(sRoleId) });
      console.log(`Found ${usersWithIssue.length} affected users.`);
      usersWithIssue.forEach(u => console.log(`  - ${u.name} ${u.lastName} (ID: ${u._id})`));
    }
    
    // Also find all actual supervisor users
    const allUsers = await User.find({});
    const supervisors = allUsers.filter(u => {
       // Support both string role and role_id populate
       return u.role === 'supervisor' || u.role_id?.toString() === supervisorRole?._id.toString();
    });

    console.log("\n--- ACTUAL SUPERVISOR USERS ---");
    supervisors.forEach(s => console.log(`${s.name} ${s.lastName}: ${s._id}`));
    
  } catch (err) {
    console.error("Audit error:", err);
  } finally {
    process.exit();
  }
}
run();
