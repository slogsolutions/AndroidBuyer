// src/components/search/LocationSearch.tsx
import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { MdGpsFixed } from 'react-icons/md';
import type { searchLocation, GeocodingResult } from '../../utils/geocoding';

interface LocationSearchBoxProps {
  onLocationSelect: (location: GeocodingResult) => void;
  onGoToCurrentLocation: () => void;
}

const LocationSearchBox = ({ onLocationSelect, onGoToCurrentLocation }: LocationSearchBoxProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const searchTimer = setTimeout(async () => {
      if (query.length > 2) {
        setIsLoading(true);
        try {
          const locations = await searchLocation(query);
          setResults(locations);
        } catch {
          setResults([]);
        } finally {
          setIsLoading(false);
        }
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(searchTimer);
  }, [query]);

  const handleClearSearch = () => {
    setQuery('');
    setResults([]);
  };

  return (
    // Make this a centered, responsive block. Dropdown will be absolutely positioned relative to this.
    <div className="relative w-full max-w-xl mx-auto">
      <div className="flex items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-grow">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search location..."
            className="w-full px-4 py-3 pl-10 pr-12 text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-red-400 focus:outline-none"
            aria-label="Search location"
          />
          {query.length > 0 ? (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-3 top-3 text-gray-500 hover:text-gray-700"
              aria-label="Clear search"
            >
              <X className="h-5 w-5" />
            </button>
          ) : (
            <Search className="absolute left-3 top-3 text-gray-400" />
          )}
        </div>

        {/* Go to Current Location Button */}
        <button
          onClick={onGoToCurrentLocation}
          className="flex items-center gap-2 bg-red-600 text-white px-3 py-2 rounded-lg shadow hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-300"
          title="Go to current location"
          type="button"
        >
          <MdGpsFixed size={18} />
          {/* small text hidden on very small screens */}
          <span className="hidden sm:inline text-sm">Current</span>
        </button>
      </div>

      {/* Loading Indicator */}
      {isLoading && (
        <div className="absolute left-0 right-0 mt-2 p-2 text-center bg-white rounded-md shadow z-40">
          <span className="text-gray-600">Searching...</span>
        </div>
      )}

      {/* Search Results Dropdown (absolutely positioned relative to wrapper) */}
      {results.length > 0 && !isLoading && (
        <div className="absolute left-0 right-0 mt-2 bg-white rounded-md shadow-lg z-50 max-h-64 overflow-auto border border-gray-100">
          {results.map((result, index) => (
            <button
              key={index}
              className="w-full px-4 py-2 text-left hover:bg-gray-50 focus:outline-none"
              onClick={() => {
                onLocationSelect(result);
                setQuery(result.placeName);
                setResults([]);
              }}
            >
              <div className="text-sm text-gray-800">{result.placeName}</div>
              {result.context && (
                <div className="text-xs text-gray-500 mt-1">{result.context}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LocationSearchBox;
