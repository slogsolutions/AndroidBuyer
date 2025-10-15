import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  // Existing fields...
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  phone: {
    type: String,
    default: null,
  },
  phoneVerified: {
    type: Boolean,
    default: false,
  },
  onlineStatus: {
   type: Boolean,
   default: false,
 },
  password: {
    type: String,
    required: function() {
      return !this.googleId;
    },
  },
  googleId: {
    type: String,
    sparse: true,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  isCaptain:
   { type: Boolean, default: false,
    },
  captainAreas:
   [{ type: String }],

  // NEW: single region assigned to the user (captain)
  // This field will be used to filter which parking spaces the captain can view/review.
  // Stored as lowercase for consistent comparisons.
  region: {
    type: String,
    trim: true,
    lowercase: true,
    default: null,
  },

  isAdmin: {
    type: Boolean,
    default: false,
  },
  verificationToken: String,
  verificationExpire: Date,
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  kycStatus: {
    type: String,
    enum: ['pending', 'submitted', 'approved', 'rejected'],
    default: 'pending',
  },
  kycData: {
    fullName: String,
    dateOfBirth: String,
    address: String,
    city: String,
    state: String,
    zipCode: String,
    country: String,
    idType: {
      type: String,
      enum: ['passport', 'drivingLicense', 'nationalId'],
    },
    idNumber: String,
    phoneNumber: String,
    idDocumentUrl: String,
  },
  vehicles: [
    {
      make: { type: String, required: true },
      model: { type: String, required: true },
      year: { type: Number, required: true },
      licensePlate: { type: String, required: true },
      chassisNumber: String,
      registrationDate: Date,
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Password hash middleware
userSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User =  mongoose.model('ParkFinderSecondUser', userSchema);
export default User