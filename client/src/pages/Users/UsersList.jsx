import React, { useState, useMemo, useEffect } from 'react';
import useSWR from 'swr';
import { useAuth } from '../../context/AuthContext';
import UsersService from '../../services/usersService';
import UserModal from './UserModal';
import { 
  Plus, Search, Edit2, Trash2, Loader2, ShieldCheck, Shield, MoreVertical,
  ChevronDown, ChevronRight, ChevronLeft, ArrowUpDown, Users 
} from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { refreshUsers } from '../../utils/cacheManager';
import { UserRoleBadge } from '../../components/common/UnifiedBadge';

const fetcher = async () => {
  const res = await UsersService.getAll();
  return res.data;
};

const HeaderCell = ({ 
  label, 
  sortKey = null, 
  currentSort = '', 
  onSort = null, 
  align = 'right', 
  className = '' 
}) => {
  const isSorted = sortKey && currentSort === sortKey;
  return (
    <th 
      onClick={() => sortKey && onSort?.(sortKey)}
      className={`py-4 px-4 font-medium text-sm text-gray-500 whitespace-nowrap bg-white border-b border-gray-100 select-none ${
        sortKey ? 'cursor-pointer hover:bg-slate-50/80 hover:text-slate-800 group transition-colors' : ''
      } ${align === 'center' ? 'text-center' : ''} ${className}`}
    >
      <div className={`flex items-center gap-1.5 transition-colors ${align === 'center' ? 'justify-center' : ''}`}>
        <span className={isSorted ? 'text-slate-900 font-semibold' : ''}>{label}</span>
        {sortKey && (
          <ArrowUpDown 
            size={12} 
            className={`transition-colors ${
              isSorted 
                ? 'text-[#10B981] font-bold' 
                : 'text-gray-300 group-hover:text-gray-500'
            }`} 
          />
        )}
      </div>
    </th>
  );
};

