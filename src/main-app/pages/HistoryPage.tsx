import React, { useState, useEffect } from 'react';

interface HistoryEntry {
  id: string;
  time: string;
  text: string;
  type: 'dictation' | 'ask';
}

interface HistoryGroup {
  label: string;
  entries: HistoryEntry[];
}

interface HistoryPageProps {
  groups?: HistoryGroup[];
}

const defaultGroups: HistoryGroup[] = [
  {
    label: 'Today',
    entries: [
      {
        id: '1',
        time: '09:30 PM',
        text: '可不可以帮我在 Login 页面增加一些元素，然后保持跟 Home Dashboard 里面的元素（比如 Logo 和图标）也都一致？',
        type: 'dictation',
      },
      {
        id: '2',
        time: '09:28 PM',
        text: '为什么这边看起来一直是 generating 的状态？看这个圈中的地方，上面有个 generating 还在跳动。',
        type: 'dictation',
      },
      {
        id: '3',
        time: '09:27 PM',
        text: '好像我的 Generating Login Screen 一直在 generating，能把它这个状态停掉吗？',
        type: 'dictation',
      },
    ],
  },
  {
    label: 'Yesterday',
    entries: [
      {
        id: '4',
        time: '03:45 PM',
        text: 'Let me check on the status of the deployment pipeline and make sure everything is running smoothly.',
        type: 'dictation',
      },
      {
        id: '5',
        time: '02:10 PM',
        text: 'Can you summarize the key points from the last team standup meeting?',
        type: 'ask',
      },
    ],
  },
  {
    label: 'Earlier',
    entries: [
      {
        id: '6',
        time: '11:20 AM',
        text: 'I need to refactor the authentication module to support multiple OAuth providers.',
        type: 'dictation',
      },
    ],
  },
];

