// ============================================================
// DegreeHistory Controller
// Handles standalone /api/degree-history/:id update & delete
// ============================================================
const DegreeHistoryService = require("../services/DegreeHistoryService");
const ApiError = require("../utils/ApiError");

class DegreeHistoryController {
  static async update(req, res) {
    const degreeId = Number(req.params.degreeId || req.params.id);
    const employeeId = req.params.employeeId ? Number(req.params.employeeId) : null;
    if (!Number.isInteger(degreeId) || degreeId <= 0) {
      throw ApiError.badRequest("معرف السجل غير صالح.");
    }
    const record = await DegreeHistoryService.update(employeeId, degreeId, req.body, req.user);
    res.json({ success: true, data: record });
  }

  static async delete(req, res) {
    const degreeId = Number(req.params.degreeId || req.params.id);
    const employeeId = req.params.employeeId ? Number(req.params.employeeId) : null;
    if (!Number.isInteger(degreeId) || degreeId <= 0) {
      throw ApiError.badRequest("معرف السجل غير صالح.");
    }
    const result = await DegreeHistoryService.delete(employeeId, degreeId, req.user);
    res.json({ success: true, ...result });
  }
}

module.exports = DegreeHistoryController;
