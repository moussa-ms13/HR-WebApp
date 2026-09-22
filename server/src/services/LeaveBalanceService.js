// ============================================================
// LeaveBalanceService — FIFO Cascading Leave Debt Engine
//
// Implements "First-In, First-Out" multi-year balance deduction:
// oldest unpaid leave debts are consumed first.
// All DB writes are wrapped in a Prisma $transaction.
// ============================================================
const prisma = require("../config/database");

// ─── Arabic number-to-words (server-side, no client bundle dependency) ──────
const ONES_AR = [
  "", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة",
  "ستة", "سبعة", "ثمانية", "تسعة", "عشرة",
  "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر",
  "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر",
];
const TENS_AR = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];

function numToWords(n) {
  const num = parseInt(n, 10);
  if (isNaN(num) || num <= 0 || num > 99) return String(n);
  if (num < 20) return ONES_AR[num];
  const ten = Math.floor(num / 10);
  const one = num % 10;
  if (one === 0) return TENS_AR[ten];
  return `${ONES_AR[one]} و${TENS_AR[ten]}`;
}

// ─────────────────────────────────────────────────────────────────────────────

class LeaveBalanceService {
  /**
   * Ensure a LeaveBalance row exists for (employeeId, year).
   * Returns the existing or newly-created record.
   */
  static async ensureBalance(employeeId, year, tx = prisma) {
    return tx.leaveBalance.upsert({
      where: { EmployeeId_Year: { EmployeeId: employeeId, Year: year } },
      create: { EmployeeId: employeeId, Year: year, TotalDays: 30, ConsumedDays: 0, RemainingDays: 30 },
      update: {},
    });
  }

  /**
   * Fetch all positive-balance rows for an employee, oldest year first.
   */
  static async getPositiveBalances(employeeId, tx = prisma) {
    return tx.leaveBalance.findMany({
      where: { EmployeeId: employeeId, RemainingDays: { gt: 0 } },
      orderBy: { Year: "asc" },
    });
  }

  /**
   * Get full balance history for an employee (for display/API).
   */
  static async getHistory(employeeId) {
    return prisma.leaveBalance.findMany({
      where: { EmployeeId: employeeId },
      orderBy: { Year: "desc" },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // CORE: FIFO Cascading Deduction
  // ─────────────────────────────────────────────────────────────

  /**
   * consumeLeaveAcrossYears
   *
   * Deducts `requestedDays` from the employee's leave balances using FIFO
   * (oldest year first). Runs entirely inside a Prisma $transaction.
   *
   * @param {number} employeeId
   * @param {number} requestedDays
   * @param {string|Date} leaveStartDate  — ISO string or Date of the new leave
   *
   * @returns {{
   *   consumedBreakdown: Array<{ balanceId, year, deducted, remaining }>,
   *   remainingBreakdown: Array<{ year, days, daysInWords }>,
   *   primaryYear: number,
   * }}
   *
   * Throws a descriptive Arabic Error if total available < requestedDays.
   */
  static async consumeLeaveAcrossYears(employeeId, requestedDays, leaveStartDate) {
    const reqDays = parseInt(requestedDays, 10);
    if (isNaN(reqDays) || reqDays <= 0) {
      throw new Error(`Invalid requestedDays: ${requestedDays}`);
    }

    // Ensure the balance row for the current leave year exists before the transaction
    const leaveYear = new Date(leaveStartDate).getFullYear();
    await this.ensureBalance(employeeId, leaveYear);

    return await prisma.$transaction(async (tx) => {
      // Fetch all positive balances, oldest first (FIFO order)
      const balances = await this.getPositiveBalances(employeeId, tx);

      // Validate total availability
      const totalAvailable = balances.reduce((sum, b) => sum + b.RemainingDays, 0);
      if (totalAvailable < reqDays) {
        throw new Error(
          `رصيد العطلة غير كافٍ: المطلوب ${reqDays} يوم، المتاح إجمالاً ${totalAvailable} يوم عبر جميع السنوات.`
        );
      }

      // ── FIFO deduction loop ──────────────────────────────────
      const consumedBreakdown = [];
      let remaining = reqDays;
      let primaryYear = leaveYear;
      let isFirst = true;

      for (const balance of balances) {
        if (remaining <= 0) break;

        const deduct = Math.min(balance.RemainingDays, remaining);

        // Atomic update for this balance row
        await tx.leaveBalance.update({
          where: { Id: balance.Id },
          data: {
            ConsumedDays: { increment: deduct },
            RemainingDays: { decrement: deduct },
          },
        });

        consumedBreakdown.push({
          balanceId: balance.Id,
          year: balance.Year,
          deducted: deduct,
          remaining: balance.RemainingDays - deduct,
        });

        if (isFirst) {
          primaryYear = balance.Year;
          isFirst = false;
        }

        remaining -= deduct;
      }

      // Re-read all balances after deduction to build the remaining snapshot
      // (only rows with balance > 0 are shown on the printed document)
      const allAfter = await tx.leaveBalance.findMany({
        where: { EmployeeId: employeeId, RemainingDays: { gt: 0 } },
        orderBy: { Year: "asc" },
      });

      const remainingBreakdown = allAfter.map((b) => ({
        year: b.Year,
        days: b.RemainingDays,
        daysInWords: numToWords(b.RemainingDays),
      }));

      return { consumedBreakdown, remainingBreakdown, primaryYear };
    });
  }

  /**
   * rollbackConsumedBreakdown
   *
   * Compensating transaction: reverses the effect of consumeLeaveAcrossYears.
   * Call this if the EmployeeStates.create() that follows fails.
   *
   * @param {Array<{ balanceId, deducted }>} consumedBreakdown
   */
  static async rollbackConsumedBreakdown(consumedBreakdown) {
    if (!consumedBreakdown?.length) return;

    await prisma.$transaction(
      consumedBreakdown.map(({ balanceId, deducted }) =>
        prisma.leaveBalance.update({
          where: { Id: balanceId },
          data: {
            ConsumedDays: { decrement: deducted },
            RemainingDays: { increment: deducted },
          },
        })
      )
    );
  }
}

module.exports = LeaveBalanceService;
