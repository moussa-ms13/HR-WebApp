import React from 'react';
import { Search, ChevronDown, Plus } from 'lucide-react';

export default function LeavesFilterBar({
  provinceFilter,
  setProvinceFilter,
  directorateFilter,
  setDirectorateFilter,
  caseTypeFilter = '',
  setCaseTypeFilter = null,
  caseTypeOptions = [],
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
  return (
    <div className="flex flex-col sm:flex-row justify-between items-center mb-6 bg-white p-3 rounded-xl border border-gray-200">
      <div className="flex items-center gap-3">
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
                <option value="">نوع الحالة: الكل</option>
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
