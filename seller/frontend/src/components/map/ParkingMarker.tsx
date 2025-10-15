import React from 'react';
import { Marker } from 'react-map-gl';
import { FaMapMarkerAlt, FaParking, FaUserCircle } from 'react-icons/fa';
import type { ParkingSpace } from '@/types/parking';

interface ParkingMarkerProps {
  latitude: number;
  longitude: number;
  color?: string;
  isCurrentLocation?: boolean;
  icon?: React.ElementType;
  onClick?: (e?: React.MouseEvent) => void;
  onMouseEnter?: (e?: React.MouseEvent) => void;
  onMouseLeave?: (e?: React.MouseEvent) => void;
  space?: ParkingSpace | null;
}

export default function ParkingMarker({
  latitude,
  longitude,
  color = '#10b981',
  isCurrentLocation = false,
  icon: CustomIcon = FaParking,
  onClick,
  onMouseEnter,
  onMouseLeave,
  space,
}: ParkingMarkerProps) {
  const price = space?.priceParking ?? space?.price ?? 0;

  return (
    <Marker 
      latitude={latitude} 
      longitude={longitude} 
      anchor="bottom"
      pitchAlignment="viewport"
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
          onClick && onClick(e);
        }}
        onMouseEnter={(e) => {
          e.stopPropagation();
          onMouseEnter && onMouseEnter(e);
        }}
        onMouseLeave={(e) => {
          e.stopPropagation();
          onMouseLeave && onMouseLeave(e);
        }}
        className="group cursor-pointer transform transition-all duration-200 ease-out"
        role="button"
        aria-label={isCurrentLocation ? "Your current location" : `Parking space - ₹${price}/hour`}
        tabIndex={0}
      >
        {isCurrentLocation ? (
          // Simple current location marker
          <div className="relative">
            <FaMapMarkerAlt className="text-3xl text-blue-600 drop-shadow-lg" />
            <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-20"></div>
          </div>
        ) : (
          // Simple parking marker - just the icon
          <div className="relative">
            {/* Price badge on hover */}
            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 group-hover:-translate-y-1 transition-all duration-200 z-20">
              <div className="bg-black/90 text-white px-2 py-1 rounded text-xs font-semibold whitespace-nowrap shadow-lg">
                ₹{price}/hr
              </div>
            </div>

            {/* Main parking icon */}
            <CustomIcon className="text-2xl text-green-500 drop-shadow-lg group-hover:scale-110 transition-transform duration-200" />
          </div>
        )}

        {/* Simple hover info for parking spaces */}
        {space && !isCurrentLocation && (
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-30">
            <div className="bg-black/90 text-white text-xs rounded px-2 py-1 shadow-lg whitespace-nowrap">
              {space.title || 'Parking Space'}
            </div>
          </div>
        )}
      </div>
    </Marker>
  );
}