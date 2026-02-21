import React from 'react';
import { NavLink } from 'react-router-dom';
import NavItem from './NavItem';
import ProBadge from './ProBadge';

const Sidebar: React.FC = () => {
  return (
    <aside className="flex h-full w-[240px] shrink-0 flex-col gap-[24px] bg-[var(--bg-sidebar)] p-[24px]">
      {/* Logo Section */}
      <div className="flex h-[32px] w-full items-center gap-[8px]">
        <span className="text-[20px] leading-none">🎙️</span>
        <span className="font-heading text-[20px] text-[var(--text-primary)]">
          Typeless
        </span>
        <ProBadge />
      </div>

      {/* Navigation */}
      <nav className="flex w-full flex-col gap-[4px]">
        <NavItem to="/dashboard" icon="🏠" label="Home" />
        <NavItem to="/history" icon="🕐" label="History" />
        <NavItem to="/dictionary" icon="📖" label="Dictionary" />
        <NavItem to="/account" icon="⚙️" label="Account" />
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom Links */}
      <div className="flex flex-col">
        <div className="h-[1px] w-full bg-[var(--border-light)]" />
        <div className="h-[8px]" />
        {[
          { to: '/help-center', icon: '❓', label: 'Help center' },
          { to: '/contact', icon: '✉️', label: 'Contact us' },
          { to: '/account/settings', icon: '🔧', label: 'Settings' },
        ].map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-[12px] h-[40px] rounded-[8px] p-[8px_12px] no-underline transition-colors text-[13px] font-sans ${
                isActive
                  ? 'bg-[var(--border-light)] text-[var(--text-primary)]'
                  : 'bg-transparent text-[#8a8880] hover:bg-[var(--border-light)]/50'
              }`
            }
          >
            <span className="text-[14px] leading-none">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>

      {/* Upgrade Section */}
      <div className="flex flex-col gap-[10px] p-[16px]">
        <div className="flex w-full flex-col gap-[8px]">
          <span className="text-[13px] font-medium font-sans text-[var(--text-primary)]">
            Pro Trial
          </span>
          <span className="text-[13px] font-sans text-[var(--text-tertiary)]">
            22 of 30 days used
          </span>
          <div className="h-[4px] w-full rounded-[2px] bg-[var(--border-light)]">
            <div className="h-[4px] w-[140px] rounded-[2px] bg-[var(--accent-orange)]" />
          </div>
        </div>
        <p className="w-full text-[12px] font-sans leading-[1.5] text-[var(--text-tertiary)]">
          Upgrade to Typeless Pro before your trial ends
        </p>
        <button className="flex h-[48px] w-full items-center justify-center rounded-[10px] bg-[var(--accent-orange)] text-[15px] tracking-[0.2px] font-sans text-white">
          Upgrade
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
