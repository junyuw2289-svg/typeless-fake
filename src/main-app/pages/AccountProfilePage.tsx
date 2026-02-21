import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store';

const AccountProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuthStore();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="flex flex-1 flex-col">
      {/* Email row */}
      <div className="flex items-center justify-between py-[24px]">
        <span className="text-[14px] font-semibold font-sans text-[var(--text-primary)]">
          Email
        </span>
        <span className="text-[14px] font-sans text-[#b0aea5]">
          {user?.email ?? '—'}
        </span>
      </div>

      {/* Divider */}
      <div className="h-[1px] w-full bg-[var(--border-light)]" />

      {/* Subscription row */}
      <div className="flex items-center justify-between py-[24px]">
        <span className="text-[14px] font-semibold font-sans text-[var(--text-primary)]">
          Subscription
        </span>
        <div className="flex items-center gap-[12px]">
          <span className="text-[14px] font-sans text-[#b0aea5]">
            Pro Trial
          </span>
          <button className="flex h-[40px] w-[120px] items-center justify-center rounded-[20px] bg-[#3b5bfe] font-sans text-[14px] text-white">
            Upgrade
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className="h-[1px] w-full bg-[var(--border-light)]" />

      {/* Gift card row */}
      <div className="flex items-center justify-between py-[24px]">
        <span className="text-[14px] font-semibold font-sans text-[var(--text-primary)]">
          Gift card
        </span>
        <button className="flex h-[40px] w-[80px] items-center justify-center rounded-[20px] border border-[#d4d2cc] bg-transparent font-sans text-[14px] text-[var(--text-primary)]">
          Buy
        </button>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Sign out button */}
      <div className="flex justify-end pb-[24px]">
        <button
          onClick={handleSignOut}
          className="flex h-[40px] w-[110px] items-center justify-center rounded-[20px] border border-[#d4d2cc] bg-transparent font-sans text-[14px] text-[var(--text-primary)]"
        >
          Sign out
        </button>
      </div>
    </div>
  );
};

export default AccountProfilePage;
