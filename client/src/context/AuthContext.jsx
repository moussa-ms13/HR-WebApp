import React, { createContext, useContext, useState, useEffect } from 'react';
import apiClient from '../services/apiClient';

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // On mount, check if user exists in local storage
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');
    
    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = async (userName, password) => {
    try {
      const response = await apiClient.post('/auth/login', { userName, password });
      
      if (response.data.success) {
        const { token, user: userData } = response.data.data;
        
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('token', token);
        setUser(userData);
        
        return { success: true };
      }
      return { success: false, message: 'فشل تسجيل الدخول' };
    } catch (error) {
      console.error('Login error:', error);
      const message = error.response?.data?.message || 'حدث خطأ أثناء الاتصال بالخادم';
      return { success: false, message };
    }
  };

  const logout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setUser(null);
    window.location.href = '/login';
  };

  // Helper to check permissions. Admin bypasses all checks.
  const hasPermission = (permissionKey) => {
    if (!user) return false;
    if (user.role === 'Admin') return true;
    return user.permissions?.[permissionKey] === true;
  };

  const value = {
    user,
    login,
    logout,
    hasPermission,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
