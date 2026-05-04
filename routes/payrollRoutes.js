import express from "express";
import {
    calculatePayroll,
} from "../controllers/payrollController.js";

const router = express.Router();

// Route to calculate payroll for an employee for a given month and year
router.post("/payroll/calculate/:employeeId/:month/:year", calculatePayroll);

export default router;
