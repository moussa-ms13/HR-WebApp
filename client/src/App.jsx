import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import MainLayout from './components/layout/MainLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Login from './pages/Auth/Login';
import UsersList from './pages/Users/UsersList';
import EmployeesList from './pages/Employees/EmployeesList';
import EmployeeProfile from './pages/Employees/EmployeeProfile';
import EmployeeStatesList from './pages/Leaves/EmployeeStatesList';
import JobsList from './pages/Jobs/JobsList';
import SystemRecordsList from './pages/SystemRecords/SystemRecordsList';

import Dashboard from './pages/Dashboard/Dashboard';
import Settings from './pages/Settings/Settings';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          {/* Protected Routes wrapped in MainLayout */}
          <Route path="/" element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="jobs" element={<JobsList />} />
              <Route path="employees" element={<EmployeesList />} />
              <Route path="employees/:id" element={<EmployeeProfile />} />
              <Route path="leaves" element={<EmployeeStatesList />} />
              <Route path="users" element={<UsersList />} />
              <Route path="system-records" element={<SystemRecordsList />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
