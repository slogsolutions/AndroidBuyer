import React from 'react';
import { Power } from 'lucide-react';

interface OnlineStatusProps {
  isOnline: boolean;
  onToggleStatus: () => void;
}

export function OnlineStatus({ isOnline, onToggleStatus }: OnlineStatusProps) {
  return (
    <div className="fixed bottom-8 right-8">
      <button
        onClick={onToggleStatus}
        className={`flex items-center space-x-2 px-6 py-3 rounded-full shadow-lg transition-colors ${
          isOnline
            ? 'bg-green-600 hover:bg-green-700'
            : 'bg-gray-600 hover:bg-gray-700'
        }`}
      >
        <Power className="h-5 w-5 text-white" />
        <span className="text-white font-medium">
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </button>
    </div>
  );
}