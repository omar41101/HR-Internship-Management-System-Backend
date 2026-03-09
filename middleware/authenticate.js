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

    // Attach logged-in user info to the request
    req.user = decoded;
    next();
    
  } catch (err) {
    return res.status(401).json({
      status: "Error",
      message: "Invalid or Expired token!",
    });
  }
};

export default authenticate;
