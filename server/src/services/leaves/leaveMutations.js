// ============================================================
// Leave Mutations — Atomic Create, Update & Delete with Balance Engine
// Supports Explicit Target-Year Consumption ("بعنوان سنة") & Exact Refund
// ============================================================
const prisma = require("../../config/database");
const ApiError = require("../../utils/ApiError");
const SystemRecordService = require("../SystemRecordService");
const CacheService = require("../CacheService");
const { ROLES, getAllowedProvinces } = require("../../config/constants");
const {
  ANNUAL_LEAVE_TYPE,
  parseOptionalDate,
  resolveCustomEndText,
  resolveExceptionalReason,
  resolveMedicalFields,
} = require("./leaveHelpers");
const {
  deductAnnualBalanceForYear,
  deductAnnualBalanceFIFO,
  refundConsumedLeave,
  getPositiveRemainingBreakdown,
} = require("./leaveBalanceHelper");
const { STATE_EMPLOYEE_SELECT, getStateById, resumeLeaveEarly } = require("./leaveLifecycle");

function extractTargetYear(data) {
  const raw =
    data?.targetYear ??
    data?.TargetYear ??
    data?.ConsumedYear ??
    data?.consumedYear;
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return null;
  }
  const yr = parseInt(raw, 10);
  return Number.isInteger(yr) && yr >= 1990 && yr <= 2100 ? yr : null;
}

