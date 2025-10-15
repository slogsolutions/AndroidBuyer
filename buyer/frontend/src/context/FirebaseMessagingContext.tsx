// src/context/FirebaseMessagingContext.tsx
import React, { createContext, useContext } from "react";
import { useFirebaseMessaging } from "../hooks/useFirebaseMessaging";

type FirebaseMessagingContextType = {
  fcmToken: string | null;
};

const FirebaseMessagingContext = createContext<FirebaseMessagingContextType>({
  fcmToken: null,
});

export const FirebaseMessagingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const fcmToken = useFirebaseMessaging(); // just reuse your hook

  return (
    <FirebaseMessagingContext.Provider value={{ fcmToken }}>
      {children}
    </FirebaseMessagingContext.Provider>
  );
};

export const useFCMToken = () => useContext(FirebaseMessagingContext);
