// ============================================================
// DegreeHistory Controller
// ============================================================
const DegreeHistoryService = require("../services/DegreeHistoryService");

class DegreeHistoryController {
  static async getByEmployee(req, res) {
    const data = await DegreeHistoryService.getByEmployee(
      Number(req.params.id || req.params.employeeId),
      req.user
    );
    res.json({ success: true, data });
  }

  static async create(req, res) {
    const record = await DegreeHistoryService.create(
      Number(req.params.id || req.params.employeeId),
      req.body,
      req.user
    );
    res.status(201).json({ success: true, data: record });
  }

  static async update(req, res) {
    const employeeId = Number(req.params.employeeId || req.params.id);
    const degreeId = Number(req.params.degreeId || req.params.id);
    const record = await DegreeHistoryService.update(
      employeeId,
      degreeId,
      req.body,
      req.user
    );
    res.json({ success: true, data: record });
  }

  static async delete(req, res) {
    const employeeId = Number(req.params.employeeId || req.params.id);
    const degreeId = Number(req.params.degreeId || req.params.id);
    const result = await DegreeHistoryService.delete(
      employeeId,
      degreeId,
      req.user
    );
    res.json({ success: true, ...result });
  }
}

module.exports = DegreeHistoryController;
