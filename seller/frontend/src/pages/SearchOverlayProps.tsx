import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { GeocodingResult } from "../utils/geocoding";
import { searchLocation } from "../utils/geocoding";
import { X } from "lucide-react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSelect?: (r: GeocodingResult) => void;
  setResults?: (r: GeocodingResult[]) => void; // optional pass-through to parent
};

export default function SearchOverlay({ isOpen, onClose, onSelect, setResults }: Props) {
  const [query, setQuery] = useState("");
  const [results, _setResults] = useState<GeocodingResult[]>([]);
  const [loading, setLoading] = useState(false);

  const updateResults = (r: GeocodingResult[]) => {
    _setResults(r);
    setResults?.(r);
  };

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      updateResults([]);
    }
  }, [isOpen]);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const r = await searchLocation(query);
      updateResults(r);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-full max-w-2xl bg-white rounded-2xl p-4 shadow-2xl"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Search location</h3>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-3 flex gap-2">
              <input
                className="flex-1 px-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Enter city, address, or place"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <button
                className="px-4 py-3 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700"
                onClick={handleSearch}
                disabled={loading || !query.trim()}
              >
                {loading ? "Searching..." : "Search"}
              </button>
            </div>

            <div className="mt-4 max-h-72 overflow-auto divide-y">
              {results.length === 0 && !loading && (
                <div className="text-sm text-gray-500 p-3">Try searching for “Connaught Place” or “Mumbai Airport”.</div>
              )}
              {results.map((r) => (
                <button
                  key={`${r.latitude}-${r.longitude}-${r.label}`}
                  className="w-full text-left p-3 hover:bg-gray-50"
                  onClick={() => onSelect?.(r)}
                >
                  <div className="text-sm font-medium text-gray-900">{r.label}</div>
                  <div className="text-xs text-gray-600">{r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}</div>
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
