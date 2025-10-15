// src/pages/Favorite.tsx
import React, { useEffect, useState } from 'react';
import Map from 'react-map-gl';
import { toast } from 'react-toastify';
import type { ParkingSpace } from '../types/parking';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMapContext } from '../context/MapContext';
import { parkingService } from '../services/parking.service';
import ParkingMarker from '../components/map/ParkingMarker';
import axios from 'axios';
import { FaParking } from 'react-icons/fa';
import ParkingSpaceList from '../components/parking/ParkingSpaceList';
import FilterBox from './Filterbox';
import { useAuth } from '../context/AuthContext';

export default function Favorite() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const { viewport, setViewport } = useMapContext();
  const [parkingSpaces, setParkingSpaces] = useState<ParkingSpace[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<ParkingSpace | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [searchedLocation, setSearchedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const { user } = useAuth();
  const [filters, setFilters] = useState({
    amenities: {
      covered: false,
      security: false,
      charging: false,
      cctv: false,
      wheelchair: false,
    },
    priceRange: [0, 500],
  });

  // If URL contains lat/lng -> fetch nearby for that location.
  useEffect(() => {
    const params = new URLSearchParams(search);
    const lat = params.get('lat') ? parseFloat(params.get('lat')!) : null;
    const lng = params.get('lng') ? parseFloat(params.get('lng')!) : null;

    if (lat && lng) {
      setViewport({ ...viewport, latitude: lat, longitude: lng, zoom: 15 });
      setCurrentLocation({ lat, lng });
      fetchNearbyParkingSpaces(lat, lng);
    } else {
      // No specific query params -> fetch ALL spaces so map displays full dataset
      (async () => {
        try {
          const all = await parkingService.getAllSpaces();
          setParkingSpaces(all || []);
        } catch (err) {
          console.warn('Failed to load all parking spaces in Favorite', err);
          // fallback: nothing
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const fetchNearbyParkingSpaces = async (lat: number, lng: number) => {
    try {
      const spaces = await parkingService.getNearbySpaces(lat, lng, 15000);
      setParkingSpaces(spaces);
    } catch (error) {
      toast.error('Failed to fetch parking spaces.');
    }
  };

  const fetchRoute = async (originLat: number, originLng: number, destLat: number, destLng: number) => {
    try {
      const response = await axios.get(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${originLng},${originLat};${destLng},${destLat}`,
        {
          params: {
            alternatives: false,
            geometries: 'geojson',
            overview: 'full',
            steps: true,
            access_token: import.meta.env.VITE_MAPBOX_TOKEN || '',
          },
        }
      );
      // use response...
    } catch (error) {
      toast.error('Failed to fetch route.');
    }
  };

  const handleMarkerClick = async (space: ParkingSpace) => {
    setSelectedSpace(space);
    if (currentLocation) {
      const { lat: originLat, lng: originLng } = currentLocation;
      const [destLng, destLat] = space.location.coordinates;
      await fetchRoute(originLat, originLng, destLat, destLng);
    }
  };

  return (
    <div className="h-[calc(100vh-64px)] relative">
      <FilterBox filters={filters} onFilterChange={setFilters} />

      <Map
        {...viewport}
        onMove={(evt) => setViewport(evt.viewState)}
        mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN || ''}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/streets-v11"
      >
        {parkingSpaces.map((space) => (
          <ParkingMarker
            key={typeof space._id === 'object' ? String((space._id as any)) : space._id}
            space={space}
            latitude={space.location.coordinates[1]}
            longitude={space.location.coordinates[0]}
            onClick={() => handleMarkerClick(space)}
            color="green"
            icon={FaParking}
          />
        ))}
      </Map>

      <ParkingSpaceList
        spaces={parkingSpaces}onSpaceSelect={(space) => {
          navigate('/parking-details', { state: { space, user } });
        }}
        filters={filters}
        userLocation={selectedSpace || currentLocation}
      />
    </div>
  );
}