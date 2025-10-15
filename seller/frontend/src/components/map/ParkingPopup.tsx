// src/components/map/ParkingPopup.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Popup } from 'react-map-gl';
import type { ParkingSpace } from '@/types/parking';
import { toast } from 'react-toastify';
import {
  FaStar, FaMapMarkerAlt, FaClock, FaShieldAlt, FaCar, FaBolt, FaWheelchair,
  FaVideo, FaUmbrella, FaChevronLeft, FaChevronRight, FaCheck, FaTimes
} from 'react-icons/fa';

// 🔒 NEW: bring in auth + OTP modal
import { useAuth } from '../../context/AuthContext';
import PhoneVerifyModal from '../PhoneVerifyModal';

interface ParkingPopupProps {
  space: ParkingSpace;
  onClose: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  user: { id?: string; _id?: string; name?: string; isVerified?: boolean } | null;
  startTime?: string | null;
  endTime?: string | null;
}

export default function ParkingPopup({
  space,
  onClose,
  onMouseEnter,
  onMouseLeave,
  user,
  startTime,
  endTime
}: ParkingPopupProps) {
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // 🔒 NEW: read the full user from context so we can check phoneVerified
  const { user: authUser } = useAuth();
  const [showPhoneModal, setShowPhoneModal] = useState(false); // 🔒 NEW

  const address: any = (space as any).address || {};
  const street = address.street || 'No street information';
  const city = address.city || 'No city information';
  const rating = (space as any).rating ?? 0;
  const amenities = (space as any).amenities || [];

  // currency formatter
  const fmt = (value: number, decimals = 2) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: decimals
    }).format(value);

  // compute discounted price meta (won't modify original object)
  const computeDiscountedPrice = (s: any) => {
    const base = Number(s.priceParking ?? s.pricePerHour ?? s.price ?? 0) || 0;
    const rawDiscount = s.discount ?? 0;
    const discount = Number.isFinite(Number(rawDiscount)) ? Number(rawDiscount) : 0;
    const clamped = Math.max(0, Math.min(100, discount));
    const discounted = +(base * (1 - clamped / 100)).toFixed(2);
    return {
      basePrice: +base.toFixed(2),
      discountPercent: clamped,
      discountedPrice: discounted,
      hasDiscount: clamped > 0 && discounted < base,
    };
  };

  // prefer precomputed __price (if Home attached it), otherwise compute
  const priceMeta = (space as any).__price ?? computeDiscountedPrice(space as any);
  const basePrice = priceMeta.basePrice;
  const discountedPrice = priceMeta.discountedPrice;
  const hasDiscount = priceMeta.hasDiscount;
  const discountPercent = priceMeta.discountPercent;

  // compute duration & total
  function computeDurationHours(start?: string | null, end?: string | null): number | null {
    if (!start || !end) return null;
    const s = new Date(start);
    const e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e <= s) return null;
    const minutes = (e.getTime() - s.getTime()) / (1000 * 60);
    return +(minutes / 60); // fractional hours
  }
  function formatDurationReadable(hours: number) {
    if (!Number.isFinite(hours) || hours <= 0) return '';
    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  }

  const durationHours = computeDurationHours(startTime, endTime);
  const perHour = hasDiscount ? discountedPrice : basePrice;
  const totalAmount = durationHours ? +(perHour * durationHours).toFixed(2) : null;
  const durationReadable = durationHours ? formatDurationReadable(durationHours) : null;

  // --- Photo handling: normalize to full URLs so <img src=...> always works ---
  const API_BASE = (import.meta.env.VITE_BASE_URL?.replace(/\/$/, '') || window.location.origin);
  const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim();

  const makeUrl = (p: any) => {
    if (!p) return null;
    if (typeof p === 'string') {
      if (p.startsWith('http://') || p.startsWith('https://')) return p;
      if (p.startsWith('/')) return `${API_BASE}${p}`;
      if (CLOUD_NAME && p.includes('/')) {
        return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${p}`;
      }
      return `${API_BASE}/uploads/${p}`;
    }
    if (typeof p === 'object') {
      if (p.url) return p.url;
      if (p.path && (p.path.startsWith('http://') || p.path.startsWith('https://'))) return p.path;
      if (p.path && p.path.startsWith('/')) return `${API_BASE}${p.path}`;
      if (p.filename) return `${API_BASE}/uploads/${p.filename}`;
    }
    return null;
  };

  const rawPhotos = (space as any).photos;
  const images = Array.isArray(rawPhotos) && rawPhotos.length > 0
    ? rawPhotos.map(makeUrl).filter(Boolean)
    : rawPhotos
      ? [makeUrl(rawPhotos)].filter(Boolean)
      : [
          'https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80'
        ];

  const handleBookNow = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Logged in?
    if (!user) {
      toast.info('Please log in to book the parking space.');
      navigate('/login');
      return;
    }

    // KYC / account verification gate (existing behaviour)
    if (!user.isVerified) {
      toast.info('Your account is not verified. Please complete your KYC to book.');
      return;
    }

    // 🔒 NEW: phone OTP gate (only if not verified)
    const phoneVerified = (authUser as any)?.phoneVerified;
    if (phoneVerified === false) {
      setShowPhoneModal(true);
      return;
    }

    // proceed to booking
    const sid = (space as any)._id?.toString() || (space as any)._id;
    const uid = (user as any)._id || (user as any).id;

    navigate('/vehicle-details', {
      state: {
        spaceId: sid,
        userId: uid,
        startTime: startTime ?? null,
        endTime: endTime ?? null,
        totalAmount: totalAmount ?? null,
      },
    });
  };

  const amenityIcons: { [key: string]: React.ElementType } = {
    security: FaShieldAlt,
    cctv: FaVideo,
    charging: FaBolt,
    wheelchair: FaWheelchair,
    covered: FaUmbrella,
    '24/7': FaClock,
    surveillance: FaVideo,
    electric: FaBolt,
    accessible: FaWheelchair,
    disability: FaWheelchair,
    roof: FaUmbrella,
    indoor: FaUmbrella,
    '24hour': FaClock,
  };

  const getAmenityIcon = (amenity: string) => {
    const key = amenity.toLowerCase();
    return amenityIcons[key] || FaCar;
  };

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <>
      <Popup
        latitude={(space as any).location.coordinates[1]}
        longitude={(space as any).location.coordinates[0]}
        onClose={onClose}
        closeButton={false}
        closeOnClick={false}
        anchor="top"
        offset={[0, -15]}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={{
          maxWidth: '300px',
          minWidth: '280px',
          padding: 0,
          borderRadius: '12px',
        }}
        closeOnMove={false}
      >
        <div
          className="bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden"
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          <button
            onClick={onClose}
            className="absolute top-1.5 right-1.5 z-20 bg-white/95 hover:bg-red-50 text-gray-500 hover:text-red-600 rounded-full w-6 h-6 flex items-center justify-center transition-all duration-200 shadow-md border border-gray-200 hover:border-red-300"
            aria-label="Close popup"
          >
            <FaTimes className="text-xs" />
          </button>

          <div className="relative h-28 bg-gradient-to-br from-blue-400 to-purple-500">
            <img
              src={images[currentImageIndex]}
              alt={(space as any).title || 'Parking space'}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"></div>

            {images.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-1 top-1/2 transform -translate-y-1/2 bg-white/90 hover:bg-white text-gray-700 rounded-full w-5 h-5 flex items-center justify-center transition-all duration-200 shadow-sm"
                  aria-label="Previous image"
                >
                  <FaChevronLeft className="text-2xs" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 bg-white/90 hover:bg-white text-gray-700 rounded-full w-5 h-5 flex items-center justify-center transition-all duration-200 shadow-sm"
                  aria-label="Next image"
                >
                  <FaChevronRight className="text-2xs" />
                </button>
              </>
            )}

            {rating > 0 && (
              <div className="absolute top-2 left-2 bg-white/95 backdrop-blur-sm px-2 py-1 rounded-full flex items-center shadow-sm">
                <FaStar className="text-yellow-500 mr-1 text-2xs" />
                <span className="text-xs font-semibold text-gray-800">{Number(rating).toFixed(1)}</span>
              </div>
            )}

            <div className="absolute bottom-2 left-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-2 py-1 rounded-full shadow-md flex items-center gap-1">
              {hasDiscount ? (
                <div className="flex items-center gap-1">
                  <div className="text-xs line-through text-white/70">{fmt(basePrice, 0)}</div>
                  <div className="text-xs font-bold">{fmt(discountedPrice)}</div>
                </div>
              ) : (
                <div className="text-xs font-bold">{fmt(basePrice)}</div>
              )}

              {hasDiscount && (
                <div className="text-2xs font-semibold bg-white text-emerald-700 px-1 rounded">
                  {discountPercent}%
                </div>
              )}
            </div>
          </div>

          <div className="p-3">
            <h3 className="font-bold text-gray-900 text-sm mb-1 leading-tight line-clamp-1">
              {(space as any).title || 'Premium Parking Space'}
            </h3>

            <div className="flex items-start text-gray-600 mb-2">
              <FaMapMarkerAlt className="text-red-500 mr-1 text-2xs mt-0.5 flex-shrink-0" />
              <span className="text-xs leading-tight line-clamp-2">{street}, {city}</span>
            </div>

            {(space as any).description && (
              <p className="text-gray-600 text-xs mb-2 leading-relaxed line-clamp-2">
                {(space as any).description}
              </p>
            )}

            {amenities.length > 0 && (
              <div className="mb-2">
                <div className="flex flex-wrap gap-1">
                  {amenities.slice(0, 3).map((amenity, index) => {
                    const Icon = getAmenityIcon(amenity);
                    return (
                      <span
                        key={index}
                        className="inline-flex items-center px-1.5 py-0.5 bg-blue-50 rounded text-2xs font-medium text-blue-700 border border-blue-100"
                        title={amenity}
                      >
                        <Icon className="mr-1 text-2xs text-blue-500" />
                        {amenity.length > 8 ? amenity.substring(0, 6) + '...' : amenity}
                      </span>
                    );
                  })}
                  {amenities.length > 3 && (
                    <span className="inline-flex items-center px-1.5 py-0.5 bg-gray-100 rounded text-2xs text-gray-600 font-medium">
                      +{amenities.length - 3}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="px-3 pb-3 pt-2 border-t border-gray-100 bg-gray-50/80">
            <button
              onClick={handleBookNow}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white py-2 px-3 rounded-lg font-semibold text-xs shadow-md hover:shadow-lg transform hover:scale-[1.02] active:scale-100 transition-all duration-200 flex items-center justify-center gap-2"
            >
              <FaCheck className="text-2xs" />
              <div className="flex-1 text-left">
                <div>Book Now</div>
                {durationHours && totalAmount ? (
                  <div className="text-[10px] opacity-90">Total {fmt(totalAmount)} • {durationReadable}</div>
                ) : (
                  <div className="text-[10px] opacity-90">{fmt(perHour)} / hr</div>
                )}
              </div>

              <div className="font-bold">
                {durationHours && totalAmount ? fmt(totalAmount) : fmt(perHour)}
              </div>
            </button>
          </div>
        </div>
      </Popup>

      {/* 🔒 OTP Modal shows only when phoneVerified === false */}
      {showPhoneModal && (
        <PhoneVerifyModal open={showPhoneModal} onClose={() => setShowPhoneModal(false)} />
      )}
    </>
  );
}
