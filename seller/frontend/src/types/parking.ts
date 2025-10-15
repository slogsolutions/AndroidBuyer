export interface ParkingSpace {
  _id: string;
  name: string;
  location: {
    coordinates: [number, number];
  };
  availableSpots: number;
  totalSpots: number;
  distance?: number;
  description?: string;
  photos?: string[];
  
  priceParking?: number; // in INR
}

export interface ParkingFormData {
  name: string;
  totalSpots: string;
  description: string;
}