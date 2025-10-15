// src/components/bookings/MyBookings.tsx
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import io from "socket.io-client";
import {
  FaMapMarkerAlt,
  FaRegCalendarAlt,
  FaCheckCircle,
  FaMoneyBillWave,
  FaTimesCircle,
  FaCreditCard,
  FaClipboard,
  FaClock,
  FaCar,
  FaParking,
  FaHistory,
  FaExclamationTriangle,
} from "react-icons/fa";
import { MdTimer, MdPayment, MdDirectionsCar } from "react-icons/md";
import LoadingScreen from "../../pages/LoadingScreen";

type Refund = {
  percent?: number;
  amount?: number;
  processedAt?: string | null;
};

type Booking = {
  _id: string;
  parkingSpace: any | null;
  startTime?: string | null;
  endTime?: string | null;
  status?: string;
  paymentStatus?: string;
  totalPrice?: number;
  priceParking?: number;
  pricePerHour?: number;
  secondOtp?: string | null;
  secondOtpExpires?: string | null;
  otp?: string | null;
  otpExpires?: string | null;
  // NEW: refund metadata returned by backend
  refund?: Refund | null;
};

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? window.location.origin;
const API_BASE = import.meta.env.VITE_BASE_URL ?? "";
const RZP_KEY = import.meta.env.VITE_RAZORPAY_KEY;

