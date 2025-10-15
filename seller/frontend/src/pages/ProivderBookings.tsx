import React, { useEffect, useState } from 'react';
import { 
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Clock3,
  CalendarDays
} from 'lucide-react';
import { motion } from 'framer-motion';
import LoadingScreen from './LoadingScreen';
import { useSocket } from '../context/SocketContext';

interface Booking {
  id?: string;         // some code used booking.id
  _id?: string;        // API uses _id for updates
  user?: any;
  customerName?: string;
  serviceName?: string;
  startTime?: string;
  endTime?: string;
  price?: number;
  totalPrice?: number;
  status?: 'pending' | 'accepted' | 'rejected' | string;
  parkingSpace?: any;  // optional - may contain price/discount info
}

const ProviderBookings = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [rejectReason, setRejectReason] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<string | null>(null);

  const socket = useSocket();

  const API_BASE = import.meta.env.VITE_BASE_URL;

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/booking/provider-bookings`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch bookings');

      const data = await response.json();
      setBookings(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (bookingId:any, newStatus:any) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/booking/${bookingId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(`Error: ${error.message}`);
        return;
      }

      setBookings((prevBookings:any) =>
        prevBookings.map((booking:any) =>
          booking._id === bookingId ? { ...booking, status: newStatus } : booking
        )
      );

      alert(`Booking status updated to ${newStatus}.`);
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Failed to update status.');
    }
  };

  useEffect(() => {
    // initial load
    fetchBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!socket) return;

    // Update booking parkingSpace.availableSpots when backend emits parking changes
    const handleParkingUpdate = (data: { parkingId?: string; availableSpots?: number } | any) => {
      if (!data) return;
      const parkingId = data.parkingId || data._id || data.id;
      const availableSpots = typeof data.availableSpots === 'number' ? data.availableSpots : data.available || data.availableSpots;
      if (!parkingId || typeof availableSpots !== 'number') return;

      setBookings((prev) =>
        prev.map((b: any) => {
          const ps = b.parkingSpace;
          const pid = ps && (ps._id ? String(ps._id) : ps.id ? String(ps.id) : null);
          if (pid && pid === String(parkingId)) {
            return { ...b, parkingSpace: { ...ps, availableSpots } };
          }
          return b;
        })
      );
    };

    // On booking events, refresh the list to keep authoritative state
    const handleBookingEvent = (payload: any) => {
      // payload may be { bookingId } or similar; we refetch list instead of partial update
      fetchBookings();
    };

    socket.on('parking-updated', handleParkingUpdate);
    socket.on('parking-released', handleParkingUpdate);

    socket.on('booking-confirmed', handleBookingEvent);
    socket.on('booking-completed', handleBookingEvent);

    return () => {
      socket.off('parking-updated', handleParkingUpdate);
      socket.off('parking-released', handleParkingUpdate);
      socket.off('booking-confirmed', handleBookingEvent);
      socket.off('booking-completed', handleBookingEvent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  const onRejectBooking = async (bookingId: string, reason: string) => {
    try {
      await fetch(`${API_BASE}/api/booking/reject/${bookingId}`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ reason }),
      });
      setBookings(prev => prev.map(booking => (booking._id === bookingId ? { ...booking, status: 'rejected' } : booking)));
    } catch (error) {
      console.error('Failed to reject booking', error);
    }
  };

  const handleReject = (bookingId: string) => {
    setSelectedBooking(bookingId);
    setRejectReason('');
  };

  const confirmReject = () => {
    if (selectedBooking && rejectReason.trim()) {
      onRejectBooking(selectedBooking, rejectReason);
      setSelectedBooking(null);
      setRejectReason('');
    }
  };

  const filterBookings = () => {
    return bookings.filter((booking: any) => {
      const name = booking.user?.name ? String(booking.user.name).toLowerCase() : "";
      const service = booking.serviceName ? String(booking.serviceName).toLowerCase() : "";

      const matchesSearch = name.includes(searchTerm.toLowerCase()) || service.includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || booking.status === statusFilter;

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
        }
      }

      return matchesSearch && matchesStatus && matchesDate;
    });
  };

  const getStatusIcon = (status: string | undefined) => {
    switch (status) {
      case 'accepted': return <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />;
      case 'rejected': return <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />;
      default: return <Clock3 className="h-5 w-5 text-primary-600 dark:text-primary-400" />;
    }
  };

  const getStatusBgColor = (status: string | undefined) => {
    switch (status) {
      case 'accepted': return 'bg-green-50 dark:bg-green-900/20';
      case 'rejected': return 'bg-red-50 dark:bg-red-900/20';
      default: return 'bg-primary-50 dark:bg-primary-900/20';
    }
  };

  // ----------------------------
  // Discount + total calculation
  // ----------------------------
  const safeNumber = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  // Compute discount percent from booking.parkingSpace if available
  const detectDiscountPercentFromSpace = (space: any) => {
    if (!space) return 0;
    // common keys: discount, discountPercent, discount_percentage
    let raw = space.discount ?? space.discountPercent ?? space.discount_percentage ?? 0;
    if (typeof raw === 'string') raw = raw.replace('%', '');
    if (typeof raw === 'object' && raw !== null) raw = raw.percent ?? raw.value ?? raw.amount ?? 0;
    const num = safeNumber(raw);
    if (!Number.isFinite(num)) return 0;
    return Math.max(0, Math.min(100, num));
  };

  // Compute booking totals (original and discounted). We prefer booking.totalPrice if present as original.
  const computeTotalsForBooking = (booking: Booking) => {
    const originalTotal = booking.totalPrice != null ? safeNumber(booking.totalPrice) : safeNumber(booking.price);
    const discountPercent = detectDiscountPercentFromSpace(booking.parkingSpace);
    const hasDiscount = discountPercent > 0;
    const discountedTotal = +(originalTotal * (1 - discountPercent / 100));
    return {
      originalTotal: +originalTotal.toFixed(2),
      discountedTotal: +discountedTotal.toFixed(2),
      discountPercent,
      hasDiscount
    };
  };
  // ----------------------------

  const filteredBookings = filterBookings();

  if (loading) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <LoadingScreen/>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900  mx-auto">
      <div className="max-w-fit  mx-auto p-4 sm:p-6 lg:p-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
            <CalendarDays className="h-7 w-7 text-primary-500 mr-3" />
            Provider Bookings
          </h2>
        </div>

        {/* Filters */}
        <div className="mb-6 flex space-x-4">
          <input
            type="text"
            placeholder="Search bookings..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg"
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="px-4 py-2 border rounded-lg">
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {/* Booking List */}
        <div className="space-y-4">
          {filteredBookings.map((booking:any) => {
            const totals = computeTotalsForBooking(booking);
            const bookingKey = booking.id ?? booking._id ?? Math.random().toString(36).slice(2,9);

            return (
              <motion.div key={bookingKey} layout className="p-6 border rounded-xl">
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-lg ${getStatusBgColor(booking.status)} mr-4`}>
                    {getStatusIcon(booking.status)}
                  </div>

                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-medium">{booking.user?.name ?? booking.customerName ?? 'Unknown'}</h3>
                        <p className="text-sm text-gray-500">{booking.serviceName}</p>
                        <p className="text-sm text-gray-500"><Calendar className="inline-block w-4 h-4 mr-2" /> {booking.startTime ? new Date(booking.startTime).toLocaleDateString() : 'N/A'}</p>
                        <p className="text-sm text-gray-500"><Clock className="inline-block w-4 h-4 mr-2" /> {booking.startTime ? new Date(booking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</p>
                      </div>

                      <div className="text-right">
                        <p className="text-sm text-gray-600">Price</p>

                        {/* Price display: show original struck-through and discounted if applicable */}
                        {totals.hasDiscount ? (
                          <div className="mt-1">
                            <div className="text-sm text-gray-400 line-through">₹{totals.originalTotal.toFixed(2)}</div>
                            <div className="text-lg font-semibold text-green-700">₹{totals.discountedTotal.toFixed(2)}</div>
                            <div className="mt-1 text-xs inline-block bg-green-500 text-white px-2 py-0.5 rounded">{totals.discountPercent}% OFF</div>
                          </div>
                        ) : (
                          <div className="mt-1 text-lg font-semibold">₹{totals.originalTotal.toFixed(2)}</div>
                        )}

                        <p className={`text-sm font-medium mt-2 ${booking.status === 'accepted' ? 'text-green-600' : booking.status === 'rejected' ? 'text-red-600' : 'text-gray-600'}`}>
                          {booking.status ? booking.status.charAt(0).toUpperCase() + booking.status.slice(1) : 'N/A'}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    {booking.status === 'pending' && (
                      <div className="mt-4 flex space-x-3">
                        {selectedBooking === booking.id ? (
                          <>
                            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason for rejection..." className="w-full px-4 py-2 border rounded-lg"></textarea>
                            <button onClick={confirmReject} className="px-4 py-2 bg-red-600 text-white rounded-lg">Confirm Reject</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => handleStatusChange(booking._id ?? booking.id, 'accepted')} className="flex-1 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors duration-200">Accept</button>
                            <button onClick={() => handleReject(booking.id ?? booking._id ?? '')} className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors duration-200">Reject</button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ProviderBookings;
