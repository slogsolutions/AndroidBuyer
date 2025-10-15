import React, { useEffect, useState } from "react";
import api from "../utils/api";
import { motion, AnimatePresence } from "framer-motion";

// Status type definitions
type SpaceStatus = "pending" | "approved" | "rejected";
type FilterStatus = SpaceStatus | "all";



interface ParkingSpace {
  _id: string;
  title: string;
  description: string;
  address?: {
    city: string;
    street?: string;
    state?: string;
  };
  priceParking: number;
  status: SpaceStatus | "submitted"; // allow backend raw value during fetch
  createdAt?: string;
  images?: string[];
}

export default function CaptainDashboard() {
  const [spaces, setSpaces] = useState<ParkingSpace[]>([]);
  const [filteredSpaces, setFilteredSpaces] = useState<ParkingSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSpace, setSelectedSpace] = useState<ParkingSpace | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterStatus>("all");
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0
  });

  const fetchSpaces = async () => {
    setLoading(true);
    try {
      const res = await api.get("/captain/parkingspaces");
      const allSpaces: ParkingSpace[] = res.data.spaces || res.data || [];

      // Map backend status -> frontend status
      const mappedSpaces: ParkingSpace[] = allSpaces.map((space) => ({
        ...space,
        status: (space.status === "submitted" ? "approved" : space.status) as SpaceStatus
      }));

      setSpaces(mappedSpaces);

      // Stats from mapped statuses
      setStats({
        total: mappedSpaces.length,
        pending: mappedSpaces.filter((s) => s.status === "pending").length,
        approved: mappedSpaces.filter((s) => s.status === "approved").length,
        rejected: mappedSpaces.filter((s) => s.status === "rejected").length
      });
    } catch (err) {
      console.error("Error fetching captain spaces:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpaces();
  }, []);

  useEffect(() => {
    if (activeFilter === "all") setFilteredSpaces(spaces);
    else setFilteredSpaces(spaces.filter((s) => s.status === activeFilter));
  }, [spaces, activeFilter]);

  const updateStatus = async (spaceId: string, status: "approved" | "rejected") => {
    try {
      // Map frontend approved -> backend submitted
      const backendStatus = status === "approved" ? "submitted" : status;
      await api.patch(`/captain/parkingspaces/${spaceId}/status`, { status: backendStatus });
      await fetchSpaces();
    } catch (err) {
      console.error("Failed to update status", err);
      throw err;
    }
  };

  const getStatusColor = (status: SpaceStatus) => {
    switch (status) {
      case "approved":
        return "bg-gradient-to-r from-green-500 to-emerald-600";
      case "rejected":
        return "bg-gradient-to-r from-red-500 to-rose-600";
      case "pending":
        return "bg-gradient-to-r from-yellow-500 to-amber-600";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusIcon = (status: SpaceStatus) => {
    switch (status) {
      case "approved":
        return "✅";
      case "rejected":
        return "❌";
      case "pending":
        return "⏳";
      default:
        return "📦";
    }
  };

  // Stats Card
  const StatsCard = ({ title, value, color, icon }: { title: string; value: number; color: string; icon: string }) => (
    <motion.div whileHover={{ scale: 1.05, y: -5 }} className={`p-6 rounded-2xl ${color} text-white shadow-lg`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm opacity-90">{title}</p>
          <p className="text-3xl font-bold">{value}</p>
        </div>
        <span className="text-2xl">{icon}</span>
      </div>
    </motion.div>
  );

  // Filter Button
  const FilterButton = ({ status, count, isActive }: { status: FilterStatus; count: number; isActive: boolean }) => (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => setActiveFilter(status)}
      className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
        isActive ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      }`}
    >
      {status === "all" ? "All Spaces" : status.charAt(0).toUpperCase() + status.slice(1)}
      <span className={`ml-2 px-2 py-1 rounded-full text-xs ${isActive ? "bg-white text-blue-600" : "bg-gray-300 text-gray-700"}`}>{count}</span>
    </motion.button>
  );

  // Space Card
  const SpaceCard = ({ space }: { space: ParkingSpace }) => {
    const label = (space.status as SpaceStatus).toUpperCase();
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.02 }}
        className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 h-full"
      >
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-bold text-gray-800 truncate">{space.title}</h3>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${getStatusColor(space.status as SpaceStatus)}`}>
            {getStatusIcon(space.status as SpaceStatus)} {label}
          </span>
        </div>

        <p className="text-gray-600 mb-4 line-clamp-2">{space.description}</p>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex items-center text-gray-500">
            <span className="mr-2">🏙️</span>
            <span className="text-sm">{space.address?.city || "Unknown City"}</span>
          </div>
          <div className="flex items-center text-gray-500">
            <span className="mr-2">💰</span>
            <span className="text-sm">₹{space.priceParking}/hour</span>
          </div>
        </div>

        <div className="flex gap-2 mt-auto">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSelectedSpace(space)}
            className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white py-2 rounded-xl font-semibold hover:shadow-lg transition-all duration-300"
          >
            Review Details
          </motion.button>
        </div>
      </motion.div>
    );
  };

  // Modal
  const CaptainApproveModal = ({ space, onClose }: { space: ParkingSpace; onClose: () => void }) => {
    const [updating, setUpdating] = useState(false);

    const handleStatusUpdate = async (status: "approved" | "rejected") => {
      setUpdating(true);
      try {
        await updateStatus(space._id, status);
        onClose();
      } catch (err) {
        console.error("Error updating status:", err);
        alert("Failed to update status");
      } finally {
        setUpdating(false);
      }
    };

    const currentStatusLabel = (space.status as SpaceStatus).toUpperCase();

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-3xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-gray-800">Review Parking Space</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-500">Title</label>
                <p className="text-lg font-semibold text-gray-800">{space.title}</p>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-500">Description</label>
                <p className="text-gray-700">{space.description}</p>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-500">Location</label>
                <p className="text-gray-700">
                  🏙️ {space.address?.city || "Unknown City"}
                  {space.address?.street && `, ${space.address.street}`}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-500">Price</label>
                <p className="text-2xl font-bold text-green-600">₹{space.priceParking}/hour</p>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-500">Current Status</label>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold text-white ${getStatusColor(space.status as SpaceStatus)}`}>
                  {currentStatusLabel}
                </span>
              </div>

              {space.createdAt && (
                <div>
                  <label className="text-sm font-semibold text-gray-500">Submitted</label>
                  <p className="text-gray-700">{new Date(space.createdAt).toLocaleDateString()}</p>
                </div>
              )}
            </div>
          </div>

          {space.status === "pending" && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-6">
              <p className="text-yellow-800 text-sm font-semibold">⚠️ This space is awaiting your approval. Please review the details carefully.</p>
            </div>
          )}

          <div className="flex gap-3">
            {space.status === "pending" ? (
              <>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleStatusUpdate("approved")}
                  disabled={updating}
                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 rounded-xl font-bold text-lg hover:shadow-lg transition-all duration-300 disabled:opacity-50"
                >
                  {updating ? "Approving..." : "✅ Approve Space"}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleStatusUpdate("rejected")}
                  disabled={updating}
                  className="flex-1 bg-gradient-to-r from-red-500 to-rose-600 text-white py-4 rounded-xl font-bold text-lg hover:shadow-lg transition-all duration-300 disabled:opacity-50"
                >
                  {updating ? "Rejecting..." : "❌ Reject Space"}
                </motion.button>
              </>
            ) : (
              <button onClick={onClose} className="flex-1 bg-gradient-to-r from-gray-500 to-gray-600 text-white py-4 rounded-xl font-bold text-lg hover:shadow-lg transition-all duration-300">
                Close Review
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Captain Dashboard
          </h1>
          <p className="text-gray-600 text-lg">Manage and review parking space submissions</p>
        </motion.div>

        {/* Stats */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatsCard title="Total Spaces" value={stats.total} color="bg-gradient-to-r from-blue-500 to-cyan-500" icon="📊" />
          <StatsCard title="Pending Review" value={stats.pending} color="bg-gradient-to-r from-yellow-500 to-amber-500" icon="⏳" />
          <StatsCard title="Approved" value={stats.approved} color="bg-gradient-to-r from-green-500 to-emerald-500" icon="✅" />
          <StatsCard title="Rejected" value={stats.rejected} color="bg-gradient-to-r from-red-500 to-rose-500" icon="❌" />
        </motion.div>

        {/* Filters */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="flex flex-wrap gap-3 mb-8 justify-center">
          <FilterButton status="all" count={stats.total} isActive={activeFilter === "all"} />
          <FilterButton status="pending" count={stats.pending} isActive={activeFilter === "pending"} />
          <FilterButton status="approved" count={stats.approved} isActive={activeFilter === "approved"} />
          <FilterButton status="rejected" count={stats.rejected} isActive={activeFilter === "rejected"} />
        </motion.div>

        {/* Loading */}
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </motion.div>
        )}

        {/* Grid */}
        {!loading && (
          <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
            <AnimatePresence mode="popLayout">
              {filteredSpaces.map((space) => (
                <motion.div
                  key={space._id}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, margin: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <SpaceCard space={space} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Empty state */}
        {!loading && filteredSpaces.length === 0 && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-12">
            <div className="text-6xl mb-4">🏢</div>
            <h3 className="text-2xl font-bold text-gray-600 mb-2">
              {activeFilter === "all" ? "No Spaces Found" : `No ${activeFilter} Spaces`}
            </h3>
            <p className="text-gray-500">
              {activeFilter === "all"
                ? "There are no parking spaces to display."
                : `There are no ${activeFilter} parking spaces at the moment.`}
            </p>
          </motion.div>
        )}

        {/* Modal */}
        <AnimatePresence>{selectedSpace && <CaptainApproveModal space={selectedSpace} onClose={() => setSelectedSpace(null)} />}</AnimatePresence>
      </div>
    </div>
  );
}
