// ============================================================
// Leave Lifecycle Queries & Early Resumption Engine
// ============================================================
const prisma = require("../../config/database");
const ApiError = require("../../utils/ApiError");
const SystemRecordService = require("../SystemRecordService");
const CacheService = require("../CacheService");
const { ROLES, getAllowedProvinces } = require("../../config/constants");
const {
  sanitizePagination,
  buildTokenizedSearch,
  resolveGeographicFilter,
  buildDirectorateCondition,
} = require("../../utils/queryBuilder");
const {
  ANNUAL_LEAVE_TYPE,
  getLeaveLifecycleCondition,
  getYearCondition,
  getDistinctYears,
  attachLiveRemainingBreakdown,
  resolveCustomEndText,
  resolveExceptionalReason,
} = require("./leaveHelpers");
const {
  refundConsumedLeave,
  getPositiveRemainingBreakdown,
} = require("./leaveBalanceHelper");
const { getJobTitlesMap } = require("../employees/employeeQueryBuilder");

const STATE_EMPLOYEE_SELECT = {
  Id: true,
  Name: true,
  LastName: true,
  Province: true,
  Gender: true,
  DateOfBirth: true,
  Directorate: true,
  AssignedPosition: true,
  EmployeeStatus: true,
  CorpsType: true,
  JobTitleId: true,
  JobTitle: { select: { Id: true, RankName: true, EmploymentCategory: true } },
  LeaveBalances: {
    orderBy: { Year: "asc" },
    select: { Year: true, TotalDays: true, ConsumedDays: true, RemainingDays: true },
  },
};

