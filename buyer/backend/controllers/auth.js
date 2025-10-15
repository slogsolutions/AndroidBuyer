// backend/controllers/auth.js
import jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';
import User from '../models/User.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/email.js';
import Twilio from 'twilio';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const twilioClient = Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const TWILIO_VERIFY_SID = process.env.TWILIO_VERIFY_SERVICE_SID;

/**
 * Single generateToken function that accepts either:
 * - a user object (preferred) -> will include id, isAdmin, isCaptain in payload
 * - or an id string -> will include only id in payload
 *
 * This keeps backward compatibility with existing calls that pass user._id.
 */
const generateToken = (userOrId) => {
  // If a string (or something that's not an object) was passed, treat it as id
  if (!userOrId || typeof userOrId === 'string' || typeof userOrId === 'number') {
    const id = typeof userOrId === 'string' || typeof userOrId === 'number' ? userOrId : undefined;
    return jwt.sign({ id }, process.env.JWT_SECRET, {
      expiresIn: '30d',
    });
  }

  // If a user object was passed, include flags
  const user = userOrId;
  return jwt.sign(
    {
      id: user._id,
      isAdmin: !!user.isAdmin,
      isCaptain: !!user.isCaptain,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

//for easy Register 
export const register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log("Validation errors:", errors.array());
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { name, email, password } = req.body;
    console.log("Registering user:", email);

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create new user
    user = new User({
      name,
      email,
      password,
    });

    // Save user
    const savedUser = await user.save();
    console.log("User saved:", savedUser._id);

    // Respond with success message
    return res.status(201).json({
      message: 'User registered successfully.',
    });

  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: 'Server error. Please try again later.' });
  }
};


// POST /api/auth/send-phone-otp
export const sendPhoneOtp = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: 'Phone is required' });

    const verification = await twilioClient.verify
      .services(TWILIO_VERIFY_SID)
      .verifications.create({ to: phone, channel: 'sms' });

    return res.json({ message: 'OTP sent', status: verification.status });
  } catch (error) {
    console.error('sendPhoneOtp error', error);
    return res.status(500).json({ message: 'Failed to send OTP' });
  }
};

// POST /api/auth/verify-phone-otp
export const verifyPhoneOtp = async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) return res.status(400).json({ message: 'Phone and code required' });

    const verificationCheck = await twilioClient.verify
      .services(TWILIO_VERIFY_SID)
      .verificationChecks.create({ to: phone, code });

    if (verificationCheck.status === 'approved') {
      const userId = req.user && req.user.id;
      if (!userId) return res.status(401).json({ message: 'Not authenticated' });

      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ message: 'User not found' });

      user.phone = phone;
      user.phoneVerified = true;
      await user.save();

      return res.json({ message: 'Phone verified', phone: user.phone, phoneVerified: true });
    }
    return res.status(400).json({ message: 'Invalid code' });
  } catch (error) {
    console.error('verifyPhoneOtp error', error);
    return res.status(500).json({ message: 'Failed to verify OTP' });
  }
};


export const setOnlineStatus = async (req, res) => {
  try {
    // expect { online: true/false } in request body
    const { online } = req.body;
    if (typeof online !== 'boolean') {
      return res.status(400).json({ message: 'Invalid online value' });
    }

    // req.user is attached by protect middleware (user doc without password)
    req.user.onlineStatus = online;
    await req.user.save();

    return res.json({
      message: 'Online status updated',
      onlineStatus: req.user.onlineStatus,
    });
  } catch (err) {
    console.error('setOnlineStatus error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    const user = await User.findOne({
      verificationToken: token,
      verificationExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired verification token' });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationExpire = undefined;
    await user.save();

    const authToken = generateToken(user._id);

    res.json({
      message: 'Email verified successfully',
      token: authToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Email verification failed' });
  }
};

export const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: 'Email already verified' });
    }

    const verificationToken = crypto.randomBytes(20).toString('hex');
    user.verificationToken = verificationToken;
    user.verificationExpire = Date.now() + 24 * 60 * 60 * 1000;
    await user.save();

    await sendVerificationEmail(email, verificationToken);

    res.json({ message: 'Verification email resent' });
  } catch (error) {
    res.status(500).json({ message: 'Could not resend verification email' });
  }
};

export const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // if (!user.isVerified) {
    //   return res.status(401).json({ 
    //     message: 'Please verify your email before logging in',
    //     needsVerification: true 
    //   });
    // }

    const token = generateToken(user._id);

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' ,error :error});
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const resetToken = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

    await user.save();
    await sendPasswordResetEmail(user.email, resetToken);

    res.json({ message: 'Password reset email sent' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Could not send password reset email' });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Could not reset password' });
  }
};

export const googleAuth = async (req, res) => {
  try {
    const { credential } = req.body;
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const { name, email, sub: googleId } = ticket.getPayload();
    let user = await User.findOne({ email });

    if (!user) {
      user = new User({
        name,
        email,
        googleId,
        isVerified: true,
      });
      await user.save();
    }

    const token = generateToken(user._id);

    res.json({
  token,
  user: {
    id: user._id,
    name: user.name,
    email: user.email,
    isVerified: user.isVerified,
    phone: user.phone || null,
    phoneVerified: !!user.phoneVerified,
    kycStatus: user.kycStatus || null,     // or kycCompleted flag if you use that
    role: user.role || null,
    // add other safe fields you want available immediately
  },
});

  } catch (error) {
    res.status(500).json({ message: 'Google authentication failed' });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Update profile controller
 * PATCH /api/auth/me
 * Allows updating only safe fields: name, bio, kycData (phoneNumber, address, city, country)
 * Does NOT allow updating role, kycStatus, isAdmin, or other privileged fields.
 */
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { name, fullName, bio, kycData } = req.body;

    // allow alias 'fullName' from frontend
    if (typeof fullName === "string" && !name) {
      user.name = fullName.trim();
    } else if (typeof name === "string") {
      user.name = name.trim();
    }

    if (typeof bio === "string") user.bio = bio.trim();

    if (kycData && typeof kycData === "object") {
      user.kycData = user.kycData || {};
      if (typeof kycData.phoneNumber === "string") user.kycData.phoneNumber = kycData.phoneNumber;
      if (typeof kycData.address === "string") user.kycData.address = kycData.address;
      if (typeof kycData.city === "string") user.kycData.city = kycData.city;
      if (typeof kycData.country === "string") user.kycData.country = kycData.country;
      // IMPORTANT: Do NOT allow clients to set kycStatus/approved directly here.
    }

    const updated = await user.save();

    const out = updated.toObject ? updated.toObject() : updated;
    if (out.password) delete out.password;

    res.json(out);
  } catch (error) {
    console.error("updateProfile error:", error);
    res.status(500).json({ message: "Could not update profile" });
  }
};