const UsersList = () => {
  const { hasPermission, user: currentUser } = useAuth();
  const toast = useToast();

  // --- Confirm Modal State ---
  const [confirmState, setConfirmState] = useState({ open: false, title: '', message: '', onConfirm: null });
  const showConfirm = (title, message, onConfirm) => setConfirmState({ open: true, title, message, onConfirm });
  const closeConfirm = () => setConfirmState({ open: false, title: '', message: '', onConfirm: null });
  
  const { data: users = [], error, isLoading, mutate } = useSWR('/api/users', fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true
  });
  
  // Filters & Search
  const [roleFilter, setRoleFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  
  // Sorting
  const [sortField, setSortField] = useState('Id');
  const [sortDirection, setSortDirection] = useState('asc');

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  // Modal & Menu states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState(null);

  // Close action menus when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setMenuOpenId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const safeUsers = Array.isArray(users) ? users : (users?.data || []);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredUsers = useMemo(() => {
    return safeUsers.filter(u => {
      if (roleFilter && u.Role !== roleFilter) return false;
      if (!searchInput.trim()) return true;
      const tokens = searchInput.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const fullName = (u.FullName || '').toLowerCase();
      const userName = (u.UserName || '').toLowerCase();
      const email = (u.Email || '').toLowerCase();
      const phone = (u.Phone || '').toLowerCase();
      return tokens.every(t => 
        fullName.includes(t) || userName.includes(t) || email.includes(t) || phone.includes(t)
      );
    });
  }, [safeUsers, roleFilter, searchInput]);

  const sortedUsers = useMemo(() => {
    return [...filteredUsers].sort((a, b) => {
      let valA = a[sortField] ?? '';
      let valB = b[sortField] ?? '';
      
      if (sortField === 'Id') {
        const numA = Number(valA) || 0;
        const numB = Number(valB) || 0;
        return sortDirection === 'asc' ? numA - numB : numB - numA;
      }
      
      valA = String(valA).toLowerCase();
      valB = String(valB).toLowerCase();
      return sortDirection === 'asc' 
        ? valA.localeCompare(valB, 'ar') 
        : valB.localeCompare(valA, 'ar');
    });
  }, [filteredUsers, sortField, sortDirection]);

  const totalPages = Math.ceil(sortedUsers.length / limit) || 1;
  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * limit;
    return sortedUsers.slice(start, start + limit);
  }, [sortedUsers, page, limit]);

  const handleSearchChange = (e) => {
    setSearchInput(e.target.value);
    setPage(1);
  };

  const handleRoleChange = (e) => {
    setRoleFilter(e.target.value);
    setPage(1);
  };

  const handleAdd = () => {
    setSelectedUser(null);
    setIsModalOpen(true);
  };

  const handleEdit = (user) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  const handleDelete = (id) => {
    showConfirm('حذف المستخدم', 'هل أنت متأكد من حذف هذا المستخدم؟', async () => {
      closeConfirm();
      try {
        await UsersService.delete(id);
        await refreshUsers();
        mutate();
        toast.success('تم حذف المستخدم بنجاح');
      } catch (err) {
        toast.error(err.response?.data?.message || 'فشل الحذف');
      }
    });
  };

  const handleModalSuccess = async () => {
    setIsModalOpen(false);
    await refreshUsers();
    mutate();
  };

  return (
    <div className="flex flex-col h-full font-sans text-slate-800" dir="rtl">
      
      {/* Top Filter & Action Bar Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs px-4 py-3 mb-4 flex flex-wrap items-center justify-between gap-3">
        {/* Right side: Role Filter & Search */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex items-center">
            <select
              id="users-filter-role"
              aria-label="الصلاحية"
              value={roleFilter}
              onChange={handleRoleChange}
              className="flex items-center gap-2 text-sm font-medium text-gray-600 px-3 py-2 hover:bg-gray-50 rounded-lg outline-none bg-transparent cursor-pointer appearance-none pl-7"
            >
              <option value="">الصلاحية: الكل</option>
              <option value="Admin">Admin</option>
              <option value="User">User</option>
            </select>
            <ChevronDown size={14} className="absolute left-2 text-gray-500 pointer-events-none" />
          </div>

          <div className="h-4 w-px bg-gray-200 ml-2" />

          <div className="relative w-64 sm:w-72">
            <input
              type="text"
              id="users-search-input"
              placeholder="البحث بالاسم أو اسم المستخدم..."
              value={searchInput}
              onChange={handleSearchChange}
              className="w-full pr-10 pl-4 py-2 bg-gray-50 border-none rounded-lg outline-none text-sm text-slate-700 focus:ring-1 focus:ring-gray-200"
            />
            <Search className="absolute right-3 top-2.5 text-gray-400" size={16} />
          </div>
        </div>

        {/* Left side: Add User Action */}
        <div className="flex items-center gap-3">
          {hasPermission('checkBoxAdd') && (
            <button
              id="users-add-button"
              type="button"
              onClick={handleAdd}
              className="flex items-center justify-center gap-1.5 px-4 py-2 text-white rounded-xl transition-all font-semibold shadow-xs text-xs sm:text-sm hover:shadow-md active:scale-[0.97] cursor-pointer bg-[#10B981] hover:bg-[#059669]"
            >
              <Plus size={16} />
              <span>مستخدم جديد</span>
            </button>
          )}
        </div>
      </div>

      {/* Standalone Table Card */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex-1 flex flex-col relative">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-right border-collapse">
            <thead className="sticky top-0 z-10 bg-white">
              <tr>
                <HeaderCell label="المعرف" sortKey="Id" currentSort={sortField} onSort={handleSort} />
                <HeaderCell label="الاسم الكامل" sortKey="FullName" currentSort={sortField} onSort={handleSort} />
                <HeaderCell label="اسم المستخدم" sortKey="UserName" currentSort={sortField} onSort={handleSort} />
                <HeaderCell label="الصلاحية" sortKey="Role" currentSort={sortField} onSort={handleSort} />
                <HeaderCell label="البريد الإلكتروني" sortKey="Email" currentSort={sortField} onSort={handleSort} />
                <HeaderCell label="رقم الهاتف" sortKey="Phone" currentSort={sortField} onSort={handleSort} />
                <th className="py-4 px-4 font-medium text-sm text-gray-500 whitespace-nowrap bg-white border-b border-gray-100 text-center select-none">
                  الإجراء
                </th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-gray-400">
                    <Loader2 size={32} className="animate-spin mx-auto mb-2 text-emerald-500" />
                    جاري تحميل البيانات...
                  </td>
                </tr>
              ) : paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-gray-400">
                    <Users size={32} className="mx-auto text-gray-300 mb-2" />
                    لا يوجد مستخدمين مطابقين للبحث
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((u) => (
                  <tr key={u.Id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="py-3 px-4 text-gray-500 font-mono text-xs">{u.Id}</td>
                    <td className="py-3 px-4 font-bold text-slate-800">{u.FullName}</td>
                    <td className="py-3 px-4 text-slate-600 font-medium font-mono text-xs" dir="ltr">{u.UserName}</td>
                    <td className="py-3 px-4">
                      <UserRoleBadge role={u.Role} />
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-xs font-mono">{u.Email || '-'}</td>
                    <td className="py-3 px-4 text-gray-500 text-xs font-mono" dir="ltr">{u.Phone || '-'}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="relative inline-block text-right" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => setMenuOpenId(menuOpenId === u.Id ? null : u.Id)}
                          className="p-1.5 text-gray-400 hover:text-emerald-600 border border-transparent hover:border-gray-200 rounded-lg transition-all cursor-pointer"
                        >
                          <MoreVertical size={18} />
                        </button>
                        
                        {menuOpenId === u.Id && (
                          <div className="absolute left-0 mt-2 w-48 rounded-xl shadow-lg bg-white ring-1 ring-black/5 z-50 py-1 font-sans">
                            {hasPermission('checkBoxEdit') && (
                              <button
                                onClick={() => { handleEdit(u); setMenuOpenId(null); }}
                                className="w-full text-right px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 cursor-pointer transition-colors"
                              >
                                <Edit2 size={14} className="text-gray-400" /> تعديل المستخدم
                              </button>
                            )}
                            {hasPermission('checkBoxDelete') && currentUser?.id !== u.Id && (
                              <button
                                onClick={() => { handleDelete(u.Id); setMenuOpenId(null); }}
                                className="w-full text-right px-4 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer transition-colors border-t border-gray-100"
                              >
                                <Trash2 size={14} className="text-red-500" /> حذف المستخدم
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Unified Bottom Pagination Footer */}
        <div className="bg-white px-6 py-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          {/* RTL order: السابق (right) → Page (middle) → التالي (left) */}
          <div className="flex gap-2">
            <button
              id="users-prev-page"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 px-4 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <ChevronRight size={15} />
              السابق
            </button>
            <button className="px-4 py-1.5 bg-emerald-500 text-white rounded-lg text-sm font-medium shadow-sm">
              {page}
            </button>
            <button
              id="users-next-page"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || totalPages === 0}
              className="flex items-center gap-1 px-4 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors cursor-pointer"
            >
              التالي
              <ChevronLeft size={15} />
            </button>
          </div>

          <div className="text-sm font-medium text-gray-500">
            إظهار {paginatedUsers.length} من أصل {sortedUsers.length} مدخل
          </div>

          <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
            أظهر
            <select 
              value={limit}
              onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
              className="border border-gray-200 rounded-lg px-2 py-1 outline-none bg-white text-slate-800 cursor-pointer text-xs"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            مدخلات
          </div>
        </div>
      </div>

      <UserModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        user={selectedUser}
        onSuccess={handleModalSuccess}
      />

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

export default UsersList;
