import React from 'react';

export default function HorizontalLoader({ label = 'Loading...', fullScreen = false }) {
  const content = (
    <div className="flex flex-col items-center justify-center gap-4 py-12 w-full">
      <div className="w-full max-w-md bg-gray-200 rounded-full h-1.5 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-purple-500 to-purple-700 rounded-full animate-loading-bar" style={{ width: '100%' }} />
      </div>
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 animate-pulse">
        {label}
      </p>
      <style>{`
        @keyframes loadingBar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-loading-bar {
          animation: loadingBar 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
        {content}
      </div>
    );
  }

  return content;
}