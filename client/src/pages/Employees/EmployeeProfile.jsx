import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import apiClient from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import { ArrowRight, User, Loader2, Building2, Calendar, FileText } from 'lucide-react';
import { DateText } from '../../utils/formatDate';
import { formatEmployeeName, getAssetUrl } from '../../utils/employeeUtils';
import ConfirmModal from '../../components/ui/ConfirmModal';

// Modular Domain Tabs
import ProfileOverviewTab from './components/tabs/ProfileOverviewTab';
import LeavesTab from './components/tabs/LeavesTab';
import SpecialCasesTab from './components/tabs/SpecialCasesTab';
import CareerTab from './components/tabs/CareerTab';
import DocumentsTab from './components/tabs/DocumentsTab';

const fetcher = async (url) => {
  const res = await apiClient.get(url);
  return res.data;
};

const EmployeeProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const [activeTab, setActiveTab] = useState('profile');

  // --- Shared Confirm Modal State ---
  const [confirmState, setConfirmState] = useState({ open: false, title: '', message: '', onConfirm: null });
  const showConfirm = (title, message, onConfirm) => setConfirmState({ open: true, title, message, onConfirm });
  const closeConfirm = () => setConfirmState({ open: false, title: '', message: '', onConfirm: null });

  // --- Profile Summary (SWR) ---
  const { data: summaryData, error: summaryError, isLoading: isSummaryLoading, mutate: mutateSummary } = useSWR(
    id ? `/employees/${id}/summary` : null,
    fetcher,
    { keepPreviousData: true }
  );
  const employee = summaryData?.data || null;

  // Active case for top banner from lightweight profile summary
  const activeSpecialCase = employee?.SpecialCases?.[0] || null;

  const tabs = [
    { id: 'profile', label: 'الملف التعريفي' },
    ...(hasPermission('checkBoxLeaves') ? [{ id: 'leaves', label: 'الإجازات' }] : []),
    ...(hasPermission('checkBoxSpecialCases') ? [{ id: 'special-cases', label: 'الحالات الخاصة' }] : []),
    { id: 'career', label: 'المسار المهني' },
    { id: 'documents', label: 'المستندات' },
  ];

  if (isSummaryLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={48} className="animate-spin text-emerald-500" />
      </div>
    );
  }

  if (summaryError || !employee) {
    return (
      <div className="p-8" dir="rtl">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-500 hover:text-slate-900 mb-6 font-medium text-sm cursor-pointer"
        >
          <ArrowRight size={18} className="ml-2" /> العودة للقائمة
        </button>
        <div className="p-4 bg-red-50 text-red-800 border border-red-200 rounded-xl text-sm font-medium">
          {summaryError?.message || 'الموظف غير موجود'}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full font-sans max-w-[1000px] mx-auto text-slate-800" dir="rtl">
      {/* Top Navigation */}
      <div className="flex justify-between items-center mb-6 pt-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
            title="العودة"
          >
            <ArrowRight size={20} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-8 overflow-x-auto custom-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 font-medium text-sm transition-colors whitespace-nowrap relative cursor-pointer ${
                activeTab === tab.id ? 'text-emerald-700' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-t-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col items-center justify-center mb-6 shadow-sm">
        <div className="w-24 h-24 rounded-full border-4 border-emerald-50 bg-slate-50 overflow-hidden shadow-sm mb-4">
          {employee.ProfileImagePath ? (
            <img
              src={getAssetUrl(employee.ProfileImagePath)}
              alt="Avatar"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
              <User size={32} className="text-gray-400" />
            </div>
          )}
        </div>
        <h2 className="text-xl font-bold text-slate-800">
          {formatEmployeeName(employee)}
        </h2>
        {(employee.LastNameFr || employee.NameFr) && (
          <p className="text-sm font-semibold text-slate-500 tracking-wide mt-0.5" dir="ltr">
            {[employee.LastNameFr, employee.NameFr].filter(Boolean).join(' ')}
          </p>
        )}
        <div className="mt-1.5 flex items-center gap-2">
          {employee.EmployeeStatus === 'متربص' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200/70">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
              متربص
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/70">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              مرسم
            </span>
          )}
        </div>
        <p className="text-sm font-medium text-gray-500 mt-2 flex items-center justify-center gap-1.5 flex-wrap">
          <span>{employee.JobTitle?.RankName || 'موظف'}</span>
          <span>•</span>
          <span>{employee.Directorate || 'الإدارة العامة'}</span>
        </p>
      </div>

      {/* Active Special Case Banner */}
      {activeSpecialCase && (
        <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 mb-6 shadow-sm">
          {/* Header */}
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-bold bg-emerald-100/70 text-emerald-800 border border-emerald-300/60">
              {activeSpecialCase.CaseType}
            </span>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Destination / Entity */}
            <div className="bg-white border border-slate-200/70 rounded-lg p-3 shadow-xs">
              <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5 mb-1">
                <Building2 size={14} className="text-slate-400" />
                المؤسسة المستقبلة / مقر التعيين
              </span>
              <p className="text-sm font-semibold text-slate-800 break-words">
                {activeSpecialCase.Destination || employee.AssignedPosition || 'غير محدد'}
              </p>
            </div>

            {/* Effective Date */}
            <div className="bg-white border border-slate-200/70 rounded-lg p-3 shadow-xs">
              <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5 mb-1">
                <Calendar size={14} className="text-slate-400" />
                تاريخ السريان
              </span>
              <p className="text-sm font-semibold text-slate-800">
                <DateText value={activeSpecialCase.StartDate} />
                {activeSpecialCase.EndDate && (
                  <span className="text-xs font-normal text-slate-500 mr-2">
                    (إلى <DateText value={activeSpecialCase.EndDate} />)
                  </span>
                )}
              </p>
            </div>

            {/* Reference Document */}
            <div className="bg-white border border-slate-200/70 rounded-lg p-3 shadow-xs">
              <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5 mb-1">
                <FileText size={14} className="text-slate-400" />
                السند الإداري
              </span>
              <p className="text-sm font-semibold text-slate-800 break-words">
                {activeSpecialCase.ReferenceDoc || 'غير متوفر'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab Contents */}
      {activeTab === 'profile' && (
        <ProfileOverviewTab employee={employee} onRefresh={mutateSummary} />
      )}

      {activeTab === 'leaves' && hasPermission('checkBoxLeaves') && (
        <LeavesTab employee={employee} onRefresh={mutateSummary} />
      )}

      {activeTab === 'special-cases' && hasPermission('checkBoxSpecialCases') && (
        <SpecialCasesTab
          employee={employee}
          onRefresh={mutateSummary}
          showConfirm={showConfirm}
          closeConfirm={closeConfirm}
        />
      )}

      {activeTab === 'career' && (
        <CareerTab
          employee={employee}
          onRefresh={mutateSummary}
          showConfirm={showConfirm}
          closeConfirm={closeConfirm}
        />
      )}

      {activeTab === 'documents' && (
        <DocumentsTab
          employee={employee}
          onRefresh={mutateSummary}
          showConfirm={showConfirm}
          closeConfirm={closeConfirm}
        />
      )}

      {/* Generic Shared Confirm Modal */}
      <ConfirmModal
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmText="حذف"
        onConfirm={confirmState.onConfirm}
        onCancel={closeConfirm}
      />
    </div>
  );
};

export default EmployeeProfile;
