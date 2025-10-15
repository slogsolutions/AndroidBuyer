'use client';

import React, { useMemo } from 'react';
import { UserCheck, BarChart2, HandCoins } from 'lucide-react';
import type { Provider, Booking } from '@/types';

interface DashboardProps {
  provider: Provider;
  bookings: Booking[];
}

/** tiny helpers (defensive; tolerate partial/missing fields) *//////
const num = (n: unknown, fb = 0) => {
  const x = Number((n as any) ?? NaN);
  return Number.isFinite(x) ? x : fb;
};
const dt = (d: unknown) => {
  const t = new Date(String(d ?? ''));
  return Number.isFinite(+t) ? t : new Date();
};
const pick = <T,>(obj: any, keys: string[], fb: T): T => {
  for (const k of keys) if (obj && obj[k] !== undefined) return obj[k];
  return fb;
};

export function Dashboard({ provider, bookings }: DashboardProps) {
  const data = useMemo(() => {
    const safe = Array.isArray(bookings) ? bookings : [];
    const now = new Date();

    let revenueThisMonth = 0;
    let todaysBookings = 0;

    for (const b of safe) {
      const createdAt = dt(pick(b, ['createdAt', 'date', 'created_on'], now));
      const amount = num(pick(b as any, ['amount', 'total', 'price', 'fare', 'revenue'], 0));

      if (createdAt.getFullYear() === now.getFullYear() && createdAt.getMonth() === now.getMonth()) {
        revenueThisMonth += amount;
      }
      if (createdAt.toDateString() === now.toDateString()) {
        todaysBookings += 1;
      }
    }

    const activeListings =
      Array.isArray((provider as any)?.listings) ? (provider as any).listings.length :
      num(pick(provider as any, ['activeListings', 'listingsCount', 'spaces'], 0));

    return {
      totalBookings: safe.length,
      revenueThisMonth,
      todaysBookings,
      activeListings,
      recent: safe.slice(0, 5),
    };
  }, [provider, bookings]);

  const cur = (n: number, code = 'INR') => {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: code, maximumFractionDigits: 0 }).format(n);
    } catch {
      return `₹${Math.round(n).toLocaleString()}`;
    }
  };

  return (
    <div className="w-full min-h-[60vh] p-4">
      {/* Header */}
      <div className="mb-6 flex items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-500 text-sm">Quick snapshot of your parking business.</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border p-4 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Revenue (this month)</span>
            <HandCoins className="w-5 h-5" />
          </div>
          <div className="mt-2 text-2xl font-semibold">{cur(data.revenueThisMonth)}</div>
        </div>

        <div className="rounded-xl border p-4 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Bookings today</span>
            <BarChart2 className="w-5 h-5" />
          </div>
          <div className="mt-2 text-2xl font-semibold">{data.todaysBookings}</div>
          <div className="text-xs text-gray-500 mt-1">Total: {data.totalBookings}</div>
        </div>

        <div className="rounded-xl border p-4 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Active listings</span>
            <UserCheck className="w-5 h-5" />
          </div>
          <div className="mt-2 text-2xl font-semibold">{data.activeListings || 0}</div>
        </div>

        <div className="rounded-xl border p-4 bg-white">
          <div className="text-sm text-gray-500">Provider</div>
          <div className="mt-2 text-lg font-medium">
            {String((provider as any)?.name ?? (provider as any)?.title ?? '—')}
          </div>
        </div>
      </div>

      {/* Recent Bookings */}
      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Recent Bookings</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500">
              <tr className="[&>th]:px-4 [&>th]:py-2">
                <th>Customer</th>
                <th>Listing</th>
                <th>When</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map((b: any, idx: number) => {
                const customer = pick(b, ['customerName', 'userName', 'name'], 'Customer');
                const listing = pick(b, ['listingName', 'spaceName', 'title', 'spot', 'name'], 'Listing');
                const start = dt(pick(b, ['startTime', 'startDate', 'from', 'checkIn', 'createdAt'], new Date()));
                const end = dt(pick(b, ['endTime', 'endDate', 'to', 'checkOut', 'startTime'], start));
                const amount = num(pick(b, ['amount', 'total', 'price', 'fare'], 0));
                return (
                  <tr key={b.id ?? idx} className="border-t">
                    <td className="px-4 py-2">{String(customer)}</td>
                    <td className="px-4 py-2">{String(listing)}</td>
                    <td className="px-4 py-2 text-gray-600">
                      {start.toLocaleDateString()} – {end.toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 text-right font-medium">{cur(amount)}</td>
                  </tr>
                );
              })}
              {data.recent.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    No bookings yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
