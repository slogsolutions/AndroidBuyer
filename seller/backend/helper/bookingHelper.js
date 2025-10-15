import ParkingSpace from '../models/ParkingSpace.js';
import Booking from '../models/Booking.js';

/**
 * Generate 1-hour slots between start and end
 */
export const generateHourlySlots = (startTime, endTime) => {
  console.log('[Helper] Generating hourly slots');
  const slots = [];
  let current = new Date(startTime);
  while (current < endTime) {
    const next = new Date(current);
    next.setHours(next.getHours() + 1);
    slots.push({ start: new Date(current), end: new Date(next) });
    current = next;
  }
  return slots;
};

/**
 * Check slot availability for a parking space
 */
export const checkSlotAvailability = async (parkingId, startTime, endTime) => {
  console.log(`[Helper] Checking availability for parking ${parkingId} from ${startTime} to ${endTime}`);
  const parking = await ParkingSpace.findById(parkingId);
  if (!parking) throw new Error('Parking not found');

  const totalSpots = parking.totalSpots;
  const slots = generateHourlySlots(startTime, endTime);

  const bookings = await Booking.find({
    parkingSpace: parkingId,
    status: { $in: ['accepted', 'active'] },
    $or: [
      { startTime: { $lt: endTime, $gte: startTime } },
      { endTime: { $gt: startTime, $lte: endTime } },
      { startTime: { $lte: startTime }, endTime: { $gte: endTime } },
    ],
  });

  const slotAvailability = slots.map(slot => {
    const bookedCount = bookings.filter(b => b.startTime < slot.end && b.endTime > slot.start).length;
    console.log(`[Helper] Slot ${slot.start.toISOString()} - ${slot.end.toISOString()} | Booked: ${bookedCount} | Available: ${totalSpots - bookedCount}`);
    return { startTime: slot.start, endTime: slot.end, availableSpots: totalSpots - bookedCount };
  });

  return slotAvailability;
};

/**
 * Reserve / release spots (optional for realtime counters)
 */
export const reserveSpots = async (parkingId, spots = 1) => {
  console.log(`[Helper] Reserving ${spots} spots for parking ${parkingId}`);
  const parking = await ParkingSpace.findById(parkingId);
  if (!parking) return null;
  parking.availableSpots = Math.max((parking.availableSpots || 0) - spots, 0);
  await parking.save();
  return parking;
};

export const releaseSpots = async (parkingId, spots = 1) => {
  console.log(`[Helper] Releasing ${spots} spots for parking ${parkingId}`);
  const parking = await ParkingSpace.findById(parkingId);
  if (!parking) return null;
  parking.availableSpots = Math.min((parking.availableSpots || 0) + spots, parking.totalSpots);
  await parking.save();
  return parking;
};
