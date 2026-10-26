import React from 'react';
import { Outlet, Navigate, NavLink } from 'react-router-dom';
import { 
  Power,
  LayoutDashboard, Briefcase, Users, CalendarOff, ArrowRightLeft, History, Settings, UserCog, User as UserIcon,
  FileSpreadsheet
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const NAV_ITEMS = [
  { title: 'الرئيسية', path: '/', icon: <LayoutDashboard size={18} />, permission: 'checkBoxHome' },
  { title: 'إدارة الوظائف', path: '/jobs', icon: <Briefcase size={18} />, permission: 'checkBoxJobs' },
  { title: 'إدارة الموظفين', path: '/employees', icon: <Users size={18} />, permission: 'checkBoxEmployees' },
  { title: 'العطل', path: '/leaves', icon: <CalendarOff size={18} />, permission: 'checkBoxLeaves' },
  { title: 'الحالات الخاصة', path: '/special-cases', icon: <ArrowRightLeft size={18} />, permission: 'checkBoxSpecialCases' },
  { title: 'التقارير والتصدير', path: '/reports', icon: <FileSpreadsheet size={18} />, permission: ['checkBoxReport', 'checkBoxExport'] },
  { title: 'المستخدمين', path: '/users', icon: <UserCog size={18} />, permission: 'checkBoxUsers' },
  { title: 'سجل النظام', path: '/system-records', icon: <History size={18} />, permission: 'checkBoxSystemRecords' },
  { title: 'الإعدادات', path: '/settings', icon: <Settings size={18} />, permission: 'checkBoxSettings' }
];

const MainLayout = () => {
  const { user, loading, logout, hasPermission } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50" dir="rtl">
        <div className="text-xl font-semibold text-emerald-600 animate-pulse">جاري التحميل...</div>
      </div>
    );
  }

  // Require authentication
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden" dir="rtl">
      
      {/* Unified Navigation & User Header */}
      <header className="bg-white border-b border-gray-200 z-10 shrink-0 shadow-xs">
        <div className="flex items-center justify-between px-6 h-14">
          
          {/* RIGHT SIDE: Horizontal Navigation Tabs */}
          <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto custom-scrollbar h-full flex-1 min-w-0">
            {NAV_ITEMS.map((item) => {
              if (!hasPermission(item.permission)) return null;
              
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 sm:px-3.5 h-full text-sm font-medium transition-all relative whitespace-nowrap shrink-0 ${
                      isActive 
                        ? 'text-emerald-700 font-bold' 
                        : 'text-gray-500 hover:text-emerald-600 hover:bg-emerald-50/50'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {item.icon}
                      <span>{item.title}</span>
                      {isActive && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-t-full"></div>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* LEFT SIDE: User Profile & Logout Controls */}
          <div className="flex items-center gap-3 shrink-0 mr-4 pr-4 border-r border-gray-100 text-gray-500">
            <div className="flex items-center gap-2.5">
              <div className="hidden sm:flex flex-col text-left" dir="ltr">
                <span className="text-sm font-bold text-slate-800 leading-tight">{user?.fullName || 'المستخدم'}</span>
                <span className="text-xs text-gray-400">{user?.role || 'Admin'}</span>
              </div>
              <div className="w-9 h-9 rounded-full bg-slate-100 border border-gray-200 flex items-center justify-center text-gray-500 overflow-hidden shadow-xs">
                <UserIcon size={18} />
              </div>
              <div className="h-5 w-px bg-gray-200 mx-1" />
              <button 
                onClick={logout} 
                className="p-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer" 
                title="تسجيل الخروج"
                aria-label="تسجيل الخروج"
              >
                <Power size={18} />
              </button>
            </div>
          </div>

        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto relative custom-scrollbar p-6">
        <Outlet />
      </main>
      
    </div>
  );
};

export default MainLayout;
