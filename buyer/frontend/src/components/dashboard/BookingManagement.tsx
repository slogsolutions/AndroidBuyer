import React, { useState } from 'react';
import { 
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Clock3,
  Search,
  CalendarDays
} from 'lucide-react';
import type { Booking } from '@/types';

interface BookingManagementProps {
  bookings: Booking[];
  onAcceptBooking: (bookingId: string) => void;
  onRejectBooking: (bookingId: string, reason: string) => void;
}

export function BookingManagement({ bookings, onAcceptBooking, onRejectBooking }: BookingManagementProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [rejectReason, setRejectReason] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<string | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted': return 'text-green-600 dark:text-green-400';
      case 'rejected': return 'text-red-600 dark:text-red-400';
      default: return 'text-primary-600 dark:text-primary-400';
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'accepted': return 'bg-green-50 dark:bg-green-900/20';
      case 'rejected': return 'bg-red-50 dark:bg-red-900/20';
      default: return 'bg-primary-50 dark:bg-primary-900/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted': return <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />;
      case 'rejected': return <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />;
      default: return <Clock3 className="h-5 w-5 text-primary-600 dark:text-primary-400" />;
    }
  };

  const filterBookings = () => {
    return bookings.filter(booking => {
      const matchesSearch =
        (booking.customerName ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (booking.serviceName ?? '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;
      
      let matchesDate = true;
      const bookingDate = booking.startTime ? new Date(booking.startTime) : null;
      const today = new Date();
      
      if (dateFilter === 'today' && bookingDate) {
        matchesDate = bookingDate.toDateString() === today.toDateString();
      } else if (dateFilter === 'week' && bookingDate) {
        const weekAgo = new Date();
        weekAgo.setDate(today.getDate() - 7);
        matchesDate = bookingDate >= weekAgo;
      } else if (dateFilter === 'month' && bookingDate) {
        const monthAgo = new Date();
        monthAgo.setMonth(today.getMonth() - 1);
        matchesDate = bookingDate >= monthAgo;
      }

      return matchesSearch && matchesStatus && matchesDate;
    });
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

  const filteredBookings = filterBookings();

  // ----------------------------
  // Discount helpers
  // ----------------------------
  const safeNumber = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  // Detect discount percent from booking.parkingSpace or booking fields (common keys)
  const detectDiscountPercentFromBooking = (booking: any) => {
    // try booking.discount or booking.parkingSpace.discount or common variations
    let raw = booking?.discount ?? booking?.discountPercent ?? booking?.discount_percentage ?? 0;

    // If there is a parkingSpace object, prefer discounts from there
    if (!raw && booking?.parkingSpace) {
      raw = booking.parkingSpace.discount ?? booking.parkingSpace.discountPercent ?? booking.parkingSpace.discount_percentage ?? 0;
    }

    // nested objects handling (e.g., { percent: 10 } or { value: 10 })
    if (typeof raw === 'object' && raw !== null) {
      raw = raw.percent ?? raw.value ?? raw.amount ?? 0;
    }

    // strings like "10%" -> "10"
    if (typeof raw === 'string') {
      raw = raw.replace?.('%', '') ?? raw;
    }

    const num = safeNumber(raw);
    const clamped = Math.max(0, Math.min(100, num));
    return clamped;
  };

  // Compute totals to show: original and discounted
  const computeTotalsForBooking = (booking: Booking) => {
    // Determine original amount:
    // Prefer booking.totalPrice (full booking amount). Otherwise fallback to booking.price (per booking or per-hour depending on your shape)
    const original = booking.totalPrice != null ? safeNumber(booking.totalPrice) : safeNumber(booking.price);

    const discountPercent = detectDiscountPercentFromBooking(booking);
    const hasDiscount = discountPercent > 0;
    const discounted = +(original * (1 - discountPercent / 100));
    return {
      original: +original.toFixed(2),
      discounted: +discounted.toFixed(2),
      discountPercent,
      hasDiscount
    };
  };
  // ----------------------------

  return (
    <div className="bg-white dark:bg-gray-900 min-h-screen">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
            <CalendarDays className="h-7 w-7 text-primary-500 mr-3" />
            Booking Management
          </h2>
        </div>

        {/* Filters */}
        <div className="mb-6 space-y-4 sm:space-y-0 sm:flex sm:items-center sm:space-x-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search bookings..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div className="flex space-x-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
            </select>

            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          </div>
        </div>

        {/* Bookings List */}
        <div className="space-y-4">
          {filteredBookings.map((booking) => {
            const totals = computeTotalsForBooking(booking as Booking);
            return (
              <div
                key={booking.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4">
                    <div className="flex items-center mb-4 sm:mb-0">
                      <div className={`p-2 rounded-lg ${getStatusBgColor(booking.status)} mr-4`}>
                        {getStatusIcon(booking.status)}
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                          {booking.customerName}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {booking.serviceName}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                          <Calendar className="h-4 w-4 mr-2" />
                          {booking.startTime ? new Date(booking.startTime).toLocaleDateString() : '-'}
                        </div>
                        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mt-1">
                          <Clock className="h-4 w-4 mr-2" />
                          {booking.startTime ? new Date(booking.startTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          }) : '-'}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Price</p>

                        {/* Show original struck-through and discounted price if discount exists */}
                        {totals.hasDiscount ? (
                          <div className="mt-1">
                            <div className="text-sm text-gray-400 line-through">₹{totals.original.toFixed(2)}</div>
                            <div className="text-lg font-medium text-green-700">₹{totals.discounted.toFixed(2)}</div>
                            <div className="mt-1 text-xs inline-block bg-green-500 text-white px-2 py-0.5 rounded">{totals.discountPercent}% OFF</div>
                          </div>
                        ) : (
                          <div className="mt-1 text-lg font-medium text-gray-900 dark:text-white">₹{totals.original.toFixed(2)}</div>
                        )}

                        <p className={`text-sm font-medium mt-2 ${getStatusColor(booking.status)}`}>
                          {booking.status ? booking.status.charAt(0).toUpperCase() + booking.status.slice(1) : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {booking.status === 'pending' && (
                    <div className="mt-4">
                      {selectedBooking === booking.id ? (
                        <div className="space-y-4">
                          <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Enter reason for rejection..."
                            className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            rows={3}
                          />
                          <div className="flex space-x-3">
                            <button
                              onClick={confirmReject}
                              className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors duration-200"
                            >
                              Confirm Reject
                            </button>
                            <button
                              onClick={() => setSelectedBooking(null)}
                              className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 px-4 py-2 rounded-lg transition-colors duration-200"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex space-x-3">
                          <button
                            onClick={() => onAcceptBooking(booking.id)}
                            className="flex-1 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors duration-200"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleReject(booking.id)}
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors duration-200"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {filteredBookings.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">No bookings found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
