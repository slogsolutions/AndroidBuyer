import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
// ⬇️ Alias the User type to avoid any ambiguity with the icon
import type { ParkingSpace, User as AppUser } from '@/types/parking';
import { toast } from 'react-toastify';
import { 
  Car, 
  Shield, 
  Camera, 
  Wifi, 
  Umbrella, 
  Zap,
  MapPin,
  Clock,
  User as UserIcon, // ✅ keep icon aliased
  Star,
  Map
} from 'lucide-react';
import { FaMoneyCheck } from 'react-icons/fa';
import { useSocket } from '../context/SocketContext';

const amenityIcons: Record<string, React.ReactNode> = {
  Security: <Shield className="w-4 h-4" />,
  CCTV: <Camera className="w-4 h-4" />,
  WiFi: <Wifi className="w-4 h-4" />,
  Covered: <Umbrella className="w-4 h-4" />,
  'EV Charging': <Zap className="w-4 h-4" />,
  'Car Wash': <Car className="w-4 h-4" />,
};

export default function ParkingDetails() {
  const location = useLocation();
  const navigate = useNavigate();
  const socket = useSocket();

  const { state } = location as { state?: { space?: ParkingSpace; user?: AppUser } };
  const initialSpace = state?.space;
  const user = state?.user;

  const [space, setSpace] = useState<ParkingSpace | undefined>(initialSpace);

  useEffect(() => {
    setSpace(initialSpace);
  }, [initialSpace]);

  useEffect(() => {
    if (!socket || !space) return;

    const handleParkingUpdate = (data: any) => {
      const parkingId = data.parkingId || data._id || data.id;
      const availableSpots =
        typeof data.availableSpots === 'number'
          ? data.availableSpots
          : data.available ?? data.availableSpots;

      if (!parkingId || typeof availableSpots !== 'number') return;

      const sid =
        space._id && typeof space._id === 'object' && (space._id as any).toString
          ? (space._id as any).toString()
          : (space._id as any);

      if (String(parkingId) === String(sid)) {
        setSpace(prev => (prev ? { ...prev, availableSpots } : prev));
      }
    };

    socket.on('parking-updated', handleParkingUpdate);
    socket.on('parking-released', handleParkingUpdate);
    return () => {
      socket.off('parking-updated', handleParkingUpdate);
      socket.off('parking-released', handleParkingUpdate);
    };
  }, [socket, space]);

  if (!space) return <div>Parking space details not found.</div>;

  const address = space.address || {};
  const street = address.street || 'No street information';
  const city = address.city || 'No city information';
  const stateName = address.state || 'No state information';
  const country = address.country || 'No country information';
  const zipCode = address.zipCode || 'No zip code';

  const handleBookNow = () => {
    if (!user) {
      toast.info('Please log in to book the parking space.');
      return;
    }
    if (!user.isVerified) {
      toast.info('Your account is not verified. Please complete your verification to book the parking space.');
      return;
    }

    const sid =
      space._id && typeof space._id === 'object' && (space._id as any).toString
        ? (space._id as any).toString()
        : (space._id as any);

    // ⬇️ Remove undefined variable `userId`; use _id or id safely
    const uidRaw = (user as any)._id ?? (user as any).id;
    if (!uidRaw) {
      toast.error('Could not determine your user ID.');
      return;
    }
    const uid = String(uidRaw);

    navigate('/vehicle-details', { state: { spaceId: String(sid), userId: uid } });
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="w-full h-48 relative">
            <img
              src={
                space.imageUrl ||
                'https://plus.unsplash.com/premium_photo-1673886205989-24c637783c60?q=80&w=1470&auto=format&fit=crop&ixlib=rb-4.0.3'
              }
              alt={space.title}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="p-4">
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-gray-800">{space.title}</h1>
              <div className="flex items-center text-gray-600">
                <MapPin className="w-4 h-4 mr-1" />
                <p className="text-sm">
                  {street}, {city}, {stateName}, {country} - {zipCode}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center text-red-600">
                <span className="text-lg font-bold">₹{space.pricePerHour}</span>
                <span className="text-sm ml-1">/hour</span>
              </div>

              <div className="flex items-center text-gray-600 mt-2">
                <FaMoneyCheck className="w-4 h-4 mr-1 text-red-500" />
                <span className="text-sm">Extra Price: {space.priceParking}</span>
              </div>

              <div className="flex items-center text-red-600">
                <Clock className="w-4 h-4 mr-1" />
                <span className="text-sm">{space.availableSpots} spots available</span>
              </div>
            </div>

            <div className="flex items-center text-gray-600 mt-2">
              <Map className="w-4 h-4 mr-1" />
              <span className="text-sm">{(space.distance ?? 0).toFixed(2)} km away</span>
            </div>

            {/* ⬇️ Use the icon alias here */}
            <div className="flex items-center text-gray-600 mt-2">
              <UserIcon className="w-4 h-4 mr-1" />
              <span className="text-sm">Owner: {space.owner?.name || 'Unknown'}</span>
            </div>

            <div className="flex items-center text-gray-600 mt-2">
              <Star className="w-4 h-4 mr-1 text-red-500" />
              <span className="text-sm">Rating: {space.rating} / 5</span>
            </div>

            <p className="text-sm text-gray-600 mt-3">{space.description}</p>

            {space.amenities?.length ? (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Amenities</h4>
                <div className="grid grid-cols-3 gap-2">
                  {space.amenities.map((amenity) => (
                    <div key={amenity} className="flex items-center space-x-1 bg-gray-50 rounded p-2">
                      <span className="text-red-600">
                        {amenityIcons[amenity] || <Shield className="w-4 h-4" />}
                      </span>
                      <span className="text-xs text-gray-600">{amenity}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <button
              onClick={handleBookNow}
              className="mt-4 w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors duration-200 flex items-center justify-center space-x-2"
            >
              <Car className="w-4 h-4" />
              <span>Book Now</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
