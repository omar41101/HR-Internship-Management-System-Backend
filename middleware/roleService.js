import UserRole from "../models/UserRole.js";
import bcrypt from "bcrypt";

// Generation of the secret code for each role
export const generateRoleCode = async () => {
  while (true) {
    // Generate an initial 3-digit code
    const newCode = Math.floor(100 + Math.random() * 900);

    // Check for code uniqueness
    let conflict = false;
    for (const role of await UserRole.find()) {
      if (await bcrypt.compare(newCode.toString(), role.code)) {
        conflict = true;
        break;
      }
    }

    if (!conflict) return newCode;
  }
};