async function createState(data, requestingUser) {
  const employeesId = parseInt(data.EmployeesId, 10);
  if (isNaN(employeesId) || employeesId <= 0) {
    throw ApiError.badRequest("معرّف الموظف غير صالح");
  }

  const employee = await prisma.employees.findUnique({
    where: { Id: employeesId },
    select: { Id: true, Name: true, LastName: true, Province: true, JobTitle: { select: { RankName: true } } },
  });
  if (!employee) throw ApiError.notFound("الموظف غير موجود");

  if (requestingUser?.role !== ROLES.ADMIN) {
    const allowed = getAllowedProvinces(requestingUser);
    if (!allowed.includes(employee.Province)) {
      throw ApiError.forbidden(`غير مصرح لك بإدارة سجلات ولاية: ${employee.Province}`);
    }
  }

  // Scenario B: Resumption submitted in Create mode resumes the active leave directly
  const isResumptionRequest =
    data.RecordCategory === "إدراج استئناف" ||
    data.StateTypeOrReason === "إدراج استئناف" ||
    Boolean(data.IsResumed) === true;

  if (isResumptionRequest) {
    const activeLeave = await prisma.employeeStates.findFirst({
      where: { EmployeesId: employeesId, IsResumed: false },
      orderBy: { Id: "desc" },
    });
    if (activeLeave) {
      const resumed = await resumeLeaveEarly(
        activeLeave.Id,
        {
          actualReturnDate:
            data.ActualReturnDate ||
            data.actualReturnDate ||
            data.StartDate ||
            new Date().toISOString().split("T")[0],
          notes: data.Notes || data.notes,
        },
        requestingUser
      );
      return { data: resumed.data || resumed, breakdown: resumed.breakdown || [], wasResumption: true };
    }
  }

  const effectiveCategory = data.RecordCategory === "إدراج استئناف" ? "تسجيل عطلة" : data.RecordCategory;
  const effectiveStateType = data.StateTypeOrReason === "إدراج استئناف" ? ANNUAL_LEAVE_TYPE : data.StateTypeOrReason;

  const parsedStartDate = parseOptionalDate(data.StartDate);
  if (!effectiveCategory || !effectiveStateType || !parsedStartDate) {
    throw ApiError.badRequest("الحقول المطلوبة ناقصة أو تاريخ البدء غير صالح");
  }

  const cleanedCustomEndText = resolveCustomEndText(data, effectiveStateType, null, false);
  const isOpenEndedLeave = Boolean(cleanedCustomEndText);
  const isAnnualType = String(effectiveStateType || "").includes("سنوية") && !String(effectiveStateType || "").includes("استثنائية");
  const daysCount = isOpenEndedLeave ? 0 : parseInt(data.DaysCount ?? data.RequestedDays ?? 0, 10);

  if (isNaN(daysCount) || daysCount < 0) {
    throw ApiError.badRequest("عدد الأيام غير صالح");
  }
  if (isAnnualType && daysCount < 1) {
    throw ApiError.badRequest("مدة العطلة السنوية يجب أن تكون يوماً واحداً على الأقل.");
  }

  const requestedTargetYear = extractTargetYear(data);

  const usersId =
    requestingUser?.userName ??
    requestingUser?.userId ??
    requestingUser?.UserId ??
    String(requestingUser?.id ?? requestingUser?.Id ?? "system");

  const parsedEndDate = parseOptionalDate(data.EndDate);
  const parsedReturnDate = parseOptionalDate(data.ActualReturnDate);
  const medicalFields = resolveMedicalFields(data, null);

  const baseData = {
    EmployeesId: employeesId,
    RecordCategory: effectiveCategory,
    CurrentJobTitle: data.CurrentJobTitle || employee.JobTitle?.RankName || "",
    StateTypeOrReason: effectiveStateType,
    DaysCount: daysCount,
    RequestedDays: daysCount,
    StartDate: parsedStartDate,
    EndDate: isOpenEndedLeave ? parsedStartDate : parsedEndDate || parsedStartDate,
    AddedDate: new Date(),
    UsersId: usersId,
    IsResumed: Boolean(isResumptionRequest),
    ActualReturnDate: parsedReturnDate || (isResumptionRequest ? parsedStartDate : null),
    IsResumedEarly: false,
    Notes: data.Notes || null,
    CustomEndText: cleanedCustomEndText,
    ExceptionalReason: resolveExceptionalReason(data, effectiveStateType, null, false),
    ...medicalFields,
  };

  const isAnnualLeave =
    effectiveCategory === "تسجيل عطلة" &&
    effectiveStateType === ANNUAL_LEAVE_TYPE &&
    daysCount > 0 &&
    !isResumptionRequest;

  // Fully atomic transaction: balance deduction + auto-resuming prior leaves + state creation
  const created = await prisma.$transaction(
    async (tx) => {
      let remainingBalanceAfter = null;
      let remainingBreakdown = [];
      let consumedYear = null;
      let consumedBreakdownJson = null;

      if (isAnnualLeave) {
        const deductRes = requestedTargetYear
          ? await deductAnnualBalanceForYear(
              tx,
              employeesId,
              requestedTargetYear,
              daysCount,
              "لتسجيل هذه العطلة"
            )
          : await deductAnnualBalanceFIFO(
              tx,
              employeesId,
              daysCount,
              "لتسجيل هذه العطلة"
            );

        consumedYear = deductRes.consumedYear;
        consumedBreakdownJson =
          Array.isArray(deductRes.consumedBreakdown) && deductRes.consumedBreakdown.length > 0
            ? JSON.stringify(deductRes.consumedBreakdown)
            : null;

        const snap = await getPositiveRemainingBreakdown(tx, employeesId);
        remainingBreakdown = snap.remainingBreakdown;
        remainingBalanceAfter = snap.remainingBalanceAfter;
      }

      if (!isResumptionRequest) {
        await tx.employeeStates.updateMany({
          where: { EmployeesId: employeesId, IsResumed: false },
          data: { IsResumed: true },
        });
      }

      const rec = await tx.employeeStates.create({
        data: {
          ...baseData,
          ConsumedYear: consumedYear,
          ConsumedBreakdown: consumedBreakdownJson,
          RemainingBalanceAfter: remainingBalanceAfter,
        },
      });
      if (isAnnualLeave) {
        rec._remainingBreakdown = remainingBreakdown;
      }
      return rec;
    },
    { maxWait: 15000, timeout: 60000 }
  );

  const yearLogSuffix = created.ConsumedYear ? ` (بعنوان سنة ${created.ConsumedYear})` : "";
  await SystemRecordService.log({
    userFullName: requestingUser?.fullName || usersId,
    title: "إضافة وضعية/إجازة موظف",
    description: `تمت إضافة ${effectiveCategory}: '${effectiveStateType}${yearLogSuffix}' للموظف '${employee.LastName} ${employee.Name}' بواسطة '${usersId}'.`,
    usersId: requestingUser?.id || 1,
    employeesId,
    ipAddress: requestingUser?.ipAddress,
  }).catch(() => {});

  CacheService.invalidateEmployeeEcosystem();
  return { data: created, wasResumption: false };
}

