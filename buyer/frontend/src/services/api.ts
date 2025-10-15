import axios from 'axios';
import { ParkingSpace, ParkingFormData } from '../types/parking';

const API_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const parkingService = {
  async getNearbySpaces(longitude: number, latitude: number): Promise<ParkingSpace[]> {
    try {
      const { data } = await api.get<ParkingSpace[]>(`/parking-spaces/nearby?lng=${longitude}&lat=${latitude}`);
      return data;
    } catch (error) {
      console.error('Error fetching nearby parking spaces:', error);
      return [];
    }
  },

  async searchSpaces(query: string): Promise<ParkingSpace[]> {
    try {
      const { data } = await api.get(`/parking-spaces/search?q=${encodeURIComponent(query)}`);
      return data;
    } catch (error) {
      console.error('Error searching parking spaces:', error);
      return [];
    }
  },

  async registerParkingSpace(parkingData: {
    name: string;
    totalSpots: string;
    description: string;
    location: {
      type: 'Point';
      coordinates: [number, number];
    };
  }): Promise<ParkingSpace | null> {
    try {
      const { data } = await api.post('/parking-spaces', parkingData);
      return data;
    } catch (error) {
      console.error('Error registering parking space:', error);
      throw new Error('Failed to register parking space');
    }
  },
};