import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SWRConfig } from 'swr';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/ui/Toast';
import MainLayout from './components/layout/MainLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import InstitutionalPageLoader from './components/ui/InstitutionalPageLoader';

// Dynamic route-level code splitting
const Login = lazy(() => import('./pages/Auth/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard'));
const JobsList = lazy(() => import('./pages/Jobs/JobsList'));
const EmployeesList = lazy(() => import('./pages/Employees/EmployeesList'));
const EmployeeProfile = lazy(() => import('./pages/Employees/EmployeeProfile'));
const EmployeeStatesList = lazy(() => import('./pages/Leaves/EmployeeStatesList'));
const SpecialCasesList = lazy(() => import('./pages/SpecialCases/SpecialCasesList'));
const UsersList = lazy(() => import('./pages/Users/UsersList'));
const SystemRecordsList = lazy(() => import('./pages/SystemRecords/SystemRecordsList'));
const Settings = lazy(() => import('./pages/Settings/Settings'));
const CustomExportPage = lazy(() => import('./pages/Reports/CustomExportPage'));

function App() {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        dedupingInterval: 2000,
        shouldRetryOnError: false,
      }}
    >
      <ToastProvider>
        <AuthProvider>
          <Router>
            <Suspense fallback={<InstitutionalPageLoader />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                
                {/* Protected Routes wrapped in MainLayout */}
                <Route path="/" element={<ProtectedRoute />}>
                  <Route element={<MainLayout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="jobs" element={<ProtectedRoute permission="checkBoxJobs"><JobsList /></ProtectedRoute>} />
                    <Route path="employees" element={<ProtectedRoute permission="checkBoxEmployees"><EmployeesList /></ProtectedRoute>} />
                    <Route path="employees/:id" element={<ProtectedRoute permission="checkBoxEmployees"><EmployeeProfile /></ProtectedRoute>} />
                    <Route path="leaves" element={<ProtectedRoute permission="checkBoxLeaves"><EmployeeStatesList /></ProtectedRoute>} />
                    <Route path="special-cases" element={<ProtectedRoute permission="checkBoxSpecialCases"><SpecialCasesList /></ProtectedRoute>} />
                    <Route path="reports" element={<ProtectedRoute permission={['checkBoxReport', 'checkBoxExport']}><CustomExportPage /></ProtectedRoute>} />
                    <Route path="users" element={<ProtectedRoute permission="checkBoxUsers"><UsersList /></ProtectedRoute>} />
                    <Route path="system-records" element={<ProtectedRoute permission="checkBoxSystemRecords"><SystemRecordsList /></ProtectedRoute>} />
                    <Route path="settings" element={<ProtectedRoute permission="checkBoxSettings"><Settings /></ProtectedRoute>} />
                  </Route>
                </Route>

                {/* Catch all */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </Router>
        </AuthProvider>
      </ToastProvider>
    </SWRConfig>
  );
}

export default App;


