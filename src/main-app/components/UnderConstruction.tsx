import React from 'react';

const ConstructionIcon: React.FC = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d97757" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="8" rx="1" />
    <path d="M17 14v7" />
    <path d="M7 14v7" />
    <path d="M17 3v3" />
    <path d="M7 3v3" />
    <path d="M10 14 2.3 6.3" />
    <path d="m14 6 7.7 7.7" />
    <path d="m8 6 8 8" />
  </svg>
);

const UnderConstruction: React.FC = () => {
  return (
    <div className="flex flex-1 items-center justify-center bg-[#faf9f5]">
      <div className="flex flex-col items-center gap-[24px] rounded-[16px] bg-[#f0efea] p-[40px]">
        <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[rgba(217,119,87,0.12)]">
          <ConstructionIcon />
        </div>
        <h2 className="font-heading text-[24px] text-[#141413] text-center">
          Under Construction
        </h2>
        <p className="w-[280px] text-center font-sans text-[14px] leading-[1.5] text-[#8a8880]">
          This page is currently being built. Check back soon!
        </p>
        <div className="h-[3px] w-[48px] rounded-[2px] bg-[#d97757]" />
      </div>
    </div>
  );
};

export default UnderConstruction;
