import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LogOut, User as UserIcon, FileCheck } from "lucide-react";
import {
  MdDashboard,
  MdHome,
  MdMap,
  MdPerson,
  MdStorefront,
} from "react-icons/md";

// Served from /public
const logoUrl = "/Park_your_Vehicle_log.png";

export default function SellerNavbar() {
  const { isAuthenticated, logout, user, refreshUser } = useAuth();

  // Detect mobile width
  const [isMobile, setIsMobile] = useState<boolean>(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  const location = useLocation();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Refresh user info safely once per user
  const lastRef = useRef<string | null>(null);
  useEffect(() => {
    const userId = (user as any)?._id ?? null;
    if (!isAuthenticated || !userId) return;
    if (lastRef.current === userId) return;
    lastRef.current = userId;
    (async () => {
      try {
        await refreshUser();
      } catch (err) {
        console.warn("SellerNavbar: refreshUser failed", err);
      }
    })();
  }, [isAuthenticated, (user as any)?._id, refreshUser]);

  const getNavItemClass = (path: string) =>
    location.pathname === path
      ? "text-red-600 font-bold dark:text-red-400"
      : "text-gray-700 dark:text-gray-300";

  // Show KYC until approved/submitted
  const rawKyc = (user as any)?.kycStatus ?? null;
  const kycNormalized =
    typeof rawKyc === "string" ? rawKyc.trim().toLowerCase() : null;
  const shouldShowKYC =
    !(kycNormalized === "submitted" || kycNormalized === "approved");

  // ======== MOBILE ========
  if (isMobile) {
    return (
      <nav className="fixed bottom-0 left-0 w-full bg-white shadow-md border-t border-gray-200 z-50 dark:bg-gray-900 dark:border-gray-800">
        <div className="flex justify-around py-3">
          {isAuthenticated ? (
            <>
              {/* Home */}
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

              {/* Register Space (after KYC approval) */}
              {!shouldShowKYC && (
                <Link
                  to="/register-parking"
                  className={`flex flex-col items-center ${getNavItemClass("/register-parking")}`}
                >
                  <MdMap className="h-6 w-6" />
                  <span className="text-xs mt-1 font-medium">Register Space</span>
                </Link>
              )}

              {/* Dashboard */}
              {!shouldShowKYC && (
                <Link
                  to="/dashboard"
                  className={`flex flex-col items-center ${getNavItemClass("/dashboard")}`}
                >
                  <MdDashboard className="h-6 w-6" />
                  <span className="text-xs mt-1 font-medium">Dashboard</span>
                </Link>
              )}

              {/* Profile */}
              <Link
                to="/profileuser"
                className={`flex flex-col items-center ${getNavItemClass("/profileuser")}`}
              >
                <UserIcon className="h-6 w-6" />
                <span className="text-xs mt-1 font-medium">
                  {(user as any)?.name || "Profile"}
                </span>
              </Link>

              {/* Logout */}
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

  // ======== DESKTOP ========
  return (
    <nav className="bg-white shadow-lg z-50 relative dark:bg-gray-900 dark:border-b dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between h-16 items-center">
          {/* Brand + Seller Badge */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center space-x-2">
              <img className="h-6 w-6" src={logoUrl} alt="ParkYourVehicles" />
              <span className="font-bold text-xl text-gray-900 dark:text-gray-100">
                ParkYourVehicles
              </span>
            </Link>

            {/* Seller Badge */}
            <span
              className="inline-flex items-center gap-2 text-sm font-medium px-2.5 py-1 rounded-full
                         bg-red-50 text-red-700 ring-1 ring-red-200
                         dark:bg-red-900/30 dark:text-red-300 dark:ring-red-800"
              title="Seller mode"
            >
              <MdStorefront className="h-4 w-4" />
              Seller
            </span>
          </div>

          {/* Desktop Nav Links */}
          <div className="hidden lg:flex items-center space-x-6">
            {isAuthenticated ? (
              <>
                {/* Home */}
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

                {/* Register Space */}
                {!shouldShowKYC && (
                  <Link
                    to="/register-parking"
                    className={`flex items-center space-x-1 ${getNavItemClass("/register-parking")}`}
                  >
                    <MdMap className="h-5 w-5" />
                    <span>Register Space</span>
                  </Link>
                )}

                {/* Dashboard */}
                {!shouldShowKYC && (
                  <Link
                    to="/dashboard"
                    className={`flex items-center space-x-1 ${getNavItemClass("/dashboard")}`}
                  >
                    <MdDashboard className="h-5 w-5" />
                    <span>Dashboard</span>
                  </Link>
                )}

                {/* Profile */}
                <Link
                  to="/profileuser"
                  className={`flex items-center space-x-1 ${getNavItemClass("/profileuser")}`}
                >
                  <MdPerson className="h-5 w-5" />
                  <span>{(user as any)?.name || "Profile"}</span>
                </Link>

                {/* Logout */}
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
                <Link
                  to="/register"
                  className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
                >
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
