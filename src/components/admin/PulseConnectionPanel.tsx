import { LogOut, Radio } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useAdmin } from "@/components/admin/AdminState";

export function PulseConnectionPanel() {
  const { pulseSession, signInToPulse, signOutOfPulse } = useAdmin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await signInToPulse(email.trim(), password);
      setPassword("");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to connect to the notification service.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (pulseSession.status === "checking") {
    return (
      <section className="ad-card ad-block" aria-live="polite">
        <p className="ad-hint">Checking the notification service session…</p>
      </section>
    );
  }

  if (pulseSession.status === "signed-in" && pulseSession.user) {
    return (
      <section className="ad-card ad-block ad-pulse-connection" aria-label="Notification service">
        <div>
          <strong>Notification service connected</strong>
          <p className="ad-hint">
            Signed in as {pulseSession.user.name} ({pulseSession.user.role}).
          </p>
        </div>
        <button type="button" className="ad-btn ad-btn--ghost ad-btn--sm" onClick={signOutOfPulse}>
          <LogOut size={16} /> Sign out
        </button>
      </section>
    );
  }

  return (
    <section className="ad-card ad-block">
      <div className="ad-block__row">
        <h2 className="ad-block__title">
          <Radio /> Connect to the notification service
        </h2>
      </div>
      <p className="ad-hint">
        Sign in with an admin or organiser account from your Maatram API. Your session token stays
        in this browser tab.
      </p>
      {(pulseSession.error || error) && (
        <p className="ad-error ad-error--box" role="alert">
          {error || pulseSession.error}
        </p>
      )}
      <form className="ad-pulse-auth__form" onSubmit={(event) => void submit(event)}>
        <label className="ad-pulse-auth__field">
          <span className="ad-field__label">Email</span>
          <input
            className="ad-input"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="ad-pulse-auth__field">
          <span className="ad-field__label">Password</span>
          <input
            className="ad-input"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button type="submit" className="ad-btn ad-btn--primary" disabled={busy}>
          <Radio size={18} /> {busy ? "Connecting…" : "Connect"}
        </button>
      </form>
    </section>
  );
}
