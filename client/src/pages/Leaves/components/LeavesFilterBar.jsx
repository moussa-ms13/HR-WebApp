import React, { useState, useEffect } from 'react';
import { Search, ChevronDown, Plus, ChevronLeft, ChevronRight, X } from 'lucide-react';

export default function LeavesFilterBar({
  provinceFilter,
  setProvinceFilter,
  directorateFilter,
  setDirectorateFilter,
  caseTypeFilter = '',
  setCaseTypeFilter = null,
  caseTypeOptions = [],
  caseTypeLabel = 'نوع الحالة: الكل',
  viewFilter = '',
  setViewFilter = null,
  viewOptions = [],
  yearFilter = '',
  setYearFilter = null,
  yearOptions = [],
  allowedProvinces = [],
  availableMofatishiyat = [],
  availableMohafathat = [],
  searchInput,
  handleSearchChange,
  setPage,
  canAdd = false,
  onAdd,
  addButtonLabel = 'تسجيل عطلة',
  searchPlaceholder = 'البحث باسم الموظف...',
}) {
  const [localYear, setLocalYear] = useState(yearFilter || '');

  useEffect(() => {
    setLocalYear(yearFilter || '');
  }, [yearFilter]);

  const handlePrevYear = () => {
    const currentYear = new Date().getFullYear();
    const active = yearFilter ? Number(yearFilter) : currentYear;
    const nextVal = (!yearFilter) ? (currentYear - 1) : (active - 1);
    setYearFilter?.(String(nextVal));
    setLocalYear(String(nextVal));
    setPage?.(1);
  };

  const handleNextYear = () => {
    const currentYear = new Date().getFullYear();
    const active = yearFilter ? Number(yearFilter) : (currentYear - 1);
    const nextVal = active + 1;
    setYearFilter?.(String(nextVal));
    setLocalYear(String(nextVal));
    setPage?.(1);
  };

  const handleClearYear = () => {
    setYearFilter?.('');
    setLocalYear('');
    setPage?.(1);
  };

  const handleYearInputChange = (e) => {
    const rawVal = e.target.value.replace(/\D/g, '').slice(0, 4);
    setLocalYear(rawVal);
    if (rawVal === '') {
      setYearFilter?.('');
      setPage?.(1);
    } else if (rawVal.length === 4) {
      const num = Number(rawVal);
      if (num >= 1900 && num <= 2100) {
        setYearFilter?.(String(num));
        setPage?.(1);
      }
    }
  };

  const applyYearInput = () => {
    const trimmed = String(localYear || '').trim();
    if (!trimmed) {
      if (yearFilter !== '') {
        setYearFilter?.('');
        setPage?.(1);
      }
      return;
    }
    const num = Number(trimmed);
    if (Number.isInteger(num) && num >= 1900 && num <= 2100) {
      if (yearFilter !== String(num)) {
        setYearFilter?.(String(num));
        setPage?.(1);
      }
    } else {
      setLocalYear(yearFilter || '');
    }
  };

  const handleYearInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyYearInput();
    }
  };

  const handleYearInputBlur = () => {
    applyYearInput();
  };

  return (
    <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mb-6 bg-white p-3 rounded-xl border border-gray-200">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* Record View Select (Optional, e.g. Special Cases lifecycle) */}
        {setViewFilter && (
          <>
            <div className="relative flex items-center">
              <select
                id="filter-record-view"
                aria-label="عرض السجلات"
                value={viewFilter}
                onChange={(e) => {
                  setViewFilter(e.target.value);
                  setPage?.(1);
                }}
                className="h-9 flex items-center text-sm font-semibold text-emerald-800 bg-emerald-50/70 hover:bg-emerald-100/80 border border-emerald-200 rounded-lg px-3 outline-none cursor-pointer appearance-none pl-7 transition-colors shadow-xs"
              >
                {viewOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute left-2 text-emerald-700 pointer-events-none" />
            </div>
            <div className="h-4 w-px bg-gray-200 ml-2" />
          </>
        )}
        {/* Province Select */}
        <div className="relative flex items-center">
          <select
            value={provinceFilter}
            onChange={(e) => {
              setProvinceFilter(e.target.value);
              setDirectorateFilter('');
              setPage(1);
            }}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 px-3 py-2 hover:bg-gray-50 rounded-lg outline-none bg-transparent cursor-pointer appearance-none pl-7"
          >
            <option value="">الولاية: الكل</option>
            {allowedProvinces.map((prov) => (
              <option key={prov} value={prov}>
                {prov}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute left-2 text-gray-500 pointer-events-none" />
        </div>

        <div className="h-4 w-px bg-gray-200 ml-2" />

        {/* Directorate Select */}
        <div className="relative flex items-center">
          <select
            value={directorateFilter}
            onChange={(e) => {
              setDirectorateFilter(e.target.value);
              setPage(1);
            }}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 px-3 py-2 hover:bg-gray-50 rounded-lg outline-none bg-transparent cursor-pointer appearance-none pl-7"
          >
            <option value="">الجهة: الكل</option>
            {provinceFilter === 'الشلف' && (
              <option
                value="المديرية الجهوية للأملاك الوطنية"
                className="font-bold text-emerald-700 bg-emerald-50"
              >
                المديرية الجهوية للأملاك الوطنية
              </option>
            )}
            <option value="مديرية أملاك الدولة" className="font-bold">
              مديرية أملاك الدولة
            </option>
            {availableMofatishiyat.map((item) => (
              <option key={item} value={item}>
                -- {item}
              </option>
            ))}
            <option value="مديرية مسح الأراضي والحفظ العقاري" className="font-bold">
              مديرية مسح الأراضي
            </option>
            {availableMohafathat.map((item) => (
              <option key={item} value={item}>
                -- {item}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute left-2 text-gray-500 pointer-events-none" />
        </div>

        {/* Case Type Select (Optional for Special Cases) */}
        {setCaseTypeFilter && (
          <>
            <div className="h-4 w-px bg-gray-200 ml-2" />
            <div className="relative flex items-center">
              <select
                value={caseTypeFilter}
                onChange={(e) => {
                  setCaseTypeFilter(e.target.value);
                  setPage?.(1);
                }}
                className="flex items-center gap-2 text-sm font-medium text-gray-600 px-3 py-2 hover:bg-gray-50 rounded-lg outline-none bg-transparent cursor-pointer appearance-none pl-7"
              >
                <option value="">{caseTypeLabel}</option>
                {caseTypeOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute left-2 text-gray-500 pointer-events-none" />
            </div>
          </>
        )}

        {/* Compact Year Stepper & Direct Input Control (< 2026 >) */}
        {setYearFilter && (
          <>
            <div className="h-4 w-px bg-gray-200 ml-2" />
            <div className="flex items-center gap-1.5" title="تصفية حسب السنة">
              <span className="text-xs font-semibold text-gray-500 whitespace-nowrap select-none">السنة:</span>
              <div
                className={`flex items-center h-9 px-1 rounded-lg border transition-all ${
                  yearFilter
                    ? 'bg-emerald-50/60 border-emerald-300 text-emerald-900 shadow-xs ring-1 ring-emerald-200/50'
                    : 'bg-white border-gray-200 hover:border-gray-300 text-gray-700 shadow-xs'
                }`}
                dir="ltr"
              >
                {/* Left Button (< / Previous Year) */}
                <button
                  type="button"
                  id="year-stepper-prev"
                  title="السنة السابقة"
                  aria-label="السنة السابقة"
                  onClick={handlePrevYear}
                  className="w-6 h-7 flex items-center justify-center rounded text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <ChevronLeft size={14} />
                </button>

                {/* Center Editable Input */}
                <input
                  type="text"
                  id="year-stepper-input"
                  inputMode="numeric"
                  maxLength={4}
                  value={localYear}
                  onChange={handleYearInputChange}
                  onKeyDown={handleYearInputKeyDown}
                  onBlur={handleYearInputBlur}
                  placeholder="الكل"
                  className="w-12 text-center font-bold text-xs bg-transparent focus:outline-none text-slate-800 placeholder:text-gray-400 placeholder:font-normal selection:bg-emerald-100"
                />

                {/* Right Button (> / Next Year) */}
                <button
                  type="button"
                  id="year-stepper-next"
                  title="السنة التالية"
                  aria-label="السنة التالية"
                  onClick={handleNextYear}
                  className="w-6 h-7 flex items-center justify-center rounded text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <ChevronRight size={14} />
                </button>

                {/* Clear (×) Button */}
                {yearFilter && (
                  <button
                    type="button"
                    id="year-stepper-clear"
                    title="عرض الكل (إلغاء التصفية)"
                    aria-label="إلغاء تصفية السنة"
                    onClick={handleClearYear}
                    className="ml-0.5 w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        <div className="h-4 w-px bg-gray-200 ml-2" />

        {/* Search Input */}
        <div className="relative w-64">
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchInput}
            onChange={handleSearchChange}
            className="w-full pr-10 pl-4 py-2 bg-gray-50 border-none rounded-lg outline-none text-sm text-slate-700 focus:ring-1 focus:ring-gray-200"
          />
          <Search className="absolute right-3 top-2.5 text-gray-400" size={16} />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        {canAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="flex items-center justify-center gap-1.5 px-5 py-2 text-white rounded-lg transition-all font-medium shadow-sm text-sm hover:shadow-md active:scale-[0.97] cursor-pointer"
            style={{ backgroundColor: '#10b981' }}
          >
            <Plus size={16} />
            <span>{addButtonLabel}</span>
          </button>
        )}
      </div>
    </div>
  );
}
