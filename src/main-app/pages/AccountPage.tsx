import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/account', icon: '👤', label: 'Account', end: true },
  { to: '/account/settings', icon: '⚙️', label: 'Settings' },
  { to: '/account/personalization', icon: '🎨', label: 'Personalization' },
  { to: '/account/about', icon: 'ℹ️', label: 'About' },
];

const externalItems = [
  { to: '/help-center', icon: '📖', label: 'Help center' },
  { to: '/release-notes', icon: '📋', label: 'Release notes' },
];

const AccountPage: React.FC = () => {
  return (
    <div className="flex h-full flex-col bg-[#faf9f5] p-[40px]">
      <h1 className="font-heading text-[32px] text-[var(--text-primary)]">
        Account
      </h1>
      <div className="flex flex-1 pt-[40px]">
        {/* Left sub-nav */}
        <nav className="flex w-[200px] shrink-0 flex-col gap-[4px]">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-[12px] h-[40px] rounded-[8px] px-[12px] no-underline transition-colors text-[14px] font-sans ${
                  isActive
                    ? 'bg-[#e8e6dc] font-medium text-[#141413]'
                    : 'bg-transparent text-[#8a8880] hover:bg-[#e8e6dc]/50'
                }`
              }
            >
              <span className="text-[14px] leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}

          <div className="my-[8px] h-[1px] w-full bg-[var(--border-light)]" />

          {externalItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-[12px] h-[40px] rounded-[8px] px-[12px] no-underline transition-colors text-[14px] font-sans ${
                  isActive
                    ? 'bg-[#e8e6dc] font-medium text-[#141413]'
                    : 'bg-transparent text-[#8a8880] hover:bg-[#e8e6dc]/50'
                }`
              }
            >
              <span className="text-[14px] leading-none">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              <span className="text-[12px] text-[#8a8880]">↗</span>
            </NavLink>
          ))}
        </nav>

        {/* Right panel */}
        <div className="flex flex-1 pl-[48px]">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AccountPage;
