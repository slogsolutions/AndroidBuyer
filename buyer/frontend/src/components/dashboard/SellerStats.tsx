// src/components/dashboard/SellerStats.tsx
import React, { useEffect, useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

type DayPoint = { date: string; count: number };

// This component accepts optional bookingsByDate prop for backwards compatibility.
// If prop is not passed, it will fetch /api/stats/me and use bookingsByDate from the response.
export default function SellerStats({ bookingsByDate }: { bookingsByDate?: DayPoint[] }) {
  const API_BASE = import.meta.env.VITE_BASE_URL || "";
  const [data, setData] = useState<DayPoint[]>(bookingsByDate || []);

  useEffect(() => {
    let mounted = true;
    // If prop provided, use it
    if (bookingsByDate && bookingsByDate.length) {
      setData(bookingsByDate);
      return;
    }

    async function loadStats() {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;

        const res = await fetch(`${API_BASE}/api/stats/me`, {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        });
        if (!res.ok) {
          console.warn("Failed to load stats:", res.status);
          return;
        }
        const json = await res.json();
        if (!mounted) return;
        // expect json.bookingsByDate to be an array of {date, count}
        if (Array.isArray(json?.bookingsByDate)) {
          setData(json.bookingsByDate);
        } else {
          // if backend returns aggregated map, try to convert
          if (json?.bookingsByDate) {
            setData(json.bookingsByDate);
          }
        }
      } catch (err) {
        console.error("Error fetching stats for SellerStats:", err);
      }
    }

    loadStats();
    return () => {
      mounted = false;
    };
  }, [API_BASE, bookingsByDate]);

  const memo = useMemo(() => data || [], [data]);

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h4 className="font-semibold mb-2">Bookings (last 7 days)</h4>
      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer>
          <LineChart data={memo}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="count" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
