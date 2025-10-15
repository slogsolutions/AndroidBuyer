import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  createBooking,
  getMyBookings,
  updateBookingStatus,
  getBookingById,
  deleteById,
  getProviderBookings,
  generateOTP,
  verifyOTP,
  verifySecondOtp,
  extendBooking
} from '../controllers/booking.js';
import User from '../models/User.js';
import Booking from '../models/Booking.js';

const router = express.Router();

// Booking CRUD & listing
router.post('/', protect, createBooking);
router.get('/my-bookings', protect, getMyBookings);
router.get('/provider-bookings', protect, getProviderBookings);

// OTP endpoints
router.post('/:id/generate-otp', protect, generateOTP);
router.post('/:id/verify-otp', protect, verifyOTP);
router.post('/:id/verify-second-otp', protect, verifySecondOtp);

// Status route
router.put('/:id/status', protect, updateBookingStatus);

// Single booking, cancel (DELETE) — frontend calls DELETE /api/booking/:bookingId with body { refundPercent }
router.get('/:id', protect, getBookingById);
router.delete('/:bookingId', protect, deleteById);

// Extend route (payment flow may call this, kept for compatibility)
router.post('/:id/extend', protect, extendBooking);

// Payment status update (existing)
router.put("/:id/update-payment-status", protect, async (req, res) => {
  const { id } = req.params;
  const { paymentStatus } = req.body;

  try {
    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    booking.paymentStatus = paymentStatus;
    await booking.save();

    res.status(200).json({ message: "Payment status updated successfully", booking });
  } catch (error) {
    console.error("Error updating payment status:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Vehicle routes kept as-is in original file (if needed)
router.post('/add-vehicle', protect, async (req, res) => {
  const { make, model, year, licensePlate, chassisNumber, registrationDate } = req.body;

  if (!make || !model || !year || !licensePlate) {
    return res.status(400).json({ message: 'All required fields must be filled.' });
  }

  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    user.vehicles.push({ make, model, year, licensePlate, chassisNumber, registrationDate });
    await user.save();

    res.status(200).json({ message: 'Vehicle added successfully!', vehicles: user.vehicles });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

router.get('/data/vehicles', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json(user.vehicles || []);
  } catch (error) {
    console.error('Error fetching vehicles:', error.message);
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

router.delete('/data/vehicles/:vehicleId', protect, async (req, res) => {
  const { vehicleId } = req.params;

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const vehicleIndex = user.vehicles.findIndex(vehicle => vehicle._id.toString() === vehicleId);
    if (vehicleIndex === -1) {
      return res.status(404).json({ message: 'Vehicle not found.' });
    }

    user.vehicles.splice(vehicleIndex, 1);
    await user.save();

    res.status(200).json({ message: 'Vehicle deleted successfully!' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
});

export default router;
