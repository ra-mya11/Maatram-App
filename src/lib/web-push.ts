import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, deleteToken } from "firebase/messaging";

const firebaseConfig = {
  apiKey: import.meta.env["VITE_FIREBASE_API_KEY"] as string,
  authDomain: import.meta.env["VITE_FIREBASE_AUTH_DOMAIN"] as string,
  projectId: import.meta.env["VITE_FIREBASE_PROJECT_ID"] as string,
  storageBucket: import.meta.env["VITE_FIREBASE_STORAGE_BUCKET"] as string,
  messagingSenderId: import.meta.env["VITE_FIREBASE_MESSAGING_SENDER_ID"] as string,
  appId: import.meta.env["VITE_FIREBASE_APP_ID"] as string,
};

const VAPID_KEY = import.meta.env["VITE_FIREBASE_VAPID_KEY"] as string;
const API_BASE_URL = (import.meta.env["VITE_API_URL"] || "/api").replace(/\/+$/, "");

function getFirebaseApp() {
  return getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
      scope: "/",
    });
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "navigate" && typeof event.data.url === "string") {
        window.location.href = event.data.url;
      }
    });
    return reg;
  } catch {
    return null;
  }
}

export async function subscribeToPush(authToken: string): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    throw new Error("This browser does not support web push notifications.");
  }
  if (!window.isSecureContext) {
    throw new Error("Web push notifications require a secure HTTPS connection.");
  }
  if (!("Notification" in window)) {
    throw new Error("This browser does not support notification permissions.");
  }
  if (!VAPID_KEY || Object.values(firebaseConfig).some((value) => !value)) {
    throw new Error("Web push is not configured. Set the Firebase web app and VAPID variables.");
  }
  if (Notification.permission === "denied") {
    throw new Error(
      "Notifications are blocked for this site. Allow them in your browser settings.",
    );
  }

  // Keep this permission request as the first asynchronous action after the explicit user click.
  const permission =
    Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  const registration = await registerServiceWorker();
  if (!registration) {
    throw new Error("Could not register the notification service worker for this site.");
  }
  const activeRegistration = await navigator.serviceWorker.ready;
  const messaging = getMessaging(getFirebaseApp());
  const fcmToken = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: activeRegistration,
  });

  if (!fcmToken) {
    throw new Error("Firebase did not return a web push token. Check the Firebase web push setup.");
  }

  const response = await fetch(`${API_BASE_URL}/notification-devices`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ deviceToken: fcmToken, platform: "web" }),
  });
  if (!response.ok) {
    throw new Error(
      `The notification API could not register this device (${response.status}). Check VITE_API_URL and backend CORS settings.`,
    );
  }
  return true;
}

export async function unsubscribeFromPush(authToken: string): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const app = getFirebaseApp();
    const messaging = getMessaging(app);

    const reg = await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js");
    const unsubOptions = reg
      ? { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg }
      : { vapidKey: VAPID_KEY };
    const fcmToken = await getToken(messaging, unsubOptions).catch(() => null);

    if (fcmToken) {
      // Remove from backend
      await fetch(`${API_BASE_URL}/notification-devices`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ deviceToken: fcmToken }),
      });
      // Delete FCM token
      await deleteToken(messaging);
    }
  } catch {
    /* ignore */
  }
}