async function getAllStates(
  requestingUser,
  page = 1,
  limit = 25,
  category = "",
  employeeId = null,
  search = "",
  directorate = "",
  province = "",
  sortBy = "Id",
  sortOrder = "desc",
  statusFilter = "active",
  stateType = "",
  year = ""
) {
  const { safePage, safeLimit, skip } = sanitizePagination(page, limit, 100);

  const { provinceFilter, isForbidden } = resolveGeographicFilter(requestingUser, province);
  if (isForbidden) {
    return {
      data: [],
      meta: {
        total: 0,
        page: safePage,
        limit: safeLimit,
        totalPages: 0,
        counts: { active: 0, resumed: 0, all: 0 },
        years: [],
      },
    };
  }

  const dirCondition = buildDirectorateCondition(directorate);
  const employeeFilter = {
    Province: provinceFilter,
    ...(employeeId && Number.isInteger(Number(employeeId)) ? { Id: Number(employeeId) } : {}),
    ...(dirCondition ? { AND: [dirCondition] } : {}),
  };

  const baseWhere = {
    Employee: employeeFilter,
    ...(category ? { RecordCategory: category } : {}),
    ...(stateType && String(stateType).trim() ? { StateTypeOrReason: String(stateType).trim() } : {}),
  };

  const hasSearch = Boolean(search && String(search).trim());

  // Short-TTL response cache for default/filtered non-search leaves table views
  // Auto-invalidated on every write via CacheService.invalidateEmployeeEcosystem() ("state_list_")
  const listCacheKey = !hasSearch
    ? `state_list_${JSON.stringify({
        prov: provinceFilter,
        dir: directorate || "",
        cat: category || "",
        st: stateType || "",
        yr: year || "",
        emp: employeeId || "",
        status: statusFilter || "",
        p: safePage,
        l: safeLimit,
        sb: sortBy || "Id",
        so: sortOrder || "desc",
      })}`
    : null;
  if (listCacheKey) {
    const cachedPage = CacheService.get(listCacheKey);
    if (cachedPage) return cachedPage;
  }

  const jobMap = hasSearch ? await getJobTitlesMap() : null;
  const tokenSearch = buildTokenizedSearch(search, (token) => {
    const lower = String(token).toLowerCase();
    const matchedJobIds = [];
    if (jobMap) {
      for (const [idStr, entry] of Object.entries(jobMap)) {
        const rankName = typeof entry === "string" ? entry : (entry?.RankName || "");
        if (rankName.toLowerCase().includes(lower)) matchedJobIds.push(Number(idStr));
      }
    }
    return [
      { Employee: { LastName: { contains: token } } },
      { Employee: { Name: { contains: token } } },
      { Employee: { NIN: { contains: token } } },
      { StateTypeOrReason: { contains: token } },
      { ExceptionalReason: { contains: token } },
      { CustomEndText: { contains: token } },
      { CurrentJobTitle: { contains: token } },
      { Notes: { contains: token } },
      ...(matchedJobIds.length > 0 ? [{ Employee: { JobTitleId: { in: matchedJobIds } } }] : []),
      ...(/^\d{4}$/.test(token) ? [{ ConsumedYear: Number(token) }] : []),
    ];
  });
  if (tokenSearch) {
    baseWhere.AND = [...(baseWhere.AND || []), ...tokenSearch.AND];
  }

  const yearCondition = getYearCondition(year);
  if (yearCondition) {
    baseWhere.AND = [...(baseWhere.AND || []), yearCondition];
  }

  const buildWhereForStatus = (status) => {
    const cond = getLeaveLifecycleCondition(status);
    if (!cond) return baseWhere;
    return { ...baseWhere, AND: [...(baseWhere.AND || []), cond] };
  };

  const effectiveDefaultStatus = employeeId ? "all" : "active";
  const requestedStatus = statusFilter || effectiveDefaultStatus;
  const currentYear = new Date().getFullYear();
  const isSearchExpanded = Boolean(search && search.trim().length >= 2) && requestedStatus === "active";
  const isPastYearExpanded = Boolean(year && Number(year) < currentYear) && requestedStatus === "active";
  const effectiveStatus = isSearchExpanded || isPastYearExpanded ? "all" : requestedStatus;

  const whereClause = buildWhereForStatus(effectiveStatus);

  let orderBy = { Id: "desc" };
  const safeOrder = String(sortOrder || "").toLowerCase() === "asc" ? "asc" : "desc";
  if (sortBy === "Employee" || sortBy === "employee" || sortBy === "Name") {
    orderBy = { Employee: { LastName: safeOrder } };
  } else if (sortBy === "RecordCategory" || sortBy === "category" || sortBy === "Category") {
    orderBy = { RecordCategory: safeOrder };
  } else if (sortBy === "StateTypeOrReason" || sortBy === "type" || sortBy === "StateType") {
    orderBy = { StateTypeOrReason: safeOrder };
  } else if (sortBy === "StartDate" || sortBy === "startDate") {
    orderBy = { StartDate: safeOrder };
  } else if (sortBy === "EndDate" || sortBy === "endDate") {
    orderBy = { EndDate: safeOrder };
  } else if (sortBy === "DaysCount" || sortBy === "TotalDays" || sortBy === "daysCount") {
    orderBy = { DaysCount: safeOrder };
  } else if (sortBy === "IsResumed" || sortBy === "status" || sortBy === "Status") {
    orderBy = { IsResumed: safeOrder };
  } else if (sortBy === "Id" || sortBy === "id") {
    orderBy = { Id: safeOrder };
  }

  const isStandardTab = ["active", "resumed", "all"].includes(effectiveStatus);
  const countCacheKey = `state_count_leaves_${JSON.stringify({
    prov: provinceFilter,
    dir: directorate || "",
    cat: category || "",
    st: stateType || "",
    yr: year || "",
    emp: employeeId || "",
  })}`;
  const cachedCounts = CacheService.get(countCacheKey);

  const statesPromise = prisma.employeeStates.findMany({
    where: whereClause,
    select: {
      Id: true,
      EmployeesId: true,
      RecordCategory: true,
      CurrentJobTitle: true,
      StateTypeOrReason: true,
      DaysCount: true,
      StartDate: true,
      EndDate: true,
      AddedDate: true,
      IsResumed: true,
      ActualReturnDate: true,
      RemainingBalanceAfter: true,
      Notes: true,
      DoctorName: true,
      CertificateDate: true,
      SecondDoctorName: true,
      SecondCertificateDate: true,
      ExceptionalReason: true,
      CustomEndText: true,
      ConsumedYear: true,
      ConsumedBreakdown: true,
      Employee: { select: STATE_EMPLOYEE_SELECT },
    },
    skip,
    take: safeLimit,
    orderBy,
  });

  let states, counts, total, years;
  if (hasSearch) {
    // Fast search path: avoid 3 redundant relational COUNT(*) queries during live search
    [states, years] = await Promise.all([statesPromise, getDistinctYears()]);
    total = skip === 0 && states.length < safeLimit
      ? states.length
      : await prisma.employeeStates.count({ where: whereClause });
    counts = cachedCounts || { active: 0, resumed: 0, all: total };
  } else if (cachedCounts && isStandardTab) {
    [states, years] = await Promise.all([statesPromise, getDistinctYears()]);
    counts = cachedCounts;
    total = counts[effectiveStatus];
  } else {
    const [rows, activeCount, resumedCount, allCount, customRes, yrs] = await Promise.all([
      statesPromise,
      prisma.employeeStates.count({ where: buildWhereForStatus("active") }),
      prisma.employeeStates.count({ where: buildWhereForStatus("resumed") }),
      prisma.employeeStates.count({ where: buildWhereForStatus("all") }),
      isStandardTab ? Promise.resolve(null) : prisma.employeeStates.count({ where: whereClause }),
      getDistinctYears(),
    ]);
    states = rows;
    counts = { active: activeCount, resumed: resumedCount, all: allCount };
    total = isStandardTab ? counts[effectiveStatus] : customRes;
    years = yrs;
    CacheService.set(countCacheKey, counts, 60);
  }

  const response = {
    data: states.map(attachLiveRemainingBreakdown),
    meta: {
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
      counts,
      years,
    },
  };

  if (listCacheKey) {
    CacheService.set(listCacheKey, response, 60);
  }

  return response;
}

