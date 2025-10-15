import React from 'react';
import { ParkingSpace } from '../../types/parking';
import { FaStar, FaMapMarkerAlt, FaClock, FaShield, FaBolt, FaWheelchair, FaVideo, FaUmbrella, FaCar, FaSearch } from 'react-icons/fa';

interface ParkingListProps {
  spaces: ParkingSpace[];
  onSpaceSelect: (space: ParkingSpace) => void;
  // searchRadius?: number;
  // onRadiusChange?: (radius: number) => void;
  filters?: any;
  userLocation?: { lat: number; lng: number } | null;
}

export default function ParkingSpaceList({ spaces, onSpaceSelect }: ParkingListProps) {
  if (!spaces || spaces.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center h-full bg-gradient-to-b from-blue-50 to-purple-50">
        <div className="w-20 h-20 bg-gradient-to-br from-blue-200 to-purple-300 rounded-full flex items-center justify-center mb-4 shadow-lg">
          <FaSearch className="text-3xl text-blue-600" />
        </div>
        <h3 className="text-xl font-bold text-gray-700 mb-2">No parking spaces found</h3>
        {/* <p className="text-gray-500 mb-4 max-w-xs">Try adjusting your search criteria or increasing the search radius</p> */}
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-3 max-w-xs">
          <p className="text-yellow-700 text-sm">💡 Tip: Try searching in a different area or removing some filters</p>
        </div>
      </div>
    );
  }

  const getAmenityIcon = (amenity: string) => {
    const amenityLower = amenity.toLowerCase();
    const amenityIcons: { [key: string]: React.ElementType } = {
      security: FaShield,
      'cctv': FaVideo,
      'surveillance': FaVideo,
      'camera': FaVideo,
      charging: FaBolt,
      'electric': FaBolt,
      wheelchair: FaWheelchair,
      'accessible': FaWheelchair,
      covered: FaUmbrella,
      'roof': FaUmbrella,
      'indoor': FaUmbrella,
      '24/7': FaClock,
    };
    
    for (const [key, icon] of Object.entries(amenityIcons)) {
      if (amenityLower.includes(key)) {
        return icon;
      }
    }
    
    return FaCar;
  };

  // Format price in INR — show two decimals for discounted price, round for base optionally
  const formatPrice = (price: number, cents = true) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: cents ? 2 : 0
    }).format(price);
  };

  // compute discounted price meta for a space (non-destructive)
  const computeDiscountedPrice = (space: any) => {
    // Prefer explicit fields in this order (matches your DB): priceParking, pricePerHour, price
    const baseRaw = space?.priceParking ?? space?.pricePerHour ?? space?.price ?? 0;
    const base = Number(baseRaw) || 0;

    // The discount might come as string or number; coerce safely
    const rawDiscount = space?.discount ?? 0;
    const discount = Number(rawDiscount);
    const clamped = Number.isFinite(discount) ? Math.max(0, Math.min(100, discount)) : 0;

    const discounted = +(base * (1 - clamped / 100)).toFixed(2);

    return {
      basePrice: +base.toFixed(2),
      discountPercent: clamped,
      discountedPrice: discounted,
      hasDiscount: clamped > 0 && discounted < base,
    };
  };

  return (
    <div className="space-y-3 p-3 max-h-[calc(100vh-280px)] overflow-auto bg-gradient-to-b from-blue-50 to-purple-50">
      {spaces.map((space, index) => {
        const address: any = (space as any).address || {};
        const street = address.street || 'Address not specified';
        const city = address.city || 'Location not specified';
        const amenities = Array.isArray(space.amenities) ? space.amenities : [];
        const rating = typeof space.rating === 'number' ? space.rating : 0;
        const availableSpaces = space.availableSpots || 1;

        // Prefer precomputed __price, but always compute a fallback (so list never misses it)
        const priceMetaFromProp = (space as any).__price;
        const computedMeta = computeDiscountedPrice(space as any);
        const priceMeta = priceMetaFromProp ?? computedMeta;

        const basePrice = priceMeta.basePrice;
        const discountedPrice = priceMeta.discountedPrice;
        const hasDiscount = priceMeta.hasDiscount;
        const discountPercent = priceMeta.discountPercent;

        // debug: see which items have discounts (remove console.debug in production)
        if (hasDiscount) {
          console.debug(`[ParkingSpaceList] discount detected for ${space._id ?? 'unknown id'} -> ${discountPercent}%`);
        }

        const key = typeof space._id === 'object' && (space._id as any).toString 
          ? (space._id as any).toString() 
          : (space._id ?? `space-${index}`);

        return (
          <div
            key={key}
            onClick={() => onSpaceSelect(space)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { 
              if (e.key === 'Enter' || e.key === ' ') onSpaceSelect(space); 
            }}
            className="group bg-white/90 backdrop-blur-sm rounded-xl shadow-lg hover:shadow-2xl cursor-pointer transition-all duration-300 transform hover:-translate-y-1 border border-white/30 overflow-hidden hover:border-blue-300 relative"
          >
            {/* Image Section */}
            <div className="relative h-28 bg-gradient-to-br from-blue-100 to-purple-200 overflow-hidden">
              <img
                src={(space as any).imageUrl || (space as any).image || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80'}
                alt={space.title || 'Parking space'}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"></div>
              
              {/* Price Badge (supports discount display) */}
              <div className="absolute top-2 right-2 bg-white/95 backdrop-blur-sm px-3 py-2 rounded-lg shadow-lg border border-white/20 flex items-center gap-3">
                {hasDiscount ? (
                  <div className="flex flex-col items-end">
                    <div className="text-xs text-gray-400 line-through leading-none">{formatPrice(basePrice, false)}</div>
                    <div className="text-lg font-bold text-green-700 leading-none">{formatPrice(discountedPrice, true)}</div>
                    <div className="text-xs text-gray-500">/hr</div>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-1">
                    <span className="font-bold text-blue-600">{formatPrice(basePrice, false)}</span>
                    <span className="text-xs text-gray-500">/hr</span>
                  </div>
                )}

                {hasDiscount && (
                  <div className="ml-2 text-xs font-semibold bg-gradient-to-r from-green-500 to-emerald-600 text-white px-2 py-0.5 rounded">
                    {discountPercent}% OFF
                  </div>
                )}
              </div>

              {/* Rating Badge */}
              {rating > 0 && (
                <div className="absolute top-2 left-2 bg-black/80 text-white px-2 py-1 rounded-full flex items-center text-xs shadow-lg">
                  <FaStar className="text-yellow-400 mr-1" />
                  <span className="font-semibold">{rating.toFixed(1)}</span>
                </div>
              )}

              {/* Available Spaces */}
              <div className="absolute bottom-2 left-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-2 py-1 rounded-full text-xs font-semibold shadow-lg">
                {availableSpaces} spot{availableSpaces !== 1 ? 's' : ''} available
              </div>
            </div>

            {/* Content Section */}
            <div className="p-3">
              {/* Title and Location */}
              <div className="mb-2">
                <h3 className="font-bold text-gray-900 text-base leading-tight mb-1 line-clamp-2 min-h-[2rem]">
                  {space.title || 'Premium Parking Space'}
                </h3>
                <div className="flex items-start text-gray-600 text-xs">
                  <FaMapMarkerAlt className="text-red-500 mr-1 mt-0.5 flex-shrink-0" />
                  <span className="leading-relaxed">{street}, {city}</span>
                </div>
              </div>

              {/* Amenities */}
              {amenities.length > 0 && (
                <div className="mb-2">
                  <div className="flex flex-wrap gap-1">
                    {amenities.slice(0, 3).map((amenity, idx) => {
                      const AmenityIcon = getAmenityIcon(amenity);
                      return (
                        <span
                          key={idx}
                          className="inline-flex items-center px-2 py-0.5 bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 rounded-full text-xs font-medium border border-blue-200"
                          title={amenity}
                        >
                          <AmenityIcon className="mr-1 text-xs" />
                          {amenity.length > 10 ? amenity.substring(0, 8) + '...' : amenity}
                        </span>
                      );
                    })}
                    {amenities.length > 3 && (
                      <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                        +{amenities.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <div className="flex items-center text-xs text-gray-500">
                  <span className="flex items-center mr-2 bg-gray-100 px-1.5 py-0.5 rounded-full">
                    <FaClock className="mr-0.5 text-blue-500 text-xs" />
                    {(space as any).available24_7 ? '24/7' : 'Limited hrs'}
                  </span>
                </div>
                
                <div className="text-right">
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
            </div>

            {/* Hover Effect Border */}
            <div className="absolute inset-0 border-2 border-transparent group-hover:border-blue-300 rounded-xl pointer-events-none transition-all duration-300"></div>
          </div>
        );
      })}
    </div>
  );
}
