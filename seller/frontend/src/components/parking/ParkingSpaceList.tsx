// src/components/parking/ParkingSpaceList.tsx
import React from 'react';
import type { ParkingSpace } from '@/types/parking';

import {
  FaStar,
  FaMapMarkerAlt,
  FaClock,
  FaShieldAlt,
  FaBolt,
  FaWheelchair,
  FaVideo,
  FaUmbrella,
  FaCar,
  FaSearch,
  FaRoad,
} from 'react-icons/fa';

interface ParkingSpaceListProps {
  spaces: ParkingSpace[];
  onSpaceSelect: (space: ParkingSpace) => void;
  searchRadius?: number; // optional
  onRadiusChange?: (radius: number) => void; // optional
  userLocation: { lat: number; lng: number };
  filters: {
    amenities: { [key: string]: boolean };
    priceRange: [number, number];
  };
  startTime?: string | null;
  endTime?: string | null;
}

// Haversine formula to calculate distance
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const getAmenityIcon = (amenity: string) => {
  const amenityLower = amenity.toLowerCase();
  const amenityIcons: { [key: string]: React.ElementType } = {
    security: FaShieldAlt,
    cctv: FaVideo,
    surveillance: FaVideo,
    camera: FaVideo,
    charging: FaBolt,
    electric: FaBolt,
    wheelchair: FaWheelchair,
    accessible: FaWheelchair,
    covered: FaUmbrella,
    roof: FaUmbrella,
    indoor: FaUmbrella,
    '24/7': FaClock,
  };

  for (const [key, icon] of Object.entries(amenityIcons)) {
    if (amenityLower.includes(key)) {
      return icon;
    }
  }
  return FaCar;
};

// Format a number as INR currency
const formatINR = (value: number, showCents = false) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(value);

// Compute price metadata (base, discountPercent, discountedPrice, hasDiscount)
const computePriceMeta = (space: any) => {
  const baseRaw = space?.priceParking ?? space?.price ?? 0;
  const base = Number(baseRaw) || 0;

  let rawDiscount = space?.discount ?? space?.discountPercent ?? space?.discount_percentage ?? 0;

  if (typeof rawDiscount === 'string') {
    rawDiscount = rawDiscount.replace?.('%', '') ?? rawDiscount;
  }
  if (typeof rawDiscount === 'object' && rawDiscount !== null) {
    rawDiscount = rawDiscount.percent ?? rawDiscount.value ?? rawDiscount.amount ?? 0;
  }

  const discountNum = Number(rawDiscount);
  const discountPercent = Number.isFinite(discountNum) ? Math.max(0, Math.min(100, discountNum)) : 0;
  const discountedPrice = +(base * (1 - discountPercent / 100)).toFixed(2);
  const hasDiscount = discountPercent > 0 && discountedPrice < base;

  return {
    basePrice: +base.toFixed(2),
    discountPercent,
    discountedPrice,
    hasDiscount,
  };
};

function computeDurationHours(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null;
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e <= s) return null;
  const minutes = (e.getTime() - s.getTime()) / (1000 * 60);
  return +(minutes / 60); // fractional hours (e.g., 1.5)
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

