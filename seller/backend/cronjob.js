import cron from 'node-cron';
import Booking from './models/Booking.js';
import UserToken from './models/UserToken.js';
import NotificationService from './service/NotificationService.js';

// Helper: send notification to all tokens for user, skip invalid
const sendNotificationToUser = async (booking, minutesBefore) => {
  if (!booking.user) return;

  try {
    console.log(`[Reminder] Preparing to send ${minutesBefore}-min reminder for booking ${booking._id}`);

    const tokens = (await UserToken.find({ userId: booking.user }).select('token -_id'))
      .map(t => t.token)
      .filter(Boolean);

    console.log(`[Reminder] Found ${tokens.length} tokens for user ${booking.user}`);

    if (!tokens.length) return;

    const title = 'Parking time ending soon';
    const body = `Your parking session will end in ${minutesBefore} minutes. Consider extending if needed.`;

    // Send individually so that failure of one token doesn't stop others
    for (const token of tokens) {
      try {
        console.log(`[Reminder] Sending notification to token: ${token}`);
        await NotificationService.sendToDevice(token, title, body);
        console.log(`[Reminder] Notification sent successfully to ${token}`);
      } catch (err) {
        if (err.code === 'messaging/registration-token-not-registered') {
          console.warn(`[Reminder] Invalid FCM token skipped: ${token}`);
        } else {
          console.error(`[Reminder] FCM error for token ${token}`, err);
        }
      }
    }

    console.log(`[Reminder] Completed sending ${minutesBefore}-min reminder for booking ${booking._id}`);
  } catch (err) {
    console.error('[Reminder] Failed to send notification', err);
  }
};

// Main cron job function
export const startBookingReminderCron = () => {
  console.log('Booking reminder cron started...');

  // Run every minute
  cron.schedule('* * * * *', async () => {
    console.log(`[Cron] Running booking reminder check at ${new Date().toISOString()}`);
    try {
      const now = new Date();
      const bookings = await Booking.find({
        endTime: { $gte: now }
      }).populate('user', 'name email');

      console.log(`[Cron] Found ${bookings.length} bookings with endTime in the future`);

      bookings.forEach(booking => {
        console.log(`[Cron] Booking ${booking._id} status: ${booking.status}, paymentStatus: ${booking.paymentStatus}`);

        const endTs = new Date(booking.endTime).getTime();
        const remainingMs = endTs - now.getTime();
        const remainingMinutes = Math.ceil(remainingMs / (1000 * 60));

        console.log(`[Cron] Booking ${booking._id} ends in ${remainingMinutes} minutes`);

        const reminderMinutes = [50, 25, 20, 10, 5]; // minutes before end
        reminderMinutes.forEach(minutes => {
          const delayMs = remainingMs - minutes * 60 * 1000;

          if (delayMs <= 0 && delayMs > -60 * 1000) {
            console.log(`[Cron] Triggering ${minutes}-min reminder for booking ${booking._id}`);
            sendNotificationToUser(booking, minutes);
          }
        });
      });
    } catch (err) {
      console.error('[Cron] Error fetching bookings', err);
    }
  });
};
