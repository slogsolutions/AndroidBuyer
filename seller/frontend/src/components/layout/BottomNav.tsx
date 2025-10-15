import React from 'react'; 
import { 
  LucideHome,
  LayoutDashboard,
  BellRing,
  LucideParkingMeter,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface BottomNavProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export function BottomNav({ currentPage, onNavigate }: BottomNavProps) {
  const navigate = useNavigate();

  // Other nav items (Dashboard, Requests, Spaces)
  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', id: 'dashboard' },
    { icon: BellRing, label: 'Requests', id: 'requests' },     
    { icon: LucideParkingMeter, label: 'Spaces', id: 'spaces' }, 
  ];

  return (
    <nav className="md:hidden fixed z-50 bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 pb-safe">
      <div className="flex justify-around">
        {/* Home button - navigates to "/" route */}
        <button
          onClick={() => navigate('/')}
          className="flex flex-col items-center py-3 flex-1 transition-colors duration-200"
        >
          <LucideHome className="h-6 w-6" />
          <span className="text-xs mt-1 font-medium">Home</span>
        </button>

        {/* Other nav items */}
        {navItems.map(({ icon: Icon, label, id }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className={`flex flex-col items-center py-3 flex-1 transition-colors duration-200 ${
              currentPage === id
                ? 'text-primary-500'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            <Icon className="h-6 w-6" />
            <span className="text-xs mt-1 font-medium">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}