async function updateState(id, data, requestingUser) {
  const existing = await getStateById(id, requestingUser);

  const wantsResume = Boolean(data.IsResumed) === true || data.RecordCategory === "إدراج استئناف";
  if (wantsResume && !existing.IsResumed) {
    const resumed = await resumeLeaveEarly(
      id,
      {
        actualReturnDate:
          data.ActualReturnDate ||
          data.actualReturnDate ||
          existing.EndDate ||
          new Date().toISOString().split("T")[0],
        notes: data.Notes !== undefined ? data.Notes : data.notes,
        ExceptionalReason:
          data.ExceptionalReason !== undefined ? data.ExceptionalReason : data.exceptionalReason,
        CustomEndText: data.CustomEndText !== undefined ? data.CustomEndText : data.customEndText,
        isOpenEnded: data.isOpenEnded,
      },
      requestingUser
    );
    return resumed.data || resumed;
  }

  const nextStateType = data.StateTypeOrReason ?? existing.StateTypeOrReason;
  const wasAnnualLeave =
    existing.StateTypeOrReason === ANNUAL_LEAVE_TYPE &&
    !existing.CustomEndText &&
    Number(existing.DaysCount || 0) > 0;
  const isAnnualType =
    String(nextStateType || "").includes("سنوية") &&
    !String(nextStateType || "").includes("استثنائية");
  const nextCustomEndText = resolveCustomEndText(data, nextStateType, existing.CustomEndText, true);
  const isOpenEndedLeave = Boolean(nextCustomEndText) && !existing.IsResumed;
  const oldDays = Number(existing.DaysCount || 0);
  const newDays = isOpenEndedLeave ? 0 : data.DaysCount !== undefined ? Number(data.DaysCount) : oldDays;

  if (isAnnualType && !(newDays >= 1)) {
    throw ApiError.badRequest("مدة العطلة السنوية يجب أن تكون يوماً واحداً على الأقل.");
  }

  const isAnnualLeave = nextStateType === ANNUAL_LEAVE_TYPE && !isOpenEndedLeave && newDays > 0;
  const requestedTargetYear = extractTargetYear(data);
  const medicalFields = resolveMedicalFields(data, existing);

  const state = await prisma.$transaction(
    async (tx) => {
      let remainingBreakdown = [];
      let remainingBalanceAfter = existing.RemainingBalanceAfter;
      let nextConsumedYear = existing.ConsumedYear ?? null;
      let nextConsumedBreakdown = existing.ConsumedBreakdown ?? null;

      if (wasAnnualLeave && isAnnualLeave) {
        const effectiveTargetYear = requestedTargetYear ?? existing.ConsumedYear ?? null;
        const yearChanged =
          Boolean(requestedTargetYear) &&
          requestedTargetYear !== (existing.ConsumedYear ?? null);

        if (yearChanged) {
          // Refund full oldDays back to original year(s), then deduct newDays from new targetYear
          if (oldDays > 0) {
            await refundConsumedLeave(tx, existing.EmployeesId, existing, oldDays);
          }
          const deductRes = await deductAnnualBalanceForYear(
            tx,
            existing.EmployeesId,
            requestedTargetYear,
            newDays,
            "لتعديل العطلة"
          );
          nextConsumedYear = deductRes.consumedYear;
          nextConsumedBreakdown = JSON.stringify(deductRes.consumedBreakdown);
        } else {
          // Same consumption year: adjust only the delta
          const daysDiff = newDays - oldDays;
          if (daysDiff < 0) {
            await refundConsumedLeave(tx, existing.EmployeesId, existing, Math.abs(daysDiff));
            if (effectiveTargetYear) {
              nextConsumedYear = effectiveTargetYear;
              nextConsumedBreakdown = JSON.stringify([{ year: effectiveTargetYear, deducted: newDays }]);
            }
          } else if (daysDiff > 0) {
            if (effectiveTargetYear) {
              await deductAnnualBalanceForYear(
                tx,
                existing.EmployeesId,
                effectiveTargetYear,
                daysDiff,
                "لتمديد العطلة"
              );
              nextConsumedYear = effectiveTargetYear;
              nextConsumedBreakdown = JSON.stringify([{ year: effectiveTargetYear, deducted: newDays }]);
            } else {
              const deductRes = await deductAnnualBalanceFIFO(
                tx,
                existing.EmployeesId,
                daysDiff,
                "لتمديد العطلة"
              );
              nextConsumedYear = existing.ConsumedYear || deductRes.consumedYear;
            }
          }
        }

        const snap = await getPositiveRemainingBreakdown(tx, existing.EmployeesId);
        remainingBreakdown = snap.remainingBreakdown;
        remainingBalanceAfter = snap.remainingBalanceAfter;
      } else if (wasAnnualLeave && !isAnnualLeave) {
        // Switched from Annual Leave to another leave type -> refund previously consumed days
        if (oldDays > 0) {
          await refundConsumedLeave(tx, existing.EmployeesId, existing, oldDays);
        }
        nextConsumedYear = null;
        nextConsumedBreakdown = null;
        remainingBalanceAfter = null;
      } else if (!wasAnnualLeave && isAnnualLeave) {
        // Switched from another leave type to Annual Leave -> deduct newDays
        const deductRes = requestedTargetYear
          ? await deductAnnualBalanceForYear(
              tx,
              existing.EmployeesId,
              requestedTargetYear,
              newDays,
              "لتعديل العطلة"
            )
          : await deductAnnualBalanceFIFO(
              tx,
              existing.EmployeesId,
              newDays,
              "لتعديل العطلة"
            );
        nextConsumedYear = deductRes.consumedYear;
        nextConsumedBreakdown = JSON.stringify(deductRes.consumedBreakdown);

        const snap = await getPositiveRemainingBreakdown(tx, existing.EmployeesId);
        remainingBreakdown = snap.remainingBreakdown;
        remainingBalanceAfter = snap.remainingBalanceAfter;
      }

      const updated = await tx.employeeStates.update({
        where: { Id: id },
        data: {
          RecordCategory:
            data.RecordCategory === "إدراج استئناف"
              ? existing.RecordCategory
              : data.RecordCategory ?? existing.RecordCategory,
          CurrentJobTitle: data.CurrentJobTitle ?? existing.CurrentJobTitle,
          StateTypeOrReason: nextStateType,
          DaysCount: newDays,
          StartDate: data.StartDate ? new Date(data.StartDate) : existing.StartDate,
          EndDate: isOpenEndedLeave
            ? data.StartDate
              ? new Date(data.StartDate)
              : existing.StartDate
            : data.EndDate
            ? new Date(data.EndDate)
            : existing.EndDate,
          IsResumed: wantsResume ? true : data.IsResumed !== undefined ? data.IsResumed : existing.IsResumed,
          ActualReturnDate: data.ActualReturnDate ? new Date(data.ActualReturnDate) : existing.ActualReturnDate,
          ConsumedYear: nextConsumedYear,
          ConsumedBreakdown: nextConsumedBreakdown,
          RemainingBalanceAfter: remainingBalanceAfter,
          Notes: data.Notes !== undefined ? data.Notes : existing.Notes,
          CustomEndText: nextCustomEndText,
          ExceptionalReason: resolveExceptionalReason(data, nextStateType, existing.ExceptionalReason, true),
          ...medicalFields,
        },
        include: { Employee: { select: STATE_EMPLOYEE_SELECT } },
      });

      updated._remainingBreakdown = remainingBreakdown;
      return updated;
    },
    { maxWait: 15000, timeout: 60000 }
  );

  await SystemRecordService.log({
    userFullName: requestingUser.fullName,
    title: "تعديل وضعية/إجازة موظف",
    description: `تم تعديل وضعية '${state.StateTypeOrReason}${state.ConsumedYear ? ` (بعنوان سنة ${state.ConsumedYear})` : ""}' للموظف (رقم: ${state.EmployeesId}) بواسطة '${requestingUser.userName}'.`,
    usersId: requestingUser.id,
    employeesId: state.EmployeesId,
    ipAddress: requestingUser.ipAddress,
  });

  CacheService.invalidateEmployeeEcosystem();
  return state;
}

