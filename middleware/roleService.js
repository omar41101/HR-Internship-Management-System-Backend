import UserRole from "../models/UserRole.js";
import { decrypt } from "../utils/cryptoUtils.js"; 

// Generation of the secret code for each role
export const generateRoleCode = async () => {
  while (true) {
    const newCode = Math.floor(100 + Math.random() * 900); // 3-digit random code

    let conflict = false; 

    // Get all roles from DB
    const roles = await UserRole.find();

    // Check uniqueness by decrypting existing codes
    for (const role of roles) {
      const plainCode = decrypt(role.code); // Decrypt the code
      if (plainCode === newCode.toString()) {
        conflict = true;
        break;
      }
    }

    if (!conflict) return newCode;
  }
};
