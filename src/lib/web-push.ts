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
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return false;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    await navigator.serviceWorker.ready;

    const app = getFirebaseApp();
    const messaging = getMessaging(app);

    // getToken() returns a real FCM registration token — exactly what the backend expects
    const swReg = await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js");
    const tokenOptions = swReg
      ? { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg }
      : { vapidKey: VAPID_KEY };
    const fcmToken = await getToken(messaging, tokenOptions);

    if (!fcmToken) return false;

    // Register with backend — backend's PushNotificationService handles FCM tokens natively
    await fetch(`${API_BASE_URL}/notification-devices`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ deviceToken: fcmToken, platform: "web" }),
    });

    return true;
  } catch {
    return false;
  }
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
