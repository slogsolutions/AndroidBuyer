// src/components/dashboard/Profile.tsx
import React, { useEffect, useState, useMemo } from "react";
import ProviderLocations from "./ProviderSpaces";
import BookedSlots from "./BookedSlot";
import axios from "axios";
import LoadingScreen from "../../pages/LoadingScreen";
import { Wallet } from "./Wallet";
import { Settings } from "./Settings";
import type { Booking, Provider } from "../../types";
import { useRole } from "../../context/RoleContext"; // <- added
import { useAuth } from "../../context/AuthContext"; // <- added to prefer auth.user for instant display

/**
 * Dashboard Profile component that supports both Seller (provider) and Buyer views.
 *
 * Seller:
 *  - Shows ProviderLocations / Settings / BookedSlots / Wallet as before
 *  - Fetches provider bookings from /api/booking/provider-bookings
 *
 * Buyer:
 *  - Shows only a compact buyer profile + booking count/list
 *  - Fetches user bookings from /api/booking/user-bookings
 *
 * Replace your existing file with this. No other changes required.
 */

export function Profile() {
  // page choices (for sellers we show ProviderLocations, Settings, BookedSlots, Wallet)
  const [currentPage, setCurrentPage] = useState<
    "ProviderLocations" | "Settings" | "BookedSlots" | "Wallet" | "BuyerBookings"
  >("ProviderLocations");

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<Provider | null>(null); // holds /api/auth/me response
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [darkMode, setDarkMode] = useState(() => {
    return JSON.parse(localStorage.getItem("darkMode") || "false");
  });

  const API_BASE_URL = import.meta.env.VITE_BASE_URL;

  // read UI role from RoleContext so toggling buyer/seller updates dashboard immediately
  const { role: uiRole } = useRole();

  // prefer auth.user for instantaneous display (so edits reflect immediately)
  const auth = useAuth();

  // aggregated stats (from new endpoint /api/stats/me)
  const [stats, setStats] = useState<{
    buyerBookingsCount?: number;
    providerBookingsCount?: number;
    spacesCount?: number;
    earnings?: number;
    bookingsByDate?: any[];
  } | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");
        const headers = { Authorization: `Bearer ${token}` };

        // Use auth.user immediately if available for faster UI updates
        if (auth?.user) {
          setUser(auth.user as Provider);
        }

        // Fetch profile details (fresh copy)
        const profileRes = await axios.get(`${API_BASE_URL}/api/auth/me`, { headers });
        if (!isMounted) return;
        const profileData = profileRes.data;
        setUser(profileData);

        // Now fetch aggregated stats (used for counts / earnings)
        try {
          const statsRes = await axios.get(`${API_BASE_URL}/api/stats/me`, { headers });
          if (!isMounted) return;
          if (statsRes.status === 200) {
            setStats(statsRes.data);
          }
        } catch (err) {
          // stats endpoint may not be present yet — keep silent but log
          console.warn("Failed to fetch stats:", err);
        }

        // detect role/seller — respect UI toggle (uiRole) first
        const profileIndicatesSeller =
          profileData?.role === "seller" ||
          profileData?.isSeller === true ||
          profileData?.seller === true ||
          profileData?.type === "seller";

        const isSeller = uiRole === "seller" ? true : profileIndicatesSeller;

        // if uiRole is 'buyer' we prefer to show buyer bookings page
        if (!isSeller) {
          setCurrentPage("BuyerBookings");
        } else {
          // default for seller remains ProviderLocations if currently set to BuyerBookings
          setCurrentPage((cur) => (cur === "BuyerBookings" ? "ProviderLocations" : cur));
        }

        // fetch bookings depending on role (respecting uiRole)
        if (isSeller) {
          // provider bookings for seller dashboard
          try {
            const bookingsRes = await axios.get(`${API_BASE_URL}/api/booking/provider-bookings`, { headers });
            if (!isMounted) return;
            setBookings(bookingsRes.data || []);
          } catch (err) {
            console.warn("provider-bookings request failed:", err);
            setBookings([]);
          }
        } else {
          // buyer bookings
          try {
            const bookingsRes = await axios.get(`${API_BASE_URL}/api/booking/user-bookings`, { headers });
            if (!isMounted) return;
            setBookings(bookingsRes.data || []);
          } catch (err) {
            console.warn("user-bookings request failed:", err);
            setBookings([]);
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        setBookings([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
    // re-run when uiRole changes so toggling updates view immediately
  }, [API_BASE_URL, uiRole, auth]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <LoadingScreen />
      </div>
    );
  }

  // Determine role again for render-time (defensive).
  // Prioritize UI toggle (uiRole) first so render matches the toggle instantly.
  const isSeller = useMemo(() => {
    if (uiRole === "seller") return true;
    if (uiRole === "buyer") return false;
    if (!user) return false;
    return (
      user.role === "seller" ||
      (user as any).isSeller === true ||
      (user as any).seller === true ||
      (user as any).type === "seller"
    );
  }, [uiRole, user]);

  // Normalize KYC status display (verified / pending / not done)
  const kycRaw = useMemo(() => {
    if (!user) return "";
    const raw =
      (user as any).kycStatus ||
      (user as any).kycData?.status ||
      ((user as any).kycData?.verified ? "approved" : "") ||
      "";
    return raw.toString().toLowerCase();
  }, [user]);

  const kycDisplay = useMemo(() => {
    if (kycRaw === "approved" || kycRaw === "verified" || kycRaw === "done") {
      return { text: "verified", className: "text-green-600" };
    }
    if (kycRaw === "pending") {
      return { text: "pending", className: "text-yellow-600" };
    }
    return { text: "not done", className: "text-gray-500" };
  }, [kycRaw]);

  // SELLER: Render the seller dashboard (same as original)
  if (isSeller) {
    return (
      <div className="mx-5 mb-52 my-5 min-h-screen bg-gray-100">
        {/* Top toggle */}
        <div className="flex space-x-4 mb-6">
          <button
            className={`px-4 py-2 rounded-lg font-semibold transition ${
              currentPage === "ProviderLocations" ? "bg-red-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
            onClick={() => setCurrentPage("ProviderLocations")}
          >
            Provider Locations
          </button>

          <button
            className={`px-4 py-2 rounded-lg font-semibold transition ${
              currentPage === "BookedSlots" ? "bg-red-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
            onClick={() => setCurrentPage("BookedSlots")}
          >
            Booked Slots
          </button>

          <button
            className={`px-4 py-2 rounded-lg font-semibold transition ${
              currentPage === "Wallet" ? "bg-red-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
            onClick={() => setCurrentPage("Wallet")}
          >
            Wallet
          </button>

          <button
            className={`px-4 py-2 rounded-lg font-semibold transition ${
              currentPage === "Settings" ? "bg-red-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
            onClick={() => setCurrentPage("Settings")}
          >
            Settings
          </button>
        </div>

        <div className="mt-6">
          {currentPage === "ProviderLocations" && <ProviderLocations />}
          {currentPage === "BookedSlots" && <BookedSlots bookings={bookings} />}
          {currentPage === "Wallet" && <Wallet bookings={bookings} />}
          {currentPage === "Settings" && <Settings />}
        </div>
      </div>
    );
  }

  // BUYER: show simplified buyer profile and bookings only (no spaces, no rating)
  // Use aggregated stats (if available) to show booking counts. Fallback to bookings.length.
  const buyerBookingsCount = stats?.buyerBookingsCount ?? bookings?.length ?? 0;
  const buyerSpacesCount = stats?.spacesCount ?? 0;

  return (
    <div className="mx-5 mb-52 my-5 min-h-screen bg-gray-100">
      <div className="max-w-4xl mx-auto p-6 bg-white rounded-2xl shadow">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{user?.name || "Your profile"}</h2>
            <p className="text-sm text-gray-500">{user?.email}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-4 text-center">
          <div className="p-4 bg-gray-50 rounded">
            <div className="text-xl font-semibold">
              {kycDisplay.text === "verified" ? "verified" : kycDisplay.text === "pending" ? "pending" : "not done"}
            </div>
            <div className="text-xs text-gray-500">KYC status</div>
          </div>

          <div className="p-4 bg-gray-50 rounded">
            <div className="text-xl font-semibold">{buyerBookingsCount}</div>
            <div className="text-xs text-gray-500">Total Bookings</div>
          </div>

          <div className="p-4 bg-gray-50 rounded">
            <div className="text-xl font-semibold">{buyerSpacesCount > 0 ? buyerSpacesCount : "—"}</div>
            <div className="text-xs text-gray-500">Spaces (buyer)</div>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-lg font-medium">Your Bookings</h3>
          {bookings?.length ? (
            <div className="grid gap-3 mt-4">
              {bookings.map((b: any) => (
                <div key={b._id || b.id} className="p-4 border rounded bg-white">
                  <div className="flex justify-between">
                    <div>
                      <div className="font-semibold">{b.spaceName || b.parkingName || b.title || "Booking"}</div>
                      <div className="text-xs text-gray-500">{b.date || b.from || b.createdAt}</div>
                    </div>
                    <div className="text-sm text-gray-600">{b.status || "-"}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 text-sm text-gray-500">You have no bookings yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
