import React from 'react';
import { CheckCircle, DollarSign, Shield, Plug, Video } from 'lucide-react';

// interface FilterBoxProps {
//   filters: {
//     amenities: { [key: string]: boolean };
//     priceRange: [number, number];
//   };
//   onFilterChange: (filters: any) => void;
// }

interface FilterBoxProps {
  filters: {
    amenities: {
      covered: boolean;
      security: boolean;
      charging: boolean;
      cctv: boolean;
      wheelchair: boolean;
    };
  };
  onFilterChange: (filters: any) => void;
}

const amenitiesList = [
  { id: 'covered', label: 'Covered Parking', icon: CheckCircle },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'charging', label: 'EV Charging', icon: Plug },
  { id: 'cctv', label: 'CCTV Surveillance', icon: Video },
  { id: 'wheelchair', label: 'Wheelchair Access', icon: CheckCircle },
];

export default function FilterBox({ filters, onFilterChange }: FilterBoxProps) {
  if (!filters || !filters.amenities) return null;
  const handleAmenityChange = (amenity: string) => {
    const updatedAmenities = {
      ...filters.amenities,
      [amenity]: !filters.amenities[amenity],
    };
    onFilterChange({ ...filters, amenities: updatedAmenities });
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const updatedPriceRange = [...filters.priceRange];
    updatedPriceRange[index] = Number(e.target.value);
    onFilterChange({ ...filters, priceRange: updatedPriceRange as [number, number] });
  };

  return (
    <div className="fixed top-0 right-0 h-full bg-white shadow-lg z-50 w-80 p-6 transform translate-x-full transition-transform ease-in-out duration-300">
      <h3 className="text-xl font-bold mb-4 flex items-center">
        <DollarSign className="w-6 h-6 text-blue-600 mr-2" />
        Filters
      </h3>

      {/* Amenities */}
      <div className="mb-6">
        <h4 className="font-semibold mb-3">Amenities</h4>
        <div className="grid grid-cols-2 gap-3">
          {amenitiesList.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`flex items-center gap-2 p-2 rounded-lg border transition ${
                filters.amenities[id] ? 'bg-blue-600 text-white' : 'bg-gray-100'
              }`}
              onClick={() => handleAmenityChange(id)}
            >
              <Icon className="w-5 h-5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div>
        <h4 className="font-semibold mb-3">Price Range</h4>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={filters.priceRange[0]}
            onChange={(e) => handlePriceChange(e, 0)}
            className="w-20 border rounded p-2"
            min="0"
          />
          <span>-</span>
          <input
            type="number"
            value={filters.priceRange[1]}
            onChange={(e) => handlePriceChange(e, 1)}
            className="w-20 border rounded p-2"
            min="0"
          />
        </div>
      </div>
    </div>
  );
}
