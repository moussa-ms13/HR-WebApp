import React from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { REPORT_TYPE_OPTIONS } from '../exportConfig';
import ExportColumnPicker from './ExportColumnPicker';

export default function ExportFilterPanel({
  reportType,
  onReportTypeChange,
  filterOptions,
  selectedProvince,
  onProvinceChange,
  selectedDirectorate,
  onDirectorateChange,
  availableDirectorates,
  employmentCategory,
  onEmploymentCategoryChange,
  rankId,
  onRankIdChange,
  availableRanks,
  status,
  onStatusChange,
  gender,
  onGenderChange,
  leaveType,
  onLeaveTypeChange,
  resumeStatus,
  onResumeStatusChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  caseType,
  onCaseTypeChange,
  activeStatus,
  onActiveStatusChange,
  categoryMode,
  onCategoryModeChange,
  searchQuery,
  onSearchQueryChange,
  customTitle,
  onCustomTitleChange,
  isTitleManuallyEdited,
  onRestoreSmartTitle,
  availableColumns,
  selectedColumns,
  onToggleColumn,
  onSelectAllColumns,
  onResetDefaultColumns,
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 mb-5 space-y-4">
      {/* Row 1: Primary Filters (Report Type + Workplace) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Report Type Dropdown */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            نوع القائمة / التقرير
          </label>
          <div className="relative">
            <select
              value={reportType}
              onChange={(e) => onReportTypeChange(e.target.value)}
              className="w-full text-xs font-medium bg-slate-50/80 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-600 outline-hidden appearance-none cursor-pointer"
            >
              {REPORT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={15}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
          </div>
        </div>

        {/* Province */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            الولاية
          </label>
          <div className="relative">
            <select
              value={selectedProvince}
              onChange={(e) => onProvinceChange(e.target.value)}
              disabled={filterOptions.provinces.length === 1}
              className="w-full text-xs font-medium bg-slate-50/80 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-600 outline-hidden appearance-none cursor-pointer disabled:bg-slate-100 disabled:cursor-not-allowed"
            >
              {filterOptions.provinces.length > 1 && <option value="">جميع الولايات المسموحة</option>}
              {filterOptions.provinces.map((p) => (
                <option key={p} value={p}>
                  ولاية {p}
                </option>
              ))}
            </select>
            <ChevronDown
              size={15}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
          </div>
        </div>

        {/* Directorate */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            المديرية / الجهة
          </label>
          <div className="relative">
            <select
              value={selectedDirectorate}
              onChange={(e) => onDirectorateChange(e.target.value)}
              disabled={!selectedProvince || availableDirectorates.length === 0}
              className="w-full text-xs font-medium bg-slate-50/80 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-600 outline-hidden appearance-none cursor-pointer disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              <option value="">
                {!selectedProvince
                  ? 'اختر الولاية أولاً'
                  : availableDirectorates.length === 0
                  ? 'لا توجد جهات مسجلة'
                  : 'جميع المديريات بالولاية'}
              </option>
              {availableDirectorates.map((dir) => (
                <option key={dir} value={dir}>
                  {dir}
                </option>
              ))}
            </select>
            <ChevronDown
              size={15}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
          </div>
        </div>
      </div>

      {/* Row 2: Report-Specific Filters */}
      {reportType === 'nominal' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              فئة التوظيف
            </label>
            <select
              value={employmentCategory}
              onChange={(e) => onEmploymentCategoryChange(e.target.value)}
              className="w-full text-xs font-medium bg-slate-50/80 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-600 outline-hidden cursor-pointer"
            >
              <option value="">جميع فئات التوظيف</option>
              {(filterOptions.employmentCategories?.length > 0
                ? filterOptions.employmentCategories.filter((c) => c && c !== 'غير محدد' && c !== 'اسلاك تقنية' && c !== 'متعاقدين بدوام جزئي')
                : ['اسلاك مشتركة', 'أسلاك تقنية (خاصة)', 'متعاقدون بدوام كلي', 'متعاقدون بدوام جزئي']
              ).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              الرتبة الوظيفية
            </label>
            <select
              value={rankId}
              onChange={(e) => onRankIdChange(e.target.value)}
              className="w-full text-xs font-medium bg-slate-50/80 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-600 outline-hidden cursor-pointer"
            >
              <option value="">جميع الرتب</option>
              {availableRanks.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.rankName} {r.categoryLevel ? `(صنف ${r.categoryLevel})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              الوضعية الإدارية / الحالة
            </label>
            <select
              value={status}
              onChange={(e) => onStatusChange(e.target.value)}
              className="w-full text-xs font-medium bg-slate-50/80 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-600 outline-hidden cursor-pointer"
            >
              <option value="">جميع الحالات والوضعيات</option>
              <option value="مرسم">مرسم</option>
              <option value="متربص">متربص</option>
              <option value="متعاقد">متعاقد</option>
              <option value="في الخدمة">في الخدمة (نشط)</option>
              <option value="عطلة">في عطلة</option>
              <option value="حالة خاصة">حالة خاصة</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              الجنس
            </label>
            <select
              value={gender}
              onChange={(e) => onGenderChange(e.target.value)}
              className="w-full text-xs font-medium bg-slate-50/80 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-600 outline-hidden cursor-pointer"
            >
              <option value="">الكل (ذكور وإناث)</option>
              <option value="ذكر">ذكور فقط</option>
              <option value="أنثى">إناث فقط</option>
            </select>
          </div>
        </div>
      )}

      {reportType === 'leaves' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              نوع العطلة
            </label>
            <select
              value={leaveType}
              onChange={(e) => onLeaveTypeChange(e.target.value)}
              className="w-full text-xs font-medium bg-slate-50/80 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-600 outline-hidden cursor-pointer"
            >
              <option value="">جميع أنواع العطل</option>
              {filterOptions.leaveTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              حالة الاستئناف
            </label>
            <select
              value={resumeStatus}
              onChange={(e) => onResumeStatusChange(e.target.value)}
              className="w-full text-xs font-medium bg-slate-50/80 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-600 outline-hidden cursor-pointer"
            >
              <option value="">جميع حالات الاستئناف</option>
              <option value="ساري المفعول">ساري المفعول (في عطلة)</option>
              <option value="لم يستأنف (متأخر)">لم يستأنف (متأخر)</option>
              <option value="تم الاستئناف">تم الاستئناف</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              تاريخ البداية (من)
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => onDateFromChange(e.target.value)}
              className="w-full text-xs font-medium bg-slate-50/80 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-600 outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              تاريخ البداية (إلى)
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => onDateToChange(e.target.value)}
              className="w-full text-xs font-medium bg-slate-50/80 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-600 outline-hidden"
            />
          </div>
        </div>
      )}

      {reportType === 'special-cases' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              نوع الحالة الخاصة
            </label>
            <select
              value={caseType}
              onChange={(e) => onCaseTypeChange(e.target.value)}
              className="w-full text-xs font-medium bg-slate-50/80 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-600 outline-hidden cursor-pointer"
            >
              <option value="">جميع الحالات الخاصة</option>
              {filterOptions.specialCaseTypes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              سريان الحالة
            </label>
            <select
              value={activeStatus}
              onChange={(e) => onActiveStatusChange(e.target.value)}
              className="w-full text-xs font-medium bg-slate-50/80 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-600 outline-hidden cursor-pointer"
            >
              <option value="">جميع الوضعيات</option>
              <option value="ساري المفعول">ساري المفعول</option>
              <option value="منتهي">منتهي</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              تاريخ السريان (من)
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => onDateFromChange(e.target.value)}
              className="w-full text-xs font-medium bg-slate-50/80 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-600 outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              تاريخ السريان (إلى)
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => onDateToChange(e.target.value)}
              className="w-full text-xs font-medium bg-slate-50/80 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-600 outline-hidden"
            />
          </div>
        </div>
      )}

      {reportType === 'degrees-experience' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              نمط الترقية / الفئة المهنية
            </label>
            <select
              value={categoryMode}
              onChange={(e) => onCategoryModeChange(e.target.value)}
              className="w-full text-xs font-medium bg-slate-50/80 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-600 outline-hidden cursor-pointer"
            >
              <option value="all">الكل (مرسمون ومتعاقدون)</option>
              <option value="grades">الدرجات (1-12) للمرسمين</option>
              <option value="experience">تعويض الخبرة (1.4%) للمتعاقدين</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              البحث السريع
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                placeholder="ابحث بالاسم، اللقب، أو الرتبة..."
                className="w-full text-xs bg-slate-50/80 border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-slate-800 focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-600 outline-hidden"
              />
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
            </div>
          </div>
        </div>
      )}

      {/* Row 3: Quick Search (for other templates) + Title Input */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 pt-2 border-t border-slate-100">
        {reportType !== 'degrees-experience' && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              البحث السريع
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                placeholder="ابحث باللقب، الاسم، أو رقم التعريف..."
                className="w-full text-xs bg-slate-50/80 border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-slate-800 focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-600 outline-hidden"
              />
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
            </div>
          </div>
        )}

        <div className={reportType === 'degrees-experience' ? 'lg:col-span-3' : 'lg:col-span-2'}>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-700">
              عنوان القائمة في ملف الإكسيل
            </label>
            {isTitleManuallyEdited && (
              <button
                type="button"
                onClick={onRestoreSmartTitle}
                className="text-xs text-emerald-700 hover:text-emerald-800 underline font-medium cursor-pointer"
              >
                استعادة العنوان التلقائي
              </button>
            )}
          </div>
          <input
            type="text"
            value={customTitle}
            onChange={(e) => onCustomTitleChange(e.target.value)}
            placeholder="اكتب العنوان هنا..."
            className="w-full text-xs font-bold bg-slate-50/80 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-600 outline-hidden"
          />
        </div>
      </div>

      {/* Row 4: Column Selector */}
      <ExportColumnPicker
        availableColumns={availableColumns}
        selectedColumns={selectedColumns}
        onToggleColumn={onToggleColumn}
        onSelectAll={onSelectAllColumns}
        onResetDefault={onResetDefaultColumns}
      />
    </div>
  );
}
