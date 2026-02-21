import React from 'react';
import { Outlet } from 'react-router-dom';

const AuthLayout: React.FC = () => {
  return (
    <div className="flex h-full w-full flex-col bg-[var(--bg-page)]">
      {/* Drag region for window chrome */}
      <div className="h-[52px] shrink-0 bg-[var(--bg-chrome)]" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        <Outlet />
      </div>
    </div>
  );
};

export default AuthLayout;
