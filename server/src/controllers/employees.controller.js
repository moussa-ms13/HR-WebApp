// ============================================================
// Employees Controller
// Handles HTTP request/response for employee endpoints
// ============================================================
const EmployeesService = require("../services/EmployeesService");

class EmployeesController {
  static async getAll(req, res) {
    const { page, limit, search, province, directorate, fileStatus, category, sortBy, sortOrder, sort, order } = req.query;
    const result = await EmployeesService.getAll(
      req.user,
      Number(page) || 1,
      Number(limit) || 25,
      search || "",
      province || "",
      directorate || "",
      fileStatus || "",
      category || "",
      sortBy || sort || "Id",
      sortOrder || order || "desc"
    );
    res.json({ success: true, ...result });
  }

  static async getById(req, res) {
    const employee = await EmployeesService.getById(Number(req.params.id), req.user);
    res.json({ success: true, data: employee });
  }

  static async getSummary(req, res) {
    const employee = await EmployeesService.getSummary(Number(req.params.id), req.user);
    res.json({ success: true, data: employee });
  }

  static async search(req, res) {
    const { q, province, directorate } = req.query;
    const data = await EmployeesService.search(req.user, q || "", province || "", directorate || "");
    res.json({ success: true, data });
  }

  static async create(req, res) {
    const employee = await EmployeesService.create(req.body, req.user);
    res.status(201).json({ success: true, data: employee });
  }

  static async update(req, res) {
    const employee = await EmployeesService.update(Number(req.params.id), req.body, req.user);
    res.json({ success: true, data: employee });
  }

  static async delete(req, res) {
    const result = await EmployeesService.delete(Number(req.params.id), req.user);
    res.json({ success: true, ...result });
  }
}

module.exports = EmployeesController;
