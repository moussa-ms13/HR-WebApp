import React from 'react';
import { Outlet, Navigate, NavLink } from 'react-router-dom';
import { 
  Power,
  LayoutDashboard, Briefcase, Users, CalendarOff, History, Settings, UserCog, User as UserIcon
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const NAV_ITEMS = [
  { title: 'الرئيسية', path: '/', icon: <LayoutDashboard size={18} />, permission: 'checkBoxHome' },
  { title: 'إدارة الوظائف', path: '/jobs', icon: <Briefcase size={18} />, permission: 'checkBoxJobs' },
  { title: 'إدارة الموظفين', path: '/employees', icon: <Users size={18} />, permission: 'checkBoxEmployees' },
  { title: 'الإجازات', path: '/leaves', icon: <CalendarOff size={18} />, permission: 'checkBoxLeaves' },
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
      
      {/* Top Header - Two Tiers */}
      <header className="bg-white border-b border-gray-200 z-10 shrink-0 shadow-sm">
        
        {/* Tier 1: Brand & User Actions */}
        <div className="flex items-center justify-between px-6 py-4">
          
          {/* FAR RIGHT: Brand (RTL places first child on the right) */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-inner" style={{ backgroundColor: '#105b38' }}>
              <span className="font-bold text-lg" style={{ color: '#c7a43e' }}>HR</span>
            </div>
            <h1 className="text-xl font-bold text-slate-800">
              نظام الموارد البشرية
            </h1>
          </div>

          {/* FAR LEFT: Action Icons & User Avatar */}
          <div className="flex items-center gap-5 text-gray-500">
            <div className="flex items-center gap-3">
              <div className="flex flex-col text-left" dir="ltr">
                <span className="text-sm font-bold text-slate-800">{user?.fullName || 'المستخدم'}</span>
                <span className="text-xs text-gray-400">{user?.role || 'Admin'}</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-slate-100 border border-gray-200 flex items-center justify-center text-gray-500 overflow-hidden">
                <UserIcon size={20} />
              </div>
              <button onClick={logout} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors mr-2" title="تسجيل الخروج">
                <Power size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Tier 2: Horizontal Navigation */}
        <div className="px-6 pb-0 border-t border-gray-100">
          <nav className="flex items-center gap-2 overflow-x-auto custom-scrollbar">
            {NAV_ITEMS.map((item) => {
              if (!hasPermission(item.permission)) return null;
              
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all relative whitespace-nowrap ${
                      isActive 
                        ? 'text-emerald-700' 
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