const HistoryPage: React.FC<HistoryPageProps> = ({ groups = defaultGroups }) => {
  const [activeTab, setActiveTab] = useState<'all' | 'dictations' | 'ask'>('all');
  const [retentionValue] = useState('Forever');
  const [isLoading, setIsLoading] = useState(true);
  const [loadedGroups, setLoadedGroups] = useState<HistoryGroup[] | null>(null);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const result = await window.electronAPI.historyList(0, 100);
        if (result.data.length > 0) {
          // Group by date
          const today = new Date();
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);

          const todayEntries: HistoryEntry[] = [];
          const yesterdayEntries: HistoryEntry[] = [];
          const earlierEntries: HistoryEntry[] = [];

          for (const record of result.data) {
            const date = new Date(record.created_at);
            const entry: HistoryEntry = {
              id: record.id,
              time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
              text: record.optimized_text || record.original_text,
              type: 'dictation',
            };

            if (date.toDateString() === today.toDateString()) {
              todayEntries.push(entry);
            } else if (date.toDateString() === yesterday.toDateString()) {
              yesterdayEntries.push(entry);
            } else {
              earlierEntries.push(entry);
            }
          }

          const grouped: HistoryGroup[] = [];
          if (todayEntries.length > 0) grouped.push({ label: 'Today', entries: todayEntries });
          if (yesterdayEntries.length > 0) grouped.push({ label: 'Yesterday', entries: yesterdayEntries });
          if (earlierEntries.length > 0) grouped.push({ label: 'Earlier', entries: earlierEntries });

          setLoadedGroups(grouped);
        }
      } catch (err) {
        console.error('Failed to load history:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadHistory();
  }, []);

  // Use loadedGroups if available, otherwise fall back to the groups prop
  const displayGroups = loadedGroups ?? groups;

  const filteredGroups = displayGroups.map((group) => ({
    ...group,
    entries: group.entries.filter((entry) => {
      if (activeTab === 'all') return true;
      if (activeTab === 'dictations') return entry.type === 'dictation';
      if (activeTab === 'ask') return entry.type === 'ask';
      return true;
    }),
  })).filter((group) => group.entries.length > 0);

  return (
    <div className="flex flex-1 flex-col gap-[40px] p-[48px]">
      {/* Header */}
      <div className="flex w-full items-center">
        <h1 className="font-heading text-[32px] font-normal text-[var(--text-primary)]">
          History
        </h1>
        <div className="flex-1" />
        <span className="text-[24px] font-sans text-[var(--text-primary)] cursor-pointer">
          &#x22EF;
        </span>
      </div>

      {/* Settings Section */}
      <div className="flex w-full flex-col gap-[12px]">
        {/* Keep History Setting */}
        <div className="flex w-full gap-[12px] rounded-[12px] bg-[var(--bg-settings)] p-[16px]">
          <div className="flex flex-1 flex-col gap-[8px]">
            <div className="flex items-center gap-[8px]">
              <span className="text-[16px]">📦</span>
              <span className="text-[15px] font-sans text-[var(--text-primary)]">
                Keep history
              </span>
            </div>
            <p className="text-[14px] font-sans leading-[1.5] text-[var(--text-tertiary)]">
              How long do you want to keep your dictation history on your device?
            </p>
          </div>
          <div className="flex h-[40px] items-center gap-[8px] rounded-[10px] bg-[var(--bg-white)] p-[12px]">
            <span className="text-[14px] font-sans text-[var(--text-primary)]">
              {retentionValue}
            </span>
            <span className="text-[10px] font-sans text-[var(--text-tertiary)]">
              &#x25BC;
            </span>
          </div>
        </div>

        {/* Privacy Section */}
        <div className="flex w-full flex-col gap-[8px] rounded-[12px] bg-[var(--bg-settings)] p-[16px]">
          <div className="flex items-center gap-[8px]">
            <span className="text-[16px]">🔒</span>
            <span className="text-[15px] font-sans text-[var(--text-primary)]">
              Your data stays private
            </span>
          </div>
          <p className="text-[14px] font-sans leading-[1.5] text-[var(--text-tertiary)]">
            Your voice dictations are private with zero data retention. They are stored only on your device and cannot be accessed from anywhere else.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-[8px]">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex items-center justify-center rounded-full px-[10px] py-[10px] text-[13px] font-sans transition-colors ${
            activeTab === 'all'
              ? 'bg-[var(--text-primary)] text-white'
              : 'bg-[var(--border-light)] text-[var(--text-primary)]'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setActiveTab('dictations')}
          className={`flex items-center justify-center rounded-full px-[10px] py-[10px] text-[13px] font-sans transition-colors ${
            activeTab === 'dictations'
              ? 'bg-[var(--text-primary)] text-white'
              : 'bg-[var(--border-light)] text-[var(--text-primary)]'
          }`}
        >
          Dictations
        </button>
        <button
          onClick={() => setActiveTab('ask')}
          className={`flex items-center justify-center rounded-full px-[10px] py-[10px] text-[13px] font-sans transition-colors ${
            activeTab === 'ask'
              ? 'bg-[var(--text-primary)] text-white'
              : 'bg-[var(--border-light)] text-[var(--text-primary)]'
          }`}
        >
          Ask anything
        </button>
      </div>

      {/* History List */}
      <div className="flex w-full flex-col gap-[20px]">
        {isLoading ? (
          <span className="text-[14px] font-sans text-[var(--text-tertiary)]">Loading...</span>
        ) : (
          filteredGroups.map((group) => (
            <React.Fragment key={group.label}>
              <span className="text-[13px] font-sans text-[var(--text-tertiary)]">
                {group.label}
              </span>
              {group.entries.map((entry) => (
                <div key={entry.id} className="flex w-full gap-[16px]">
                  <span className="font-mono text-[12px] text-[var(--text-tertiary)] shrink-0">
                    {entry.time}
                  </span>
                  <p className="text-[14px] font-sans leading-[1.6] text-[var(--text-primary)]">
                    {entry.text}
                  </p>
                </div>
              ))}
            </React.Fragment>
          ))
        )}
      </div>
    </div>
  );
};

export default HistoryPage;
