import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

// Middleware to authenticate users based on JWT token
const authenticate = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) {
    return res.status(401).json({
      status: "Error",
      message: "No Token provided!",
    });
  }

  try {
    // Decode the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // JWT payload uses "id" but controllers expect "req.user._id"
    // Map id → _id so both req.user._id and req.user.id work everywhere
    req.user = {
      ...decoded,
      _id: decoded.id,
    };

    next();

  } catch (err) {
    return res.status(401).json({
      status: "Error",
      message: "Invalid or Expired token!",
    });
  }
};

export default authenticate;

// ─────────────────────────────────────────────────────────────────────────────
// WHY THIS CHANGE WAS MADE
// ─────────────────────────────────────────────────────────────────────────────
//
// OLD CODE:
//   req.user = decoded;
//
// The JWT payload is signed at login time with { id, role, iat, exp }.
// Note the field is "id" (no underscore).
//
// PROBLEM:
//   Every controller across the app accesses the logged-in user as:
//     const userId = req.user._id;
//   Since the JWT payload has "id" not "_id", req.user._id was always
//   undefined. This caused User.findById(undefined) to return null,
//   which triggered the "User not found!" 404 response on every single
//   authenticated route — check-in, check-out, getMyStatus, etc.
//
// NEW CODE:
//   req.user = { ...decoded, _id: decoded.id };
//
//   We spread the decoded payload and add _id as an alias for id.
//   Now both req.user.id and req.user._id work everywhere, without
//   changing a single line in any controller or middleware.
// ─────────────────────────────────────────────────────────────────────────────