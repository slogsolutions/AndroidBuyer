// import { useEffect, useRef, useState } from "react";
// import { messaging } from "../firebase";
// import { getToken, onMessage } from "firebase/messaging";
// import { toast } from "react-toastify";
// import api from "../utils/api";

// export const useFirebaseMessaging = (user: any) => {
//   const [fcmToken, setFcmToken] = useState<string | null>(null);
//   const listenerSet = useRef(false);

//   useEffect(() => {
//     console.log("1 inside hook")
//     if (!user || !user._id) return; // only run if user exists
// console.log("2  inside hook after check user")
//     const requestPermissionAndToken = async () => {
//       try {
//         const permission = await Notification.requestPermission();
//         if (permission !== "granted") return;

//         const token = await getToken(messaging, {
//           vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
//         });
//         console.log("3 Your Token",token)
//         if (!token) return;

//         const storageKey = `fcm_token_${user._id}`;
//         const savedToken = localStorage.getItem(storageKey);

//         if (token !== savedToken) {
        
//           setFcmToken(token);
//           localStorage.setItem(storageKey, token);

//           // ✅ Send to backend with user._id
//              console.log("4 Your not saved so sended to save to backend")
//           await api.post("/users/save-token", {
//             userId: user._id,
//             fcmToken: token,
//             deviceInfo: navigator.userAgent,
//           });
//         } else {
//              console.log("5 Entered Else in Hook")
//           setFcmToken(savedToken);
//         }
//       } catch (err) {
//         console.error("FCM token error:", err);
//       }
//     };

//     // Set up message listener only once
//     if (!listenerSet.current) {
//       onMessage(messaging, (payload) => {
//         toast.info(
//           `${payload.notification?.title || "Notification"}: ${
//             payload.notification?.body || ""
//           }`,
//           { position: "top-right", autoClose: 5000 }
//         );
//       });
//       listenerSet.current = true;
//     }

//     requestPermissionAndToken();
//   }, [user?._id]);

//   return fcmToken;
// };


import { useEffect, useRef, useState } from "react";
import { messaging } from "../firebase";
import { getToken, onMessage } from "firebase/messaging";
import { toast } from "react-toastify";
import api from "../utils/api";

type StoredFcm = { token: string; userId: string };

export const useFirebaseMessaging = (user: any) => {
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const listenerRef = useRef<{ unsub?: () => void }>({});

  useEffect(() => {
    if (!user || !user._id) return;

    let mounted = true;
    const localKey = `fcm_token`; // stores { token, userId }

    const requestPermissionAndToken = async () => {
      try {
        // Only prompt if not already granted
        if (Notification.permission !== "granted") {
          const permission = await Notification.requestPermission();
          if (permission !== "granted") {
            console.log("1.a Notification permission not granted");
            return;
          }
        }

        const token = await getToken(messaging, {
          vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
        });

        console.log("1.b FCM token:", token);
        if (!token) return;

        // read saved token object { token, userId } from local storage
        let saved: StoredFcm | null = null;
        const savedRaw = localStorage.getItem(localKey);
        if (savedRaw) {
          try {
            saved = JSON.parse(savedRaw) as StoredFcm;
          } catch (e) {
            saved = null;
          }
        }

        // Determine whether we need to inform backend:
        // send if no saved object, token changed, or saved owner is different.
        const needSendToBackend =
          !saved || saved.token !== token || saved.userId !== user._id;

        // Always update local storage to reflect latest token + owner
        localStorage.setItem(localKey, JSON.stringify({ token, userId: user._id }));

        if (needSendToBackend) {
          if (mounted) setFcmToken(token);

          try {
            // Ensure your `api` automatically attaches auth headers (Bearer).
            await api.post("/users/save-token", {
              userId: user._id,
              fcmToken: token,
              deviceInfo: navigator.userAgent,
            });
            console.log("2. Saved FCM token to backend (or reassigned). measn token changed or saved new");
          } catch (err) {
            console.error("2.b Failed to save token to backend:", err);
            // Optionally remove local entry so next attempt retries:
            // localStorage.removeItem(localKey);
          }
        } else {
          // nothing to do; reuse saved token
          if (mounted) setFcmToken(saved!.token);
        }
      } catch (err) {
        console.error("3. FCM token error:", err);
      }
    };

    // Setup onMessage once and store unsubscribe
    if (!listenerRef.current.unsub) {
      const unsub = onMessage(messaging, (payload) => {
        toast.info(
          `${payload.notification?.title || "Notification"}: ${payload.notification?.body || ""}`,
          { position: "top-right", autoClose: 5000 }
        );
      });

      // v9 `onMessage` sometimes returns undefined — guard that
      listenerRef.current.unsub = typeof unsub === "function" ? unsub : undefined;
    }

    requestPermissionAndToken();

    // Re-check on focus to handle token rotation while app was backgrounded
    const onFocus = () => requestPermissionAndToken();
    window.addEventListener("focus", onFocus);

    return () => {
      mounted = false;
      window.removeEventListener("focus", onFocus);
      if (listenerRef.current.unsub) {
        try {
          listenerRef.current.unsub();
        } catch (e) {
          console.warn("Error during FCM onMessage cleanup:", e);
        }
        listenerRef.current.unsub = undefined;
      }
    };
  }, [user?._id]);

  return fcmToken;
};

export default useFirebaseMessaging;