async function getStateById(id, requestingUser) {
  const state = await prisma.employeeStates.findUnique({
    where: { Id: id },
    include: {
      Employee: { select: STATE_EMPLOYEE_SELECT },
    },
  });

  if (!state) throw ApiError.notFound(`EmployeeState ${id} not found.`);

  if (requestingUser.role !== ROLES.ADMIN) {
    const allowed = getAllowedProvinces(requestingUser);
    if (!allowed.includes(state.Employee.Province)) {
      throw ApiError.forbidden("Geographic access denied for this state record.");
    }
  }

  return attachLiveRemainingBreakdown(state);
}

async function resumeLeaveEarly(id, data, requestingUser) {
  const existing = await getStateById(id, requestingUser);

  if (existing.IsResumed) {
    throw ApiError.badRequest(`سجل العطلة رقم ${id} تم استئنافه مسبقاً.`);
  }

  const returnDateVal = data.actualReturnDate || data.ActualReturnDate;
  if (!returnDateVal) {
    throw ApiError.badRequest("يرجى تحديد تاريخ استئناف العمل الفعلي.");
  }

  const actualReturn = new Date(returnDateVal);
  if (isNaN(actualReturn.getTime())) {
    throw ApiError.badRequest("تاريخ استئناف العمل الفعلي غير صالح.");
  }

  const startDate = new Date(existing.StartDate);
  if (isNaN(startDate.getTime())) {
    throw ApiError.badRequest("تاريخ بداية العطلة المسجل غير صالح.");
  }

  const actualUtc = Date.UTC(actualReturn.getFullYear(), actualReturn.getMonth(), actualReturn.getDate());
  const startUtc = Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());

  if (actualUtc < startUtc) {
    throw ApiError.badRequest("تاريخ استئناف العمل الفعلي لا يمكن أن يكون قبل تاريخ بداية العطلة.");
  }

  const diffDays = Math.round((actualUtc - startUtc) / (1000 * 60 * 60 * 24));
  const newDaysCount = Math.max(1, diffDays);
  const originalDays = existing.DaysCount || existing.RequestedDays || 0;
  const wasOpenEnded = Boolean(existing.CustomEndText) || originalDays === 0;
  const refundDaysNeeded = wasOpenEnded ? 0 : Math.max(0, originalDays - newDaysCount);
  const isEarly = refundDaysNeeded > 0;
  const isAnnualLeave = existing.StateTypeOrReason === ANNUAL_LEAVE_TYPE;

  const transactionResult = await prisma.$transaction(
    async (tx) => {
      let breakdown = [];
      let totalRefunded = 0;

      if (isAnnualLeave && refundDaysNeeded > 0) {
        const res = await refundConsumedLeave(tx, existing.EmployeesId, existing, refundDaysNeeded);
        breakdown = res.breakdown;
        totalRefunded = res.totalRefunded;
      }

      let remainingBalanceAfter = existing.RemainingBalanceAfter;
      let remainingBreakdown = [];
      if (isAnnualLeave) {
        const snap = await getPositiveRemainingBreakdown(tx, existing.EmployeesId);
        remainingBreakdown = snap.remainingBreakdown;
        remainingBalanceAfter = snap.remainingBalanceAfter;
      }

      const inputNotes = (data.notes || data.Notes || "").trim();
      const updatedNotes = inputNotes
        ? existing.Notes
          ? `${existing.Notes} | ${inputNotes}`
          : inputNotes
        : existing.Notes;

      const recalculatedEndDate =
        isEarly || wasOpenEnded ? new Date(startUtc + (newDaysCount - 1) * 86400000) : existing.EndDate;

      const updatedState = await tx.employeeStates.update({
        where: { Id: id },
        data: {
          IsResumed: true,
          IsResumedEarly: isEarly,
          ActualReturnDate: actualReturn,
          DaysCount: isEarly || wasOpenEnded ? newDaysCount : existing.DaysCount,
          EndDate: recalculatedEndDate,
          RequestedDays: existing.RequestedDays || existing.DaysCount,
          RefundedDays: totalRefunded,
          RefundedBreakdown: breakdown.length > 0 ? JSON.stringify(breakdown) : null,
          ...(isAnnualLeave && isEarly && existing.ConsumedYear
            ? { ConsumedBreakdown: JSON.stringify([{ year: existing.ConsumedYear, deducted: newDaysCount }]) }
            : {}),
          RemainingBalanceAfter: remainingBalanceAfter,
          Notes: updatedNotes,
          CustomEndText: resolveCustomEndText(data, existing.StateTypeOrReason, existing.CustomEndText, true),
          ExceptionalReason: resolveExceptionalReason(data, existing.StateTypeOrReason, existing.ExceptionalReason, true),
        },
        include: { Employee: { select: STATE_EMPLOYEE_SELECT } },
      });

      updatedState._remainingBreakdown = remainingBreakdown;
      return { updatedState, breakdown };
    },
    { maxWait: 15000, timeout: 60000 }
  );

  await SystemRecordService.log({
    userFullName: requestingUser.fullName || requestingUser.userName || "System",
    title: "استئناف إجازة مبكراً",
    description: `تم استئناف إجازة '${existing.StateTypeOrReason}' للموظف (رقم: ${existing.EmployeesId}) واسترجاع ${transactionResult.updatedState.RefundedDays || 0} يوم بواسطة '${requestingUser.userName}'.`,
    usersId: requestingUser.id || 1,
    employeesId: existing.EmployeesId,
    ipAddress: requestingUser.ipAddress,
  });

  CacheService.invalidateEmployeeEcosystem();

  return {
    data: transactionResult.updatedState,
    breakdown: transactionResult.breakdown,
  };
}

module.exports = {
  STATE_EMPLOYEE_SELECT,
  getAllStates,
  getStateById,
  resumeLeaveEarly,
};
