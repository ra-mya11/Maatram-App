import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Bell, LogOut, RefreshCw } from "lucide-react";
import {
  getStudentNotifications,
  loginStudent,
  markStudentNotificationRead,
  SOCKET_URL,
  STUDENT_TOKEN_KEY,
  STUDENT_USER_KEY,
  type StudentAccount,
  type StudentNotification,
} from "@/lib/student-api";
import { subscribeToPush, unsubscribeFromPush } from "@/lib/web-push";

function readStoredUser(): StudentAccount | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = sessionStorage.getItem(STUDENT_USER_KEY);
    if (!stored) return null;
    const user = JSON.parse(stored) as StudentAccount;
    return user.role === "VOLUNTEER" && typeof user.name === "string" ? user : null;
  } catch {
    return null;
  }
}

function notificationTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString();
}

// Lazy-load socket.io-client only in the browser
async function connectSocket(url: string, token: string) {
  try {
    const { io } = await import("socket.io-client");
    return io(url, { auth: { token }, transports: ["websocket", "polling"] });
  } catch {
    return null;
  }
}

export function StudentNotifications({
  onUnreadChange,
}: {
  onUnreadChange: (count: number) => void;
}) {
  const [token, setToken] = useState(() =>
    typeof window === "undefined" ? null : sessionStorage.getItem(STUDENT_TOKEN_KEY),
  );
  const [user, setUser] = useState<StudentAccount | null>(readStoredUser);
  const [items, setItems] = useState<StudentNotification[]>([]);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(Boolean(token));
  const [busy, setBusy] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushStatus, setPushStatus] = useState("");
  const [error, setError] = useState("");
  const socketRef = useRef<{ disconnect: () => void } | null>(null);

  const refresh = useCallback(
    async (authToken?: string) => {
      const t = authToken ?? token;
      if (!t) return;
      try {
        const notifications = await getStudentNotifications(t);
        setItems(notifications);
        onUnreadChange(notifications.filter((item) => !item.readAt).length);
        setError("");
        setLoading(false);
      } catch (reason) {
        setError(
          reason instanceof Error ? reason.message : "Could not load student notifications.",
        );
        setLoading(false);
      }
    },
    [onUnreadChange, token],
  );

  // Connect Socket.IO for real-time notification delivery
  useEffect(() => {
    if (!token) return;
    let active = true;
    connectSocket(SOCKET_URL, token).then((socket) => {
      if (!active || !socket) return;
      socketRef.current = socket;
      socket.on("notification:new", () => void refresh());
    });
    return () => {
      active = false;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [token, refresh]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      onUnreadChange(0);
      return;
    }
    void refresh();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 15000);
    return () => window.clearInterval(interval);
  }, [onUnreadChange, refresh, token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const session = await loginStudent(identifier.trim(), password);
      sessionStorage.setItem(STUDENT_TOKEN_KEY, session.token);
      sessionStorage.setItem(STUDENT_USER_KEY, JSON.stringify(session.user));
      setToken(session.token);
      setUser(session.user);
      setPassword("");
      setLoading(true);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to sign in to student notifications.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function enablePush() {
    if (!token) return;
    setPushBusy(true);
    setPushStatus("");
    setError("");
    try {
      await subscribeToPush(token);
      setPushStatus("Browser notifications are enabled on this device.");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not enable browser notifications.",
      );
    } finally {
      setPushBusy(false);
    }
  }

  async function markRead(item: StudentNotification) {
    if (!token || item.readAt) return;
    try {
      await markStudentNotificationRead(token, item.id);
      const readAt = new Date().toISOString();
      const updated = items.map((entry) => (entry.id === item.id ? { ...entry, readAt } : entry));
      setItems(updated);
      onUnreadChange(updated.filter((entry) => !entry.readAt).length);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not mark the notification as read.",
      );
    }
  }

  function signOut() {
    if (token) void unsubscribeFromPush(token);
    sessionStorage.removeItem(STUDENT_TOKEN_KEY);
    sessionStorage.removeItem(STUDENT_USER_KEY);
    socketRef.current?.disconnect();
    socketRef.current = null;
    setToken(null);
    setUser(null);
    setItems([]);
    setError("");
    onUnreadChange(0);
  }

  if (!token) {
    return (
      <section className="mq-notif-connect">
        <p>Connect your account to receive PULSE opportunity notifications.</p>
        <form onSubmit={(event) => void submit(event)}>
          <label>
            <span>Maatram ID or email</span>
            <input
              autoComplete="username"
              required
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
            />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error && (
            <p className="mq-notif-error" role="alert">
              {error}
            </p>
          )}
          <button className="mq-notif-submit" type="submit" disabled={busy}>
            {busy ? "Connecting…" : "Connect account"}
          </button>
        </form>
        <small>
          After connecting, tap Enable browser notifications and allow the browser prompt.
        </small>
      </section>
    );
  }

  return (
    <section className="mq-notif-center" aria-label="Student notifications">
      <div className="mq-notif-account">
        <span>{user ? `Notifications for ${user.name}` : "Your student notifications"}</span>
        <button type="button" onClick={signOut} aria-label="Sign out of student notifications">
          <LogOut size={15} /> Sign out
        </button>
      </div>
      <p className="mq-notif-status">
        Enable push alerts on this device to receive updates when the dashboard is closed.
      </p>
      <button
        type="button"
        className="mq-notif-submit"
        disabled={pushBusy}
        onClick={() => void enablePush()}
      >
        <Bell size={16} /> {pushBusy ? "Enabling…" : "Enable browser notifications"}
      </button>
      {pushStatus && (
        <p className="mq-notif-status" role="status">
          {pushStatus}
        </p>
      )}
      {loading && <p className="mq-notif-status">Loading notifications…</p>}
      {!loading && !items.length && (
        <p className="mq-notif-status">No notifications have been sent to this account yet.</p>
      )}
      {error && (
        <p className="mq-notif-error" role="alert">
          {error}
        </p>
      )}
      {items.map((item) => (
        <article
          className={`mq-notif-item${item.readAt ? "" : " mq-notif-item--unread"}`}
          key={item.id}
        >
          <Bell size={18} aria-hidden="true" />
          <div>
            <strong>{item.title}</strong>
            <p>{item.body}</p>
            <time>{notificationTime(item.createdAt)}</time>
            {item.deepLink && (
              <a href={item.deepLink} onClick={() => void markRead(item)}>
                View opportunity
              </a>
            )}
          </div>
          {!item.readAt && (
            <button type="button" className="mq-notif-read" onClick={() => void markRead(item)}>
              Mark read
            </button>
          )}
        </article>
      ))}
      <button
        type="button"
        className="mq-notif-refresh"
        disabled={loading}
        onClick={() => void refresh()}
      >
        <RefreshCw size={15} /> Refresh notifications
      </button>
    </section>
  );
}
