import React, { useState } from "react";
import { RoleProvider, useRole } from "./context/RoleContext";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { MapProvider } from "./context/MapContext";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import KYC from "./pages/KYC";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import RegisterParking from "./pages/RegisterParking";
import { env } from "./config/env";
import "react-toastify/dist/ReactToastify.css";
import "mapbox-gl/dist/mapbox-gl.css";
import AdminPanel from "./pages/Admin";
import VehicleDetails from "./pages/VehicleDetails";
import MyBookings from "./components/parking/MyBookings";
import ProviderBookings from "./pages/ProivderBookings";
import AddVehicle from "./pages/AddVechicle";
import VehicleList from "./pages/VehicleList";
import TrackNowPage from "./components/parking/TrackNowPage";
import FilterParkingPage from "./pages/FilterParkingPage";
import ParkingDetails from "./pages/ParkinSpaceDetails";
import Dash from "./Dash";
import Front from "./pages/Front";
import Favorites from "./pages/Favorite";
import FindParking from "./components/search/FindParking";
import Profile from "./pages/Profile";
import { buyerRoutes } from "./routes/BuyerRoutes";
import { sellerRoutes } from "./routes/SellerRoutes";
import { useFirebaseMessaging } from "./hooks/useFirebaseMessaging";
import EditProfile from "./pages/EditProfile";
import PhoneVerifyModal from "./components/PhoneVerifyModal";
import CaptainDashboard from "./pages/CaptainDashboard";
import RequireAuth from "./components/RequireAuth";

export default function App() {
  return (
    <AuthProvider>
      <GoogleOAuthProvider clientId={env.GOOGLE_CLIENT_ID}>
        <RoleProvider>
          <MapProvider>
            <Router>
              <AppRoutes />
            </Router>
          </MapProvider>
        </RoleProvider>
      </GoogleOAuthProvider>
    </AuthProvider>
  );
}

function HomeOrFront() {
  const [showHome, setShowHome] = useState(false);

  try {
    if (showHome) return <Home />;
    return <Front onProceed={() => setShowHome(true)} />;
  } catch (err) {
    console.error("Error rendering HomeOrFront:", err);
    return (
      <div style={{ padding: 24 }}>
        <h2>Something went wrong while rendering the front page.</h2>
        <p>Check the browser console for details.</p>
      </div>
    );
  }
}

function AppRoutes() {
  const { user } = useAuth();
  const { role } = useRole();
  const [showPhoneModal, setShowPhoneModal] = useState(false);

  // Register FCM for the whole app session
  useFirebaseMessaging(user);

  // Gate actions (e.g., "Book Now") behind phone verification without blocking browsing
  const requirePhoneVerification = (action: () => void) => {
    if (!user) {
      window.location.href = "/login";
      return;
    }
    const phoneVerified = (user as any)?.phoneVerified;
    if (phoneVerified === false) {
      setShowPhoneModal(true);
      return;
    }
    action();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar requirePhoneVerification={requirePhoneVerification} />

      <Routes>
        {/* Public / landing */}
        <Route path="/" element={<HomeOrFront />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/verify-email/:token" element={<VerifyEmail />} />

        {/* Generic protected */}
        <Route
          path="/bookings"
          element={
            <ProtectedRoute>
              <MyBookings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/vehicle-details"
          element={
            <ProtectedRoute>
              <VehicleDetails />
            </ProtectedRoute>
          }
        />
        <Route
          path="/add-vechile"
          element={
            <ProtectedRoute>
              <AddVehicle />
            </ProtectedRoute>
          }
        />
        <Route
          path="/track"
          element={
            <ProtectedRoute>
              <TrackNowPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/filter-parking"
          element={
            <ProtectedRoute>
              <FilterParkingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/check-vechile"
          element={
            <ProtectedRoute>
              <VehicleList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/kyc"
          element={
            <ProtectedRoute>
              <KYC />
            </ProtectedRoute>
          }
        />
        <Route
          path="/register-parking"
          element={
            <ProtectedRoute>
              <RegisterParking />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dash />
            </ProtectedRoute>
          }
        />
        <Route
          path="/edit-profile"
          element={
            <ProtectedRoute>
              <EditProfile />
            </ProtectedRoute>
          }
        />

        {/* Role-protected */}
        <Route
          path="/captain"
          element={
            <RequireAuth role="captain">
              <CaptainDashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireAuth role="admin">
              <AdminPanel />
            </RequireAuth>
          }
        />

        {/* Seller ops */}
        <Route
          path="/provider-bookings"
          element={
            <ProtectedRoute>
              <ProviderBookings />
            </ProtectedRoute>
          }
        />

        {/* Browsing pages stay open; booking actions are gated by requirePhoneVerification */}
        <Route
          path="/parking-details"
          element={
            <ParkingDetails requirePhoneVerification={requirePhoneVerification} />
          }
        />
        <Route
          path="/find"
          element={<FindParking requirePhoneVerification={requirePhoneVerification} />}
        />

        {/* Misc open pages */}
        <Route path="/favorite" element={<Favorites />} />
        <Route path="/profileuser" element={<Profile />} />

        {/* Dynamic role-based route groups */}
        {user && role === "buyer" && buyerRoutes}
        {user && role === "seller" && sellerRoutes}
      </Routes>

      <ToastContainer position="top-right" />

      {/* Phone verification modal appears only when a gated action is attempted */}
      {showPhoneModal && (
        <PhoneVerifyModal
          open={showPhoneModal}
          onClose={() => setShowPhoneModal(false)}
        />
      )}
    </div>
  );
}