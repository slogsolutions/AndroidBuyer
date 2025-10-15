// src/services/parking.service.ts
import api from '../utils/api';
import type { ParkingSpace } from '../types/parking';

export const parkingService = {
  /**
   * Get nearby parking spaces based on location.
   *
   * NOTE: If lat or lng is missing (null/undefined), this will fallback to getAllSpaces()
   * so callers that don't supply a location will receive the full list.
   *
   * @param lat optional latitude
   * @param lng optional longitude
   * @param startTime optional ISO datetime string (e.g. new Date().toISOString() or input value)
   * @param endTime optional ISO datetime string
   * @param onlyAvailable optional boolean - when true backend will return only spaces with availableSpots > 0
   */
  async getNearbySpaces(
    lat?: number | null,
    lng?: number | null,
    startTime?: string | null,
    endTime?: string | null,
    onlyAvailable?: boolean
  ) {
    // If lat/lng are not provided, return all locations (and delegate time filtering to getAllSpaces)
    if (lat == null || lng == null) {
      return this.getAllSpaces(startTime, endTime, onlyAvailable);
    }

    const params = new URLSearchParams({
      lat: lat.toString(),
      lng: lng.toString(),
    });

    if (startTime) params.set('startTime', startTime);
    if (endTime) params.set('endTime', endTime);
    if (onlyAvailable) params.set('onlyAvailable', 'true');

    const url = `/parking?${params.toString()}`;
    const response = await api.get<ParkingSpace[]>(url);
    return response.data;
  },

  /**
   * Get all parking spaces (non-geo)
   * @param startTime optional ISO datetime string
   * @param endTime optional ISO datetime string
   * @param onlyAvailable optional boolean - when true backend will return only spaces with availableSpots > 0
   */
  async getAllSpaces(startTime?: string | null, endTime?: string | null, onlyAvailable?: boolean) {
    const params = new URLSearchParams();
    if (startTime) params.set('startTime', startTime);
    if (endTime) params.set('endTime', endTime);
    if (onlyAvailable) params.set('onlyAvailable', 'true');

    const url = params.toString() ? `/parking?${params.toString()}` : '/parking';
    const response = await api.get<ParkingSpace[]>(url);
    return response.data;
  },

  // Register a parking space (FormData, with photos)
  async registerSpaceFormData(data: FormData) {
    const token = localStorage.getItem('token');
    const response = await api.post('/parking', data, {
      headers: {
        Authorization: `Bearer ${token}`,
        // Let browser set Content-Type for FormData
      },
    });
    return response.data;
  },

  // Register a parking space (JSON, no photos)
  async registerSpaceJSON(payload: any) {
    const token = localStorage.getItem('token');
    const response = await api.post('/parking', payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  },

  // Convenience wrapper: decides FormData vs JSON
  async registerSpace(data: FormData | Record<string, any>) {
    if (data instanceof FormData) {
      return this.registerSpaceFormData(data);
    } else {
      return this.registerSpaceJSON(data);
    }
  },

  // Get user's own parking spaces
  async getMySpaces() {
    const response = await api.get('/parking/my-spaces');
    return response.data;
  },

  // Get a specific parking space by ID
  async getSpaceById(id: string) {
    const response = await api.get(`/parking/${id}`);
    return response.data;
  },

  // Get filtered parking spaces based on optional amenities (no radius)
  async getFilteredSpaces({
    lat,
    lng,
    amenities,
  }: {
    lat: number;
    lng: number;
    amenities?: string[];
  }) {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lng: lng.toString(),
    });

    if (amenities && amenities.length > 0) params.set('amenities', amenities.join(','));

    const response = await api.get<ParkingSpace[]>(`/parking/filter?${params.toString()}`);
    return response.data;
  },

  // Toggle per-space online status
  async toggleOnline(spaceId: string, isOnline: boolean) {
    const response = await api.patch(`/parking/${spaceId}/online`, { isOnline });
    return response.data;
  },

  // Soft-delete a parking space
  async deleteSpace(spaceId: string) {
    const response = await api.delete(`/parking/${spaceId}`);
    return response.data;
  },

  /**
   * Initiate a Razorpay payment for a booking.
   * - bookingId: id of the booking created on backend
   * - amount: amount in INR (number). Backend expects amount and creates order.
   *
   * Returns: { orderId, amount, currency } (whatever backend/razorpay order returns)
   */
  async initiatePayment(bookingId: string, amount: number) {
    const token = localStorage.getItem('token');
    const response = await api.post(
      '/payment/initiate-payment',
      { bookingId, amount },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  },

  /**
   * Verify a Razorpay payment after checkout.
   * Payload must include: bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature
   *
   * Backend responds with booking and updated parking object (use parking to update UI counts).
   */
  async verifyPayment(payload: {
    bookingId: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) {
    const token = localStorage.getItem('token');
    const response = await api.post('/payment/verify-payment', payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  },

  /**
   * Fetch availability summary for a single parking space.
   * Useful after verifyPayment or as a polling fallback to refresh the spot count.
   * Backend should return at least { availableSpots, totalSpots } in the parking object.
   */
  async getAvailability(spaceId: string) {
    const response = await api.get(`/parking/${spaceId}`);
    return response.data;
  },
};

export default parkingService;
