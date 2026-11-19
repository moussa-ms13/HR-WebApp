// ============================================================
// Employees Controller
// Handles HTTP request/response for employee listing endpoint
// ============================================================
const EmployeesService = require("../services/EmployeesService");

class EmployeesController {
  static async getAll(req, res) {
    const {
      page,
      limit,
      search,
      province,
      directorate,
      fileStatus,
      category,
      status,
      employeeStatus,
      sortBy,
      sortOrder,
      sort,
      order,
    } = req.query;

    const safeSortBy = (sortBy || sort || "").trim() || "Id";
    const rawOrder = (sortOrder || order || "").toString().trim();
    const safeSortOrder = rawOrder === "1" || rawOrder.toLowerCase() === "asc" ? "asc" : "desc";

    const result = await EmployeesService.getAll(
      req.user,
      Number(page) || 1,
      Number(limit) || 25,
      search || "",
      province || "",
      directorate || "",
      fileStatus || "",
      category || "",
      safeSortBy,
      safeSortOrder,
      status || employeeStatus || ""
    );
    res.json({ success: true, ...result });
  }
}

module.exports = EmployeesController;
