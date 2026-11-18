import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { adminEvents, defaultDraft, type AdminEvent, type EventDraft } from "@/data/admin-mock";
import {
  createOpportunity,
  getPulseUser,
  loginPulseUser,
  publishOpportunity,
  toPulseEvent,
  type ApiOpportunity,
  type PulseUser,
} from "@/lib/pulse-api";

type Sent = { eventId: string; tier: number; count: number };
type PulseSession = {
  status: "checking" | "signed-out" | "signed-in";
  token: string | null;
  user: PulseUser | null;
  error: string | null;
};
type State = {
  draft: EventDraft;
  update: (patch: Partial<EventDraft>) => void;
  resetDraft: () => void;
  events: AdminEvent[];
  published: AdminEvent | null;
  publish: () => Promise<AdminEvent>;
  sent: Sent[];
  recordSent: (s: Sent) => void;
  pulseSession: PulseSession;
  signInToPulse: (email: string, password: string) => Promise<void>;
  signOutOfPulse: () => void;
};
const Ctx = createContext<State | null>(null);
const KEY = "maatram-admin-state";
const PULSE_TOKEN_KEY = "maatram-pulse-token";

export function AdminState({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<EventDraft>(defaultDraft);
  const [created, setCreated] = useState<AdminEvent[]>([]);
  const [published, setPublished] = useState<AdminEvent | null>(null);
  const [sent, setSent] = useState<Sent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pulseSession, setPulseSession] = useState<PulseSession>({
    status: "checking",
    token: null,
    user: null,
    error: null,
  });
  const pendingPublish = useRef<{ draftKey: string; opportunity: ApiOpportunity } | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem(PULSE_TOKEN_KEY);
    if (!token) {
      setPulseSession({ status: "signed-out", token: null, user: null, error: null });
      return;
    }

    void getPulseUser(token)
      .then((user) => setPulseSession({ status: "signed-in", token, user, error: null }))
      .catch((error: unknown) => {
        sessionStorage.removeItem(PULSE_TOKEN_KEY);
        setPulseSession({
          status: "signed-out",
          token: null,
          user: null,
          error:
            error instanceof Error
              ? error.message
              : "The saved admin session could not be verified.",
        });
      });
  }, []);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s.draft) setDraft({ ...defaultDraft, ...s.draft });
        if (s.created) setCreated(s.created);
        if (s.published) setPublished(s.published);
        if (s.sent) setSent(s.sent);
      }
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ draft, created, published, sent }));
    } catch {
      // Large uploaded images may exceed storage; keep everything else.
      try {
        sessionStorage.setItem(
          KEY,
          JSON.stringify({ draft: { ...draft, image: null }, created: [], published: null, sent }),
        );
      } catch {
        /* ignore */
      }
    }
  }, [draft, created, published, sent, loaded]);

  const update = useCallback((p: Partial<EventDraft>) => {
    setDraft((d) => ({ ...d, ...p }));
  }, []);

  const resetDraft = useCallback(() => {
    setDraft(defaultDraft);
  }, []);

  const recordSent = useCallback((s: Sent) => {
    setSent((o) => [...o, s]);
  }, []);

  const signInToPulse = useCallback(async (email: string, password: string) => {
    const { token, user } = await loginPulseUser(email, password);
    sessionStorage.setItem(PULSE_TOKEN_KEY, token);
    setPulseSession({ status: "signed-in", token, user, error: null });
  }, []);

  const signOutOfPulse = useCallback(() => {
    sessionStorage.removeItem(PULSE_TOKEN_KEY);
    setPulseSession({ status: "signed-out", token: null, user: null, error: null });
  }, []);

  const publish = useCallback(async () => {
    if (!pulseSession.token) {
      throw new Error("Sign in with an admin or organiser account before publishing.");
    }

    const draftKey = JSON.stringify(draft);
    let opportunity =
      pendingPublish.current?.draftKey === draftKey ? pendingPublish.current.opportunity : null;
    if (!opportunity) {
      opportunity = await createOpportunity(pulseSession.token, draft);
      pendingPublish.current = { draftKey, opportunity };
    }
    await publishOpportunity(pulseSession.token, opportunity.id);
    const ev = toPulseEvent({ ...opportunity, status: "OPEN", broadcastStopped: false });
    pendingPublish.current = null;
    setCreated((c) => [ev, ...c]);
    setPublished(ev);
    return ev;
  }, [draft, pulseSession.token]);

  const events = useMemo(() => [...created, ...adminEvents], [created]);

  const value = useMemo(
    () => ({
      draft,
      update,
      resetDraft,
      events,
      published,
      publish,
      sent,
      recordSent,
      pulseSession,
      signInToPulse,
      signOutOfPulse,
    }),
    [
      draft,
      update,
      resetDraft,
      events,
      published,
      publish,
      sent,
      recordSent,
      pulseSession,
      signInToPulse,
      signOutOfPulse,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdmin() {
  const s = useContext(Ctx);
  if (!s) throw new Error("AdminState provider missing");
  return s;
}

export function useAdminEvent(id: string | undefined) {
  const { events } = useAdmin();
  return events.find((e) => e.id === id) ?? events.find((e) => e.id === "palm-seeds")!;
}
