import express from "express";
import AppError from "../utils/AppError.js";
import User from "../models/User.js";

const router = express.Router();

/**
 * @route   GET /api/test-error
 * @desc    Test various error responses
 * @access  Public
 */
router.get("/test-error", async (req, res, next) => {
    const { type } = req.query;

    try {
        if (type === "validation") {
            // Simulate a Mongoose validation error
            const user = new User({});
            await user.validate();
        }

        if (type === "database") {
            // Simulate a Mongoose CastError (Invalid ID)
            await User.findById("invalid-id-format");
        }

        if (type === "app") {
            // Simulate a custom AppError
            throw new AppError("This is a controlled application error.", 400, "Try providing a valid name.");
        }

        if (type === "json") {
            // Simulate a syntax error (manual)
            const err = new SyntaxError("Unexpected token in JSON");
            err.status = 400;
            err.body = "invalid json";
            throw err;
        }

        if (type === "server") {
            // Simulate an unhandled server error
            throw new Error("Something went completely wrong on the server!");
        }

        res.status(200).json({
            status: "Success",
            message: "No error occurred. Use ?type=validation|database|app|server|json to test.",
        });
    } catch (err) {
        next(err);
    }
});

export default router;
