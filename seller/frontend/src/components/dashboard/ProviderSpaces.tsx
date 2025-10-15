import React, { useEffect, useState } from 'react';
import axios from 'axios';
import LoadingScreen from '../../pages/LoadingScreen';
import parkingService from '../../services/parking.service';
import { 
  MapPin, 
  Star, 
  DollarSign, 
  Clock, 
  Shield, 
  Car, 
  Wifi,
  Power,
  Trash2,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';

interface Location {
  _id: string;
  title: string;
  latitude: number;
  longitude: number;
  address: string;
  description: string;
  pricePerHour: number;
  availability: any[];
  amenities: string[];
  rating: number;
  priceParking: number;
  availableSpots: number;
  status: string;
  isOnline: boolean;
}

const ProviderLocations: React.FC = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        setLoading(true);
        const response = await axios.get(
          `${import.meta.env.VITE_BASE_URL}/api/parking/my-spaces`,
          {
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          }
        );

        console.log('API Response:', response.data);

        const locations = response.data.map((item: any) => ({
          _id: item._id,
          title: item.title,
          latitude: item.location.coordinates[1],
          longitude: item.location.coordinates[0],
          address: `${item.address.street}, ${item.address.city}, ${item.address.state}, ${item.address.zipCode}, ${item.address.country}`,
          description: item.description,
          pricePerHour: item.pricePerHour,
          availability: item.availability,
          amenities: item.amenities,
          rating: item.rating,
          priceParking: item.priceParking,
          availableSpots: item.availableSpots,
          status: item.status,
          isOnline: item.isOnline ?? false,
        }));

        setLocations(locations);
      } catch (err) {
        console.error('Error fetching locations:', err);
        setLocations([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLocations();
  }, []);

  // ✅ Optimistic update with safe server fallback (fixes snap-back)
  const handleToggleOnline = async (id: string, current: boolean) => {
    const desired = !current;

    // update UI immediately (optimistic)
    setLocations((prev) =>
      prev.map((loc) =>
        loc._id === id ? { ...loc, isOnline: desired } : loc
      )
    );

    try {
      const updated = await parkingService.toggleOnline(id, desired);

      // If server returns a valid boolean for isOnline, use it.
      // Otherwise keep the optimistic value (desired).
      const serverValue = updated && typeof updated.isOnline === 'boolean'
        ? updated.isOnline
        : desired;

      setLocations((prev) =>
        prev.map((loc) =>
          loc._id === id ? { ...loc, isOnline: serverValue } : loc
        )
      );
    } catch (err) {
      console.error('Failed to toggle online status:', err);
      const msg =
        (err as any)?.response?.data?.message ||
        (err as any)?.message ||
        'Could not update online status';
      alert(msg);

      // rollback change if failed
      setLocations((prev) =>
        prev.map((loc) =>
          loc._id === id ? { ...loc, isOnline: current } : loc
        )
      );
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this space?')) return;
    try {
      await parkingService.deleteSpace(id);
      setLocations((prev) => prev.filter((loc) => loc._id !== id));
    } catch (err) {
      console.error('Failed to delete space:', err);
      alert('Could not delete space');
    }
  };

  const getAmenityIcon = (amenity: string) => {
    const amenityLower = amenity.toLowerCase();
    if (amenityLower.includes('covered') || amenityLower.includes('roof')) return <Shield className="h-3.5 w-3.5" />;
    if (amenityLower.includes('security')) return <Shield className="h-3.5 w-3.5" />;
    if (amenityLower.includes('wifi')) return <Wifi className="h-3.5 w-3.5" />;
    if (amenityLower.includes('ev') || amenityLower.includes('charging')) return <Power className="h-3.5 w-3.5" />;
    return <Car className="h-3.5 w-3.5" />;
  };

  if (loading) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <LoadingScreen />
      </div>
    );
  }

  return (
    <div className="w-full p-4 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
            My Parking Spaces
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your parking locations and availability
          </p>
        </div>
        
        {locations.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
            <Car className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-lg text-gray-500 dark:text-gray-400">No parking spaces available.</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              Get started by registering your first parking space
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {locations.map((location) => (
              <div
                key={location._id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow duration-200"
              >
                <div className="p-4">
                  {/* Header */}
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-semibold text-gray-800 dark:text-white text-lg line-clamp-1">
                      {location.title}
                    </h3>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      location.status === 'pending' 
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    }`}>
                      {location.status}
                    </span>
                  </div>

                  {/* Address */}
                  <div className="flex items-start mb-3">
                    <MapPin className="h-4 w-4 text-gray-400 mt-0.5 mr-2 flex-shrink-0" />
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                      {location.address}
                    </p>
                  </div>

                  {/* Description */}
                  {location.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">
                      {location.description}
                    </p>
                  )}

                  {/* Pricing */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2">
                      <div className="flex items-center text-blue-700 dark:text-blue-300 mb-1">
                        <DollarSign className="h-3.5 w-3.5 mr-1" />
                        <span className="text-xs font-medium">Regular</span>
                      </div>
                      <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                        ₹{location.priceParking}/hr
                      </p>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-2">
                      <div className="flex items-center text-orange-700 dark:text-orange-300 mb-1">
                        <Clock className="h-3.5 w-3.5 mr-1" />
                        <span className="text-xs font-medium">Overtime</span>
                      </div>
                      <p className="text-sm font-semibold text-orange-800 dark:text-orange-200">
                        ₹{location.pricePerHour}/hr
                      </p>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      <Star className="h-4 w-4 text-yellow-500 mr-1" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {location.rating}/5
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        {location.availableSpots}
                      </span> spots available
                    </div>
                  </div>

                  {/* Amenities */}
                  {location.amenities && location.amenities.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center mb-2">
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          Amenities
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {location.amenities.map((amenity, index) => (
                          <div
                            key={index}
                            className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                          >
                            {getAmenityIcon(amenity)}
                            <span className="text-xs ml-1">{amenity}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => handleToggleOnline(location._id, location.isOnline)}
                      className={`flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200 ${
                        location.isOnline
                          ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300 dark:hover:bg-green-800'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      {location.isOnline ? (
                        <ToggleRight className="h-4 w-4 mr-1.5" />
                      ) : (
                        <ToggleLeft className="h-4 w-4 mr-1.5" />
                      )}
                      {location.isOnline ? 'Online' : 'Offline'}
                    </button>
                    
                    <button
                      onClick={() => handleDelete(location._id)}
                      className="flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 transition-colors duration-200"
                    >
                      <Trash2 className="h-4 w-4 mr-1.5" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProviderLocations;
