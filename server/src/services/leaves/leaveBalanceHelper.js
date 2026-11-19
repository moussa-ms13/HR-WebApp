// ============================================================
// Leave Balance Transactional Helpers (FIFO Deduct / Reverse-FIFO Refund)
// NOTE: All writes inside interactive Prisma transactions use sequential
// await (NEVER Promise.all) to keep SQL Server's mssql/tedious driver safe.
// ============================================================
const ApiError = require("../../utils/ApiError");

/**
 * FIFO deduction (oldest year first) inside an active Prisma transaction `tx`.
 */
async function deductAnnualBalanceFIFO(tx, employeeId, daysCount, errorLabel = "لتسجيل هذه العطلة") {
  const balances = await tx.leaveBalance.findMany({
    where: { EmployeeId: employeeId, RemainingDays: { gt: 0 } },
    orderBy: { Year: "asc" },
  });

  const totalAvailable = balances.reduce((sum, b) => sum + b.RemainingDays, 0);
  if (totalAvailable < daysCount) {
    throw ApiError.badRequest(
      `الرصيد غير كافٍ ${errorLabel} (المتاح: ${totalAvailable} يوم، المطلوب: ${daysCount} يوم)`
    );
  }

  let remaining = daysCount;
  for (const balance of balances) {
    if (remaining <= 0) break;
    const deduction = Math.min(balance.RemainingDays, remaining);
    await tx.leaveBalance.update({
      where: { Id: balance.Id },
      data: {
        ConsumedDays: balance.ConsumedDays + deduction,
        RemainingDays: balance.RemainingDays - deduction,
      },
    });
    remaining -= deduction;
  }
}

/**
 * Reverse-FIFO refund (newest year first) inside an active Prisma transaction `tx`.
 * Returns { breakdown, totalRefunded }.
 */
async function refundAnnualBalanceReverseFIFO(tx, employeeId, daysToRefund) {
  const breakdown = [];
  let totalRefunded = 0;
  let remainingToRefund = daysToRefund;

  if (remainingToRefund <= 0) {
    return { breakdown, totalRefunded };
  }

  const balances = await tx.leaveBalance.findMany({
    where: { EmployeeId: employeeId },
    orderBy: { Year: "desc" },
  });

  for (const balance of balances) {
    if (remainingToRefund <= 0) break;
    const headroom = balance.TotalDays - balance.RemainingDays;
    if (headroom > 0) {
      const take = Math.min(remainingToRefund, headroom);
      await tx.leaveBalance.update({
        where: { Id: balance.Id },
        data: {
          ConsumedDays: balance.ConsumedDays - take,
          RemainingDays: balance.RemainingDays + take,
        },
      });
      breakdown.push({ year: balance.Year, refunded: take });
      remainingToRefund -= take;
      totalRefunded += take;
    }
  }

  return { breakdown, totalRefunded };
}

/**
 * Re-queries live positive balances after deduction/refund inside `tx`.
 */
async function getPositiveRemainingBreakdown(tx, employeeId) {
  const positiveAfter = await tx.leaveBalance.findMany({
    where: { EmployeeId: employeeId, RemainingDays: { gt: 0 } },
    orderBy: { Year: "asc" },
  });
  const remainingBreakdown = positiveAfter.map((b) => ({
    year: b.Year,
    days: b.RemainingDays,
  }));
  const remainingBalanceAfter = remainingBreakdown.reduce((sum, r) => sum + r.days, 0);
  return { remainingBreakdown, remainingBalanceAfter };
}

module.exports = {
  deductAnnualBalanceFIFO,
  refundAnnualBalanceReverseFIFO,
  getPositiveRemainingBreakdown,
};
