import mongoose from 'mongoose';

const refundSchema = new mongoose.Schema({
  percent: { type: Number, default: 0 }, // percent refunded
  amount: { type: Number, default: 0 }, // absolute amount refunded
  processedAt: { type: Date, default: null }, // when refund was recorded / processed
  refundedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'ParkFinderSecondUser', default: null }, // optional actor who processed refund
}, { _id: false });

const bookingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ParkFinderSecondUser',
    required: true,
  },
  parkingSpace: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ParkfindersecondParkingSpace',
    required: true,
  },
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ParkFinderSecondUser',
    default: null,
  },
  pricePerHour: {
    type: Number,
    required: true,
  },
  startTime: {
    type: Date,
    required: true,
  },
  endTime: {
    type: Date,
    required: true,
  },
  totalPrice: {
    type: Number,
    required: true,
    default: 0,
  },
  vehicleNumber: String,
  vehicleType: String,
  vehicleModel: String,
  contactNumber: String,
  chassisNumber: String,
  drivingLicenseUrl: String,
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'confirmed', 'active', 'overdue', 'completed', 'cancelled'],
    default: 'pending',
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded', 'failed'],
    default: 'pending',
  },

  // OTPs
  otp: {
    type: String,
    default: null,
  },
  otpExpires: {
    type: Date,
    default: null,
  },
  otpVerified: {
    type: Boolean,
    default: false,
  },

  // session timing
  startedAt: {
    type: Date,
    default: null,
  },
  sessionEndAt: {
    type: Date,
    default: null,
  },
  completedAt: {
    type: Date,
    default: null,
  },

  // second / checkout OTP
  secondOtp: {
    type: String,
    default: null,
  },
  secondOtpExpires: {
    type: Date,
    default: null,
  },

  // cancellation/refund metadata
  cancelledAt: {
    type: Date,
    default: null,
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ParkFinderSecondUser',
    default: null,
  },
  refund: {
    type: refundSchema,
    default: () => ({}),
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// keep existing model name if already registered
export default mongoose.models.parkfindersecondBooking ||
  mongoose.model('parkfindersecondBooking', bookingSchema);
