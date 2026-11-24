// ============================================================
// Leave Balance Transactional Helpers
// Supports Explicit Target-Year Deduction/Refund ("بعنوان سنة")
// with Full Backward-Compatible FIFO / Reverse-FIFO Fallbacks.
// NOTE: All writes inside interactive Prisma transactions use sequential
// await (NEVER Promise.all) to keep SQL Server's mssql/tedious driver safe.
// ============================================================
const ApiError = require("../../utils/ApiError");

/**
 * Explicit year deduction ("بعنوان سنة") inside an active Prisma transaction `tx`.
 * Validates that the employee has a LeaveBalance record for `targetYear` with
 * `RemainingDays >= daysCount` and deducts strictly from that year.
 */
async function deductAnnualBalanceForYear(
  tx,
  employeeId,
  targetYear,
  daysCount,
  errorLabel = "لتسجيل هذه العطلة"
) {
  const yr = parseInt(targetYear, 10);
  if (!Number.isInteger(yr) || yr < 1990 || yr > 2100) {
    throw ApiError.badRequest("سنة استهلاك الرصيد المختارة غير صالحة.");
  }

  const balance = await tx.leaveBalance.findUnique({
    where: {
      EmployeeId_Year: {
        EmployeeId: employeeId,
        Year: yr,
      },
    },
  });

  if (!balance) {
    throw ApiError.badRequest(
      `لا يوجد رصيد عطلة سنوية مسجل لسنة ${yr} لهذا الموظف.`
    );
  }

  if (balance.RemainingDays < daysCount) {
    throw ApiError.badRequest(
      `الرصيد المتبقي لسنة ${yr} غير كافٍ ${errorLabel} (المتبقي: ${balance.RemainingDays} يوم، المطلوب: ${daysCount} يوم)`
    );
  }

  await tx.leaveBalance.update({
    where: { Id: balance.Id },
    data: {
      ConsumedDays: balance.ConsumedDays + daysCount,
      RemainingDays: balance.RemainingDays - daysCount,
    },
  });

  return {
    consumedYear: yr,
    consumedBreakdown: [{ year: yr, deducted: daysCount }],
  };
}

/**
 * Legacy FIFO deduction (oldest year first) inside an active Prisma transaction `tx`.
 * Used only when `targetYear` is omitted by legacy callers.
 */
async function deductAnnualBalanceFIFO(
  tx,
  employeeId,
  daysCount,
  errorLabel = "لتسجيل هذه العطلة"
) {
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

  const consumedBreakdown = [];
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
    consumedBreakdown.push({ year: balance.Year, deducted: deduction });
    remaining -= deduction;
  }

  return {
    consumedYear: consumedBreakdown[0]?.year || null,
    consumedBreakdown,
  };
}

/**
 * Refunds `daysToRefund` directly back to a specific `targetYear`'s LeaveBalance row.
 * Falls back to Reverse-FIFO only if that year's balance row no longer exists.
 */
async function refundAnnualBalanceToYear(tx, employeeId, targetYear, daysToRefund) {
  if (!daysToRefund || daysToRefund <= 0) {
    return { breakdown: [], totalRefunded: 0 };
  }

  const yr = parseInt(targetYear, 10);
  if (!Number.isInteger(yr)) {
    return refundAnnualBalanceReverseFIFO(tx, employeeId, daysToRefund);
  }

  const balance = await tx.leaveBalance.findUnique({
    where: {
      EmployeeId_Year: {
        EmployeeId: employeeId,
        Year: yr,
      },
    },
  });

  if (!balance) {
    return refundAnnualBalanceReverseFIFO(tx, employeeId, daysToRefund);
  }

  const headroom = Math.max(0, balance.TotalDays - balance.RemainingDays);
  const refundable = Math.max(headroom, balance.ConsumedDays);
  const take = Math.min(daysToRefund, refundable);

  if (take <= 0) {
    return { breakdown: [], totalRefunded: 0 };
  }

  const nextRemaining = Math.min(balance.TotalDays, balance.RemainingDays + take);
  const actualAdded = Math.max(0, nextRemaining - balance.RemainingDays);
  const nextConsumed = Math.max(0, balance.ConsumedDays - actualAdded);

  if (actualAdded > 0) {
    await tx.leaveBalance.update({
      where: { Id: balance.Id },
      data: {
        ConsumedDays: nextConsumed,
        RemainingDays: nextRemaining,
      },
    });
    return {
      breakdown: [{ year: balance.Year, refunded: actualAdded }],
      totalRefunded: actualAdded,
    };
  }

  return { breakdown: [], totalRefunded: 0 };
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
          ConsumedDays: Math.max(0, balance.ConsumedDays - take),
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
 * Unified smart refund: returns days to the exact year(s) recorded on `existingState`
 * (`ConsumedYear` / `ConsumedBreakdown`), with Reverse-FIFO fallback for legacy records.
 */
async function refundConsumedLeave(tx, employeeId, existingState, daysToRefund) {
  if (!daysToRefund || daysToRefund <= 0) {
    return { breakdown: [], totalRefunded: 0 };
  }

  // 1. If explicit ConsumedYear is recorded on the leave, refund straight to that year
  if (existingState?.ConsumedYear) {
    return refundAnnualBalanceToYear(
      tx,
      employeeId,
      existingState.ConsumedYear,
      daysToRefund
    );
  }

  // 2. If ConsumedBreakdown JSON is recorded (e.g. multi-year legacy FIFO), refund in reverse order
  if (existingState?.ConsumedBreakdown) {
    try {
      const parsed = JSON.parse(existingState.ConsumedBreakdown);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const breakdown = [];
        let totalRefunded = 0;
        let remaining = daysToRefund;

        for (let i = parsed.length - 1; i >= 0; i--) {
          if (remaining <= 0) break;
          const entry = parsed[i];
          const maxFromEntry = Math.min(remaining, Number(entry.deducted) || remaining);
          if (maxFromEntry > 0 && entry.year) {
            const res = await refundAnnualBalanceToYear(
              tx,
              employeeId,
              entry.year,
              maxFromEntry
            );
            if (res.totalRefunded > 0) {
              breakdown.push(...res.breakdown);
              totalRefunded += res.totalRefunded;
              remaining -= res.totalRefunded;
            }
          }
        }
        return { breakdown, totalRefunded };
      }
    } catch (_) {
      // Ignore malformed JSON and fall back cleanly
    }
  }

  // 3. Fallback for pre-existing historical records without ConsumedYear
  return refundAnnualBalanceReverseFIFO(tx, employeeId, daysToRefund);
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
  deductAnnualBalanceForYear,
  deductAnnualBalanceFIFO,
  refundAnnualBalanceToYear,
  refundAnnualBalanceReverseFIFO,
  refundConsumedLeave,
  getPositiveRemainingBreakdown,
};
