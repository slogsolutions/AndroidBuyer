import axios from 'axios';

export interface GeocodingResult {
  longitude: number;
  latitude: number;
  placeName: string;
  // optional address pieces for auto‑fill (present only for reverse lookups)
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

// Shared Mapbox token (unchanged)
const MAPBOX_TOKEN =
  'pk.eyJ1IjoicGFya2Vhc2UxIiwiYSI6ImNtNGN1M3pmZzBkdWoya3M4OGFydjgzMzUifQ.wbsW51a7zFMq0yz0SeV6_A';

// Forward geocoding (unchanged behavior)
export const searchLocation = async (query: string): Promise<GeocodingResult[]> => {
  try {
    const response = await axios.get(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        query
      )}.json?access_token=${MAPBOX_TOKEN}`
    );

    return response.data.features.map((feature: any) => ({
      longitude: feature.center[0],
      latitude: feature.center[1],
      placeName: feature.place_name,
    }));
  } catch (error) {
    console.error('Geocoding error:', error);
    return [];
  }
};

// NEW: reverse geocoding for auto‑fill of address fields
export const reverseGeocode = async (
  latitude: number,
  longitude: number
): Promise<GeocodingResult> => {
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${MAPBOX_TOKEN}`;
    const { data } = await axios.get(url);

    const feature = data.features?.[0];

    const ctx: any[] = feature?.context ?? [];
    // Mapbox sometimes places some fields on the feature itself (e.g., address)
    const byType = (t: string) =>
      ctx.find((c) => (c.id as string)?.startsWith(t + '.')) || {};

    const addressNumber = feature?.address ?? '';
    const street = feature?.text ?? '';
    const city =
      (byType('place').text ||
        byType('locality').text ||
        byType('district').text) ??
      '';
    const state = (byType('region').text as string) ?? '';
    const zipCode = (byType('postcode').text as string) ?? '';
    const country = (byType('country').text as string) ?? '';

    return {
      longitude: feature?.center?.[0] ?? longitude,
      latitude: feature?.center?.[1] ?? latitude,
      placeName: feature?.place_name ?? '',
      street: [addressNumber, street].filter(Boolean).join(' '),
      city,
      state,
      zipCode,
      country,
    };
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    // Fallback with only coordinates
    return {
      longitude,
      latitude,
      placeName: '',
    };
  }
};