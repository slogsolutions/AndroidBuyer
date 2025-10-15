// SellerRoutes.tsx
import React from "react";
import { Route } from "react-router-dom";
import ProtectedRoute from "../components/ProtectedRoute";
import ProviderBookings from "../pages/ProivderBookings";
import RegisterParking from "../pages/RegisterParking";
import Dash from "../Dash";
import Profile from "../pages/Profile";
import KYC from "../pages/KYC";

export const sellerRoutes = [
  <Route key="provider" path="/parkingprovider" element={<ProtectedRoute><ProviderBookings /></ProtectedRoute>} />,
  <Route key="register" path="/register-parking" element={<ProtectedRoute><RegisterParking /></ProtectedRoute>} />,
  <Route key="dashboard" path="/dashboard" element={<ProtectedRoute><Dash /></ProtectedRoute>} />,
  <Route key="profile" path="/profileuser" element={<Profile />} />,
  <Route key="kyc" path="/kyc" element={<ProtectedRoute><KYC /></ProtectedRoute>} />
];
