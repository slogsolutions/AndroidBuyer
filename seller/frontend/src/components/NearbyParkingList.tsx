import React from 'react';
import { Car } from 'lucide-react';

interface ParkingSpace {
  _id: string;
  name: string;
  availableSpots: number;
  totalSpots: number;
  distance?: number;
}

interface NearbyParkingListProps {
  parkingSpaces: ParkingSpace[];
  onSelect: (spaceId: string) => void;
}

const NearbyParkingList = ({ parkingSpaces, onSelect }: NearbyParkingListProps) => {
  return (
    <div className="bg-white shadow-md rounded-lg p-4 max-h-60 overflow-y-auto">
      <h2 className="text-lg font-semibold mb-4">Nearby Parking Spaces</h2>
      {parkingSpaces.length === 0 ? (
        <p className="text-gray-500 text-center">No parking spaces found nearby</p>
      ) : (
        <div className="space-y-3">
          {parkingSpaces.map((space) => (
            <div
              key={space._id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
              onClick={() => onSelect(space._id)}
            >
              <div className="flex items-center space-x-3">
                <Car className="h-5 w-5 text-blue-600" />
                <div>
                  <h3 className="font-medium">{space.name}</h3>
                  <p className="text-sm text-gray-500">
                    {space.distance ? `${space.distance.toFixed(1)} km away` : ''}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium text-blue-600">
                  {space.availableSpots} / {space.totalSpots}
                </p>
                <p className="text-xs text-gray-500">spots available</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NearbyParkingList;