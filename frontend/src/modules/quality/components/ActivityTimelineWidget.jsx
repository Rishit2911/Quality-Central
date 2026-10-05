import React from 'react';
import { MessageSquare, GitCommit, CheckCircle2, User } from 'lucide-react';

const DEFAULT_ACTIVITIES = [
  {
    id: 'ACT-1',
    user: 'Sneh Shah',
    avatar: 'SS',
    avatarBg: 'bg-purple-100 text-purple-700',
    timestamp: '11 Mar 2021, 12:35 AM',
    text: 'Sneh Shah commented on QC-00124 to begin testing.',
    bugRef: 'QC-00124',
    icon: MessageSquare
  },
  {
    id: 'ACT-2',
    user: 'RAJU Phames',
    avatar: 'RJ',
    avatarBg: 'bg-slate-800 text-white',
    timestamp: '11 Mar 2021, 11:07 AM',
    text: 'The issue is responsible as Both Chrome and Edge.',
    icon: GitCommit
  },
  {
    id: 'ACT-3',
    user: 'John Doe',
    avatar: 'JD',
    avatarBg: 'bg-blue-100 text-blue-700',
    timestamp: '11 Mar 2021, 12 PM',
    text: 'John Doe closed EC-00120 to begin district practices.',
    bugRef: 'EC-00120',
    icon: CheckCircle2
  },
  {
    id: 'ACT-4',
    user: 'John Doe',
    avatar: 'JD',
    avatarBg: 'bg-blue-100 text-blue-700',
    timestamp: '11 Apr 2021, 13 PM',
    text: 'Thinking on the Is:rits. Will have to be Roffinegotte.',
    icon: MessageSquare
  },
  {
    id: 'ACT-5',
    user: 'Sneh Shah',
    avatar: 'SS',
    avatarBg: 'bg-purple-100 text-purple-700',
    timestamp: '1 Apr 2021, 12 AM',
    text: 'Added test scenarios for API response validation on Edge.',
    icon: User
  }
];

export default function ActivityTimelineWidget({ activities = DEFAULT_ACTIVITIES }) {
  // Highlights bug references like LEX-00125, TC-00123, QC-00124 in text
  const formatActivityText = (text) => {
    const parts = text.split(/([A-Z]{2,4}-\d+)/g);
    return parts.map((part, index) => {
      if (/[A-Z]{2,4}-\d+/.test(part)) {
        return (
          <span
            key={index}
            className="text-[#7C3AED] font-black hover:underline cursor-pointer"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className="bg-white border border-[#ebe4ff] rounded-[2rem] p-8 shadow-[0_10px_40px_rgba(180,140,255,0.04)] flex flex-col justify-start transition-all duration-300 hover:shadow-[0_15px_45px_rgba(124,58,237,0.06)] h-full">
      <style>{`
        .custom-activity-scroll {
          scrollbar-width: thin;
          scrollbar-color: #CBD5E1 transparent;
        }
        .custom-activity-scroll::-webkit-scrollbar {
          width: 5px;
        }
        .custom-activity-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-activity-scroll::-webkit-scrollbar-thumb {
          background-color: #CBD5E1;
          border-radius: 9999px;
        }
        .custom-activity-scroll::-webkit-scrollbar-thumb:hover {
          background-color: #94A3B8;
        }
      `}</style>

      {/* Header */}
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#7C3AED]">
            RECENT ACTIVITY / MENTIONS
          </h3>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            Realtime collaboration across quality tasks
          </p>
        </div>
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
      </div>

      {/* Timeline Feed with Scrollbar */}
      <div className="flex-1 overflow-y-auto max-h-[380px] pr-2 pl-1 py-1 custom-activity-scroll">
        {activities && activities.length > 0 ? (
          <div className="relative pl-6 space-y-5 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
            {activities.map((act) => (
              <div key={act.id} className="relative group">
                {/* Timeline Node dot/avatar */}
                <div
                  className={`absolute -left-6 top-0.5 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border-2 border-white shadow-sm ring-2 ring-slate-100 ${
                    act.avatarBg || 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {act.avatar}
                </div>

                {/* Content */}
                <div className="ml-2 bg-[#FAF8FF] group-hover:bg-[#F5F0FF] p-3 rounded-2xl border border-transparent group-hover:border-[#E9DDFF] transition-all">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-black text-slate-900">
                      {act.user}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400">
                      {act.timestamp}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    {formatActivityText(act.text)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-xs font-semibold text-slate-400">
            No recent activity recorded yet.
          </div>
        )}
      </div>
    </div>
  );
}
