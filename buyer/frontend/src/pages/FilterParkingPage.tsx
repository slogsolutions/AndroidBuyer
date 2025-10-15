import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { parkingService } from "../services/parking.service";
import ParkingSpaceList from "../components/parking/ParkingSpaceList";

export default function FilterParkingPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [filters, setFilters] = useState(location.state?.filters || {});
  const [parkingSpaces, setParkingSpaces] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFilteredParkingSpaces(filters);
  }, [filters]);

  const fetchFilteredParkingSpaces = async (filters: any) => {
    try {
      setLoading(true);
      const spaces = await parkingService.getFilteredSpaces(filters);
      setParkingSpaces(spaces);
    } catch (error) {
      toast.error("Failed to fetch parking spaces.");
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (newFilters: any) => {
    setFilters(newFilters);
    fetchFilteredParkingSpaces(newFilters);
  };

  if (loading) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <button
        onClick={() => navigate(-1)}
        className="bg-blue-600 text-white px-4 py-2 rounded mb-4"
      >
        Go Back
      </button>
      <h1 className="text-2xl font-bold mb-4">Filtered Parking Spaces</h1>

      {/* ParkingSpaceList Component */}
      <ParkingSpaceList
        spaces={parkingSpaces}
        onSpaceSelect={(space) => navigate(`/space/${space._id}`)}
      />
    </div>
  );
}