export default function ParkingSpaceList({
  spaces,
  onSpaceSelect,
  searchRadius,
  userLocation,
  filters,
  startTime,
  endTime,
}: ParkingSpaceListProps) {
  const filteredSpaces = spaces.filter((space: any) => {
    // Calculate & attach distance (so parent or UI can reuse)
    const distance = calculateDistance(
      userLocation.lat,
      userLocation.lng,
      space.location.coordinates[1],
      space.location.coordinates[0]
    );
    (space as any).distance = distance;

    // Check amenities
    for (const [key, value] of Object.entries(filters.amenities)) {
      if (
        value &&
        !space.amenities?.some((amenity: string) => amenity?.toLowerCase?.().includes(key.toLowerCase()))
      ) {
        return false;
      }
    }

    // Price range filter (use pre-discount price to avoid surprises)
    const price = Number(space.priceParking ?? space.price ?? 0);
    if (price < filters.priceRange[0] || price > filters.priceRange[1]) {
      return false;
    }

    return true;
  });

  if (filteredSpaces.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center h-48 bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl border border-white/30">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-200 to-purple-300 rounded-full flex items-center justify-center mb-3 shadow-lg">
          <FaSearch className="text-2xl text-blue-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-700 mb-1">No parking spaces found</h3>
        <p className="text-gray-500 text-sm mb-3 max-w-xs">Try adjusting your filters or search radius</p>
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-2 max-w-xs">
          <p className="text-yellow-700 text-xs">💡 Try increasing search radius or removing filters</p>
        </div>
      </div>
    );
  }

  const durationHours = computeDurationHours(startTime, endTime);
  const timeFilterActive = Boolean(startTime && endTime);

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
      {filteredSpaces.map((space: any) => {
        const address: any = space.address || {};
        const amenities = Array.isArray(space.amenities) ? space.amenities : [];
        const rating = typeof space.rating === 'number' ? space.rating : 0;

        // Prefer time-window availability when filter is active; else show total capacity-ish.
        const timeWindowAvail =
          typeof space.availableSpots === 'number' && !Number.isNaN(space.availableSpots)
            ? space.availableSpots
            : undefined;

        const totalCapacity =
          Number(
            space.totalSpots ??
              space.total_slots ??
              space.capacity ??
              space.slotCount ??
              // as a last fallback use availableSpots if it's actually a static "total" in some schemas
              space.availableSpots ??
              0
          ) || 0;

        const shownAvailability = timeFilterActive ? (timeWindowAvail ?? 0) : totalCapacity;

        const priceMeta = (space as any).__price ?? computePriceMeta(space);
        const basePrice = priceMeta.basePrice;
        const discountedPrice = priceMeta.discountedPrice;
        const hasDiscount = priceMeta.hasDiscount;
        const discountPercent = priceMeta.discountPercent;

        const perHour = hasDiscount ? discountedPrice : basePrice;
        const totalAmount = durationHours ? +(perHour * durationHours).toFixed(2) : null;
        const durationReadable = durationHours ? formatDurationReadable(durationHours) : null;

        const key =
          typeof space._id === 'object' && (space._id as any)?.toString
            ? (space._id as any).toString()
            : (space._id as string);

        return (
          <div
            key={key}
            onClick={() => onSpaceSelect(space)}
            className="group bg-white/90 backdrop-blur-sm rounded-xl shadow-lg hover:shadow-xl cursor-pointer transition-all duration-300 transform hover:-translate-y-0.5 border border-white/30 overflow-hidden hover:border-blue-300 relative"
          >
            <div className="p-3">
              {/* Header Row */}
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 text-sm leading-tight truncate mb-1">
                    {space.title || 'Premium Parking Space'}
                  </h3>
                  <div className="flex items-center text-gray-600 text-xs">
                    <FaMapMarkerAlt className="text-red-500 mr-1 flex-shrink-0" />
                    <span className="truncate">
                      {address.street || 'Unknown Street'}, {address.city || 'Unknown City'}
                    </span>
                  </div>
                </div>

                {/* Price and Rating */}
                <div className="text-right ml-2 flex-shrink-0">
                  {hasDiscount ? (
                    <div className="flex flex-col items-end">
                      <div className="text-xs text-gray-400 line-through">{formatINR(basePrice, false)}</div>
                      <div className="text-lg font-bold text-green-700">{formatINR(discountedPrice, true)}</div>
                      <div className="text-[10px] mt-1 inline-block bg-gradient-to-r from-green-500 to-emerald-600 text-white px-2 py-0.5 rounded font-semibold">
                        {discountPercent}% OFF
                      </div>
                      <div className="text-xs text-gray-500 mt-1">/hr</div>
                    </div>
                  ) : (
                    <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-2 py-1 rounded-lg text-sm font-bold">
                      {formatINR(basePrice, false)}
                      <span className="text-xs ml-1">/hr</span>
                    </div>
                  )}

                  {rating > 0 && (
                    <div className="flex items-center justify-end mt-1">
                      <FaStar className="text-yellow-400 text-xs mr-1" />
                      <span className="text-xs font-semibold text-gray-700">{rating.toFixed(1)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Distance and Availability */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center text-xs text-gray-600 bg-blue-50 px-2 py-1 rounded-full">
                  <FaRoad className="text-blue-500 mr-1" />
                  <span>{(space.distance as number)?.toFixed(1)} km away</span>
                </div>

                <div
                  className={`flex items-center text-xs px-2 py-1 rounded-full font-semibold ${
                    timeFilterActive ? 'text-green-600 bg-green-50' : 'text-gray-600 bg-gray-100'
                  }`}
                >
                  {shownAvailability} spot{shownAvailability !== 1 ? 's' : ''}{' '}
                  {timeFilterActive ? 'available for your time' : 'total'}
                </div>
              </div>

              {/* Amenities */}
              {amenities.length > 0 && (
                <div className="mb-2">
                  <div className="flex flex-wrap gap-1">
                    {amenities.slice(0, 2).map((amenity: string, idx: number) => {
                      const AmenityIcon = getAmenityIcon(amenity);
                      return (
                        <span
                          key={idx}
                          className="inline-flex items-center px-2 py-1 bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 rounded-full text-xs font-medium border border-blue-200"
                          title={amenity}
                        >
                          <AmenityIcon className="mr-1 text-xs" />
                          {amenity.length > 12 ? amenity.substring(0, 10) + '...' : amenity}
                        </span>
                      );
                    })}
                    {amenities.length > 2 && (
                      <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                        +{amenities.length - 2} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Pricing block: show total amount if time period selected, else show per-hour */}
              <div className="mb-2">
                {durationHours && totalAmount ? (
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-600">Total for {durationReadable}</div>
                    <div className="font-semibold text-gray-900">{formatINR(totalAmount, true)}</div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-600">Rate</div>
                    <div className="font-semibold text-gray-900">{formatINR(perHour, false)}/hr</div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <div className="flex items-center text-xs text-gray-500">
                  <span className="flex items-center bg-gray-100 px-2 py-1 rounded-full">
                    <FaClock className="mr-1 text-blue-500 text-xs" />
                    {space.available24_7 ? '24/7 Available' : 'Limited hours'}
                  </span>
                </div>

                <button
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSpaceSelect(space);
                  }}
                >
                  View Details
                </button>
              </div>
            </div>

            {/* Hover Effect Border */}
            <div className="absolute inset-0 border-2 border-transparent group-hover:border-blue-300 rounded-xl pointer-events-none transition-all duration-300"></div>
          </div>
        );
      })}

      {/* Custom Scrollbar Styling */}
      <style >{`
        .max-h-64::-webkit-scrollbar {
          width: 6px;
        }
        .max-h-64::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 10px;
        }
        .max-h-64::-webkit-scrollbar-thumb {
          background: linear-gradient(135deg, #3b82f6, #8b5cf6);
          border-radius: 10px;
        }
        .max-h-64::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(135deg, #2563eb, #7c3aed);
        }
      `}</style>
    </div>
  );
}
