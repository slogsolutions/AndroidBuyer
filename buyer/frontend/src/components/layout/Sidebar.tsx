import React from 'react';
import { 
  BellRing,
  LucideParkingMeter,
  PlusSquare,
  Sun,
  Moon,
  PowerOff
} from 'lucide-react';

interface BottomNavProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onLogout: () => void;
  className?: string;
}

export function Sidebar({
  currentPage,
  onNavigate,
  darkMode,
  onToggleDarkMode,
  onLogout,
  className = '',
}: BottomNavProps) {
  const menuItems = [
    { icon: PlusSquare, label: 'Register', id: 'register' },
    { icon: LucideParkingMeter, label: 'Spaces', id: 'spaces' },
    { icon: BellRing, label: 'Requests', id: 'requests' },
  ];

  // Accessible keyboard handler
  const handleKeyToggle = (handler: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handler();
    }
  };

  return (
    <div className={`fixed bottom-0 left-0 w-full bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex justify-around items-center p-2 ${className}`}>
      {/* Navigation items */}
      {menuItems.map(({ icon: Icon, label, id }) => (
        <button
          key={id}
          onClick={() => onNavigate(id)}
          className={`flex flex-col items-center justify-center px-3 py-1 rounded-lg transition-all duration-200 ${
            currentPage === id
              ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-500'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <Icon className={`h-6 w-6 mb-1 ${currentPage === id ? 'text-primary-500' : ''}`} />
          <span className="text-xs font-medium">{label}</span>
        </button>
      ))}

      {/* Dark mode toggle */}
      <div
        role="switch"
        aria-checked={darkMode}
        tabIndex={0}
        onKeyDown={handleKeyToggle(onToggleDarkMode)}
        title={darkMode ? 'Switch to light theme' : 'Switch to dark theme'}
        className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors duration-200 cursor-pointer ${
          darkMode ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'
        }`}
        onClick={onToggleDarkMode}
      >
        <div className="pointer-events-none absolute left-2">
          {darkMode ? <Moon className="h-4 w-4 text-white" /> : null}
        </div>
        <div className="pointer-events-none absolute right-2">
          {!darkMode ? <Sun className="h-4 w-4 text-primary-500" /> : null}
        </div>

        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
            darkMode ? 'translate-x-8' : 'translate-x-1'
          }`}
        />
      </div>
    </div>
  );
}