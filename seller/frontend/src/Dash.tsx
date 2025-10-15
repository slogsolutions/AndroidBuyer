// Dash.tsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Dashboard } from './components/dashboard/Dashboard';
import { Sidebar } from './components/layout/Sidebar';
import { BottomNav } from './components/layout/BottomNav';
import Requests from './pages/Requests';
import LoadingScreen from './pages/LoadingScreen';
import type { Booking, Provider } from '@/types';
import { ProviderDashboard } from './components/dashboard/Deatils';
import { Profile } from './components/dashboard/Profile';

import RegisterParking from './pages/RegisterParking';
import ProviderLocations from './components/dashboard/ProviderSpaces';
import { BookingManagement } from './components/dashboard/BookingManagement';
import BookedSlots from './components/dashboard/BookedSlot';

function Dash() {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('darkMode') || 'false');
    } catch {
      return false;
    }
  });

  const API_BASE_URL = import.meta.env.VITE_BASE_URL;
  
  useEffect(() => {
    const socket = io(import.meta.env.VITE_SOCKET_URL);

    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };

        const providerRes = await axios.get(`${API_BASE_URL}/api/auth/me`, { headers });
        const fetchedProvider = providerRes.data?.user ?? providerRes.data;
        setProvider(fetchedProvider);

        const bookingsRes = await axios.get(`${API_BASE_URL}/api/booking/provider-bookings`, { headers });
        setBookings(bookingsRes.data);

        const userId = fetchedProvider._id;
        socket.emit('register-provider', { userId });
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const handleToggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    try { localStorage.setItem('darkMode', JSON.stringify(newMode)); } catch {}
  };

  if (loading) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <LoadingScreen />
      </div>
    );
  }

  return (
    // Use min-h-screen and full width so the layout always fills the viewport
    <div className="flex min-h-screen w-full bg-gray-50 dark:bg-gray-900">
      {/* NOTE: Sidebar should use h-full so it inherits parent's height (avoid h-screen here) */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        darkMode={darkMode}
        onToggleDarkMode={handleToggleDarkMode}
        className="hidden md:flex"
        onLogout={() => {
          localStorage.removeItem('token');
          navigate('/login');
        }}
      />

      {/* Main area: make this fill remaining space and also min-h-screen */}
      <div className="flex-1 min-h-screen flex flex-col">
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0 bg-transparent">
          {currentPage === 'dashboard' && provider && (
            <Dashboard provider={provider} bookings={bookings} />
          )}

          {currentPage === 'register' && (
            <div className="p-6 max-w-7xl mx-auto">
              <RegisterParking />
            </div>
          )}

          {currentPage === 'spaces' && (
            <div className="p-6 max-w-7xl mx-auto">
              <ProviderLocations />
            </div>
          )}

          {currentPage === 'requests' && (
            <div className="p-6 max-w-7xl mx-auto">
              <Requests />
            </div>
          )}

                    {currentPage === 'ProviderDash' && <ProviderDashboard />}
          {currentPage === 'BookedSlots' && <BookedSlots bookings={bookings} />}
          {currentPage === 'Profile' && <Profile />}
        </main>

        {/* BottomNav usually only for mobile; it can overlap on top of main content.
            The outer container has no white background so overlapping won't show white gaps. */}
        <BottomNav currentPage={currentPage} onNavigate={setCurrentPage} />
      </div>
    </div>
  );
}

export default Dash;
