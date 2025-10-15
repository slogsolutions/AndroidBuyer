// frontend/src/pages/EditProfile.tsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function EditProfile() {
  const auth = useAuth?.();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form from auth.user if available
  const initial = {
    name: auth?.user?.name || "",
    email: auth?.user?.email || "",
    bio: auth?.user?.bio || "",
    phoneNumber: auth?.user?.kycData?.phoneNumber || "",
    address: auth?.user?.kycData?.address || "",
    city: auth?.user?.kycData?.city || "",
    country: auth?.user?.kycData?.country || "",
    region: auth?.user?.region || "",
  };

  const [form, setForm] = useState(initial);

  useEffect(() => {
    setForm(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.user]);

  const API_BASE = import.meta.env.VITE_BASE_URL || "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Not authenticated");

      const payload = {
        name: form.name,
        bio: form.bio,
        kycData: {
          phoneNumber: form.phoneNumber,
          address: form.address,
          city: form.city,
          country: form.country,
        },
        // include region (normalize to lowercase for consistency)
        region: form.region ? String(form.region).toLowerCase() : null,
      };

      const res = await fetch(`${API_BASE}/api/auth/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Update failed: ${res.status} ${txt}`);
      }

      const updated = await res.json();

      // update auth context so navbar/profile reflect changes immediately
      if (auth?.setUser) {
        auth.setUser(updated);
      } else if (auth?.refreshUser) {
        await auth.refreshUser();
      }

      // navigate back to profile
      navigate("/profileuser"); // keep your route as-is
    } catch (err: any) {
      console.error("Profile update error:", err);
      setError(err?.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto bg-white p-6 rounded-lg shadow">
        <h2 className="text-2xl font-semibold mb-4">Edit Profile</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Full name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          

          <h4 className="font-medium mt-2">Info</h4>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-700">Phone</label>
              <input
                value={form.phoneNumber}
                onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700">Country</label>
              <input
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700">City</label>
              <input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700">Address</label>
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full border rounded px-3 py-2"
              />
            </div>

            {/* NEW: Region field for captains */}
            <div>
              <label className="block text-sm text-gray-700">Region</label>
              <select
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">Select region</option>
                <option value="dehradun">Dehradun</option>
                <option value="mussoorie">Mussoorie</option>
                <option value="other">Other</option>
              </select>
              <small className="text-xs text-gray-500">If you're a captain, set your assigned region here.</small>
            </div>
          </div>

          {error && <div className="text-red-600 text-sm">{error}</div>}

          <div className="flex gap-3">
            <button type="submit" disabled={loading} className="px-4 py-2 bg-red-600 text-white rounded">
              {loading ? "Saving..." : "Save changes"}
            </button>
            <button type="button" onClick={() => navigate(-1)} className="px-4 py-2 border rounded">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
