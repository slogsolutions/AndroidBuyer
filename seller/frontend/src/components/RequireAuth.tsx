import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useRole } from "../context/RoleContext";

type RequireAuthProps = {
  children: JSX.Element;
  role?: "captain" | "admin" | "buyer" | "seller";
};

export default function RequireAuth({ children, role }: RequireAuthProps) {
  const { user, loading } = useAuth() as any;   // adjust if your AuthContext exports types
  const { role: ctxRole } = useRole() as any;
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-400 border-t-transparent" />
      </div>
    );
  }

  // not logged in -> go to login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // no role requirement
  if (!role) return children;

  // check role logic
  const allowed =
    (role === "captain" && (user.isCaptain || ctxRole === "captain")) ||
    (role === "admin" && (user.isAdmin || ctxRole === "admin")) ||
    (role === "buyer" && ctxRole === "buyer") ||
    (role === "seller" && ctxRole === "seller");

  if (!allowed) {
    return <Navigate to="/" replace />;
  }

  return children;
}
