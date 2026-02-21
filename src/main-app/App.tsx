import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import AuthLayout from './layouts/AuthLayout';
import AuthGuard from './components/AuthGuard';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import HistoryPage from './pages/HistoryPage';
import DictionaryPage from './pages/DictionaryPage';
import AccountPage from './pages/AccountPage';
import AccountProfilePage from './pages/AccountProfilePage';
import UnderConstruction from './components/UnderConstruction';

const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        {/* Public routes (no sidebar) */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        {/* Protected routes (with sidebar) */}
        <Route element={<AuthGuard />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/dictionary" element={<DictionaryPage />} />
            <Route path="/account" element={<AccountPage />}>
              <Route index element={<AccountProfilePage />} />
              <Route path="settings" element={<UnderConstruction />} />
              <Route path="personalization" element={<UnderConstruction />} />
              <Route path="about" element={<UnderConstruction />} />
            </Route>
            <Route path="/help-center" element={<UnderConstruction />} />
            <Route path="/contact" element={<UnderConstruction />} />
            <Route path="/release-notes" element={<UnderConstruction />} />
          </Route>
        </Route>

        {/* Default redirect */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