const MyBookings: React.FC = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const socketRef = useRef<any>(null);
  const [activeTab, setActiveTab] = useState("all");

  // store OTPs generated/returned by server keyed by bookingId
  const [generatedOtps, setGeneratedOtps] = useState<Record<string, { otp: string; expiresAt?: string }>>({});

  useEffect(() => {
    let mounted = true;

    const fetchBookings = async () => {
      try {
        const response = await axios.get(`${API_BASE}/api/booking/my-bookings`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        if (mounted) setBookings(response.data || []);
      } catch (err) {
        console.error("fetchBookings error:", err);
        if (mounted) setError("Failed to fetch bookings");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchBookings();

    // init socket.io and handlers
    try {
      socketRef.current = io(SOCKET_URL, { autoConnect: true });

      socketRef.current.on("connect", () => {
        console.log("socket connected", socketRef.current.id);
      });

      // booking-updated: payload { booking }
      socketRef.current.on("booking-updated", (payload: any) => {
        try {
          const updated = payload?.booking ?? payload;
          if (!updated || !updated._id) return;
          setBookings((prev) => prev.map((b) => (b._id === updated._id ? { ...b, ...updated } : b)));
          // if server returned a secondOtp in broadcast, show it
          if (updated.secondOtp) {
            setGeneratedOtps((prev) => ({ ...prev, [updated._id]: { otp: updated.secondOtp, expiresAt: updated.secondOtpExpires } }));
          }
        } catch (e) {
          console.warn("booking-updated handler error", e);
        }
      });

      // booking-overdue: payload { bookingId }
      socketRef.current.on("booking-overdue", (payload: any) => {
        if (!payload) return;
        const id = payload.bookingId ?? payload._id;
        if (!id) return;
        setBookings((prev) => prev.map((b) => (b._id === id ? { ...b, status: "overdue" } : b)));
      });

      // booking-completed
      socketRef.current.on("booking-completed", (payload: any) => {
        if (!payload) return;
        const id = payload.bookingId ?? payload._id;
        if (!id) return;
        setBookings((prev) => prev.map((b) => (b._id === id ? { ...b, status: "completed" } : b)));
      });
    } catch (e) {
      console.warn("socket init failed", e);
    }

    return () => {
      mounted = false;
      try {
        if (socketRef.current) socketRef.current.disconnect();
      } catch (e) {}
    };
  }, []);

  // ---------------- helpers ----------------
  const loadRazorpayScript = async () =>
    new Promise((resolve, reject) => {
      if ((window as any).Razorpay) return resolve(true);
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => reject(new Error("Failed to load Razorpay script"));
      document.body.appendChild(script);
    });

  const requestOTPFromServer = async (bookingId: string) => {
    const token = localStorage.getItem("token");
    const response = await axios.post(
      `${API_BASE}/api/booking/${bookingId}/generate-otp`,
      {},
      { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
    );
    return response.data;
  };

  const computePriceMeta = (space: any) => {
    const baseRaw = space?.priceParking ?? space?.price ?? space?.pricePerHour ?? 0;
    const base = Number(baseRaw) || 0;
    let rawDiscount = space?.discount ?? space?.discountPercent ?? space?.discount_percentage ?? 0;
    if (typeof rawDiscount === "string") rawDiscount = rawDiscount.replace?.("%", "") ?? rawDiscount;
    if (typeof rawDiscount === "object" && rawDiscount !== null) {
      rawDiscount = rawDiscount.percent ?? rawDiscount.value ?? rawDiscount.amount ?? 0;
    }
    const discountNum = Number(rawDiscount);
    const discountPercent = Number.isFinite(discountNum) ? Math.max(0, Math.min(100, discountNum)) : 0;
    return { basePrice: +base.toFixed(2), discountPercent, hasDiscount: discountPercent > 0 };
  };

  const getHoursDuration = (startISO?: string | null, endISO?: string | null) => {
    try {
      if (!startISO || !endISO) return 0;
      const start = new Date(startISO).getTime();
      const end = new Date(endISO).getTime();
      if (isNaN(start) || isNaN(end) || end <= start) return 0;
      const ms = end - start;
      return ms / (1000 * 60 * 60);
    } catch {
      return 0;
    }
  };

  const computeTotalsForBooking = (booking: Booking) => {
    const space = booking.parkingSpace ?? {};
    const meta = computePriceMeta(space);
    const perHour = Number(booking.priceParking ?? booking.pricePerHour ?? meta.basePrice ?? 0) || 0;
    const hours = getHoursDuration(booking.startTime, booking.endTime) || 0;
    const effectiveHours = hours > 0 ? hours : 1;
    const originalTotal = +(perHour * effectiveHours);
    const discountedTotal = +(originalTotal * (1 - (meta.discountPercent / 100)));
    return {
      perHour,
      hours: effectiveHours,
      originalTotal: +originalTotal.toFixed(2),
      discountedTotal: +discountedTotal.toFixed(2),
      discountPercent: meta.discountPercent,
      hasDiscount: meta.hasDiscount,
    };
  };

  // new helper: hours until start (can be fractional)
  const getHoursUntilStart = (booking: Booking) => {
    if (!booking.startTime) return -Infinity;
    const startTs = new Date(booking.startTime).getTime();
    if (isNaN(startTs)) return -Infinity;
    return (startTs - Date.now()) / (1000 * 60 * 60);
  };

  // Determine cancel refund percent based on rules:
  // > 3 hours => 60% refund
  // > 2 hours => 40% refund
  // > 1 hour => 10% refund
  // <= 1 hour => not allowed
  const getCancelRefundPercent = (booking: Booking) => {
    const hoursUntil = getHoursUntilStart(booking);
    if (hoursUntil > 3) return 60;
    if (hoursUntil > 2) return 40;
    if (hoursUntil > 1) return 10;
    return 0;
  };

  // Format address object to string
  const formatAddress = (address: any): string => {
    if (!address) return "Location not specified";
    if (typeof address === "string") return address;
    if (typeof address === "object") {
      const parts = [
        address.street,
        address.city,
        address.state,
        address.zipCode,
        address.country
      ].filter(Boolean);
      return parts.join(", ") || "Location not specified";
    }
    return "Location not specified";
  };

  // allow entering primary OTP 15 minutes before start
  const canEnterOtp = (booking: Booking) => {
    if (!booking.startTime) return false;
    const startTs = new Date(booking.startTime).getTime();
    if (isNaN(startTs)) return false;
    return Date.now() >= startTs - 15 * 60 * 1000;
  };

  // whether user can cancel (only if > 1 hour until start)
  const canCancel = (booking: Booking) => {
    return getHoursUntilStart(booking) > 1;
  };

  // ---------------- actions ----------------
  // Updated: accept booking object so we can compute refund & confirm with user
  const handleCancelBooking = async (booking: Booking) => {
    try {
      const totals = computeTotalsForBooking(booking);
      // use discountedTotal as paid amount (fallback to originalTotal)
      const paidAmount = Number(booking.totalPrice ?? totals.discountedTotal ?? totals.originalTotal ?? 0);
      const refundPercent = getCancelRefundPercent(booking);

      if (refundPercent <= 0) {
        alert("Cancellation not allowed within 1 hour of start time.");
        return;
      }

      const refundAmount = +(paidAmount * (refundPercent / 100));
      const retainedAmount = +(paidAmount - refundAmount);

      const confirmMsg = `Cancel booking?\n\nPaid: ₹${paidAmount.toFixed(2)}\nRefund: ₹${refundAmount.toFixed(2)} (${refundPercent}%)\nRetained by provider: ₹${retainedAmount.toFixed(2)}\n\nProceed with cancellation?`;
      if (!window.confirm(confirmMsg)) return;

      // Send DELETE with refundPercent (backend should process refund accordingly).
      // axios.delete allows a `data` field for payload.
      const response = await axios.delete(`${API_BASE}/api/booking/${booking._id}`, {
        data: { refundPercent },
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });

      // If server returns updated booking list or object, respect it; else remove locally
      if (response?.data?.booking) {
        const returned = response.data.booking;
        setBookings((prev) => prev.map((b) => (b._id === returned._id ? returned : b)));
      } else if (response?.data?.success === false) {
        // Server explicitly refused
        alert(response.data.message || "Cancellation failed on server");
      } else {
        // assume deleted
        setBookings((prev) => prev.filter((b) => b._id !== booking._id));
      }

      alert(`Booking cancelled. Refund: ₹${refundAmount.toFixed(2)} (${refundPercent}%).`);
    } catch (err: any) {
      console.error("cancel booking error:", err);
      const msg = err?.response?.data?.message ?? "Failed to cancel booking";
      alert(msg);
    }
  };

  const handlePayNow = async (bookingId: string, amountInRupees: number) => {
    try {
      await loadRazorpayScript();
      const amountInPaise = Math.round(Number(amountInRupees) * 100);

      const { data: paymentData } = await axios.post(
        `${API_BASE}/api/payment/initiate-payment`,
        { bookingId, amount: amountInPaise, isPaise: true },
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );

      const options = {
        key: RZP_KEY,
        amount: paymentData.amount,
        currency: "INR",
        order_id: paymentData.orderId,
        handler: async (response: any) => {
          try {
            const verifyResp = await axios.post(
              `${API_BASE}/api/payment/verify-payment`,
              {
                bookingId,
                razorpay_order_id: paymentData.orderId,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                extend: false,
                isPaise: true,
              },
              { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
            );

            alert("Payment successful!");
            // server will emit booking-updated; optimistic update only for quick UI feedback:
            setBookings((prev) => prev.map((b) => (b._id === bookingId ? { ...b, paymentStatus: "paid" } : b)));

            // if server returned OTP (rare for plain pay), keep it
            const otpObj = verifyResp?.data?.otp;
            if (otpObj?.otp) {
              setGeneratedOtps((prev) => ({ ...prev, [bookingId]: { otp: otpObj.otp, expiresAt: otpObj.expiresAt } }));
            }
          } catch (e) {
            console.error(e);
            alert("Payment verification failed");
          }
        },
        prefill: { name: "Parking Space", email: "customer@example.com", contact: "9999999999" },
        theme: { color: "#FFC107" },
      };

      const razorpay = new (window as any).Razorpay(options);
      razorpay.open();
    } catch (err) {
      console.error("handlePayNow error:", err);
      alert("Failed to initiate payment");
    }
  };

  const handleExtendAndPay = async (booking: Booking) => {
    try {
      const totals = computeTotalsForBooking(booking);
      const amountRupees = Number(totals.perHour || 0);
      await loadRazorpayScript();
      const amountInPaise = Math.round(amountRupees * 100);

      const { data: paymentData } = await axios.post(
        `${API_BASE}/api/payment/initiate-payment`,
        { bookingId: booking._id, amount: amountInPaise, extend: true, isPaise: true },
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );

      const options = {
        key: RZP_KEY,
        amount: paymentData.amount,
        currency: "INR",
        order_id: paymentData.orderId,
        handler: async (response: any) => {
          try {
            const verifyResp = await axios.post(
              `${API_BASE}/api/payment/verify-payment`,
              {
                bookingId: booking._id,
                razorpay_order_id: paymentData.orderId,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                extend: true,
                isPaise: true,
              },
              { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
            );

            // Optimistic: locally update endTime AND set status to active (important per your requirement)
            const originalEndTs = booking.endTime ? new Date(booking.endTime).getTime() : Date.now();
            const newEnd = new Date(originalEndTs + 60 * 60 * 1000);
            setBookings((prev) =>
              prev.map((b) =>
                b._id === booking._id ? { ...b, endTime: newEnd.toISOString(), paymentStatus: "paid", status: "active" } : b
              )
            );

            // If server returned booking, use that authoritative object (server should set status accordingly)
            if (verifyResp?.data?.booking) {
              const returned = verifyResp.data.booking;
              setBookings((prev) => prev.map((b) => (b._id === returned._id ? returned : b)));
            }

            alert("Extension payment successful — booking extended by 1 hour.");

            // extension does not usually generate checkout OTP; if server returns OTP show it
            const maybeOtp = verifyResp?.data?.otp;
            if (maybeOtp?.otp) {
              setGeneratedOtps((prev) => ({ ...prev, [booking._id]: { otp: maybeOtp.otp, expiresAt: maybeOtp.expiresAt } }));
              navigate("/track", { state: { parkingSpace: booking.parkingSpace, otp: maybeOtp.otp, bookingId: booking._id, expiresAt: maybeOtp.expiresAt } });
              return;
            }
          } catch (e) {
            console.error("Extension payment verification failed", e);
            alert("Extension payment verification failed");
          }
        },
        prefill: { name: "Parking Space", email: "customer@example.com", contact: "9999999999" },
        theme: { color: "#FFC107" },
      };

      const razorpay = new (window as any).Razorpay(options);
      razorpay.open();
    } catch (err) {
      console.error("handleExtendAndPay error:", err);
      alert("Failed to create extension payment. Please try again.");
    }
  };

  // Pay fine flow:
  // - calls /initiate-payment and /verify-payment with fine=true
  // - server will increment totalPrice and generate secondOtp (checkout OTP)
  // - server should NOT complete booking automatically; provider must verify secondOtp to complete
  const handlePayFine = async (booking: Booking) => {
    try {
      // compute fine: overdue hours * (0.5 * perHour or booking.totalPrice)
      const now = Date.now();
      const endTs = booking.endTime ? new Date(booking.endTime).getTime() : now;
      const overdueMs = Math.max(0, now - endTs);
      const overdueHours = Math.max(1, Math.ceil(overdueMs / (1000 * 60 * 60)));

      const totals = computeTotalsForBooking(booking);
      const fallbackPerHour = totals.perHour || 0;
      // const bookingTotalPrice = Number(booking.totalPrice ?? 0);
      // const fineAmount = overdueHours * 0.5 * (bookingTotalPrice > 0 ? bookingTotalPrice : fallbackPerHour);
      const bookingTotalPrice = Number(booking.priceParking ?? 0);
      const fineAmount = 100 + overdueHours * (bookingTotalPrice > 0 ? bookingTotalPrice : fallbackPerHour);
      const fineInPaise = Math.round(fineAmount * 100);

      await loadRazorpayScript();

      const { data: paymentData } = await axios.post(
        `${API_BASE}/api/payment/initiate-payment`,
        { bookingId: booking._id, amount: fineInPaise, isPaise: true, fine: true },
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );

      const options = {
        key: RZP_KEY,
        amount: paymentData.amount,
        currency: "INR",
        order_id: paymentData.orderId,
        handler: async (response: any) => {
          try {
            const verifyResp = await axios.post(
              `${API_BASE}/api/payment/verify-payment`,
              {
                bookingId: booking._id,
                razorpay_order_id: paymentData.orderId,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                extend: false,
                isPaise: true,
                fine: true,
              },
              { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
            );

            // server returns updated booking (if any) and otp object if generated
            const returnedBooking = verifyResp?.data?.booking;
            const returnedOtpObj = verifyResp?.data?.otp;

            if (returnedBooking) {
              setBookings((prev) => prev.map((b) => (b._id === returnedBooking._id ? returnedBooking : b)));
            } else {
              // If server didn't return booking, mark paymentStatus=paid and set status active (server should have revived it)
              setBookings((prev) => prev.map((b) => (b._id === booking._id ? { ...b, paymentStatus: "paid", status: "active" } : b)));
            }

            if (returnedOtpObj?.otp) {
              setGeneratedOtps((prev) => ({ ...prev, [booking._id]: { otp: returnedOtpObj.otp, expiresAt: returnedOtpObj.expiresAt } })); 
              alert(`Fine paid. Checkout OTP generated: ${returnedOtpObj.otp}. Provide this to provider to checkout.`);
              // Do NOT auto-complete booking — provider must verify second OTP via provider UI/API
              return;
            }

            // fallback: ask server to explicitly generate OTP (shouldn't normally be needed)
            try {
              const otpRes = await requestOTPFromServer(booking._id);
              setGeneratedOtps((prev) => ({ ...prev, [booking._id]: { otp: otpRes.otp, expiresAt: otpRes.expiresAt } }));
              alert(`Fine paid. Checkout OTP generated: ${otpRes.otp}. Provide this to provider to checkout.`);
            } catch (otpErr) {
              console.error("Failed to generate OTP after fine payment", otpErr);
              alert("Fine paid but failed to generate checkout OTP. Contact provider/admin.");
            }
          } catch (e) {
            console.error("Fine payment verification failed", e);
            alert("Fine payment verification failed");
          }
        },
        prefill: { name: "Parking Space", email: "customer@example.com", contact: "9999999999" },
        theme: { color: "#FFC107" },
      };

      const razorpay = new (window as any).Razorpay(options);
      razorpay.open();
    } catch (err) {
      console.error("handlePayFine error:", err);
      alert("Failed to initiate fine payment. Try again.");
    }
  };

  const handleGenerateOtpForCompletion = async (booking: Booking) => {
    try {
      const res = await requestOTPFromServer(booking._id);
      // server returns either primary OTP (for checkin) or second OTP (for checkout)
      setGeneratedOtps((prev) => ({ ...prev, [booking._id]: { otp: res.otp, expiresAt: res.expiresAt } }));
    } catch (err) {
      console.error("Failed to generate OTP", err);
      alert("Failed to generate OTP. Try again.");
    }
  };

  const handleTrackNow = async (booking: Booking) => {
    try {
      const res = await requestOTPFromServer(booking._id);
      navigate("/track", {
        state: {
          parkingSpace: booking.parkingSpace,
          otp: res.otp,
          bookingId: booking._id,
          expiresAt: res.expiresAt,
        },
      });
    } catch (e) {
      console.error("handleTrackNow error:", e);
      alert("Failed to generate OTP. Try again.");
    }
  };

  const statusLabel = (s?: string) => {
    switch (s) {
      case "pending":
        return { label: "Pending", color: "text-yellow-600", bgColor: "bg-yellow-100", borderColor: "border-yellow-200", icon: FaClock };
      case "accepted":
        return { label: "Accepted", color: "text-blue-600", bgColor: "bg-blue-100", borderColor: "border-blue-200", icon: FaCheckCircle };
      case "confirmed":
        return { label: "Confirmed", color: "text-indigo-600", bgColor: "bg-indigo-100", borderColor: "border-indigo-200", icon: FaCheckCircle };
      case "active":
        return { label: "Active", color: "text-green-600", bgColor: "bg-green-100", borderColor: "border-green-200", icon: FaCar };
      case "overdue":
        return { label: "Overdue", color: "text-red-600", bgColor: "bg-red-100", borderColor: "border-red-200", icon: FaExclamationTriangle };
      case "rejected":
        return { label: "Rejected", color: "text-red-600", bgColor: "bg-red-100", borderColor: "border-red-200", icon: FaTimesCircle };
      case "completed":
        return { label: "Completed", color: "text-gray-600", bgColor: "bg-gray-100", borderColor: "border-gray-200", icon: FaHistory };
      case "cancelled":
        return { label: "Cancelled", color: "text-red-600", bgColor: "bg-red-50", borderColor: "border-red-200", icon: FaTimesCircle };
      default:
        return { label: s ?? "Unknown", color: "text-gray-600", bgColor: "bg-gray-100", borderColor: "border-gray-200", icon: FaClock };
    }
  };

  // Filter bookings based on active tab
  const filteredBookings = bookings.filter(booking => {
    if (activeTab === "all") return true;
    if (activeTab === "active") return booking.status === "active";
    if (activeTab === "upcoming") return ["pending", "accepted", "confirmed"].includes(booking.status || "");
    if (activeTab === "completed") return booking.status === "completed";
    if (activeTab === "overdue") return booking.status === "overdue";
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <LoadingScreen />
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center p-8 bg-white rounded-3xl shadow-2xl">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Error Loading Bookings</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  // ---------------- render ----------------
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-8 px-4">
      {/* Animated Background Elements */}
      <div className="fixed top-0 left-0 w-72 h-72 bg-blue-200/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 animate-pulse" />
      <div className="fixed bottom-0 right-0 w-96 h-96 bg-indigo-200/20 rounded-full blur-3xl translate-x-1/3 translate-y-1/3 animate-pulse" />
      
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-4 rounded-2xl shadow-2xl">
              <FaParking className="text-white text-3xl" />
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-slate-800 to-indigo-600 bg-clip-text text-transparent">
              Your Bookings
            </h1>
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Manage your parking sessions, track active bookings, and view your parking history
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center gap-3">
              <div className="bg-blue-500/10 p-3 rounded-xl">
                <FaClock className="text-blue-600 text-xl" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-800">{bookings.filter(b => ["pending", "accepted", "confirmed"].includes(b.status || "")).length}</div>
                <div className="text-sm text-gray-600">Upcoming</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center gap-3">
              <div className="bg-green-500/10 p-3 rounded-xl">
                <FaCar className="text-green-600 text-xl" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-800">{bookings.filter(b => b.status === "active").length}</div>
                <div className="text-sm text-gray-600">Active</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center gap-3">
              <div className="bg-red-500/10 p-3 rounded-xl">
                <FaExclamationTriangle className="text-red-600 text-xl" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-800">{bookings.filter(b => b.status === "overdue").length}</div>
                <div className="text-sm text-gray-600">Overdue</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center gap-3">
              <div className="bg-gray-500/10 p-3 rounded-xl">
                <FaHistory className="text-gray-600 text-xl" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-800">{bookings.filter(b => b.status === "completed").length}</div>
                <div className="text-sm text-gray-600">Completed</div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-2 shadow-lg border border-white/20 mb-8">
          <div className="flex flex-wrap gap-2">
            {[
              { id: "all", label: "All Bookings", icon: FaHistory },
              { id: "upcoming", label: "Upcoming", icon: FaClock },
              { id: "active", label: "Active", icon: FaCar },
              { id: "overdue", label: "Overdue", icon: FaExclamationTriangle },
              { id: "completed", label: "Completed", icon: FaCheckCircle }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
                    activeTab === tab.id
                      ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg transform scale-105"
                      : "text-gray-600 hover:bg-gray-100/80 hover:text-gray-800"
                  }`}
                >
                  <Icon className="text-lg" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bookings Grid */}
        {filteredBookings.length === 0 ? (
          <div className="text-center py-16 bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/20">
            <div className="text-6xl mb-4">🚗</div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">No bookings found</h3>
            <p className="text-gray-600">You don't have any {activeTab !== "all" ? activeTab : ""} bookings at the moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
            {filteredBookings.map((booking, index) => {
              const st = statusLabel(booking.status);
              const StatusIcon = st.icon;
              const now = Date.now();
              const endTs = booking.endTime ? new Date(booking.endTime).getTime() : NaN;
              const isActive = booking.status === "active";
              const beforeEnd = !isNaN(endTs) ? now < endTs : false;
              const afterOrAtEnd = !isNaN(endTs) ? now >= endTs : false;

              const totals = computeTotalsForBooking(booking);
              const perHour = totals.perHour;
              const extensionAmount = Math.ceil(perHour);
              const generated = generatedOtps[booking._id] ?? (booking.secondOtp ? { otp: booking.secondOtp, expiresAt: booking.secondOtpExpires } : undefined);
              const payableStatuses = ["pending", "accepted", "confirmed"];
              const showPayNow = booking.paymentStatus === "pending" && payableStatuses.includes(booking.status);

              const overdueMs = Math.max(0, (isNaN(endTs) ? 0 : now - endTs));
              const overdueHours = overdueMs > 0 ? Math.ceil(overdueMs / (1000 * 60 * 60)) : 0;
              const bookingTotalPrice = Number(booking.totalPrice ?? 0);
              const previewFine = overdueHours > 0 ? overdueHours * 0.5 * (bookingTotalPrice > 0 ? bookingTotalPrice : perHour) : 0;

              // New: showPayFine only when end time has passed and booking not completed
              const hasEnded = !isNaN(endTs) && now > endTs;
              const showPayFine = hasEnded && booking.status !== "completed";

              // cancellation eligibility and refund percent
              const refundPercent = getCancelRefundPercent(booking);
              const paidAmount = Number(booking.totalPrice ?? totals.discountedTotal ?? totals.originalTotal ?? 0);
              const refundAmount = +(paidAmount * (refundPercent / 100));

              // Determine if refunded metadata present
              const hasRefund = !!(booking.refund && booking.refund.amount && booking.refund.amount > 0) || booking.paymentStatus === 'refunded';

              return (
                <div 
                  key={booking._id} 
                  className="group bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl hover:shadow-3xl transition-all duration-500 transform hover:scale-105 border border-white/20 overflow-hidden"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {/* Header with Gradient */}
                  <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16" />
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xl font-bold truncate">{booking.parkingSpace?.title || "Parking Space"}</h3>
                        <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${st.bgColor} ${st.borderColor} border backdrop-blur-sm`}>
                          <StatusIcon className={`text-sm ${st.color}`} />
                          <span className={`text-sm font-semibold ${st.color}`}>{st.label}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-blue-100">
                        <FaMapMarkerAlt />
                        <span className="text-sm">{formatAddress(booking.parkingSpace?.address)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Booking Details */}
                  <div className="p-6 space-y-4">
                    {/* Time Information */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-gray-700">
                        <div className="bg-blue-100 p-2 rounded-lg">
                          <FaRegCalendarAlt className="text-blue-600 text-sm" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-500">Start Time</div>
                          <div className="font-semibold">{booking.startTime ? new Date(booking.startTime).toLocaleString() : "N/A"}</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 text-gray-700">
                        <div className="bg-green-100 p-2 rounded-lg">
                          <MdTimer className="text-green-600 text-sm" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-500">End Time</div>
                          <div className="font-semibold">{booking.endTime ? new Date(booking.endTime).toLocaleString() : "N/A"}</div>
                        </div>
                      </div>
                    </div>

                    {/* Price Information */}
                    <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-2xl p-4 border border-gray-200/50">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="bg-green-100 p-2 rounded-lg">
                          <FaMoneyBillWave className="text-green-600 text-sm" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-500">Total Price</div>
                          {totals.hasDiscount ? (
                            <div className="flex items-center gap-3">
                              <div className="text-2xl font-bold text-green-700">₹{totals.discountedTotal.toFixed(2)}</div>
                              <div className="text-sm text-gray-400 line-through">₹{totals.originalTotal.toFixed(2)}</div>
                              <div className="bg-green-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                                {totals.discountPercent}% OFF
                              </div>
                            </div>
                          ) : (
                            <div className="text-2xl font-bold text-gray-800">₹{totals.originalTotal.toFixed(2)}</div>
                          )}

                          {/* NEW: show refund info when present */}
                          {hasRefund && (
                            <div className="mt-3 inline-flex items-center gap-3">
                              <div className="text-sm font-semibold text-red-600">
                                Refunded: ₹{(booking.refund?.amount ?? 0).toFixed(2)}
                                {booking.refund?.percent ? ` (${booking.refund.percent}% )` : booking.paymentStatus === 'refunded' ? ' (refunded)' : ''}
                              </div>
                              {booking.refund?.processedAt && (
                                <div className="text-xs text-gray-500">on {new Date(booking.refund.processedAt).toLocaleString()}</div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-3 pt-4">
                      { /* Show cancel when booking is upcoming (pending/accepted/confirmed) and allowed by time rules */ }
                      {["pending","accepted","confirmed"].includes(booking.status ?? "") && canCancel(booking) &&  Number(booking.totalPrice ?? 0) > 0 &&(
                        <button 
                          onClick={() => handleCancelBooking(booking)} 
                          className="w-full bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold py-3 px-4 rounded-xl hover:from-red-600 hover:to-red-700 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                        >
                          <FaTimesCircle className="text-lg" />
                          Cancel Booking {refundPercent > 0 ? `- Refund ₹${refundAmount.toFixed(2)} (${refundPercent}%)` : ""}
                        </button>
                      )}

                      {/* If cancellation not allowed because <1 hour left, optionally show disabled button or nothing */ }
                      {["pending","accepted","confirmed"].includes(booking.status ?? "") && !canCancel(booking) && Number(booking.totalPrice ?? 0) > 0 &&(
                        <div className="text-center text-sm text-red-600 font-medium">
                          Cancellation not available within 1 hour of start time
                        </div>
                      )}

                      {showPayNow && (
                        <button 
                          onClick={() => handlePayNow(booking._id, totals.discountedTotal)} 
                          className="w-full bg-gradient-to-r from-yellow-500 to-amber-600 text-white font-semibold py-3 px-4 rounded-xl hover:from-yellow-600 hover:to-amber-700 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                        >
                          <MdPayment className="text-lg" />
                          Pay Now - ₹{totals.discountedTotal.toFixed(2)}
                        </button>
                      )}

                      {/* Active session flows */}
                      {isActive && (
                        <>
                          {beforeEnd && (
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <button 
                                  onClick={() => handleGenerateOtpForCompletion(booking)} 
                                  className="bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold py-3 px-4 rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center justify-center gap-2"
                                >
                                  Check Out
                                </button>
                                <button 
                                  onClick={() => handleTrackNow(booking)} 
                                  className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold py-3 px-4 rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center justify-center gap-2"
                                >
                                  <MdDirectionsCar className="text-lg" />
                                  Track
                                </button>
                              </div>

                              <button 
                                onClick={() => handleExtendAndPay(booking)} 
                                className="w-full bg-gradient-to-r from-purple-500 to-pink-600 text-white font-semibold py-3 px-4 rounded-xl hover:from-purple-600 hover:to-pink-700 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                              >
                                Extend 1 Hour - ₹{extensionAmount}
                              </button>
                            </div>
                          )}

                          {afterOrAtEnd && (
                            <div className="space-y-3">
                              <button disabled className="w-full bg-gray-300 text-gray-700 font-semibold py-3 px-4 rounded-xl cursor-not-allowed flex items-center justify-center gap-2">
                                Check Out Time Over
                              </button>
                              {/* previously there was a duplicate pay fine inside here; removed to avoid duplicates */}
                              <div className="text-center text-sm text-red-600 font-medium">
                                {overdueHours > 0 ? `Overdue: ${overdueHours} hr${overdueHours > 1 ? "s" : ""}` : "Time over"}
                              </div>
                              { /* If the session has passed, the centralized pay fine button (below) will show */ }
                            </div>
                          )}
                        </>
                      )}

                      {/* Centralized Pay Fine button: only when end time has passed and not completed */}
                      {showPayFine && (
                        <div className="space-y-2">
                          <button 
                            onClick={() => handlePayFine(booking)} 
                            className="w-full bg-gradient-to-r from-red-600 to-orange-600 text-white font-semibold py-3 px-4 rounded-xl hover:from-red-700 hover:to-orange-700 transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center justify-center gap-2"
                          >
                            Pay Fine - ₹{previewFine.toFixed(2)}
                          </button>
                          <div className="text-center text-sm text-red-600 font-medium">
                            Overdue: {overdueHours} hr{overdueHours > 1 ? "s" : ""}
                          </div>
                        </div>
                      )}

                      {/* Track button for paid bookings */}
                      {booking.paymentStatus === "paid" && booking.status !== "cancelled" && booking.status !== "completed" && !isActive && (
                        <button 
                          onClick={() => handleTrackNow(booking)} 
                          className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold py-3 px-4 rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                        >
                          <MdDirectionsCar className="text-lg" />
                          Track Now
                        </button>
                      )}
                    </div>

                    {/* OTP Display */}
                    {generated && (
                      <div className="mt-4 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl border border-indigo-200/60 shadow-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="text-xs font-semibold text-indigo-600/80 mb-2 uppercase tracking-wide">Checkout OTP</div>
                            <div className="text-2xl font-mono font-bold tracking-widest bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                              {generated.otp}
                            </div>
                            {generated.expiresAt && (
                              <div className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                                <MdTimer className="text-amber-500" />
                                Expires: {new Date(generated.expiresAt).toLocaleString()}
                              </div>
                            )}
                          </div>
                          <button 
                            onClick={() => { navigator.clipboard?.writeText(generated.otp); alert("OTP copied to clipboard"); }} 
                            className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-3 rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 transform hover:scale-110 shadow-lg"
                            title="Copy OTP"
                          >
                            <FaClipboard />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add custom animations */}
      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.6s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default MyBookings;
