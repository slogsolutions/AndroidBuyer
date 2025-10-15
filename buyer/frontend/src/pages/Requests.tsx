// frontend/src/pages/Requests.tsx
import React, { useEffect, useState } from 'react';
import { 
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Clock3,
  CalendarDays,
  Key,
  Search,
  Filter,
  DollarSign,
  User,
  MapPin,
  Tag,
  CreditCard
} from 'lucide-react';
import { motion } from 'framer-motion';
import LoadingScreen from './LoadingScreen';

interface Booking {
  _id?: string;
  id?: string;
  customerName?: string;
  serviceName?: string;
  startTime?: string;
  endTime?: string;
  price?: number;
  status?: 'pending' | 'accepted' | 'rejected' | 'confirmed' | 'active' | 'completed' | 'cancelled';
  user?: { name: string };
  totalPrice?: number;
  paymentStatus?: string;
  otpVerified?: boolean;
  providerId?: string | null;
  sessionEndAt?: string | null;
  startedAt?: string | null;
}

const ProviderBookings = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected' | 'confirmed' | 'active' | 'completed'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'specific'>('all');
  const [specificDate, setSpecificDate] = useState<string>('');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [selectedBooking, setSelectedBooking] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState<string>("");
  const [verifyingOtp, setVerifyingOtp] = useState<string | null>(null);
  const [secondOtpInput, setSecondOtpInput] = useState("");
  const [verifyingSecondOtp, setVerifyingSecondOtp] = useState<string | null>(null);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(
          `${import.meta.env.VITE_BASE_URL}/api/booking/provider-bookings`,
          {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (!response.ok) throw new Error("Failed to fetch bookings");

        const data = await response.json();
        const list = data.bookings || data;
        
        // Sort bookings by startTime in descending order (latest first)
        const sortedBookings = list.sort((a: Booking, b: Booking) => {
          const timeA = a.startTime ? new Date(a.startTime).getTime() : 0;
          const timeB = b.startTime ? new Date(b.startTime).getTime() : 0;
          return timeB - timeA;
        });
        
        setBookings(sortedBookings);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, []);

  // --- FROM OLD CODE: helpers & reject-time checks (added as requested) ---
  // helper: return true if current time is earlier than (startTime - 1 hour)
  const canRejectBooking = (booking: Booking) => {
    if (!booking.startTime) return true;
    const startTs = new Date(booking.startTime).getTime();
    if (isNaN(startTs)) return true;
    const oneHourBefore = startTs - 60 * 60 * 1000;
    return Date.now() < oneHourBefore;
  };

  // helper: return true if current time is >= booking startTime (OTP entry allowed only after start for buyer)
 const canEnterOtp = (booking: Booking) => {
  if (!booking.startTime) return false;
  const startTs = new Date(booking.startTime).getTime();
  if (isNaN(startTs)) return false;

  // allow entering OTP from 15 minutes before startTime
  const allowedFrom = startTs - 15 * 60 * 1000; // 15 minutes in ms
  return Date.now() >= allowedFrom;
};


  // helper: only allow cancellation if current time is earlier than 24 hours before start
  const canCancelBooking = (booking: Booking) => {
    if (!booking.startTime) return false;
    const startTs = new Date(booking.startTime).getTime();
    if (isNaN(startTs)) return false;
    const now = Date.now();
    const twentyFourHoursBefore = startTs - 24 * 60 * 60 * 1000;
    return now < twentyFourHoursBefore;
  };

  // friendly countdown text until start
  const timeUntilStartText = (booking: Booking) => {
    if (!booking.startTime) return 'Start time not specified';
    const startTs = new Date(booking.startTime).getTime();
    if (isNaN(startTs)) return 'Start time invalid';
    const diff = startTs - Date.now();
    if (diff <= 0) return 'Starting now';
    const mins = Math.ceil(diff / (60 * 1000));
    if (mins < 60) return `${mins} min${mins > 1 ? 's' : ''} to start`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs} hr${hrs > 1 ? 's' : ''}${remMins > 0 ? ` ${remMins} min` : ''} to start`;
  };
  // --- end added helpers ---

  const handleStatusChange = async (bookingId: any, newStatus: any) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${import.meta.env.VITE_BASE_URL}/api/booking/${bookingId}/status`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        alert(`Error: ${error.message}`);
        return;
      }

      const data = await response.json();
      const updatedBooking = data.booking || null;

      setBookings((prevBookings: any) =>
        prevBookings.map((booking: any) =>
          booking._id === bookingId
            ? { ...booking, status: newStatus, providerId: updatedBooking?.providerId || booking.providerId }
            : booking
        )
      );

      alert(`Booking status updated to ${newStatus}.`);
    } catch (err) {
      console.error("Error updating status:", err);
      alert("Failed to update status.");
    }
  };

  // Cancel booking handler (keeps same behavior as old code)
  const handleCancelBooking = (bookingId: string) => {
    const booking = bookings.find(b => b._id === bookingId || b.id === bookingId);
    if (!booking) {
      alert('Booking not found');
      return;
    }

    if (!canCancelBooking(booking)) {
      alert('Cannot cancel this booking online. Please contact customer care.');
      return;
    }

    // Reuse status change endpoint (same as old code)
    handleStatusChange(bookingId, 'cancelled');
  };

  const onRejectBooking = async (bookingId: string, reason: string) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${import.meta.env.VITE_BASE_URL}/api/booking/${bookingId}/status`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: "rejected", reason }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        alert(`Error: ${error.message}`);
        return;
      }

      setBookings(prev => prev.map(booking => 
        (booking._id === bookingId || booking.id === bookingId) 
          ? { ...booking, status: 'rejected' } 
          : booking
      ));
    } catch (error) {
      console.error("Failed to reject booking", error);
      alert("Failed to reject booking.");
    }
  };

  const verifyOtpForBooking = async (bookingId: string) => {
    if (!otpInput.trim()) {
      alert("Please enter OTP");
      return;
    }

    setVerifyingOtp(bookingId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_BASE_URL}/api/booking/${bookingId}/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ otp: otpInput }),
      });
      
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || "OTP verification failed");
        setVerifyingOtp(null);
        return;
      }

      alert('OTP verified — booking confirmed!');
      const returned = data.booking || data;
      setBookings(prev => prev.map(booking => 
        (booking._id === bookingId || booking.id === bookingId) 
          ? { ...booking, status: 'confirmed', otpVerified: true, startedAt: returned?.startedAt || new Date().toISOString(), sessionEndAt: returned?.sessionEndAt || null } 
          : booking
      ));
      
      setOtpInput('');
      setVerifyingOtp(null);
    } catch (err) {
      console.error("verify OTP error", err);
      alert("Error verifying OTP");
      setVerifyingOtp(null);
    }
  };

  const verifySecondOtpForBooking = async (bookingId: string) => {
    if (!secondOtpInput.trim() || secondOtpInput.length !== 6) {
      alert("Please enter a valid 6-digit second OTP");
      return;
    }
    
    setVerifyingSecondOtp(bookingId);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${import.meta.env.VITE_BASE_URL}/api/booking/${bookingId}/verify-second-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ otp: secondOtpInput }),
      });
      
      const data = await res.json();
      if (!res.ok) {
        alert(`Error: ${data.message || "Failed to verify second OTP"}`);
        setVerifyingSecondOtp(null);
        return;
      }
      
      const returned = data.booking || data;
      setBookings((prev) =>
        prev.map((b: any) => {
          const stable = b._id || b.id;
          if (stable === bookingId) {
            return { ...b, ...(returned || {}), status: "completed" };
          }
          return b;
        })
      );

      alert("Parking session completed!");
      setSecondOtpInput("");
      setVerifyingSecondOtp(null);
    } catch (err) {
      console.error("verifySecondOtpForBooking error:", err);
      setVerifyingSecondOtp(null);
    }
  };

  const handleReject = (bookingId: string) => {
    const booking = bookings.find((b) => b._id === bookingId || b.id === bookingId);
    if (!booking) {
      alert("Booking not found.");
      return;
    }

    // Use the old filter rule: disallow rejection within 1 hour of start
    if (!canRejectBooking(booking)) {
      alert("You can only reject a booking earlier than 1 hour before the start time.");
      return;
    }

    setSelectedBooking(bookingId);
    setRejectReasons((prev) => ({ ...prev, [bookingId]: "" }));
  };

  const confirmReject = () => {
    if (selectedBooking) {
      const reason = (rejectReasons[selectedBooking] || "").trim();
      if (!reason) {
        alert("Please provide a reason before rejecting.");
        return;
      }
      onRejectBooking(selectedBooking, reason);
      setSelectedBooking(null);
      setRejectReasons((prev) => {
        const next = { ...prev };
        delete next[selectedBooking];
        return next;
      });
    }
  };

  const filterBookings = () => {
    return bookings.filter((booking) => {
      const name = booking.user?.name
        ? booking.user.name.toLowerCase()
        : (booking.customerName || "").toLowerCase();
      const service = booking.serviceName ? booking.serviceName.toLowerCase() : "";
      
      const matchesSearch = name.includes(searchTerm.toLowerCase()) || service.includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || booking.status === statusFilter;
      const matchesPayment = paymentFilter === "all" || booking.paymentStatus === paymentFilter;
  
      let matchesDate = true;
      const bookingDate = booking.startTime ? new Date(booking.startTime) : null;
      const today = new Date();
  
      if (bookingDate) {
        if (dateFilter === "today") {
          matchesDate = bookingDate.toDateString() === today.toDateString();
        } else if (dateFilter === "week") {
          const weekAgo = new Date();
          weekAgo.setDate(today.getDate() - 7);
          matchesDate = bookingDate >= weekAgo;
        } else if (dateFilter === "month") {
          const monthAgo = new Date();
          monthAgo.setMonth(today.getMonth() - 1);
          matchesDate = bookingDate >= monthAgo;
        } else if (dateFilter === "specific" && specificDate) {
          matchesDate = bookingDate.toISOString().split('T')[0] === specificDate;
        }
      }
  
      return matchesSearch && matchesStatus && matchesDate && matchesPayment;
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'rejected': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'confirmed': return <Key className="h-4 w-4 text-blue-600" />; // Changed to Key for confirmed (start session ready)
      case 'active': return <Clock className="h-4 w-4 text-emerald-600" />; // Clock for active session
      case 'completed': return <Tag className="h-4 w-4 text-gray-600" />;
      case 'cancelled': return <XCircle className="h-4 w-4 text-orange-600" />; 
      default: return <Clock3 className="h-4 w-4 text-amber-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted': return 'text-green-700 bg-green-100 border-green-300 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700';
      case 'rejected': return 'text-red-700 bg-red-100 border-red-300 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700';
      case 'confirmed': return 'text-blue-700 bg-blue-100 border-blue-300 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700';
      case 'completed': return 'text-gray-700 bg-gray-100 border-gray-300 dark:bg-gray-900/50 dark:text-gray-300 dark:border-gray-700';
      case 'active': return 'text-emerald-700 bg-emerald-100 border-emerald-300 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-700';
      case 'cancelled': return 'text-orange-700 bg-orange-100 border-orange-300 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-700';
      default: return 'text-amber-700 bg-amber-100 border-amber-300 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-700';
    }
  };

  const getPaymentColor = (paymentStatus: string) => {
    return paymentStatus === 'paid' 
      ? 'text-green-700 bg-green-100 border-green-300 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700' 
      : 'text-amber-700 bg-amber-100 border-amber-300 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-700';
  };

  const formatCompactDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      dateString: date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  const filteredBookings = filterBookings();

  if (loading) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <LoadingScreen />
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center justify-center p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 mb-6"
          >
            <CalendarDays className="h-10 w-10 text-primary-500 mr-4" />
            <div className="text-left">
              <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                Parking Requests 
              </h2>
              <p className="text-md text-gray-600 dark:text-gray-400 font-medium">
                Manage all your customer bookings and sessions
              </p>
            </div>
          </motion.div>
        </div>

        {/* Enhanced Filters Section */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-10 bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-100 dark:border-gray-700"
        >
          <div className="flex items-center justify-between mb-6 border-b pb-3 border-gray-100 dark:border-gray-700">
            <div className="flex items-center">
              <Filter className="h-5 w-5 text-primary-500 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Quick Filters</h3>
            </div>
            <div className="text-sm font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 px-3 py-1 rounded-full">
              {filteredBookings.length} booking{filteredBookings.length !== 1 ? 's' : ''} shown
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by customer or service..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 shadow-inner"
              />
            </div>

            {/* Status Filter */}
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value as any)} 
              className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 shadow-inner"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
              <option value="confirmed">Confirmed</option>
              <option value="active">Active (In Session)</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>

            {/* Date Filter */}
            <div className="flex flex-col space-y-2 lg:space-y-0 lg:flex-row lg:space-x-2">
              <select 
                value={dateFilter} 
                onChange={(e) => {
                  setDateFilter(e.target.value as any);
                  if (e.target.value !== 'specific') {
                    setSpecificDate('');
                  }
                }}
                className={`flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 shadow-inner ${dateFilter === 'specific' ? 'lg:w-1/2' : 'lg:w-full'}`}
              >
                <option value="all">All Dates</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
                <option value="specific">Specific Date</option>
              </select>
              
              {dateFilter === 'specific' && (
                <input
                  type="date"
                  value={specificDate}
                  onChange={(e) => setSpecificDate(e.target.value)}
                  className="lg:w-1/2 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 shadow-inner"
                />
              )}
            </div>

            {/* Payment Filter */}
            <select 
              value={paymentFilter} 
              onChange={(e) => setPaymentFilter(e.target.value as any)} 
              className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 shadow-inner"
            >
              <option value="all">All Payments</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending Payment</option>
            </select>
          </div>

          {/* Active Filters Display - Cleaner Layout */}
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mr-2">Active Filters:</span>
            {searchTerm && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800 dark:bg-primary-900/50 dark:text-primary-300 border border-primary-300 dark:border-primary-700">
                Search: **{searchTerm}**
                <button onClick={() => setSearchTerm('')} className="ml-1.5 font-bold hover:text-primary-600 transition-colors">×</button>
              </span>
            )}
            {statusFilter !== 'all' && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-300 dark:border-blue-700">
                Status: **{statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}**
                <button onClick={() => setStatusFilter('all')} className="ml-1.5 font-bold hover:text-blue-600 transition-colors">×</button>
              </span>
            )}
            {dateFilter !== 'all' && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 border border-green-300 dark:border-green-700">
                Date: **{dateFilter === 'specific' ? specificDate : dateFilter.charAt(0).toUpperCase() + dateFilter.slice(1)}**
                <button onClick={() => {
                  setDateFilter('all');
                  setSpecificDate('');
                }} className="ml-1.5 font-bold hover:text-green-600 transition-colors">×</button>
              </span>
            )}
            {paymentFilter !== 'all' && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300 border border-purple-300 dark:border-purple-700">
                Payment: **{paymentFilter.charAt(0).toUpperCase() + paymentFilter.slice(1)}**
                <button onClick={() => setPaymentFilter('all')} className="ml-1.5 font-bold hover:text-purple-600 transition-colors">×</button>
              </span>
            )}
            {(searchTerm || statusFilter !== 'all' || dateFilter !== 'all' || paymentFilter !== 'all') && (
              <button
                onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('all');
                    setDateFilter('all');
                    setSpecificDate('');
                    setPaymentFilter('all');
                }}
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Clear All
              </button>
            )}
          </div>
        </motion.div>
        
        {/* Booking Grid - FIX applied: added items-start to the grid container */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 **items-start**">
          {filteredBookings.map((booking: any) => {
            const stableId = booking._id || booking.id;
            const startDate = booking.startTime ? formatCompactDate(booking.startTime) : null;
            const endDate = booking.endTime ? formatCompactDate(booking.endTime) : null;
            
            return (
              <motion.div 
                key={stableId} 
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                // Card now uses flex-col and flex-grow on the content to push the footer down 
                // BUT the main fix is the items-start on the parent grid.
                className="group bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-2xl border border-gray-100 dark:border-gray-700 transition-all duration-300 overflow-hidden relative flex flex-col"
              >
                {/* Status Badge - Prominent position */}
                <div className={`absolute top-0 right-0 m-3 px-3 py-1 rounded-full text-xs font-bold uppercase flex items-center shadow-md ${getStatusColor(booking.status)}`}>
                    {getStatusIcon(booking.status)}
                    <span className="ml-1">{booking.status?.charAt(0).toUpperCase() + booking.status?.slice(1)}</span>
                </div>

                {/* Header with Customer Info */}
                <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                  <div className="flex items-start space-x-4">
                    <div className="p-3 bg-primary-100 dark:bg-primary-900/50 rounded-full flex-shrink-0">
                      <User className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-extrabold text-gray-900 dark:text-white truncate">
                        {booking.user?.name || booking.customerName || 'Unknown Customer'}
                      </h3>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400 truncate flex items-center mt-0.5">
                        <MapPin className="h-4 w-4 text-secondary-500 mr-1.5" />
                        {booking.serviceName || 'Parking Service'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Main Content Area - FLEX-GROW applied here to fill vertical space if needed */}
                <div className="p-6 flex-grow">
                    {/* Date and Time - Two-Column Card Layout */}
                    <div className="grid grid-cols-2 gap-4 text-sm border-b border-gray-100 dark:border-gray-700 pb-4 mb-4">
                      
                      {/* Start Time Block */}
                      <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                        <div className="flex items-center text-primary-600 dark:text-primary-400 mb-1">
                          <Calendar className="h-4 w-4 mr-2" />
                          <span className="font-semibold uppercase text-xs tracking-wider">Start Time</span>
                        </div>
                        {startDate ? (
                          <div className="text-gray-900 dark:text-white mt-1">
                            <div className="font-bold text-base">{startDate.time}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{startDate.dateString}</div>
                          </div>
                        ) : (
                          <div className="text-gray-500 dark:text-gray-400 text-sm font-medium">N/A</div>
                        )}
                      </div>
                      
                      {/* End Time Block */}
                      <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                        <div className="flex items-center text-red-600 dark:text-red-400 mb-1">
                          <Clock className="h-4 w-4 mr-2" />
                          <span className="font-semibold uppercase text-xs tracking-wider">End Time</span>
                        </div>
                        {endDate ? (
                          <div className="text-gray-900 dark:text-white mt-1">
                            <div className="font-bold text-base">{endDate.time}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{endDate.dateString}</div>
                          </div>
                        ) : (
                          <div className="text-gray-500 dark:text-gray-400 text-sm font-medium">N/A</div>
                        )}
                      </div>
                    </div>

                    {/* Price and Payment Status (Kept inside the flex-grow area) */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2">
                        
                        <span className="text-xl font-extrabold text-gray-900 dark:text-white">
                          ₹{booking.totalPrice ? Math.ceil(booking.totalPrice) : "N/A"}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">(Total Estimate)</span>
                      </div>
                      <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border shadow-sm ${getPaymentColor(booking.paymentStatus)}`}>
                        <CreditCard className="h-3 w-3 mr-1" />
                        {booking.paymentStatus === 'paid' ? 'Pre-Paid' : 'Due'}
                      </div>
                    </div>
                </div>

                {/* Footer with Action Buttons (Fixed at the bottom) */}
                <div className="p-6 pt-0">
                  <div className="space-y-3">
                    {/* 1. Pending Booking Actions */}
                    {booking.status === 'pending' && (
                      <div className="space-y-3">
                        {selectedBooking === stableId ? (
                          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 space-y-2">
                            <textarea
                              value={rejectReasons[stableId] || ""}
                              onChange={(e) => setRejectReasons(prev => ({ ...prev, [stableId]: e.target.value }))}
                              placeholder="Reason for rejection..."
                              className="w-full px-3 py-2 border border-red-300 dark:border-red-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none placeholder-red-400 dark:placeholder-red-300"
                              rows={2}
                            />
                            <div className="flex space-x-2">
                              <button 
                                onClick={confirmReject} 
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-3 py-2.5 rounded-lg text-sm transition-colors duration-200 font-bold shadow-md"
                              >
                                Confirm Reject
                              </button>
                              <button 
                                onClick={() => setSelectedBooking(null)} 
                                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 px-3 py-2.5 rounded-lg text-sm transition-colors duration-200 font-medium"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex space-x-2">
                            <button 
                              onClick={() => handleStatusChange(booking._id, 'accepted')} 
                              className="flex-1 bg-primary-600 hover:bg-primary-700 text-white px-3 py-3 rounded-lg text-sm transition-colors duration-200 font-bold shadow-md shadow-primary-500/30"
                            >
                              <CheckCircle className="h-4 w-4 mr-2 inline-block" /> Accept Booking
                            </button>
                            <button 
                              onClick={() => handleReject(stableId)} 
                              className={`flex-1 px-3 py-3 rounded-lg text-sm transition-colors duration-200 font-medium shadow-md ${
                                canRejectBooking(booking) 
                                  ? 'bg-red-600 text-white hover:bg-red-700 shadow-red-500/30' 
                                  : 'bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400'
                              }`}
                              title={!canRejectBooking(booking) ? 'Cannot reject within 1 hour of start time' : 'Reject booking'}
                              disabled={!canRejectBooking(booking)}
                            >
                              <XCircle className="h-4 w-4 mr-2 inline-block" /> {canRejectBooking(booking) ? 'Reject' : 'Locked'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 2. Start Session OTP Verification (Accepted & Paid) */}
                    {booking.paymentStatus === 'paid' && booking.status === 'accepted' && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-300 dark:border-blue-800 p-4 shadow-inner">
                        <div className="flex items-center justify-between mb-3">
                           <span className="text-sm font-bold text-blue-800 dark:text-blue-300 flex items-center">
                              <Key className="h-4 w-4 text-blue-600 dark:text-blue-400 mr-2" />
                              Verify CHECK IN OTP
                           </span>
                           <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Session ID: {stableId.slice(-6)}</span>
                        </div>
                        
                        {canEnterOtp(booking) ? (
                          <div className="flex space-x-2">
                            <input
                              type="text"
                              placeholder="Enter 6-digit OTP"
                              value={verifyingOtp === stableId ? otpInput : ''}
                              onChange={(e) => {
                                if (verifyingOtp === stableId) {
                                  setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6));
                                } else {
                                  setVerifyingOtp(stableId);
                                  setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6));
                                }
                              }}
                              className="flex-1 px-4 py-2.5 border border-blue-300 dark:border-blue-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              maxLength={6}
                            />
                            <button
                              onClick={() => verifyOtpForBooking(stableId)}
                              disabled={verifyingOtp === stableId && otpInput.length !== 6}
                              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-lg text-sm transition-colors duration-200 font-bold shadow-md shadow-blue-500/30"
                            >
                              {verifyingOtp === stableId ? "Verifying..." : "Confirm Start"}
                            </button>
                          </div>
                        ) : (
                          <div className="text-center p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <Clock3 className="h-5 w-5 text-amber-600 dark:text-amber-400 mx-auto mb-1" />
                            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                              Ready {timeUntilStartText(booking)}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 3. End Session OTP Verification (Active/Confirmed) */}
                    {(booking.status === 'confirmed' || booking.status === 'active' || booking.status === 'overdue' ) && (
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-300 dark:border-emerald-800 p-4 shadow-inner">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-bold text-emerald-800 dark:text-emerald-300 flex items-center">
                            <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mr-2" />
                            {/* Session {!booking.startedAt ? 'Confirmed' : 'Active'} - End OTP */}
                            Verify CHECK OUT OTP
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{booking.startedAt ? 'Started' : 'Awaiting Start'}</span>
                        </div>
                        <div className="flex space-x-2">
                          <input
                            type="text"
                            placeholder="Enter 6-digit End OTP"
                            value={verifyingSecondOtp === stableId ? secondOtpInput : ''}
                            onChange={(e) => {
                              if (verifyingSecondOtp === stableId) {
                                setSecondOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6));
                              } else {
                                setVerifyingSecondOtp(stableId);
                                setSecondOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6));
                              }
                            }}
                            className="flex-1 px-4 py-2.5 border border-emerald-300 dark:border-emerald-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            maxLength={6}
                          />
                          <button
                            onClick={() => verifySecondOtpForBooking(stableId)}
                            disabled={verifyingSecondOtp === stableId && secondOtpInput.length !== 6}
                            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-lg text-sm transition-colors duration-200 font-bold shadow-md shadow-emerald-500/30"
                          >
                            {verifyingSecondOtp === stableId ? "Ending..." : "End Session"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 4. Cancel Button for Active/Confirmed Bookings (Non-Pending) */}
                    {booking.status !== 'completed' && booking.status !== 'cancelled' && booking.status !== 'pending' && (
                      <button
                        onClick={() => handleCancelBooking(stableId)}
                        className={`w-full text-sm px-3 py-3 rounded-lg transition-colors duration-200 font-medium shadow-md ${
                          canCancelBooking(booking) 
                            ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-orange-500/30' 
                            : 'bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400'
                        }`}
                        title={canCancelBooking(booking) ? 'Cancel booking (Refund Policy Applies)' : 'Cancellation window closed (within 24 hours of start)'}
                        disabled={!canCancelBooking(booking)}
                      >
                        {canCancelBooking(booking) ? 'Cancel Booking' : 'Cancellation Window Closed'}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Empty State */}
        {filteredBookings.length === 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 mt-6 shadow-lg"
          >
            <CalendarDays className="h-16 w-16 text-primary-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No Bookings Found</h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-lg mx-auto text-md">
              {searchTerm || statusFilter !== 'all' || dateFilter !== 'all' || paymentFilter !== 'all' 
                ? "Your current filters are too restrictive. Please try broadening your search criteria."
                : "You don't have any customer booking requests at the moment. New requests will appear here instantly."}
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default ProviderBookings;