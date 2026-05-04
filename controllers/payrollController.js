import * as payrollService from "../services/payrollService.js";

// Controller function to calculate payroll for an employee for a given month and year
export const calculatePayroll = async (req, res, next) => {
  try {
    const { employeeId, month, year } = req.params;
    const payload = req.body;

    const result = await payrollService.calculatePayroll(
      employeeId,
      parseInt(month),
      parseInt(year),
      payload,
    );

    res.status(result.code).json(result);
  } catch (error) {
    next(error);
  }
};
