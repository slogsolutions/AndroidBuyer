import { firebaseApp } from "../utils/firebase.js";
import { getMessaging } from "firebase-admin/messaging";

const messaging = getMessaging(firebaseApp);

class NotificationService {
  static async sendToDevice(token, title, body, data = {}) {
    const message = {
      notification: { title, body },
      data,
      token,
    };
    return await messaging.send(message);
  }

  static async sendToMultiple(tokens, title, body, data = {}) {
    if (!tokens || tokens.length === 0) {
      return { successCount: 0, failureCount: 0, responses: [] };
    }

    const message = {
      notification: { title, body },
      data,
      tokens,
    };
      console.log("enter inside the scheduleBookingEndReminders ")
    return await messaging.sendEachForMulticast(message);
  }
}

export default NotificationService;