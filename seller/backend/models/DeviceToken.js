// backend/models/DeviceToken.js
import mongoose from 'mongoose';

const DeviceTokenSchema = new mongoose.Schema(
  {
    // userId is optional now. If provided, it should be an ObjectId referencing User.
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // the FCM token (required)
    token: { type: String, required: true, unique: true, index: true },

    // optional device info string (model, platform, app version, etc.)
    deviceInfo: { type: String, default: null },

    // additional field to record when we last saw/updated this token
    lastSeen: { type: Date, default: Date.now },
  },
  {
    timestamps: true, // adds createdAt and updatedAt
  }
);

// ensure there is an index for token (unique) and optionally a compound index if desired later
DeviceTokenSchema.index({ token: 1 }, { unique: true });

export default mongoose.model('DeviceToken', DeviceTokenSchema);
