import React, { useState, useRef, useCallback, useEffect } from 'react';
import useSWR from 'swr';
import { useAuth } from '../../context/AuthContext';
import UsersService from '../../services/usersService';
import UserModal from './UserModal';
import { Plus, Search, Edit2, Trash2, Loader2, ShieldCheck, Shield, MoreVertical } from 'lucide-react';

const fetcher = async () => {
  const res = await UsersService.getAll();
  return res.data;
};

const UsersList = () => {
  const { hasPermission, user: currentUser } = useAuth();
  
  const { data: users = [], error, isLoading, mutate } = useSWR('/api/users', fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true
  });
  
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null); // null means "Add" mode
  const [menuOpenId, setMenuOpenId] = useState(null);

  // Debounced search for client-side filtering
  const debounceRef = useRef(null);
  const handleSearch = useCallback((e) => {
    const value = e.target.value;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchQuery(value.trim());
    }, 300);
  }, []);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const safeUsers = Array.isArray(users) ? users : [];
  const filteredUsers = safeUsers.filter(u => 
    u.FullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.UserName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAdd = () => {
    setSelectedUser(null);
    setIsModalOpen(true);
  };

  const handleEdit = (user) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('هل أنت متأكد من حذف هذا المستخدم؟')) {
      try {
        await UsersService.delete(id);
        mutate();
      } catch (err) {
        alert(err.response?.data?.message || 'فشل الحذف');
      }
    }
  };

  const handleModalSuccess = () => {
    setIsModalOpen(false);
    mutate();
  };

  return (
    <div className="flex flex-col h-full font-sans" dir="rtl">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">إدارة المستخدمين</h1>
          <p className="text-sm text-slate-500 mt-1">إدارة حسابات النظام والصلاحيات</p>
        </div>
        
        <div className="flex w-full sm:w-auto items-center gap-3">
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="بحث بالاسم..."
              defaultValue=""
              onChange={handleSearch}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
          </div>
          
          {hasPermission('checkBoxAdd') && (
            <button
              onClick={handleAdd}
              className="flex items-center justify-center px-4 py-2 text-white rounded-lg transition shadow-sm text-sm font-medium shrink-0"
              style={{ backgroundColor: '#105b38' }}
            >
              <Plus size={18} className="ml-1" />
              مستخدم جديد
            </button>
          )}
        </div>
      </div>



      {/* DataGrid */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-visible flex-1 flex flex-col mt-4">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-right border-collapse whitespace-nowrap">
            <thead className="bg-white text-gray-500 text-sm border-b border-gray-200 sticky top-0 z-10">
              <tr>
                <th className="py-4 px-6 font-medium">المعرف</th>
                <th className="py-4 px-6 font-medium">الاسم الكامل</th>
                <th className="py-4 px-6 font-medium">اسم المستخدم</th>
                <th className="py-4 px-6 font-medium">الصلاحية</th>
                <th className="py-4 px-6 font-medium">البريد الإلكتروني</th>
                <th className="py-4 px-6 font-medium">رقم الهاتف</th>
                <th className="py-4 px-6 font-medium text-center">الإجراء</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-700 divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-gray-400">
                    <Loader2 size={32} className="animate-spin mx-auto mb-2 text-emerald-500" />
                    جاري تحميل البيانات...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-gray-400">
                    لا يوجد مستخدمين مطابقين للبحث
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.Id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6 text-gray-500">{u.Id}</td>
                    <td className="py-4 px-6 font-bold text-slate-800">{u.FullName}</td>
                    <td className="py-4 px-6 text-slate-600 font-medium" dir="ltr">{u.UserName}</td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                        u.Role === 'Admin' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                        u.Role === 'Read' ? 'bg-slate-100 text-slate-700 border border-slate-200' :
                        'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {u.Role === 'Admin' ? <ShieldCheck size={12} className="ml-1" /> : <Shield size={12} className="ml-1" />}
                        {u.Role}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-gray-500">{u.Email || '-'}</td>
                    <td className="py-4 px-6 text-gray-500" dir="ltr">{u.Phone || '-'}</td>
                    <td className="py-4 px-6 text-center">
                      <div className="relative inline-block text-right">
                        <button 
                          onClick={() => setMenuOpenId(menuOpenId === u.Id ? null : u.Id)}
                          className="p-2 text-gray-400 hover:text-emerald-600 rounded-full transition-colors"
                        >
                          <MoreVertical size={18} />
                        </button>
                        
                        {menuOpenId === u.Id && (
                          <div className="absolute left-0 mt-2 w-48 rounded-xl shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                            <div className="py-1" role="menu">
                              {hasPermission('checkBoxEdit') && (
                                <button
                                  onClick={() => { handleEdit(u); setMenuOpenId(null); }}
                                  className="w-full text-right px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <Edit2 size={16} className="text-blue-500" /> تعديل المستخدم
                                </button>
                              )}
                              {hasPermission('checkBoxDelete') && currentUser?.id !== u.Id && (
                                <button
                                  onClick={() => { handleDelete(u.Id); setMenuOpenId(null); }}
                                  className="w-full text-right px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                >
                                  <Trash2 size={16} className="text-red-500" /> حذف المستخدم
                                </button>
                              )}
                            </div>
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
      </div>

      <UserModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        user={selectedUser}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
};

export default UsersList;
