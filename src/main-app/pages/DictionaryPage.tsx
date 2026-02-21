import React, { useState } from 'react';

const SAMPLE_WORDS: string[] = [
  'Skylight',
  'reveal',
  'Xin',
  'claude code',
  'online markdown render',
  'Scene',
  'SceneItems',
  'Anvar Kayumov',
  'Yixuan Ye',
  'UnLockView',
  '消重',
  'comment',
  '结构体',
  '边界条件',
  'renyue',
  'ERD',
  '欣一些',
  'FI-CN',
  'GetFeedrecall',
  'RPC',
  'tphase-out',
  'feed recall',
  'view Status',
  'mixank',
];

const DictionaryPage: React.FC = () => {
  const [activeTab] = useState<'all'>('all');

  return (
    <div className="flex flex-1 flex-col gap-[32px] p-[48px]">
      {/* Subheading */}
      <span className="font-heading text-[14px] font-normal text-[var(--text-primary)]">
        Degine Your Own Work In Fixtionary
      </span>

      {/* Header with title + new word button */}
      <div className="flex w-[216px] items-center justify-center gap-[16px]">
        <h1 className="font-heading text-[32px] font-normal text-[var(--text-primary)]">
          Dictionary
        </h1>
        <button className="flex h-[44px] items-center justify-center rounded-[22px] bg-[var(--text-primary)] p-[12px] text-[14px] font-sans text-white">
          New word
        </button>
      </div>

      {/* Filter Row */}
      <div className="flex w-full items-center">
        <div className="flex gap-[8px]">
          <button
            className={`flex items-center justify-center rounded-full px-[10px] py-[10px] text-[13px] font-sans ${
              activeTab === 'all'
                ? 'bg-[var(--text-primary)] text-white'
                : 'bg-[var(--border-light)] text-[var(--text-primary)]'
            }`}
          >
            All
          </button>
        </div>
        <div className="flex-1" />
        <button className="flex h-[40px] w-[40px] items-center justify-center rounded-[20px] bg-[var(--border-light)]">
          <span className="text-[16px]">🔍</span>
        </button>
      </div>

      {/* Words Grid */}
      <div className="flex w-full flex-col gap-[16px]">
        {Array.from({ length: Math.ceil(SAMPLE_WORDS.length / 3) }, (_, rowIdx) => (
          <div key={rowIdx} className="flex w-full gap-[20px]">
            {SAMPLE_WORDS.slice(rowIdx * 3, rowIdx * 3 + 3).map((word, colIdx) => (
              <div
                key={`${rowIdx}-${colIdx}`}
                className="flex w-[310px] items-center gap-[8px]"
              >
                <span className="text-[14px] text-[var(--accent-green)]">✨</span>
                <span className="text-[14px] font-sans text-[var(--text-primary)]">
                  {word}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DictionaryPage;