async function deleteState(id, requestingUser) {
  const existing = await prisma.employeeStates.findUnique({
    where: { Id: id },
    select: {
      Id: true,
      EmployeesId: true,
      RecordCategory: true,
      StateTypeOrReason: true,
      DaysCount: true,
      CustomEndText: true,
      ConsumedYear: true,
      ConsumedBreakdown: true,
      Employee: { select: { Name: true, LastName: true, Province: true } },
    },
  });
  if (!existing) throw ApiError.notFound(`EmployeeState ${id} not found.`);

  if (requestingUser.role !== ROLES.ADMIN) {
    const allowed = getAllowedProvinces(requestingUser);
    if (!allowed.includes(existing.Employee.Province)) {
      throw ApiError.forbidden("Geographic access denied for this state record.");
    }
  }

  const isAnnualLeaveToRefund =
    existing.StateTypeOrReason === ANNUAL_LEAVE_TYPE &&
    !existing.CustomEndText &&
    Number(existing.DaysCount || 0) > 0;

  let refundedDaysTotal = 0;
  let refundedYearSummary = "";

  await prisma.$transaction(
    async (tx) => {
      if (isAnnualLeaveToRefund) {
        const refundRes = await refundConsumedLeave(
          tx,
          existing.EmployeesId,
          existing,
          Number(existing.DaysCount)
        );
        refundedDaysTotal = refundRes.totalRefunded;
        if (refundRes.breakdown?.length > 0) {
          refundedYearSummary = refundRes.breakdown
            .map((b) => `${b.refunded} يوم لسنة ${b.year}`)
            .join("، ");
        }
      }
      await tx.employeeStates.delete({ where: { Id: id } });
    },
    { maxWait: 15000, timeout: 60000 }
  );

  await SystemRecordService.log({
    userFullName: requestingUser.fullName,
    title: "حذف وضعية/إجازة موظف",
    description: `تم حذف وضعية '${existing.StateTypeOrReason}' للموظف '${existing.Employee.LastName} ${existing.Employee.Name}'${refundedDaysTotal > 0 ? ` واسترجاع الرصيد (${refundedYearSummary})` : ""} بواسطة '${requestingUser.userName}'.`,
    usersId: requestingUser.id,
    employeesId: existing.EmployeesId,
    ipAddress: requestingUser.ipAddress,
  });

  CacheService.invalidateEmployeeEcosystem();
  return {
    message: "State deleted successfully.",
    refundedDays: refundedDaysTotal,
  };
}

module.exports = { createState, updateState, deleteState };
