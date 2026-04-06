import mongoose from "mongoose";

const userRoleSchema = mongoose.Schema(
<<<<<<< HEAD
    {
        name: {
            type: String,
            required: true
        },
        description: {
            type: String
        }
    },
    {
        timestamps: true
    }
);

export default mongoose.model("UserRole", userRoleSchema);
=======
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    }
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("UserRole", userRoleSchema);
 
>>>>>>> sprint1
