// models/ParkingSpace.js
import mongoose from "mongoose";

const parkingSpaceSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ParkFinderSecondUser",
    required: true,
  },
  // backend/models/ParkingSpace.js
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'ParkFinderSecondUser' },
  approvedAt: { type: Date },

  title: {
    type: String,
    required: true,
  },
  // per-space online & soft-delete fields
  isOnline: {
    type: Boolean,
    default: false,
  },
  region: { type: String, index: true, trim: true, lowercase: true },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  deletedAt: {
    type: Date,
    default: null,
  },

  description: String,
  location: {
    type: {
      type: String,
      enum: ["Point"],
      required: true,
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String,
  },
  totalSpots: {
    type: Number,
    required: true,
    default: 1
  },
  // current available spots
  availableSpots: {
    type: Number,
    required: true,
    default: 1
  },
  priceParking: {
    type: Number,
  },
  pricePerHour: {
    type: Number,
    required: true,
  },
  // NEW: discount percentage (0-100)
  discount: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  availability: [
    {
      date: Date,
      slots: [
        {
          startTime: Date,
          endTime: Date,
          isBooked: {
            type: Boolean,
            default: false,
          },
        },
      ],
    },
  ],
  amenities: [
    {
      type: String,
      enum: ["covered", "security", "charging", "cctv", "wheelchair"],
    },
  ],
  availableSpots: {
    type: Number,
  },
  photos: [{
    type: String
  }],
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0,
  },
  reviews: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ParkFinderSecondUser",
      },
      rating: Number,
      comment: String,
      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  status: {
    type: String,
    enum: ['submitted', 'pending', 'approved', 'rejected', 'active', 'inactive'],
    default: 'pending',
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
},
{
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

parkingSpaceSchema.index({ location: "2dsphere" });

// Virtual: discountedPrice based on pricePerHour and discount
parkingSpaceSchema.virtual('discountedPrice').get(function() {
  const price = Number(this.pricePerHour || 0);
  const discount = Number(this.discount || 0);
  const dp = price * (1 - discount / 100);
  return Number(dp.toFixed(2));
});

// Prevent OverwriteModelError
export default mongoose.models.ParkfindersecondParkingSpace ||
  mongoose.model("ParkfindersecondParkingSpace", parkingSpaceSchema);
