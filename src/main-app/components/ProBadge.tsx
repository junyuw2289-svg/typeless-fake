import React from 'react';

const ProBadge: React.FC = () => {
  return (
    <span className="inline-flex items-center rounded-[4px] bg-[rgba(217,119,87,0.2)] px-[6px] py-[3px]">
      <span className="text-[12px] text-[var(--accent-orange)] font-sans">
        Pro Trial
      </span>
    </span>
  );
};

export default ProBadge;
