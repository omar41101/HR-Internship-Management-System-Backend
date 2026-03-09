import User from "../models/User.js";

// Middleware to authorize users based on role, self-access, or supervisor access
const authorize = (roles = [], options = {}) => {
  return async (req, res, next) => {
    try {
      const user = req.user;

      // Check the Role Permission
      if (roles.includes(user.role)) {
        return next();
      }

      // Check if the user himself has self access
      if (options.allowSelf) {
        if (user.id === req.params.id) {
          return next();
        }
      }

      // Check if the supervisor has access
      if (options.allowSupervisor) {
        const targetUser = await User.findById(req.params.id);

        if (targetUser && user.id === targetUser.supervisor_id?.toString()) {
          return next();
        }
      }

      return res.status(403).json({
        status: "Error",
        message: "Unauthorized!",
      });
    } catch (err) {
      return res.status(500).json({
        status: "Error",
        message: err.message,
      });
    }
  };
};

export default authorize;
