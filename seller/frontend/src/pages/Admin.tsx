import React, { useEffect, useState } from "react";
import api from "../utils/api";
import Notification from "./Notification";

export default function AdminDashboard() {
  const [tab, setTab] = useState("dashboard");
  const [users, setUsers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [spaces, setSpaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dashboardStats, setDashboardStats] = useState({
    totalUsers: 0,
    totalCaptains: 0,
    totalBookings: 0,
    totalSpaces: 0,
    revenue: 0,
    activeBookings: 0,
  });
  
  // Selection states
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectedCaptains, setSelectedCaptains] = useState([]);
  const [selectedBookings, setSelectedBookings] = useState([]);
  const [selectedSpaces, setSelectedSpaces] = useState([]);
  
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [selectedSpace, setSelectedSpace] = useState(null);

  // Filters for users
  const [isVerifiedFilter, setIsVerifiedFilter] = useState(null);
  const [kycStatusFilter, setKycStatusFilter] = useState(null);
  const [stateFilter, setStateFilter] = useState(null);
  const [cityFilter, setCityFilter] = useState(null);

  // Filters for captains (similar, plus region and isCaptain)
  const [captainIsVerifiedFilter, setCaptainIsVerifiedFilter] = useState(null);
  const [captainKycStatusFilter, setCaptainKycStatusFilter] = useState(null);
  const [captainStateFilter, setCaptainStateFilter] = useState(null);
  const [captainCityFilter, setCaptainCityFilter] = useState(null);
  const [regionFilter, setRegionFilter] = useState(null);
  const [isCaptainFilter, setIsCaptainFilter] = useState(null); // New filter: null = All, true = Yes, false = No

  // Filters for bookings
  const [bookingStatusFilter, setBookingStatusFilter] = useState(null);
  const [bookingCityFilter, setBookingCityFilter] = useState(null);

  // Filters for spaces
  const [spaceStatusFilter, setSpaceStatusFilter] = useState(null);
  const [spaceStateFilter, setSpaceStateFilter] = useState(null);
  const [spaceCityFilter, setSpaceCityFilter] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/users");
      setUsers(res.data.users || []);
    } catch (err) {
      console.error("Error fetching users:", err);
      setError(err.response?.data?.error || err.message || "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/bookings");
      setBookings(res.data.bookings || []);
    } catch (err) {
      console.error("Error fetching bookings:", err);
      setError(err.response?.data?.error || err.message || "Failed to fetch bookings");
    } finally {
      setLoading(false);
    }
  };

  const fetchSpaces = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/parkingspaces");
      setSpaces(res.data.spaces || []);
    } catch (err) {
      console.error("Error fetching parking spaces:", err);
      setError(err.response?.data?.error || err.message || "Failed to fetch parking spaces");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "users" || tab === "captains") {
      fetchUsers();
    } else if (tab === "bookings") {
      fetchBookings();
    } else if (tab === "parkingspaces") {
      fetchSpaces();
    }
  }, [tab]);

  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        const [usersRes, bookingsRes, spacesRes] = await Promise.all([
          api.get("/admin/users"),
          api.get("/admin/bookings"),
          api.get("/admin/parkingspaces"),
        ]);
        const allUsers = usersRes.data.users || [];
        const allBookings = bookingsRes.data.bookings || [];
        const allSpaces = spacesRes.data.spaces || [];
        const totalUsers = allUsers.length;
        const totalCaptains = allUsers.filter(u => u.isCaptain).length;
        const totalBookings = allBookings.length;
        const totalSpaces = allSpaces.length;
        const activeBookings = allBookings.filter((booking) =>
          ["confirmed", "pending", "accepted"].includes(booking.status?.toLowerCase())
        ).length;
        const totalRevenue = allBookings
          .filter((booking) => booking.status?.toLowerCase() === "completed")
          .reduce((sum, booking) => sum + (booking.totalPrice || 0), 0);
        setDashboardStats({
          totalUsers,
          totalCaptains,
          totalBookings,
          totalSpaces,
          activeBookings,
          revenue: totalRevenue,
        });
      } catch (err) {
        console.error("Error fetching dashboard stats:", err);
      }
    };
    fetchDashboardStats();
  }, []);

  // Bulk delete handlers
  const handleBulkDeleteUsers = async () => {
    if (selectedUsers.length === 0) {
      alert("Please select users to delete");
      return;
    }
    if (!window.confirm(`Are you sure you want to delete ${selectedUsers.length} user(s)?`)) {
      return;
    }
    try {
      await Promise.all(selectedUsers.map(id => api.delete(`/admin/users/${id}`)));
      alert("Users deleted successfully");
      setSelectedUsers([]);
      fetchUsers();
    } catch (err) {
      console.error("Error deleting users:", err);
      alert("Failed to delete users");
    }
  };

  const handleBulkDeleteCaptains = async () => {
    if (selectedCaptains.length === 0) {
      alert("Please select users to delete");
      return;
    }
    if (!window.confirm(`Are you sure you want to delete ${selectedCaptains.length} user(s)?`)) {
      return;
    }
    try {
      await Promise.all(selectedCaptains.map(id => api.delete(`/admin/users/${id}`)));
      alert("Users deleted successfully");
      setSelectedCaptains([]);
      fetchUsers();
    } catch (err) {
      console.error("Error deleting users:", err);
      alert("Failed to delete users");
    }
  };

  const handleBulkDeleteBookings = async () => {
    if (selectedBookings.length === 0) {
      alert("Please select bookings to delete");
      return;
    }
    if (!window.confirm(`Are you sure you want to delete ${selectedBookings.length} booking(s)?`)) {
      return;
    }
    try {
      await Promise.all(selectedBookings.map(id => api.delete(`/admin/bookings/${id}`)));
      alert("Bookings deleted successfully");
      setSelectedBookings([]);
      fetchBookings();
    } catch (err) {
      console.error("Error deleting bookings:", err);
      alert("Failed to delete bookings");
    }
  };

  const handleBulkDeleteSpaces = async () => {
    if (selectedSpaces.length === 0) {
      alert("Please select parking spaces to delete");
      return;
    }
    if (!window.confirm(`Are you sure you want to delete ${selectedSpaces.length} parking space(s)?`)) {
      return;
    }
    try {
      await Promise.all(selectedSpaces.map(id => api.delete(`/admin/parkingspaces/${id}`)));
      alert("Parking spaces deleted successfully");
      setSelectedSpaces([]);
      fetchSpaces();
    } catch (err) {
      console.error("Error deleting parking spaces:", err);
      alert("Failed to delete parking spaces");
    }
  };

  // Checkbox handlers
  const toggleUserSelection = (userId) => {
    setSelectedUsers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const toggleAllUsers = () => {
    const filteredUserIds = getFilteredUsers().map(u => u._id);
    if (selectedUsers.length === filteredUserIds.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUserIds);
    }
  };

  const toggleCaptainSelection = (userId) => {
    setSelectedCaptains(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const toggleAllCaptains = () => {
    const filteredCaptainIds = getFilteredCaptains().map(c => c._id);
    if (selectedCaptains.length === filteredCaptainIds.length) {
      setSelectedCaptains([]);
    } else {
      setSelectedCaptains(filteredCaptainIds);
    }
  };

  const toggleBookingSelection = (bookingId) => {
    setSelectedBookings(prev =>
      prev.includes(bookingId) ? prev.filter(id => id !== bookingId) : [...prev, bookingId]
    );
  };

  const toggleAllBookings = () => {
    const filteredBookingIds = getFilteredBookings().map(b => b._id);
    if (selectedBookings.length === filteredBookingIds.length) {
      setSelectedBookings([]);
    } else {
      setSelectedBookings(filteredBookingIds);
    }
  };

  const toggleSpaceSelection = (spaceId) => {
    setSelectedSpaces(prev =>
      prev.includes(spaceId) ? prev.filter(id => id !== spaceId) : [...prev, spaceId]
    );
  };

  const toggleAllSpaces = () => {
    const filteredSpaceIds = getFilteredSpaces().map(s => s._id);
    if (selectedSpaces.length === filteredSpaceIds.length) {
      setSelectedSpaces([]);
    } else {
      setSelectedSpaces(filteredSpaceIds);
    }
  };

  const getFilteredUsers = () => {
    return users.filter((user) => {
      let match = true;
      if (isVerifiedFilter !== null) match = match && user.isVerified === isVerifiedFilter;
      if (kycStatusFilter !== null) match = match && user.kycStatus === kycStatusFilter;
      if (stateFilter !== null) match = match && user.kycData?.state === stateFilter;
      if (cityFilter !== null) match = match && user.kycData?.city === cityFilter;
      return match;
    });
  };

  const getFilteredCaptains = () => {
    return users.filter((user) => {
      let match = true;
      if (captainIsVerifiedFilter !== null) match = match && user.isVerified === captainIsVerifiedFilter;
      if (captainKycStatusFilter !== null) match = match && user.kycStatus === captainKycStatusFilter;
      if (captainStateFilter !== null) match = match && user.kycData?.state === captainStateFilter;
      if (captainCityFilter !== null) match = match && user.kycData?.city === captainCityFilter;
      if (regionFilter !== null) match = match && user.region === regionFilter;
      if (isCaptainFilter !== null) match = match && user.isCaptain === isCaptainFilter;
      return match;
    });
  };

  const getFilteredBookings = () => {
    return bookings.filter((booking) => {
      let match = true;
      if (bookingStatusFilter !== null) match = match && booking.status === bookingStatusFilter;
      if (bookingCityFilter !== null) match = match && booking.parkingSpace?.address?.city === bookingCityFilter;
      return match;
    });
  };

  const getFilteredSpaces = () => {
    return spaces.filter((space) => {
      let match = true;
      if (spaceStatusFilter !== null) match = match && space.status === spaceStatusFilter;
      if (spaceStateFilter !== null) match = match && space.address?.state === spaceStateFilter;
      if (spaceCityFilter !== null) match = match && space.address?.city === spaceCityFilter;
      return match;
    });
  };

  const generateRecentActivity = () => {
    const activities = [];
    const recentUsers = users.slice(-3).reverse();
    recentUsers.forEach((user, index) => {
      activities.push({
        type: "user",
        message: `New user ${user?.name || "Unknown"} registered`,
        time: `${(index + 1) * 2} minutes ago`,
        color: "blue",
        user: user.name || "Unknown",
      });
    });
    const recentBookings = bookings.slice(-2).reverse();
    recentBookings.forEach((booking, index) => {
      activities.push({
        type: "booking",
        message: `${booking.user?.name || "User"} booked ${booking.parkingSpace?.title || "parking space"}`,
        time: `${(index + 5) * 2} minutes ago`,
        color: "green",
        amount: booking.totalPrice,
      });
    });
    const completedBookings = bookings
      .filter((b) => b.status?.toLowerCase() === "completed")
      .slice(-1);
    completedBookings.forEach((booking, index) => {
      activities.push({
        type: "payment",
        message: `Payment of $${booking.totalPrice || 0} received`,
        time: `${(index + 8) * 3} minutes ago`,
        color: "purple",
        amount: booking.totalPrice,
      });
    });
    return activities.slice(0, 4);
  };

  const sidebarItems = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
        </svg>
      ),
      gradient: "from-blue-500 to-purple-600",
    },
    {
      id: "users",
      label: "Users",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197" />
        </svg>
      ),
      gradient: "from-emerald-500 to-teal-600",
    },
    {
      id: "captains",
      label: "Captains",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      gradient: "from-indigo-500 to-blue-600",
    },
    {
      id: "bookings",
      label: "Bookings",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      gradient: "from-orange-500 to-red-600",
    },
    {
      id: "parkingspaces",
      label: "Parking Spaces",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      gradient: "from-purple-500 to-pink-600",
    },
    {
      id: "notification",
      label: "Notification",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C8.67 6.165 8 7.388 8 9v5.159c0 .538-.214 1.055-.595 1.436L6 17h5m4 0v1a3 3 0 11-6 0v-1h6z" />
        </svg>
      ),
      gradient: "from-yellow-500 to-orange-600",
    },
  ];

  const StatCard = ({ title, value, icon, gradient, change }) => (
    <div className="relative overflow-hidden bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
            <p className="text-3xl font-bold text-gray-900">{value}</p>
            {change && <p className="text-sm text-green-600 font-medium mt-1">↗ {change}% from last month</p>}
          </div>
          <div className={`p-4 rounded-2xl bg-gradient-to-br ${gradient} shadow-lg`}>{icon}</div>
        </div>
      </div>
      <div className={`h-1 bg-gradient-to-r ${gradient}`}></div>
    </div>
  );

  const DashboardContent = () => {
    const recentActivity = generateRecentActivity();
    const calculateGrowth = (current, type) => {
      const baseGrowth = {
        users: Math.floor(Math.random() * 15) + 5,
        captains: Math.floor(Math.random() * 10) + 3,
        bookings: Math.floor(Math.random() * 20) + 8,
        spaces: Math.floor(Math.random() * 10) + 3,
        revenue: Math.floor(Math.random() * 25) + 10,
      };
      return baseGrowth[type] || 5;
    };
    return (
      <div className="space-y-8">
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 rounded-3xl shadow-2xl">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative p-8 text-white">
            <h1 className="text-4xl font-bold mb-2">Welcome back, Admin</h1>
            <p className="text-blue-100 text-lg">Here's what's happening with your parking platform today.</p>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="bg-white/10 rounded-lg p-3">
                <div className="font-medium">Total Revenue</div>
                <div className="text-lg font-bold">${dashboardStats.revenue.toLocaleString()}</div>
              </div>
              <div className="bg-white/10 rounded-lg p-3">
                <div className="font-medium">Active Now</div>
                <div className="text-lg font-bold">{dashboardStats.activeBookings}</div>
              </div>
              <div className="bg-white/10 rounded-lg p-3">
                <div className="font-medium">This Month</div>
                <div className="text-lg font-bold">{dashboardStats.totalBookings}</div>
              </div>
              <div className="bg-white/10 rounded-lg p-3">
                <div className="font-medium">Total Users</div>
                <div className="text-lg font-bold">{dashboardStats.totalUsers}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <StatCard
            title="Total Users"
            value={dashboardStats.totalUsers}
            change={calculateGrowth(dashboardStats.totalUsers, "users")}
            gradient="from-blue-500 to-purple-600"
            icon={<svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1z" /></svg>}
          />
          <StatCard
            title="Total Captains"
            value={dashboardStats.totalCaptains}
            change={calculateGrowth(dashboardStats.totalCaptains, "captains")}
            gradient="from-indigo-500 to-blue-600"
            icon={<svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
          />
          <StatCard
            title="Total Bookings"
            value={dashboardStats.totalBookings}
            change={calculateGrowth(dashboardStats.totalBookings, "bookings")}
            gradient="from-emerald-500 to-teal-600"
            icon={<svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
          />
          <StatCard
            title="Parking Spaces"
            value={dashboardStats.totalSpaces}
            change={calculateGrowth(dashboardStats.totalSpaces, "spaces")}
            gradient="from-orange-500 to-red-600"
            icon={<svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" /></svg>}
          />
          <StatCard
            title="Revenue"
            value={`$${dashboardStats.revenue.toLocaleString()}`}
            change={calculateGrowth(dashboardStats.revenue, "revenue")}
            gradient="from-purple-500 to-pink-600"
            icon={<svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1" /></svg>}
          />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Recent Activity</h3>
            <div className="space-y-4">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-center space-x-4 p-3 rounded-xl hover:bg-gray-50 transition-colors duration-200">
                    <div className={`p-2 rounded-lg ${activity.color === "blue" ? "bg-blue-100" : activity.color === "green" ? "bg-green-100" : activity.color === "purple" ? "bg-purple-100" : "bg-orange-100"}`}>
                      <div className={`w-3 h-3 rounded-full ${activity.color === "blue" ? "bg-blue-500" : activity.color === "green" ? "bg-green-500" : activity.color === "purple" ? "bg-purple-500" : "bg-orange-500"}`}></div>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{activity.message}</p>
                      <p className="text-xs text-gray-500">{activity.time}</p>
                    </div>
                    {activity.amount && <div className="text-sm font-medium text-green-600">${activity.amount}</div>}
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">No recent activity</p>
                  <p className="text-sm text-gray-400 mt-1">Activity will appear here as users interact with the platform</p>
                </div>
              )}
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Quick Stats</h3>
            <div className="space-y-6">
              {[
                { label: "Active Bookings", value: dashboardStats.activeBookings, total: Math.max(dashboardStats.totalBookings, 1), color: "blue" },
                { label: "Occupied Spaces", value: Math.floor(dashboardStats.totalSpaces * 0.75), total: Math.max(dashboardStats.totalSpaces, 1), color: "green" },
                { label: "Verified Users", value: Math.floor(dashboardStats.totalUsers * 0.85), total: Math.max(dashboardStats.totalUsers, 1), color: "orange" },
              ].map((stat, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-700">{stat.label}</span>
                    <span className="text-gray-500">{stat.value}/{stat.total}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className={`h-2 rounded-full transition-all duration-500 ${stat.color === "blue" ? "bg-blue-500" : stat.color === "green" ? "bg-green-500" : "bg-orange-500"}`} style={{ width: `${Math.min((stat.value / stat.total) * 100, 100)}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const DataTable = ({ title, data, columns, emptyMessage, onEdit, selectedItems, toggleSelection, toggleAll }) => {
    const filteredData = data.filter((item) =>
      Object.values(item).some((val) => val?.toString().toLowerCase().includes(searchTerm.toLowerCase()))
    );
    
    const allSelected = filteredData.length > 0 && selectedItems.length === filteredData.length;

    return (
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-900">{title}</h3>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
              <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          {selectedItems.length > 0 && (
            <div className="mt-4 flex items-center justify-between bg-blue-50 p-3 rounded-lg">
              <span className="text-sm font-medium text-blue-900">
                {selectedItems.length} item(s) selected
              </span>
              <button
                onClick={() => {
                  if (tab === "users") handleBulkDeleteUsers();
                  else if (tab === "captains") handleBulkDeleteCaptains();
                  else if (tab === "bookings") handleBulkDeleteBookings();
                  else if (tab === "parkingspaces") handleBulkDeleteSpaces();
                }}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
              >
                Delete Selected
              </button>
            </div>
          )}
        </div>
        {filteredData.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 009.586 13H7" />
              </svg>
            </div>
            <p className="text-gray-500 text-lg">{emptyMessage}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </th>
                  {columns.map((column, index) => (
                    <th
                      key={index}
                      className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                    >
                      {column.header}
                    </th>
                  ))}
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredData.map((item) => (
                  <tr key={item._id} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(item._id)}
                        onChange={() => toggleSelection(item._id)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                    </td>
                    {columns.map((column, colIndex) => (
                      <td key={colIndex} className="px-6 py-4 whitespace-nowrap">
                        {column.render ? column.render(item) : item[column.key]}
                      </td>
                    ))}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => onEdit(item)}
                        className="text-blue-600 hover:text-blue-800 mr-2"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const UserEditModal = ({ user, onClose, onSave }) => {
    const [formData, setFormData] = useState(user || {});
    const [hasChanges, setHasChanges] = useState(false);

    const handleChange = (e) => {
      setFormData({ ...formData, [e.target.name]: e.target.value });
      setHasChanges(true);
    };

    const handleDropdownChange = (field, value) => {
      setFormData({ ...formData, [field]: value });
      setHasChanges(true);
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!hasChanges) {
        alert("No changes to save");
        return;
      }
      try {
        await api.put(`/admin/users/${user._id}`, formData);
        alert("User updated successfully");
        onSave();
        onClose();
      } catch (err) {
        console.error("Error updating user:", err);
        alert("Failed to update user");
      }
    };

    const handleDelete = async () => {
      if (window.confirm("Are you sure you want to delete this user?")) {
        try {
          await api.delete(`/admin/users/${user._id}`);
          alert("User deleted successfully");
          onSave();
          onClose();
        } catch (err) {
          console.error("Error deleting user:", err);
          alert("Failed to delete user");
        }
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
          <h3 className="text-xl font-bold mb-4">Edit User</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                name="name"
                value={formData.name || ""}
                onChange={handleChange}
                placeholder="Name"
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                name="email"
                value={formData.email || ""}
                onChange={handleChange}
                placeholder="Email"
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Verification</label>
              <select
                value={formData.isVerified ? "true" : "false"}
                onChange={(e) => handleDropdownChange("isVerified", e.target.value === "true")}
                className="w-full p-2 border rounded"
              >
                <option value="true">Verified</option>
                <option value="false">Not Verified</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">KYC Status</label>
              <select
                value={formData.kycStatus || "pending"}
                onChange={(e) => handleDropdownChange("kycStatus", e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="pending">Pending KYC</option>
                <option value="submitted">Submitted KYC</option>
                <option value="approved">Approved KYC</option>
                <option value="rejected">Rejected KYC</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Is Captain</label>
              <select
                value={formData.isCaptain ? "true" : "false"}
                onChange={(e) => handleDropdownChange("isCaptain", e.target.value === "true")}
                className="w-full p-2 border rounded"
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
              <input
                name="region"
                value={formData.region || ""}
                onChange={handleChange}
                placeholder="Region"
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Captain Areas (comma separated)</label>
              <input
                name="captainAreas"
                value={formData.captainAreas?.join(", ") || ""}
                onChange={(e) => {
                  setFormData({ ...formData, captainAreas: e.target.value.split(",").map(a => a.trim()).filter(a => a) });
                  setHasChanges(true);
                }}
                placeholder="Area1, Area2"
                className="w-full p-2 border rounded"
              />
            </div>
            <button
              type="submit"
              disabled={!hasChanges}
              className={`w-full p-2 rounded ${hasChanges ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}
            >
              Save Changes
            </button>
          </form>
          <div className="mt-4">
            <button
              onClick={handleDelete}
              className="w-full bg-red-600 text-white p-2 rounded hover:bg-red-700"
            >
              Delete User
            </button>
          </div>
          <button
            onClick={onClose}
            className="mt-4 w-full bg-gray-300 text-gray-800 p-2 rounded hover:bg-gray-400"
          >
            Close
          </button>
        </div>
      </div>
    );
  };

  const BookingEditModal = ({ booking, onClose, onSave }) => {
    const [formData, setFormData] = useState(booking || {});
    const [hasChanges, setHasChanges] = useState(false);

    const handleChange = (e) => {
      setFormData({ ...formData, [e.target.name]: e.target.value });
      setHasChanges(true);
    };

    const handleDropdownChange = (field, value) => {
      setFormData({ ...formData, [field]: value });
      setHasChanges(true);
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!hasChanges) {
        alert("No changes to save");
        return;
      }
      try {
        await api.put(`/admin/bookings/${booking._id}`, formData);
        alert("Booking updated successfully");
        onSave();
        onClose();
      } catch (err) {
        console.error("Error updating booking:", err);
        alert("Failed to update booking");
      }
    };

    const handleDelete = async () => {
      if (window.confirm("Are you sure you want to delete this booking?")) {
        try {
          await api.delete(`/admin/bookings/${booking._id}`);
          alert("Booking deleted successfully");
          onSave();
          onClose();
        } catch (err) {
          console.error("Error deleting booking:", err);
          alert("Failed to delete booking");
        }
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
          <h3 className="text-xl font-bold mb-4">Edit Booking</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
              <input
                name="startTime"
                type="datetime-local"
                value={new Date(formData.startTime).toISOString().slice(0, 16)}
                onChange={handleChange}
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
              <input
                name="endTime"
                type="datetime-local"
                value={new Date(formData.endTime).toISOString().slice(0, 16)}
                onChange={handleChange}
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Price</label>
              <input
                name="totalPrice"
                type="number"
                value={formData.totalPrice || ""}
                onChange={handleChange}
                placeholder="Total Price"
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={formData.status || "pending"}
                onChange={(e) => handleDropdownChange("status", e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={!hasChanges}
              className={`w-full p-2 rounded ${hasChanges ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}
            >
              Save Changes
            </button>
          </form>
          <div className="mt-4">
            <button
              onClick={handleDelete}
              className="w-full bg-red-600 text-white p-2 rounded hover:bg-red-700"
            >
              Delete Booking
            </button>
          </div>
          <button
            onClick={onClose}
            className="mt-4 w-full bg-gray-300 text-gray-800 p-2 rounded hover:bg-gray-400"
          >
            Close
          </button>
        </div>
      </div>
    );
  };

  const SpaceEditModal = ({ space, onClose, onSave }) => {
    const [formData, setFormData] = useState(space || {});
    const [hasChanges, setHasChanges] = useState(false);

    const handleChange = (e) => {
      setFormData({ ...formData, [e.target.name]: e.target.value });
      setHasChanges(true);
    };

    const handleDropdownChange = (field, value) => {
      setFormData({ ...formData, [field]: value });
      setHasChanges(true);
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!hasChanges) {
        alert("No changes to save");
        return;
      }
      try {
        await api.put(`/admin/parkingspaces/${space._id}`, formData);
        alert("Parking space updated successfully");
        onSave();
        onClose();
      } catch (err) {
        console.error("Error updating parking space:", err);
        alert("Failed to update parking space");
      }
    };

    const handleDelete = async () => {
      if (window.confirm("Are you sure you want to delete this parking space?")) {
        try {
          await api.delete(`/admin/parkingspaces/${space._id}`);
          alert("Parking space deleted successfully");
          onSave();
          onClose();
        } catch (err) {
          console.error("Error deleting parking space:", err);
          alert("Failed to delete parking space");
        }
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
          <h3 className="text-xl font-bold mb-4">Edit Parking Space</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                name="title"
                value={formData.title || ""}
                onChange={handleChange}
                placeholder="Title"
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input
                name="description"
                value={formData.description || ""}
                onChange={handleChange}
                placeholder="Description"
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price per Hour</label>
              <input
                name="pricePerHour"
                type="number"
                value={formData.pricePerHour || ""}
                onChange={handleChange}
                placeholder="Price per Hour"
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={formData.status || "pending"}
                onChange={(e) => handleDropdownChange("status", e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="pending">Pending</option>
                <option value="submitted">Submitted</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={!hasChanges}
              className={`w-full p-2 rounded ${hasChanges ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}
            >
              Save Changes
            </button>
          </form>
          <div className="mt-4">
            <button
              onClick={handleDelete}
              className="w-full bg-red-600 text-white p-2 rounded hover:bg-red-700"
            >
              Delete Space
            </button>
          </div>
          <button
            onClick={onClose}
            className="mt-4 w-full bg-gray-300 text-gray-800 p-2 rounded hover:bg-gray-400"
          >
            Close
          </button>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-20">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-200 rounded-full animate-spin"></div>
            <div className="absolute top-0 left-0 w-16 h-16 border-4 border-blue-600 rounded-full animate-spin border-t-transparent"></div>
          </div>
        </div>
      );
    }
    if (error) {
      return (
        <div className="bg-red-50 border-l-4 border-red-400 p-6 rounded-xl">
          <div className="flex">
            <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error Loading Data</h3>
              <p className="mt-2 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      );
    }
    switch (tab) {
      case "dashboard":
        return <DashboardContent />;
      case "users":
        const uniqueStates = [...new Set(users.map((u) => u.kycData?.state || "").filter(Boolean))].sort();
        const uniqueCities = [...new Set(users.map((u) => u.kycData?.city || "").filter(Boolean))].sort();
        const filteredUsers = getFilteredUsers();
        return (
          <div>
            <div className="flex flex-wrap space-x-4 mb-4">
              <select
                value={isVerifiedFilter === null ? "" : isVerifiedFilter ? "true" : "false"}
                onChange={(e) => setIsVerifiedFilter(e.target.value === "" ? null : e.target.value === "true")}
                className="p-2 border rounded"
              >
                <option value="">All Email Verification</option>
                <option value="true">Verified</option>
                <option value="false">Not Verified</option>
              </select>
              <select
                value={kycStatusFilter ?? ""}
                onChange={(e) => setKycStatusFilter(e.target.value || null)}
                className="p-2 border rounded"
              >
                <option value="">All KYC Status</option>
                <option value="pending">Pending</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              <select
                value={stateFilter ?? ""}
                onChange={(e) => setStateFilter(e.target.value || null)}
                className="p-2 border rounded"
              >
                <option value="">All States</option>
                {uniqueStates.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
              <select
                value={cityFilter ?? ""}
                onChange={(e) => setCityFilter(e.target.value || null)}
                className="p-2 border rounded"
              >
                <option value="">All Cities</option>
                {uniqueCities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>
            <DataTable
              title={`Users (${filteredUsers.length})`}
              data={filteredUsers}
              emptyMessage="No users found"
              selectedItems={selectedUsers}
              toggleSelection={toggleUserSelection}
              toggleAll={toggleAllUsers}
              columns={[
                {
                  header: "User",
                  render: (user) => (
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                        {(user.name || "U").charAt(0).toUpperCase()}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{user.name || "Unknown"}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  ),
                },
                {
                  header: "Status",
                  render: (user) => (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.isAdmin ? "bg-purple-100 text-purple-800" : "bg-green-100 text-green-800"}`}>
                      {user.isAdmin ? "Admin" : "User"}
                    </span>
                  ),
                },
                {
                  header: "Verified",
                  render: (user) => (
                    <span className={user.isVerified ? "text-green-600" : "text-red-600"}>
                      {user.isVerified ? "Yes" : "No"}
                    </span>
                  ),
                },
                {
                  header: "KYC",
                  render: (user) => (
                    <span className={`capitalize ${user.kycStatus === "approved" ? "text-green-600" : user.kycStatus === "rejected" ? "text-red-600" : "text-yellow-600"}`}>
                      {user.kycStatus}
                    </span>
                  ),
                },
                {
                  header: "Captain",
                  render: (user) => (
                    <span className={user.isCaptain ? "text-green-600" : "text-red-600"}>
                      {user.isCaptain ? "Yes" : "No"}
                    </span>
                  ),
                },
                {
                  header: "Joined",
                  render: (user) => (
                    <span className="text-sm text-gray-500">{new Date(user.createdAt).toLocaleDateString()}</span>
                  ),
                },
              ]}
              onEdit={(item) => setSelectedUser(item)}
            />
          </div>
        );
      case "captains":
        const uniqueCaptainStates = [...new Set(users.map((u) => u.kycData?.state || "").filter(Boolean))].sort();
        const uniqueCaptainCities = [...new Set(users.map((u) => u.kycData?.city || "").filter(Boolean))].sort();
        const uniqueRegions = [...new Set(users.map((u) => u.region || "").filter(Boolean))].sort();
        const filteredCaptains = getFilteredCaptains();
        return (
          <div>
            <div className="flex flex-wrap space-x-4 mb-4">
              <select
                value={captainIsVerifiedFilter === null ? "" : captainIsVerifiedFilter ? "true" : "false"}
                onChange={(e) => setCaptainIsVerifiedFilter(e.target.value === "" ? null : e.target.value === "true")}
                className="p-2 border rounded"
              >
                <option value="">All Email Verification</option>
                <option value="true">Verified</option>
                <option value="false">Not Verified</option>
              </select>
              <select
                value={captainKycStatusFilter ?? ""}
                onChange={(e) => setCaptainKycStatusFilter(e.target.value || null)}
                className="p-2 border rounded"
              >
                <option value="">All KYC Status</option>
                <option value="pending">Pending</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              <select
                value={captainStateFilter ?? ""}
                onChange={(e) => setCaptainStateFilter(e.target.value || null)}
                className="p-2 border rounded"
              >
                <option value="">All States</option>
                {uniqueCaptainStates.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
              <select
                value={captainCityFilter ?? ""}
                onChange={(e) => setCaptainCityFilter(e.target.value || null)}
                className="p-2 border rounded"
              >
                <option value="">All Cities</option>
                {uniqueCaptainCities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
              <select
                value={regionFilter ?? ""}
                onChange={(e) => setRegionFilter(e.target.value || null)}
                className="p-2 border rounded"
              >
                <option value="">All Regions</option>
                {uniqueRegions.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
              <select
                value={isCaptainFilter === null ? "" : isCaptainFilter ? "true" : "false"}
                onChange={(e) => setIsCaptainFilter(e.target.value === "" ? null : e.target.value === "true")}
                className="p-2 border rounded"
              >
                <option value="">All Captain Status</option>
                <option value="true">Captains Only</option>
                <option value="false">Non-Captains Only</option>
              </select>
            </div>
            <DataTable
              title={`Users for Captain Management (${filteredCaptains.length})`}
              data={filteredCaptains}
              emptyMessage="No users found"
              selectedItems={selectedCaptains}
              toggleSelection={toggleCaptainSelection}
              toggleAll={toggleAllCaptains}
              columns={[
                {
                  header: "User",
                  render: (user) => (
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                        {(user.name || "U").charAt(0).toUpperCase()}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 flex items-center">
                          {user.name || "Unknown"}
                          {user.isCaptain && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              Captain
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  ),
                },
                {
                  header: "Status",
                  render: (user) => (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.isAdmin ? "bg-purple-100 text-purple-800" : "bg-green-100 text-green-800"}`}>
                      {user.isAdmin ? "Admin" : "User"}
                    </span>
                  ),
                },
                {
                  header: "Verified",
                  render: (user) => (
                    <span className={user.isVerified ? "text-green-600" : "text-red-600"}>
                      {user.isVerified ? "Yes" : "No"}
                    </span>
                  ),
                },
                {
                  header: "KYC",
                  render: (user) => (
                    <span className={`capitalize ${user.kycStatus === "approved" ? "text-green-600" : user.kycStatus === "rejected" ? "text-red-600" : "text-yellow-600"}`}>
                      {user.kycStatus}
                    </span>
                  ),
                },
                {
                  header: "Region",
                  render: (user) => user.region || "N/A",
                },
                {
                  header: "Areas",
                  render: (user) => user.captainAreas?.join(", ") || "N/A",
                },
                {
                  header: "Joined",
                  render: (user) => (
                    <span className="text-sm text-gray-500">{new Date(user.createdAt).toLocaleDateString()}</span>
                  ),
                },
              ]}
              onEdit={(item) => setSelectedUser(item)}
            />
          </div>
        );
      case "bookings":
        const uniqueBookingStatuses = [...new Set(bookings.map((b) => b.status).filter(Boolean))].sort();
        const uniqueBookingCities = [...new Set(bookings.map((b) => b.parkingSpace?.address?.city || "").filter(Boolean))].sort();
        const filteredBookings = getFilteredBookings();
        return (
          <div>
            <div className="flex flex-wrap space-x-4 mb-4">
              <select
                value={bookingStatusFilter ?? ""}
                onChange={(e) => setBookingStatusFilter(e.target.value || null)}
                className="p-2 border rounded"
              >
                <option value="">All Statuses</option>
                {uniqueBookingStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <select
                value={bookingCityFilter ?? ""}
                onChange={(e) => setBookingCityFilter(e.target.value || null)}
                className="p-2 border rounded"
              >
                <option value="">All Cities</option>
                {uniqueBookingCities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>
            <DataTable
              title={`Bookings (${filteredBookings.length})`}
              data={filteredBookings}
              emptyMessage="No bookings found"
              selectedItems={selectedBookings}
              toggleSelection={toggleBookingSelection}
              toggleAll={toggleAllBookings}
              columns={[
                {
                  header: "User",
                  render: (booking) => (
                    <div className="text-sm">
                      <div className="font-medium text-gray-900">{booking.user?.name || "Unknown User"}</div>
                      <div className="text-gray-500">{booking.user?.email || "No email"}</div>
                    </div>
                  ),
                },
                {
                  header: "Parking Space",
                  render: (booking) => (
                    <div className="text-sm">
                      <div className="font-medium text-gray-900">{booking.parkingSpace?.title || "Unknown Space"}</div>
                      <div className="text-gray-500">{booking.parkingSpace?.address?.city || "No location"}</div>
                    </div>
                  ),
                },
                {
                  header: "Date & Time",
                  render: (booking) => (
                    <span className="text-sm text-gray-500">{new Date(booking.startTime).toLocaleString()}</span>
                  ),
                },
                {
                  header: "Status",
                  render: (booking) => (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${booking.status === "confirmed" ? "bg-green-100 text-green-800" : booking.status === "pending" ? "bg-yellow-100 text-yellow-800" : booking.status === "cancelled" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-800"}`}>
                      {booking.status}
                    </span>
                  ),
                },
                {
                  header: "Amount",
                  render: (booking) => (
                    <span className="text-sm font-medium text-gray-900">${booking.totalPrice || 0}</span>
                  ),
                },
              ]}
              onEdit={(item) => setSelectedBooking(item)}
            />
          </div>
        );
      case "parkingspaces":
        const uniqueSpaceStatuses = [...new Set(spaces.map((s) => s.status).filter(Boolean))].sort();
        const uniqueSpaceStates = [...new Set(spaces.map((s) => s.address?.state || "").filter(Boolean))].sort();
        const uniqueSpaceCities = [...new Set(spaces.map((s) => s.address?.city || "").filter(Boolean))].sort();
        const filteredSpaces = getFilteredSpaces();
        return (
          <div>
            <div className="flex flex-wrap space-x-4 mb-4">
              <select
                value={spaceStatusFilter ?? ""}
                onChange={(e) => setSpaceStatusFilter(e.target.value || null)}
                className="p-2 border rounded"
              >
                <option value="">All Statuses</option>
                {uniqueSpaceStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <select
                value={spaceStateFilter ?? ""}
                onChange={(e) => setSpaceStateFilter(e.target.value || null)}
                className="p-2 border rounded"
              >
                <option value="">All States</option>
                {uniqueSpaceStates.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
              <select
                value={spaceCityFilter ?? ""}
                onChange={(e) => setSpaceCityFilter(e.target.value || null)}
                className="p-2 border rounded"
              >
                <option value="">All Cities</option>
                {uniqueSpaceCities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>
            <DataTable
              title={`Parking Spaces (${filteredSpaces.length})`}
              data={filteredSpaces}
              emptyMessage="No parking spaces found"
              selectedItems={selectedSpaces}
              toggleSelection={toggleSpaceSelection}
              toggleAll={toggleAllSpaces}
              columns={[
                {
                  header: "Space",
                  render: (space) => (
                    <div className="text-sm">
                      <div className="font-medium text-gray-900">{space.title || "Untitled"}</div>
                      <div className="text-gray-500">{space.description || "No description"}</div>
                    </div>
                  ),
                },
                {
                  header: "Owner",
                  render: (space) => (
                    <div className="text-sm">
                      <div className="font-medium text-gray-900">{space.owner?.name || "Unknown"}</div>
                      <div className="text-gray-500">{space.owner?.email || "No email"}</div>
                    </div>
                  ),
                },
                {
                  header: "Location",
                  render: (space) => (
                    <div className="text-sm text-gray-500">
                      {space.address?.street && `${space.address.street}, `}
                      {space.address?.city || "No city"}
                      {space.address?.state && `, ${space.address.state}`}
                    </div>
                  ),
                },
                {
                  header: "Price/Hour",
                  render: (space) => (
                    <span className="text-sm font-medium text-gray-900">${space.pricePerHour || 0}</span>
                  ),
                },
                {
                  header: "Status",
                  render: (space) => (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${space.status === "active" ? "bg-green-100 text-green-800" : space.status === "pending" ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"}`}>
                      {space.status}
                    </span>
                  ),
                },
              ]}
              onEdit={(item) => setSelectedSpace(item)}
            />
          </div>
        );
      case "notification":
        return <Notification />;
      default:
        return <DashboardContent />;
    }
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className={`${sidebarCollapsed ? "w-20" : "w-72"} transition-all duration-300 ease-in-out bg-white shadow-2xl border-r border-gray-100`}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                </svg>
              </div>
              {!sidebarCollapsed && (
                <div className="ml-4">
                  <h2 className="text-xl font-bold text-gray-900">ParkAdmin</h2>
                  <p className="text-sm text-gray-500">Control Panel</p>
                </div>
              )}
            </div>
          </div>
          <nav className="flex-1 px-4 py-6">
            <div className="space-y-2">
              {sidebarItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={`w-full flex items-center px-4 py-3 text-left rounded-xl transition-all duration-200 ${tab === item.id ? `bg-gradient-to-r ${item.gradient} text-white shadow-lg transform scale-105` : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`}
                >
                  <span className={`${tab === item.id ? "text-white" : "text-gray-400"}`}>{item.icon}</span>
                  {!sidebarCollapsed && <span className="ml-3 font-medium">{item.label}</span>}
                </button>
              ))}
            </div>
          </nav>
          <div className="p-4 border-t border-gray-100">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-full flex items-center justify-center p-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all duration-200"
            >
              <svg
                className={`w-5 h-5 transform transition-transform ${sidebarCollapsed ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        <header className="bg-white/80 backdrop-blur-lg shadow-sm border-b border-gray-100 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 capitalize">
                {tab === "dashboard"
                  ? "Dashboard Overview"
                  : tab === "users"
                  ? "User Management"
                  : tab === "captains"
                  ? "Captain Management"
                  : tab === "parkingspaces"
                  ? "Parking Spaces"
                  : tab === "bookings"
                  ? "Booking Management"
                  : tab === "notification"
                  ? "Notifications"
                  : "Dashboard"}
              </h1>
              <p className="text-gray-600 mt-1">
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <button className="relative p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v5l-5-5h5z" />
                </svg>
                <span className="absolute top-2 right-2 block h-2 w-2 rounded-full bg-red-400 ring-2 ring-white"></span>
              </button>
              <div className="flex items-center space-x-3 bg-gray-50 rounded-full px-4 py-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-semibold">A</span>
                </div>
                <span className="text-sm font-medium text-gray-700">Admin User</span>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto">
            {renderContent()}
            {selectedUser && (
              <UserEditModal
                user={selectedUser}
                onClose={() => setSelectedUser(null)}
                onSave={fetchUsers}
              />
            )}
            {selectedBooking && (
              <BookingEditModal
                booking={selectedBooking}
                onClose={() => setSelectedBooking(null)}
                onSave={fetchBookings}
              />
            )}
            {selectedSpace && (
              <SpaceEditModal
                space={selectedSpace}
                onClose={() => setSelectedSpace(null)}
                onSave={fetchSpaces}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}