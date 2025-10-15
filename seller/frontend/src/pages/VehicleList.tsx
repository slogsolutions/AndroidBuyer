import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Trash2 } from 'lucide-react'; // Importing icons from lucid-react

const VehicleList = () => {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        const token = localStorage.getItem('token'); // Assuming token is stored in localStorage
        const response = await axios.get(`${import.meta.env.VITE_BASE_URL}/api/booking/data/vehicles`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setVehicles(response.data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to fetch vehicles.');
      } finally {
        setLoading(false);
      }
    };

    fetchVehicles();
  }, []);

  // Function to delete a vehicle
  const deleteVehicle = async (vehicleId: string) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${import.meta.env.VITE_BASE_URL}/api/booking/data/vehicles/${vehicleId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Remove the deleted vehicle from the state
      setVehicles((prevVehicles) => prevVehicles.filter((vehicle) => vehicle._id !== vehicleId));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete vehicle.');
    }
  };

  if (loading) {
    return <div className="text-center text-gray-600">Loading vehicle details...</div>;
  }

  if (error) {
    return <div className="text-center text-red-500">{error}</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h2 className="text-3xl font-bold text-center mb-8 text-gray-800">Vehicle Details</h2>
      {vehicles.length === 0 ? (
        <p className="text-center text-gray-500">No vehicles found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {vehicles.map((vehicle) => (
            <div
              key={vehicle._id}
              className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
            >
              <h3 className="text-2xl font-semibold text-gray-800 mb-3">{vehicle.make} {vehicle.model}</h3>
              <div className="space-y-3">
                <p className="text-gray-700"><strong>Year:</strong> {vehicle.year}</p>
                <p className="text-gray-700"><strong>License Plate:</strong> {vehicle.licensePlate}</p>
                <p className="text-gray-700"><strong>Chassis Number:</strong> {vehicle.chassisNumber}</p>
                <p className="text-gray-700">
                  <strong>Registration Date:</strong> {new Date(vehicle.registrationDate).toLocaleDateString()}
                </p>
              </div>
              <div className="mt-4 flex justify-between space-x-4">
                <button
                  onClick={() => deleteVehicle(vehicle._id)}
                  className="bg-red-500 text-white py-2 px-4 rounded-md hover:bg-red-600 transition-all flex items-center space-x-2 w-full"
                >
                  <Trash2 size={18} />
                  <span>Delete Vehicle</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VehicleList;