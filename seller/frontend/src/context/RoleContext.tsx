// src/context/RoleContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";

type Role = "buyer" | "seller";
interface RoleContextType {
  role: Role;
  toggleRole: () => void;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role>(() => {
    try {
      const saved = localStorage.getItem("role");
      return saved === "seller" ? "seller" : "buyer";
    } catch {
      return "buyer";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("role", role);
    } catch {}
  }, [role]);

  const toggleRole = () => setRole((p) => (p === "buyer" ? "seller" : "buyer"));

  return <RoleContext.Provider value={{ role, toggleRole }}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}
