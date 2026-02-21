import React, { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store';

const AuthGuard: React.FC = () => {
  const { user, isLoading, checkSession } = useAuthStore();

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  useEffect(() => {
    const unsubscribe = window.electronAPI.onAuthStateChanged((newUser) => {
      useAuthStore.getState().setUser(newUser);
    });
    return unsubscribe;
  }, []);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-[var(--bg-page)]">
        <p className="text-[var(--text-secondary)]">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default AuthGuard;
