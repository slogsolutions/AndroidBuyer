import NotificationService from '../service/NotificationService.js';
import UserToken from "../models/UserToken.js";

export const scheduleBookingEndReminders = (booking) => {
  if (!booking || !booking.user || !booking.endTime) return;

  console.log("enter inside the scheduleBookingEndReminders ")
  const now = Date.now();
  const endTs = new Date(booking.endTime).getTime();
  const remainingMs = endTs - now;

  if (remainingMs <= 0) return; // already ended

  const sendReminder = async (minutesBefore) => {
    try {
      const tokens = (await UserToken.find({ userId: booking.user }).select('token -_id'))
        .map(t => t.token)
        .filter(Boolean);
      if (tokens.length === 0) return;

      const title = 'Parking time ending soon';
      const body = `Your parking session will end in ${minutesBefore} minutes. Consider extending if needed.`;

      for (const token of tokens) {
        await NotificationService.sendToDevice(token, title, body);
      }
      console.log(`[Reminder] Sent ${minutesBefore}-min reminder for booking ${booking._id}`);
    } catch (err) {
      console.error('[Reminder] Error sending notification', err);
    }
  };

  // Schedule reminders (fire-and-forget)
  const reminders = [10, 5,25]; // minutes before endTime
  reminders.forEach(mins => {
    const delay = remainingMs - mins * 60 * 1000;
    if (delay > 0) {
      setTimeout(() => sendReminder(mins), delay);
    }
  });
};
