// ============================================================
// EmployeeStatesService — Public Facade (100% Backward-Compatible API)
// Delegates to modular domain files under server/src/services/leaves/
// ============================================================
const { getAllStates, getStateById, resumeLeaveEarly } = require("./leaves/leaveLifecycle");
const { createState, updateState, deleteState } = require("./leaves/leaveMutations");

class EmployeeStatesService {
  static async getAll(...args) {
    return getAllStates(...args);
  }

  static async getById(id, requestingUser) {
    return getStateById(id, requestingUser);
  }

  static async create(data, requestingUser) {
    return createState(data, requestingUser);
  }

  static async update(id, data, requestingUser) {
    return updateState(id, data, requestingUser);
  }

  static async delete(id, requestingUser) {
    return deleteState(id, requestingUser);
  }

  static async resumeLeaveEarly(id, data, requestingUser) {
    return resumeLeaveEarly(id, data, requestingUser);
  }
}

module.exports = EmployeeStatesService;
