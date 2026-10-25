import React, { useState } from 'react';
import useSWR from 'swr';
import { Users, Calendar, Briefcase, FolderOpen, Loader2, Clock, AlertTriangle, ChevronLeft, ChevronRight, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { 
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import apiClient from '../../services/apiClient';
import { DateText } from '../../utils/formatDate';
import { formatEmployeeName } from '../../utils/employeeUtils';
import { useAuth } from '../../context/AuthContext';

const fetcher = async (url) => {
  const response = await apiClient.get(url);
  return response.data;
};

const PIE_COLORS = [
  '#105b38', '#0a7e50', '#209e66', '#2dd4bf', 
  '#c7a43e', '#eab308', '#f59e0b', '#3b82f6',
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444'
];

const Dashboard = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';

  // Stats + recent activity
  const { data: statsData, error: statsError, isLoading: isStatsLoading } = useSWR('/dashboard/stats', fetcher, {
    keepPreviousData: true,
    dedupingInterval: 30000,
  });

  // Province PieChart data (DB-level groupBy)
  const { data: provinceData, isLoading: isProvinceLoading } = useSWR('/dashboard/employees-by-province', fetcher, {
    keepPreviousData: true,
    dedupingInterval: 30000,
  });

  // Resuming soon panel — optimized: keep stale data visible, dedupe within 30s
  const { data: resumingData, isLoading: isResumingLoading } = useSWR('/dashboard/resuming-soon', fetcher, {
    keepPreviousData: true,
    dedupingInterval: 30000,
  });

  // Overdue resumes panel — optimized: keep stale data visible, dedupe within 30s
  const { data: overdueData, isLoading: isOverdueLoading } = useSWR('/dashboard/overdue-resumes', fetcher, {
    keepPreviousData: true,
    dedupingInterval: 30000,
  });

  // Admin-only: Daily User KPIs with date navigation & 3-minute auto-refresh
  const [kpiDate, setKpiDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  });

  const { data: kpiData, isLoading: isKpiLoading } = useSWR(
    isAdmin ? `/dashboard/user-kpis?date=${kpiDate}` : null,
    fetcher,
    { refreshInterval: 180000, keepPreviousData: true, dedupingInterval: 30000 }
  );

  // Date navigation helpers
  const shiftKpiDate = (days) => {
    const d = new Date(kpiDate);
    d.setDate(d.getDate() + days);
    // Don't allow future dates
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (d > today) return;
    setKpiDate(d.toISOString().slice(0, 10));
  };

  const formatKpiDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ar-DZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  const isToday = kpiDate === new Date().toISOString().slice(0, 10);

  if (isStatsLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 size={32} className="animate-spin text-emerald-600" />
      </div>
    );
  }

  if (statsError || !statsData?.success) {
    return (
      <div className="flex h-full w-full items-center justify-center text-red-500 font-medium">
        فشل في تحميل بيانات لوحة القيادة.
      </div>
    );
  }

  const { stats } = statsData.data;
  const pieData = provinceData?.data || [];
  const resumingSoon = resumingData?.data || [];
  const overdueResumes = overdueData?.data || [];
  const userKpis = kpiData?.data || [];
  const maxKpi = userKpis.length > 0 ? Math.max(...userKpis.map(k => k.count)) : 1;



  return (
    <div className="flex flex-col gap-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">الرئيسية</h1>
          <p className="text-sm text-slate-500 mt-1">نظرة عامة على نظام الموارد البشرية</p>
        </div>
        <div className="flex gap-2">
          <Link to="/employees" className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors">
            إدارة الموظفين
          </Link>
          <Link to="/leaves" className="px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors" style={{ backgroundColor: '#105b38' }}>
            تسجيل عطلة
          </Link>
        </div>
      </div>

      {/* Row 1 — Top Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="إجمالي الموظفين" 
          value={stats.totalEmployees} 
          icon={<Users size={24} className="text-blue-500" />} 
          bgColor="bg-blue-50" 
        />
        <StatCard 
          title="الموظفون في عطلة / حالات خاصة" 
          value={stats.activeLeaves} 
          icon={<Calendar size={24} className="text-orange-500" />} 
          bgColor="bg-orange-50" 
        />
        <StatCard 
          title="المستندات المرفوعة" 
          value={stats.totalDocuments} 
          icon={<FolderOpen size={24} className="text-purple-500" />} 
          bgColor="bg-purple-50" 
        />
        <StatCard 
          title="إجمالي الرتب" 
          value={stats.totalJobTitles} 
          icon={<Briefcase size={24} className="text-emerald-500" />} 
          bgColor="bg-emerald-50" 
        />
      </div>

      {/* Row 2 — Operational Leave Return Tracking (Side-by-Side 50/50) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Right Card: Overdue Resumes (تأخر في الاستئناف) */}
        <div className="bg-red-50 rounded-xl border border-red-200 shadow-sm overflow-hidden flex flex-col h-full">
          <div className="border-r-4 border-red-500 p-5 flex flex-col flex-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-red-800">تأخر في الاستئناف</h2>
                <p className="text-xs text-red-600 mt-0.5">موظفون تجاوزوا تاريخ العودة</p>
              </div>
              {overdueResumes.length > 0 && (
                <span className="mr-auto inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-600 text-white text-xs font-bold animate-pulse">
                  {overdueResumes.length}
                </span>
              )}
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1 flex-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-red-200 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-red-300">
              {isOverdueLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-red-400" />
                </div>
              ) : overdueResumes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center text-red-400 text-sm">
                  <span className="text-2xl mb-1">✓</span>
                  لا يوجد موظفون متأخرون — ممتاز
                </div>
              ) : (
                overdueResumes.map((state) => (
                  <Link
                    key={state.Id}
                    to={`/leaves?search=${encodeURIComponent(formatEmployeeName(state.Employee, ''))}`}
                    className="flex items-center gap-3 bg-white/70 rounded-lg p-3 border border-red-100 cursor-pointer group transition-all duration-200 hover:bg-red-100/80 hover:border-red-200 hover:shadow-sm"
                  >
                    <div className="w-2 h-2 mt-1.5 rounded-full shrink-0 bg-red-500 animate-pulse" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">
                        {formatEmployeeName(state.Employee, 'موظف')}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{state.StateTypeOrReason}</p>
                    </div>
                    <span className="shrink-0 inline-flex items-center rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700 border border-red-200">
                      متأخر {state.overdueDays} يوم
                    </span>
                    <ChevronLeft size={16} className="shrink-0 opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-red-300 group-hover:text-red-500" />
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Left Card: Resuming Soon (سوف يستأنف العمل قريباً) */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col h-full">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
              <Clock size={20} className="text-orange-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">سوف يستأنف العمل قريباً</h2>
              <p className="text-xs text-slate-500 mt-0.5">موظفون مقبلون على استئناف العمل</p>
            </div>
            {resumingSoon.length > 0 && (
              <span className="mr-auto inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-bold">
                {resumingSoon.length}
              </span>
            )}
          </div>
          
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1 flex-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-orange-200 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-orange-300">
            {isResumingLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={24} className="animate-spin text-orange-400" />
              </div>
            ) : resumingSoon.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center text-gray-400 text-sm">
                لا توجد حالات استئناف قريبة
              </div>
            ) : (
              resumingSoon.map((state) => (
                <Link
                  key={state.Id}
                  to={`/leaves?search=${encodeURIComponent(formatEmployeeName(state.Employee, ''))}`}
                  className="flex items-center gap-3 bg-slate-50/70 rounded-lg p-3 border border-slate-100 cursor-pointer group transition-all duration-200 hover:bg-orange-50/80 hover:border-orange-200 hover:shadow-sm"
                >
                  <div className="w-2 h-2 mt-1.5 rounded-full shrink-0 bg-orange-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">
                      {formatEmployeeName(state.Employee, 'موظف')}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{state.StateTypeOrReason}</p>
                  </div>
                  <span className="shrink-0 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200/70 rounded-full px-2.5 py-1 font-medium">
                    تاريخ العودة: <DateText value={state.EndDate} />
                  </span>
                  <ChevronLeft size={16} className="shrink-0 opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-orange-300 group-hover:text-orange-500" />
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Row 3 — Analytics & Charts (User KPIs: lg:col-span-7, Donut Chart: lg:col-span-5) */}
      <div className={`grid grid-cols-1 ${isAdmin ? 'lg:grid-cols-12' : 'lg:grid-cols-1'} gap-6 items-stretch`}>
        {/* Right Side (lg:col-span-7): Daily User KPIs — Vertical Bar Chart */}
        {isAdmin && (
          <div className="lg:col-span-7 bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
            {/* Header with date navigation */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <BarChart3 size={20} className="text-emerald-600" />
                مؤشرات أداء المستخدمين
              </h2>

              <div className="flex items-center gap-2">
                {!isToday && (
                  <button
                    onClick={() => setKpiDate(new Date().toISOString().slice(0, 10))}
                    className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                  >
                    اليوم
                  </button>
                )}

                <div className="flex items-center gap-1 bg-gray-50 rounded-lg border border-gray-200 px-1 py-1">
                  <button
                    onClick={() => shiftKpiDate(-1)}
                    className="p-1.5 rounded-md hover:bg-gray-200 transition-colors text-gray-500 hover:text-gray-700"
                    title="اليوم السابق"
                  >
                    <ChevronRight size={16} />
                  </button>
                  <span dir="ltr" className="text-sm font-medium text-slate-700 px-3 min-w-[180px] text-center select-none">
                    {formatKpiDate(kpiDate)}
                  </span>
                  <button
                    onClick={() => shiftKpiDate(1)}
                    disabled={isToday}
                    className={`p-1.5 rounded-md transition-colors ${isToday ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-gray-200 text-gray-500 hover:text-gray-700'}`}
                    title="اليوم التالي"
                  >
                    <ChevronLeft size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Bar Chart */}
            <div className="flex-1 flex flex-col justify-end">
              {isKpiLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 size={28} className="animate-spin text-emerald-500" />
                </div>
              ) : userKpis.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
                  لا توجد عمليات مسجلة في هذا اليوم
                </div>
              ) : (
                <div className="flex items-end justify-around h-64 w-full gap-2 pt-6 px-2">
                  {userKpis.map((kpi, i) => {
                    const heightPct = Math.max((kpi.count / maxKpi) * 100, 6);
                    return (
                      <div key={i} className="flex flex-col items-center flex-1 min-w-0 h-full justify-end group">
                        {/* Count label above bar */}
                        <span className="text-sm font-bold text-gray-700 mb-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                          {kpi.count}
                        </span>
                        {/* Bar */}
                        <div
                          className="w-full max-w-[48px] bg-emerald-500 hover:bg-emerald-600 rounded-t-md transition-all duration-500 ease-out cursor-default"
                          style={{ height: `${heightPct}%` }}
                          title={`${kpi.name}: ${kpi.count}`}
                        />
                        {/* User name below bar */}
                        <p className="text-[11px] text-slate-500 font-medium mt-2 text-center truncate w-full leading-tight max-w-[80px]">
                          {kpi.name}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Left Side (lg:col-span-5): Province Distribution Donut Chart with Curved Corners */}
        <div className={`${isAdmin ? 'lg:col-span-5' : 'lg:col-span-12'} bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800">توزيع الموظفين حسب الولاية</h2>
            {pieData.length > 0 && (
              <span className="text-xs text-slate-400 font-medium">
                {pieData.reduce((acc, curr) => acc + (curr.count || 0), 0)} موظف
              </span>
            )}
          </div>
          <div className="h-80 w-full flex items-center justify-center flex-1" dir="ltr">
            {isProvinceLoading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 size={24} className="animate-spin text-emerald-500" />
              </div>
            ) : pieData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-gray-400 text-sm">
                لا توجد بيانات لعرضها
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={98}
                    cornerRadius={6}
                    paddingAngle={4}
                    stroke="none"
                    dataKey="count"
                    nameKey="name"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={{ strokeWidth: 1, stroke: '#cbd5e1' }}
                  >
                    {pieData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={PIE_COLORS[index % PIE_COLORS.length]} 
                        stroke="none"
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value, name) => [`${value} موظف`, name]}
                    contentStyle={{ 
                      borderRadius: '8px', 
                      border: 'none', 
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', 
                      direction: 'rtl',
                      fontFamily: 'inherit'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon, bgColor }) => (
  <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4 transition-transform hover:-translate-y-1">
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${bgColor}`}>
      {icon}
    </div>
    <div>
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <h3 className="text-2xl font-bold text-slate-800 mt-1">{value}</h3>
    </div>
  </div>
);

export default Dashboard;
