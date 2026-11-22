import React from "react";

const RecitalToggleCard = ({ checked, onToggle, title, children }) => (
  <div
    className={`rounded-lg border transition-colors ${
      checked
        ? "border-emerald-300 bg-emerald-50/40"
        : "border-slate-200 bg-slate-50/50"
    }`}
  >
    <label className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onToggle(e.target.checked)}
        className="w-4 h-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-500 cursor-pointer"
      />
      <span
        className={`text-xs font-bold ${
          checked ? "text-emerald-900" : "text-slate-600"
        }`}
      >
        {title}
      </span>
    </label>
    {checked && (
      <div className="px-3 pb-3 pt-1 border-t border-emerald-200/60 space-y-2">
        {children}
      </div>
    )}
  </div>
);

/**
 * ExperienceRecitalsForm — Renders the 4 optional dynamic career recitals
 * with include/exclude checkboxes and compact number/date inputs.
 */
export default function ExperienceRecitalsForm({ form, updateField }) {
  return (
    <div className="border-t border-slate-100 pt-3 space-y-2.5">
      {/* 1. Temporary Appointment */}
      <RecitalToggleCard
        checked={form.includeTemp}
        onToggle={(val) => updateField("includeTemp", val)}
        title="1. مقرر التوظيف بصفة عون مؤقت"
      >
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
              رقم المقرر
            </label>
            <input
              type="text"
              value={form.tempDecNum}
              onChange={(e) => updateField("tempDecNum", e.target.value)}
              placeholder="مثال: 49"
              className="w-full px-2 py-1 text-xs border border-slate-300 rounded-md bg-white outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
              تاريخ المقرر
            </label>
            <input
              type="date"
              value={form.tempDecDate}
              onChange={(e) => updateField("tempDecDate", e.target.value)}
              className="w-full px-2 py-1 text-xs border border-slate-300 rounded-md bg-white outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
            تاريخ بداية التوظيف المؤقت
          </label>
          <input
            type="date"
            value={form.tempStartDate}
            onChange={(e) => updateField("tempStartDate", e.target.value)}
            className="w-full px-2 py-1 text-xs border border-slate-300 rounded-md bg-white outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </RecitalToggleCard>

      {/* 2. Work Contract */}
      <RecitalToggleCard
        checked={form.includeContract}
        onToggle={(val) => updateField("includeContract", val)}
        title="2. عقد العمل غير محدد المدة"
      >
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
              رقم العقد
            </label>
            <input
              type="text"
              value={form.contractNum}
              onChange={(e) => updateField("contractNum", e.target.value)}
              placeholder="مثال: 101"
              className="w-full px-2 py-1 text-xs border border-slate-300 rounded-md bg-white outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
              تاريخ العقد
            </label>
            <input
              type="date"
              value={form.contractDate}
              onChange={(e) => updateField("contractDate", e.target.value)}
              className="w-full px-2 py-1 text-xs border border-slate-300 rounded-md bg-white outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
              نظام التوقيت
            </label>
            <select
              value={form.contractSchedule}
              onChange={(e) => updateField("contractSchedule", e.target.value)}
              className="w-full px-2 py-1 text-xs border border-slate-300 rounded-md bg-white outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="الكامل">التوقيت الكامل</option>
              <option value="الجزئي">التوقيت الجزئي</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
              تاريخ السريان
            </label>
            <input
              type="date"
              value={form.contractStartDate}
              onChange={(e) => updateField("contractStartDate", e.target.value)}
              className="w-full px-2 py-1 text-xs border border-slate-300 rounded-md bg-white outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>
      </RecitalToggleCard>

      {/* 3. Previous Allowance Decision */}
      <RecitalToggleCard
        checked={form.includePrevDecision}
        onToggle={(val) => updateField("includePrevDecision", val)}
        title="3. مقرر تعويض الخبرة المهنية السابق"
      >
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
              رقم المقرر السابق
            </label>
            <input
              type="text"
              value={form.prevDecNum}
              onChange={(e) => updateField("prevDecNum", e.target.value)}
              placeholder="مثال: 903"
              className="w-full px-2 py-1 text-xs border border-slate-300 rounded-md bg-white outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
              تاريخ المقرر السابق
            </label>
            <input
              type="date"
              value={form.prevDecDate}
              onChange={(e) => updateField("prevDecDate", e.target.value)}
              className="w-full px-2 py-1 text-xs border border-slate-300 rounded-md bg-white outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
            يسري ابتداءً من
          </label>
          <input
            type="date"
            value={form.prevEffectiveDate}
            onChange={(e) => updateField("prevEffectiveDate", e.target.value)}
            className="w-full px-2 py-1 text-xs border border-slate-300 rounded-md bg-white outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </RecitalToggleCard>

      {/* 4. National Service / Retention */}
      <RecitalToggleCard
        checked={form.includeNationalService}
        onToggle={(val) => updateField("includeNationalService", val)}
        title="4. مقرر تثبيت الخدمة الوطنية والاستبقاء"
      >
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
              رقم المقرر
            </label>
            <input
              type="text"
              value={form.nsDecNum}
              onChange={(e) => updateField("nsDecNum", e.target.value)}
              placeholder="مثال: 866"
              className="w-full px-2 py-1 text-xs border border-slate-300 rounded-md bg-white outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
              تاريخ المقرر
            </label>
            <input
              type="date"
              value={form.nsDecDate}
              onChange={(e) => updateField("nsDecDate", e.target.value)}
              className="w-full px-2 py-1 text-xs border border-slate-300 rounded-md bg-white outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>
      </RecitalToggleCard>
    </div>
  );
}
