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

      // Determine the target ID (fallback to req.params.id or req.params.userId if not explicitly set by previous middleware)
      const targetId = req.targetUserId || req.params.id || req.params.userId;

      // Check if the user himself has self access
      if (options.allowSelf) {
        const tokenUserId = (user.id || user._id || "").toString();
        // Use either targetUserId overlay or the id from params
        const finalTargetId = (targetId || "").toString();

        console.log(`[AUTH-DEBUG] TokenUserID: ${tokenUserId}, TargetID: ${finalTargetId}, Match: ${tokenUserId === finalTargetId}`);

        if (finalTargetId === "current" || tokenUserId === finalTargetId) {
          return next();
        }
      }

      // Check if the supervisor has access
      if (options.allowSupervisor) {
        const targetUser = await User.findById(targetId);

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
