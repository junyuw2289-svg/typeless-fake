import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { signIn, signInWithGoogle, error, isLoading } = useAuthStore();
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleGoogleClick = async () => {
    await signInWithGoogle();
  };

  const handleEmailClick = () => {
    setShowEmailForm(true);
  };

  const handleAppleClick = () => {
    alert('Coming soon');
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await signIn(email, password);
    if (success) {
      navigate('/dashboard');
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center">
      <div className="flex w-[520px] flex-col items-center gap-[32px]">
        {/* Logo & Title */}
        <div className="flex w-full flex-col items-center gap-[12px]">
          <span className="text-[48px] text-center">🎙️</span>
          <div className="flex w-full items-center justify-center gap-[10px]">
            <h1 className="font-heading text-[38px] font-normal tracking-[-0.6px] leading-[1.2] text-[var(--text-primary)]">
              Welcome to Typeless
            </h1>
            <span className="inline-flex items-center rounded-[6px] bg-[rgba(217,119,87,0.15)] px-[8px] py-[4px]">
              <span className="text-[12px] font-medium font-sans text-[var(--accent-orange)]">
                Pro
              </span>
            </span>
          </div>
          <p className="text-[15px] font-sans leading-[1.5] text-[var(--text-tertiary)] text-center">
            Voice keyboard that makes you smarter
          </p>
        </div>

        {/* Auth Buttons */}
        {!showEmailForm ? (
          <div className="flex w-full flex-col gap-[12px]">
            <button
              onClick={handleGoogleClick}
              className="flex h-[50px] w-full items-center justify-center gap-[8px] rounded-[12px] border border-[var(--border-light)] bg-[var(--bg-white)] text-[15px] font-medium tracking-[0.2px] font-sans text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 256 256" fill="#141413">
                <path d="M224,128a96,96,0,1,1-21.95-61.09,8,8,0,1,1-12.33,10.18A80,80,0,1,0,207.6,136H128a8,8,0,0,1,0-16h88A8,8,0,0,1,224,128Z"/>
              </svg>
              Continue with Google
            </button>

            <button
              onClick={handleEmailClick}
              className="flex h-[50px] w-full items-center justify-center gap-[8px] rounded-[12px] border border-[var(--border-light)] bg-[var(--bg-white)] text-[15px] font-medium font-sans text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 256 256" fill="#141413">
                <path d="M224,48H32a8,8,0,0,0-8,8V192a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A8,8,0,0,0,224,48ZM203.43,64,128,133.15,52.57,64ZM216,192H40V74.19l82.59,75.71a8,8,0,0,0,10.82,0L216,74.19V192Z"/>
              </svg>
              Continue with email
            </button>

            <button
              onClick={handleAppleClick}
              className="flex h-[50px] w-full items-center justify-center gap-[8px] rounded-[12px] border border-[var(--border-light)] bg-[var(--bg-white)] text-[15px] font-medium font-sans text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 256 256" fill="#141413">
                <path d="M223.3,169.59a8.07,8.07,0,0,0-2.8-3.4C203.53,154.53,200,134.64,200,120c0-17.67,13.47-33.06,21.5-40.67a8,8,0,0,0,0-11.62C208.82,55.74,187.82,48,168,48a72.23,72.23,0,0,0-40,12.13A71.56,71.56,0,0,0,88,48C67.18,48,47.18,55.74,34.5,67.71a8,8,0,0,0,0,11.62C42.53,86.94,56,102.33,56,120c0,14.64-3.53,34.53-20.5,46.19a8.07,8.07,0,0,0-2.8,3.4A74.79,74.79,0,0,0,16,216a8,8,0,0,0,16,0,58.91,58.91,0,0,1,12.49-36.65C52.3,170.28,72,153.81,72,120A71,71,0,0,0,66,91a56.06,56.06,0,0,1,62,0A56.06,56.06,0,0,1,190,91a71,71,0,0,0-6,29c0,33.81,19.7,50.28,27.51,59.35A58.91,58.91,0,0,1,224,216a8,8,0,0,0,16,0A74.79,74.79,0,0,0,223.3,169.59ZM128,80a8,8,0,0,1-8-8V40a8,8,0,0,1,16,0V72A8,8,0,0,1,128,80Z"/>
              </svg>
              Continue with Apple
            </button>
          </div>
        ) : (
          <form onSubmit={handleEmailSubmit} className="flex w-full flex-col gap-[12px]">
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="flex h-[50px] w-full items-center rounded-[12px] border border-[var(--border-light)] bg-[var(--bg-white)] px-[16px] text-[15px] font-sans text-[var(--text-primary)] outline-none focus:border-[var(--accent-orange)]"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="flex h-[50px] w-full items-center rounded-[12px] border border-[var(--border-light)] bg-[var(--bg-white)] px-[16px] text-[15px] font-sans text-[var(--text-primary)] outline-none focus:border-[var(--accent-orange)]"
            />
            {error && (
              <p className="text-[13px] font-sans text-red-500">{error}</p>
            )}
            <button
              type="submit"
              disabled={isLoading}
              className="flex h-[50px] w-full items-center justify-center rounded-[12px] bg-[var(--accent-orange)] text-[15px] font-medium tracking-[0.2px] font-sans text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
            <button
              type="button"
              onClick={() => setShowEmailForm(false)}
              className="flex h-[40px] w-full items-center justify-center text-[14px] font-sans text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Back to other options
            </button>
          </form>
        )}

        {/* Divider */}
        <div className="h-[1px] w-full bg-[var(--border-light)]" />

        {/* Feature Cards */}
        <div className="flex w-full justify-center gap-[16px]">
          <div className="flex flex-1 flex-col items-center gap-[12px] rounded-[16px] border border-[var(--border-card)] bg-[var(--bg-white)] p-[24px] overflow-hidden">
            <div className="flex flex-col h-[48px] w-[48px] items-center justify-center rounded-[24px] bg-[rgba(217,119,87,0.12)]">
              <span className="text-[22px]">🎤</span>
            </div>
            <span className="font-heading text-[18px] tracking-[-0.2px] text-[var(--text-primary)] text-center">
              Voice to Text
            </span>
            <p className="h-[80px] w-full text-[13px] font-sans leading-[1.5] text-[var(--text-secondary)] text-center">
              Speak naturally and let AI transcribe perfectly
            </p>
          </div>

          <div className="flex flex-1 flex-col items-center gap-[12px] rounded-[16px] border border-[var(--border-card)] bg-[var(--bg-white)] p-[24px] overflow-hidden">
            <div className="flex flex-col h-[48px] w-[48px] items-center justify-center rounded-[24px] bg-[rgba(147,130,220,0.12)]">
              <span className="text-[22px]">✨</span>
            </div>
            <span className="font-heading text-[18px] tracking-[-0.2px] text-[var(--text-primary)] text-center">
              AI Personalization
            </span>
            <p className="h-[80px] w-full text-[13px] font-sans leading-[1.5] text-[var(--text-secondary)] text-center">
              Learns your style and vocabulary over time
            </p>
          </div>

          <div className="flex flex-1 flex-col items-center gap-[12px] rounded-[16px] border border-[var(--border-card)] bg-[var(--bg-white)] p-[24px] overflow-hidden">
            <div className="flex flex-col h-[48px] w-[48px] items-center justify-center rounded-[24px] bg-[rgba(72,160,120,0.12)]">
              <span className="text-[22px]">⏱</span>
            </div>
            <span className="font-heading text-[18px] tracking-[-0.2px] text-[var(--text-primary)] text-center">
              Save Time
            </span>
            <p className="h-[80px] w-full text-[13px] font-sans leading-[1.5] text-[var(--text-secondary)] text-center">
              Type 3x faster with voice dictation in any app
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex w-full flex-col items-center justify-center gap-[8px]">
          <div className="flex w-full items-center justify-center gap-[4px]">
            <span className="text-[13px] font-sans text-[var(--text-tertiary)]">
              By signing up, you agree to the
            </span>
            <span className="text-[13px] font-sans text-[var(--accent-orange)] cursor-pointer">
              Terms of Service
            </span>
            <span className="text-[13px] font-sans text-[var(--text-tertiary)]">
              and
            </span>
            <span className="text-[13px] font-sans text-[var(--accent-orange)] cursor-pointer">
              Privacy Policy
            </span>
          </div>
          <div className="flex w-full items-center justify-center gap-[8px]">
            <span className="text-[12px] font-sans text-[var(--text-tertiary)]">
              Version v1.0.2
            </span>
            <span className="text-[12px] font-sans text-[var(--accent-orange)] cursor-pointer">
              Check for updates
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
