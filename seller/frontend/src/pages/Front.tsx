// src/components/Front.tsx
import React, { useState, useEffect } from 'react';
import { Car, Star, Shield, Zap, Map, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

import type { searchLocation, GeocodingResult } from '../utils/geocoding';
import { useMapContext } from '../context/MapContext';
import type { ParkingSpace } from '../types/parking';
import { parkingService } from '../services/parking.service';

// Assuming this component handles the actual search input when activated
import SearchOverlay from './SearchOverlayProps';

// Import all your asset images
import image1 from '../assest/1.jpg';
import image7 from '../assest/2.jpg';
import image2 from '../assest/3.jpg';
import image3 from '../assest/4.jpg';
import image4 from '../assest/5.jpg';
import image5 from '../assest/6.jpg';
import image6 from '../assest/8.png';
import image8 from '../assest/7.jpg';
import image9 from '../assest/8.jpg';
import image10 from '../assest/9.jpg';

interface LocationSearchBoxProps {
  onLocationSelect?: (location: GeocodingResult) => void;
  onProceed?: () => void;
}

interface ParkingArea {
  id: string;
  imageUrl: string;
  title?: string;
  description?: string;
}

const popularAreas: ParkingArea[] = [
  { id: '1', imageUrl: image1, title: 'Downtown Premium', description: '24/7 Secure Parking' },
  { id: '2', imageUrl: image7, title: 'Business District', description: 'Covered & Monitored' },
  { id: '3', imageUrl: image2, title: 'EV Charging', description: 'Spacious & Safe' },
  { id: '4', imageUrl: image4, title: 'Residential Zone', description: 'Peaceful & Secure' },
  { id: '5', imageUrl: image3, title: 'Covered Parking', description: 'Ample Space Available' },
  { id: '6', imageUrl: image9, title: 'Premium Parking', description: 'Long-term Security' },
];

const featuredImages = [
  { url: image5, title: 'Valet Parking', subtitle: 'Assisted Parking' },
  { url: image6, title: '24/7 Security', subtitle: 'Always Protected' },
  { url: image8, title: 'Easy Booking', subtitle: 'Instant Reservation' },
  { url: image10, title: 'Prime Locations', subtitle: 'Best Spots in City' },
];

// Floating animation for mobile-optimized cards
const FloatingElement = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => (
  <motion.div
    initial={{ y: 20, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    transition={{ duration: 0.5, delay, type: 'spring', stiffness: 100 }}
    whileHover={{ y: -3 }}
    className="transform-gpu"
  >
    {children}
  </motion.div>
);

// Lightweight background particles (mobile optimized)
const BackgroundParticles = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {[...Array(8)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute w-1.5 h-1.5 bg-red-200 rounded-full"
        initial={{ x: Math.random() * 100, y: Math.random() * 100 }}
        animate={{ y: [0, -15, 0], opacity: [0.2, 0.6, 0.2] }}
        transition={{ duration: 4 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 1 }}
        style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
      />
    ))}
  </div>
);

const Front: React.FC<LocationSearchBoxProps> = ({ onLocationSelect, onProceed }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const { viewport, setViewport } = useMapContext();
  const [parkingSpaces, setParkingSpaces] = useState<ParkingSpace[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const navigate = useNavigate();

  // Auto-rotate featured images
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveImage(prev => (prev + 1) % featuredImages.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const fetchNearbyParkingSpaces = async (lat: number, lng: number) => {
    try {
      const spaces = await parkingService.getNearbySpaces(lat, lng);
      setParkingSpaces(spaces);
    } catch {
      toast.error('Failed to fetch parking spaces.');
    }
  };

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        position => {
          const { latitude, longitude } = position.coords;
          setViewport({ ...viewport, latitude, longitude });
          setCurrentLocation({ lat: latitude, lng: longitude });
          fetchNearbyParkingSpaces(latitude, longitude);
        },
        error => {
          console.error('Location error:', error);
          toast.error('Could not get your location. Please enable location services.');
        }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLocationSelect = async (result: GeocodingResult) => {
    setViewport({ ...viewport, longitude: result.longitude, latitude: result.latitude });

    try {
      const spaces = await parkingService.getNearbySpaces(result.latitude, result.longitude);
      setParkingSpaces(spaces);
      if (spaces.length === 0) {
        toast.info('No nearby parking spaces available at the selected location.');
      }
    } catch {
      toast.error('Failed to fetch parking spaces for the selected location.');
    }

    onLocationSelect?.(result);
    setIsSearchOpen(false);
  };

  return (
    <>
      {/* 🧭 Sticky Top Header (Buyer) */}
      <header className="w-full bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Left: Logo + Brand */}
          <div className="flex items-center space-x-2">
            <img
              src="/Park_your_Vehicle_log.png"
              alt="ParkYourVehicles Logo"
              className="h-7 w-7 object-contain"
            />
            <span className="font-extrabold text-gray-900 text-lg tracking-tight">
              ParkYourVehicles
            </span>
          </div>

          {/* Right: Buyer pill */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-400 bg-emerald-50 text-emerald-700 text-sm font-semibold">
            {/* shopping bag icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4 text-emerald-700"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M7 7V6a5 5 0 0 1 10 0v1h2a1 1 0 0 1 1 1v11a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V8a1 1 0 0 1 1-1h2zm2 0h6V6a3 3 0 0 0-6 0v1z" />
            </svg>
            <span>Buyer</span>
          </div>
        </div>
      </header>

      {/* ===== Main Page Content ===== */}
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-red-50 relative overflow-hidden">
        {/* Lightweight Background Particles */}
        <BackgroundParticles />

        {/* Subtle animated orbs */}
        <motion.div
          className="absolute top-8 -left-8 w-20 h-20 bg-gradient-to-r from-red-200 to-pink-200 rounded-full blur-xl opacity-20"
          animate={{ x: [0, 20, 0], y: [0, -10, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-8 -right-8 w-20 h-20 bg-gradient-to-r from-blue-200 to-cyan-200 rounded-full blur-xl opacity-15"
          animate={{ x: [0, -20, 0], y: [0, 10, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Main Content */}
        <div className="relative z-10 px-4 pt-4 pb-16">
          {/* Mobile-first header CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-6"
          >
            <button
              onClick={() => {
                setIsSearchOpen(true);
                onProceed?.();
              }}
              className="w-full bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-4 border border-gray-100/50 flex items-center justify-between mb-3"
              aria-label="Find parking"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center overflow-hidden">
                  <img
                    src="/Park_your_Vehicle_log.png"
                    alt="logo"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="text-left">
                  <div className="font-bold text-gray-900 text-base leading-tight">
                    Find your <span className="text-red-600">perfect</span> spot
                  </div>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                Go
              </div>
            </button>

            <p className="text-xs text-gray-500 text-center leading-relaxed px-2">
              Quick booking • Verified spots • 24/7 security
            </p>
          </motion.div>

          {/* Popular Areas */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mb-8"
          >
            <h2 className="text-lg font-bold text-center text-gray-800 mb-5">Popular Areas</h2>
            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
              {popularAreas.map((area, index) => (
                <FloatingElement key={area.id} delay={index * 0.1}>
                  <motion.div
                    className="group relative bg-white/80 backdrop-blur-sm rounded-xl shadow-lg overflow-hidden border border-gray-100/40 cursor-pointer"
                    whileHover={{ scale: 1.03 }}
                  >
                    <div className="relative overflow-hidden rounded-xl h-28 sm:h-32">
                      <motion.img
                        src={area.imageUrl}
                        alt={area.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <div className="absolute bottom-0 left-0 right-0 p-2 translate-y-1 group-hover:translate-y-0 transition-transform duration-300">
                        <motion.h3 className="text-white font-bold text-xs leading-tight">
                          {area.title}
                        </motion.h3>
                        <motion.p className="text-red-200 text-xs" transition={{ delay: 0.1 }}>
                          {area.description}
                        </motion.p>
                      </div>
                    </div>
                  </motion.div>
                </FloatingElement>
              ))}
            </div>
          </motion.div>

          {/* Featured Slider */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="mb-8"
          >
            <h3 className="text-lg font-bold text-center text-gray-800 mb-4">Why Choose Us?</h3>
            <div className="relative rounded-2xl shadow-lg overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeImage}
                  initial={{ opacity: 0, scale: 1.05 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.6 }}
                  className="h-48 sm:h-56"
                >
                  <img
                    src={featuredImages[activeImage].url}
                    alt={featuredImages[activeImage].title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent flex items.end p-4">
                    <div className="text-white">
                      <motion.h4
                        className="text-lg font-bold mb-1"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                      >
                        {featuredImages[activeImage].title}
                      </motion.h4>
                      <motion.p
                        className="text-red-200 text-sm"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 }}
                      >
                        {featuredImages[activeImage].subtitle}
                      </motion.p>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Slider dots */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex space-x-2">
                {featuredImages.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setActiveImage(index)}
                    className={`w-2 h-2 rounded-full transition-all duration-200 ${
                      index === activeImage ? 'bg-red-600 scale-125' : 'bg-white/40'
                    }`}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.9 }}
            className="grid grid-cols-3 gap-3 max-w-md mx-auto mb-8"
          >
            {[
              { icon: <Car className="w-5 h-5" />, value: '10K+', label: 'Spaces' },
              { icon: <Map className="w-5 h-5" />, value: '50+', label: 'Cities' },
              { icon: <Star className="w-5 h-5" />, value: '4.8', label: 'Rating' },
              { icon: <Shield className="w-5 h-5" />, value: '24/7', label: 'Security' },
              { icon: <Zap className="w-5 h-5" />, value: '500+', label: 'EV Charging' },
              { icon: <Clock className="w-5 h-5" />, value: 'Instant', label: 'Booking' },
            ].map(stat => (
              <motion.div
                key={stat.label}
                className="flex flex-col items-center p-3 bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-100/30 text-center"
                whileHover={{ scale: 1.05, y: -2 }}
                transition={{ type: 'spring', stiffness: 250 }}
              >
                <motion.div className="text-red-600 mb-1 flex justify-center" whileHover={{ rotate: 180 }} transition={{ duration: 0.3 }}>
                  {stat.icon}
                </motion.div>
                <div className="text-sm font-bold text-gray-900">{stat.value}</div>
                <div className="text-xs text-gray-600 mt-0.5">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Search Overlay (full-screen search UI) */}
        <SearchOverlay
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          // If your overlay needs these, pass them through:
          // onSearch={(q) => setQuery(q)}
          // onSearchResults={(r) => setResults(r)}
          // onLocationSelected={handleLocationSelect}
        />

        {/* If you display results on the main page instead of inside SearchOverlay, render them with AnimatePresence here. */}
        <AnimatePresence>{/* results list UI (optional) */}</AnimatePresence>
      </div>
    </>
  );
};

export default Front;
