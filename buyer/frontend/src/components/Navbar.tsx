import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LogOut, User as UserIcon, Calendar, FileCheck } from "lucide-react";
import { MdCalendarMonth, MdHome, MdPerson, MdShoppingBag } from "react-icons/md";

// Vite serves files from public/ at the root path — use the root path instead of importing from /public
const logoUrl = "/Park_your_Vehicle_log.png";

export default function Navbar() {
  // NOTE: we request refreshUser so Navbar always shows up-to-date kycStatus
  const { isAuthenticated, logout, user, refreshUser } = useAuth();

  // SSR-safe window usage for initial state
  const [isMobile, setIsMobile] = useState<boolean>(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  const location = useLocation();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ---- Guarded refreshUser: call only once per user id ----
  const lastRef = useRef<string | null>(null);
  useEffect(() => {
    const userId = (user as any)?._id ?? null; // keep safe typing
    if (!isAuthenticated || !userId) return;

    if (lastRef.current === userId) return; // already refreshed for this user
    lastRef.current = userId;

    (async () => {
      try {
        await refreshUser();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("Navbar: refreshUser failed", err);
      }
    })();
  }, [isAuthenticated, (user as any)?._id, refreshUser]);

  const getNavItemClass = (path: string) =>
    location.pathname === path
      ? "text-red-600 font-bold dark:text-red-400"
      : "text-gray-700 dark:text-gray-300";

  // -------------------------
  // Robust KYC visibility check
  // Hide KYC link once status is "submitted" or "approved"
  // -------------------------
  const rawKyc = (user as any)?.kycStatus ?? null;
  const kycNormalized =
    typeof rawKyc === "string" ? rawKyc.trim().toLowerCase() : null;
  const shouldShowKYC = !(kycNormalized === "submitted" || kycNormalized === "approved");
  // -------------------------

  // ======== MOBILE (bottom tab bar) ========
  if (isMobile) {
    return (
      <nav className="fixed bottom-0 left-0 w-full bg-white shadow-md border-t border-gray-200 z-50 dark:bg-gray-900 dark:border-gray-800">
        <div className="flex justify-around py-3">
          {isAuthenticated ? (
            <>
              <Link to="/" className={`flex flex-col items-center ${getNavItemClass("/")}`}>
                <MdHome className="h-6 w-6" />
              </Link>

              {/* Show KYC only if not approved */}
              {shouldShowKYC && (
                <Link to="/kyc" className={`flex flex-col items-center ${getNavItemClass("/kyc")}`}>
                  <FileCheck className="h-6 w-6" />
                  <span className="text-xs mt-1 font-medium">KYC</span>
                </Link>
              )}

              {/* Bookings link - buyer only (this navbar is buyer-only) */}
              <Link to="/bookings" className={`flex flex-col items-center ${getNavItemClass("/bookings")}`}>
                <Calendar className="h-6 w-6" />
                <span className="text-xs mt-1 font-medium">My Bookings</span>
              </Link>

              <Link to="/profileuser" className={`flex flex-col items-center ${getNavItemClass("/profileuser")}`}>
                <UserIcon className="h-6 w-6" />
                <span className="text-xs mt-1 font-medium">{(user as any)?.name || "Profile"}</span>
              </Link>

              <button
                onClick={logout}
                className="flex flex-col items-center text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              >
                <LogOut className="h-6 w-6" />
                <span className="text-xs mt-1 font-medium">Logout</span>
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className={`flex flex-col items-center ${getNavItemClass("/login")}`}>
                <UserIcon className="h-6 w-6" />
                <span className="text-xs">Login</span>
              </Link>
              <Link
                to="/register"
                className="flex flex-col items-center text-white bg-red-600 px-3 py-1 rounded-md hover:bg-red-700"
              >
                <span className="text-xs">Register</span>
              </Link>
            </>
          )}
        </div>
      </nav>
    );
  }

  // ======== DESKTOP (top bar) ========
  return (
    <nav className="bg-white shadow-lg z-50 relative dark:bg-gray-900 dark:border-b dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between h-16 items-center">
          {/* Brand + Buyer badge */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center space-x-2">
              <img className="h-6 w-6" src={logoUrl} alt="ParkYourVehicles" />
              <span className="font-bold text-xl text-gray-900 dark:text-gray-100">ParkYourVehicles</span>
            </Link>

            {/* Buyer-specific identity */}
            <span
              className="inline-flex items-center gap-2 text-sm font-medium px-2.5 py-1 rounded-full
                         bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200
                         dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-800"
              title="Buyer mode"
            >
              <MdShoppingBag className="h-4 w-4" />
              Buyer
            </span>
          </div>

          <div className="hidden lg:flex items-center space-x-6">
            {isAuthenticated ? (
              <>
                <Link to="/" className={`flex items-center space-x-1 ${getNavItemClass("/")}`}>
                  <MdHome className="h-5 w-5" />
                </Link>

                {/* Show KYC only if not approved */}
                {shouldShowKYC && (
                  <Link to="/kyc" className={`flex items-center space-x-1 ${getNavItemClass("/kyc")}`}>
                    <FileCheck className="h-5 w-5" />
                    <span>KYC</span>
                  </Link>
                )}

                {/* Bookings - buyer only */}
                <Link to="/bookings" className={`flex items-center space-x-1 ${getNavItemClass("/bookings")}`}>
                  <MdCalendarMonth className="h-5 w-5" />
                  <span>My Bookings</span>
                </Link>

                <Link to="/profileuser" className={`flex items-center space-x-1 ${getNavItemClass("/profileuser")}`}>
                  <MdPerson className="h-5 w-5" />
                  <span>{(user as any)?.name || "Profile"}</span>
                </Link>

                <button
                  onClick={logout}
                  className="flex items-center space-x-1 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                >
                  <LogOut className="h-5 w-5" />
                  <span>Logout</span>
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className={`px-3 py-2 ${getNavItemClass("/login")}`}>
                  Login
                </Link>
                <Link to="/register" className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700">
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
