// backend/routes/payment.js
import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { protect } from '../middleware/auth.js';
import Booking from '../models/Booking.js';
import { scheduleBookingEndReminders } from '../utils/notificationScheduler.js';

const router = express.Router();

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_eQoJ7XZxUf37D7';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'BGzT1IIBANjZukY8LR9Pmjyy';

// const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env;
// if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
//   throw new Error('Razorpay live keys are not set. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to your env.');
// }

const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET,
});

function normalizeToPaise(amount, opts = { isPaise: undefined }) {
  const parsed = Number(amount);
  if (Number.isNaN(parsed) || parsed <= 0) return null;
  if (opts.isPaise === true) return Math.round(parsed);
  return Math.round(parsed * 100);
}

router.post('/initiate-payment', protect, async (req, res) => {
  try {
    const { bookingId, amount, isPaise } = req.body;
    if (!bookingId) return res.status(400).json({ success: false, message: 'bookingId required' });
    if (amount === undefined || amount === null || amount === '') {
      return res.status(400).json({ success: false, message: 'amount required' });
    }

    const amountPaise = normalizeToPaise(amount, { isPaise });
    if (!amountPaise || !Number.isInteger(amountPaise) || amountPaise <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount (could not normalize to paise)' });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const shortBooking = String(bookingId).slice(-8);
    const shortTs = Date.now().toString().slice(-6);
    const receipt = `r_${shortBooking}_${shortTs}`;

    const options = {
      amount: amountPaise,
      currency: 'INR',
      receipt,
      payment_capture: 1,
    };

    const order = await razorpay.orders.create(options);

    return res.status(200).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      bookingId,
    });
  } catch (err) {
    console.error('[initiate-payment] error', err);
    return res.status(500).json({ success: false, message: 'Failed to create order', error: err.message || err });
  }
});

/**
 * POST /api/payment/verify-payment
 * body: { bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature, extend?, isPaise?, fine? }
 */
router.post('/verify-payment', protect, async (req, res) => {
  try {
    const { bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature, extend, fine } = req.body;
    if (!bookingId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Missing required verification fields' });
    }

    // verify signature
    const generatedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      console.warn('[verify-payment] signature mismatch', { generatedSignature, razorpay_signature });
      return res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }

    // try to fetch payment to get captured amount
    let paidPaise = null;
    try {
      const payment = await razorpay.payments.fetch(razorpay_payment_id);
      paidPaise = Number(payment.amount); // paise
    } catch (errFetch) {
      console.warn('[verify-payment] payment fetch failed', errFetch);
      try {
        const order = await razorpay.orders.fetch(razorpay_order_id);
        paidPaise = Number(order.amount);
      } catch (errOrder) {
        console.error('[verify-payment] order fetch fallback failed', errOrder);
      }
    }

    if (!paidPaise || isNaN(paidPaise) || paidPaise <= 0) {
      return res.status(400).json({ success: false, message: 'Unable to determine paid amount from Razorpay' });
    }

    const paidRupees = Number((paidPaise / 100.0).toFixed(2));

    // update booking safely (increment)
    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const previousTotal = Number(booking.totalPrice || 0);
    booking.totalPrice = Number((previousTotal + paidRupees).toFixed(2));
    booking.paymentStatus = 'paid';

    let generatedOtp = null;

    // If this payment is an extension (extend === true), extend endTime by 1 hour
    if (extend === true || extend === 'true' || extend === 1) {
      const currentEndTs = booking.endTime ? new Date(booking.endTime).getTime() : Date.now();
      const baseTs = isNaN(currentEndTs) ? Date.now() : currentEndTs;
      booking.endTime = new Date(baseTs + 60 * 60 * 1000);
      // Keep session active/state as-is; server will emit booking-updated
    }

    // If this payment is a fine (user paid because booking was overdue)
    if (fine === true || fine === 'true' || fine === 1) {
      // DO NOT change endTime or set status to active here.
      // We only generate secondOtp (checkout OTP) and keep booking.status as-is (likely 'overdue').
      generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      booking.secondOtp = generatedOtp;
      booking.secondOtpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

      // do NOT set completedAt or change status to 'completed' or 'active' here.
    }

    await booking.save();

    //send notification after paid
if (booking.paymentStatus === 'paid') {
  scheduleBookingEndReminders(booking);
}

    // Load populated booking for return and emit via socket
    const populated = await Booking.findById(booking._id).populate('parkingSpace').populate('user', 'name email');

    try {
      if (global.io) {
        global.io.emit('booking-updated', { booking: populated });
        if (booking.user) global.io.to(booking.user.toString()).emit('booking-updated', { booking: populated });
      }
    } catch (emitErr) {
      console.warn('[verify-payment] socket emit error', emitErr);
    }

    return res.status(200).json({
      success: true,
      message: 'Payment verified and booking updated',
      booking: populated,
      paidAmount: paidRupees,
      previousTotal,
      newTotal: booking.totalPrice,
      otp: generatedOtp ? { otp: generatedOtp, expiresAt: booking.secondOtpExpires } : null,
    });
  } catch (err) {
    console.error('[verify-payment] error', err);
    return res.status(500).json({ success: false, message: 'Payment verification failed', error: err.message || err });
  }
});

export default router;
