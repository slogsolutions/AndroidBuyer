// src/components/search/FindParking.tsx
import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Map, Source, Layer } from 'react-map-gl';
import { parkingService } from '../../services/parking.service';
import Loader from '../../pages/LoadingScreen';
import { useAuth } from '../../context/AuthContext';
const socket = io(import.meta.env.VITE_SOCKET_URL || '');

export default function FindParking({ requirePhoneVerification }: FindParkingProps) {
  const [location, setLocation] = useState('');
  const [filters, setFilters] = useState<string[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<any[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<any | null>(null);
  const { user } = useAuth();
  const [viewport, setViewport] = useState({
    latitude: 0,
    longitude: 0,
    zoom: 12,
  });

  // Get user's current location
  const getCurrentLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userCoords = { lat: position.coords.latitude, lng: position.coords.longitude };
        setCoords(userCoords);
        setLocation('Current Location');
        setViewport({
          latitude: userCoords.lat,
          longitude: userCoords.lng,
          zoom: 12,
        });
      },
      (error) => alert('Failed to get location')
    );
  };

  // If user clicks Search (explicit), call nearby
  const handleSearch = async () => {
    if (!coords) {
      alert('Please enter a location or use "Find My Location"');
      return;
    }

    setLoading(true);

    try {
      // ✅ Fetch ALL spaces instead of nearby with radius
      const results = await parkingService.getAllSpaces();

      setProviders(results);

      socket.emit('notify-nearby-providers', {
        userLat: coords.lat,
        userLng: coords.lng,
        userId: user?._id,
        userName: user?.name,
        userVehicle: user?.vehicle || 'Unknown Vehicle',
        userContact: user?.phone || 'No Contact Info',
      });
    } catch (error) {
      console.error('Error fetching parking spots:', error);
    }

    setLoading(false);
  };

  // On mount: if there is no explicit search or coords, fetch ALL spaces so markers show across map
  useEffect(() => {
    let cancelled = false;
    const loadAll = async () => {
      try {
        setLoading(true);
        const all = await parkingService.getAllSpaces();
        if (!cancelled) setProviders(all || []);
      } catch (err) {
        console.warn('Failed to fetch all parking spaces on mount', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadAll();
    return () => {
      cancelled = true;
    };
  }, []);

  // Listen for provider acceptance
  useEffect(() => {
    socket.on('provider-accepted', (providerData: any) => {
      setSelectedProvider(providerData);
    });
    return () => {
      socket.off('provider-accepted');
    };
  }, []);

  // Listen for parking availability updates from backend and update providers state
  useEffect(() => {
    const handleParkingUpdate = (data: { parkingId?: string; availableSpots?: number } | any) => {
      if (!data) return;
      const parkingId = data.parkingId || data._id || data.id;
      const availableSpots = typeof data.availableSpots === 'number' ? data.availableSpots : data.available || data.availableSpots;
      if (!parkingId || typeof availableSpots !== 'number') return;

      setProviders((prev) =>
        prev.map((p) => {
          // compare both string and object id cases
          const pid = p._id ? (typeof p._id === 'string' ? p._id : String(p._id)) : (p.id || '');
          if (pid === parkingId.toString()) {
            return { ...p, availableSpots };
          }
          return p;
        })
      );
    };

    socket.on('parking-updated', handleParkingUpdate);
    socket.on('parking-released', handleParkingUpdate);

    return () => {
      socket.off('parking-updated', handleParkingUpdate);
      socket.off('parking-released', handleParkingUpdate);
    };
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Find Parking</h2>

      <div className="flex gap-2">
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Enter location"
          className="border rounded px-3 py-2 flex-1"
        />
        <button onClick={getCurrentLocation} className="bg-blue-600 text-white px-4 py-2 rounded">Find My Location</button>
      </div>

      <button className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded" onClick={handleSearch}>
        Search
      </button>

      {loading && <Loader />}

      <div className="mt-6" style={{ height: '400px', width: '100%' }}>
        <Map
          {...viewport}
          onMove={(evt) => setViewport(evt.viewState)}
          mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN || ''}
          style={{ width: '100%', height: '100%' }}
          mapStyle="mapbox://styles/mapbox/streets-v11"
        >
          {providers.map((provider) => (
            <Source key={provider._id} type="geojson" data={{
              type: 'FeatureCollection',
              features: [{
                type: 'Feature',
                geometry: {
                  type: 'Point',
                  coordinates: [provider.location.coordinates[0], provider.location.coordinates[1]],
                },
                properties: {
                  title: provider.title,
                },
              }],
            }}>
              <Layer
                id={`marker-${provider._id}`}
                type="symbol"
                layout={{
                  'icon-image': 'marker-15',
                  'icon-size': 1.5,
                }}
              />
            </Source>
          ))}
        </Map>
      </div>

      {selectedProvider && (
        <div className="mt-6 border p-4 rounded">
          <h3 className="text-lg font-bold">Provider Details</h3>
          <p>Name: {selectedProvider.name}</p>
          <p>Location: {selectedProvider.location}</p>
          <button className="mt-4 bg-green-500 text-white px-4 py-2 rounded">Pay Now</button>
        </div>
      )}
    </div>
  );
}
