// BuyerRoutes.tsx
import React from "react";
import { Route } from "react-router-dom";
import ProtectedRoute from "../components/ProtectedRoute";
import MyBookings from "../components/parking/MyBookings";
import Profile from "../pages/Profile";
import KYC from "../pages/KYC";

export const buyerRoutes = [
  <Route key="bookings" path="/bookings" element={<ProtectedRoute><MyBookings /></ProtectedRoute>} />,
  <Route key="profile" path="/profileuser" element={<Profile />} />,
  <Route key="kyc" path="/kyc" element={<ProtectedRoute><KYC /></ProtectedRoute>} />
];
