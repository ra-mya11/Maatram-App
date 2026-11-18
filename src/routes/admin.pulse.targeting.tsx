import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  CalendarCheck,
  CircleCheck,
  Info,
  MapPin,
  Megaphone,
  Send,
  Smartphone,
  Sparkles,
  Target,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AdminFrame, EventSummaryCard, PageHeader } from "@/components/admin/admin-ui";
import { useAdmin } from "@/components/admin/AdminState";
import { PulseConnectionPanel } from "@/components/admin/PulseConnectionPanel";
import { getOrganiserOpportunities, startPulseBroadcast, type PulseEvent } from "@/lib/pulse-api";
import { seo } from "@/lib/seo";
import target from "@/assets/admin/target.png";

export const Route = createFileRoute("/admin/pulse/targeting")({
  validateSearch: (s: Record<string, unknown>) => ({
    event: typeof s["event"] === "string" ? s["event"] : "palm-seeds",
  }),
  head: () =>
    seo(
      "Smart Volunteering Announcement",
      "Reach the right volunteers faster with tiered audience targeting.",
    ),
  component: Targeting,
});

const matchingInsights = [
  { label: "Skills Match", sub: "Volunteer skills and event requirements", value: 45 },
  { label: "Location Match", sub: "Distance or city match", value: 25 },
  { label: "Availability Match", sub: "Available during the event", value: 20 },
  { label: "Experience Match", sub: "Relevant volunteer experience", value: 10 },
];

const audienceTiers = [
  {
    tier: 1,
    label: "Best-matched volunteers",
    detail: "Match score ≥ 80%; starts with the closest fit.",
    reach: "First",
  },
  {
    tier: 2,
    label: "Wider relevant network",
    detail: "Match score ≥ 50%; expands if places remain.",
    reach: "Next",
  },
  {
    tier: 3,
    label: "Remaining Maatram community",
    detail: "Reaches remaining eligible volunteers if needed.",
    reach: "Last",
  },
] as const;

function Targeting() {
  const { event } = Route.useSearch();
  const { pulseSession } = useAdmin();
  const navigate = useNavigate();
  const [events, setEvents] = useState<PulseEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [previewTier, setPreviewTier] = useState<1 | 2 | 3>(1);
  const [loadError, setLoadError] = useState("");
  const [sendError, setSendError] = useState("");
  const loadEvents = useCallback(async () => {
    if (!pulseSession.token) {
      setEvents([]);
      return;
    }
    setLoading(true);
    setLoadError("");
    try {
      setEvents(await getOrganiserOpportunities(pulseSession.token));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load this opportunity.");
    } finally {
      setLoading(false);
    }
  }, [pulseSession.token]);
  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const ev = events.find((item) => item.id === event);
  const canBroadcast = ev?.apiStatus === "OPEN" && !ev.broadcastStopped;

  const sendAnnouncement = async () => {
    if (!pulseSession.token || !ev || !canBroadcast) return;
    setSending(true);
    setSendError("");
    try {
      const result = await startPulseBroadcast(pulseSession.token, ev.id);
      navigate({
        to: "/admin/pulse/success",
        search: {
          event: ev.id,
          campaignId: result.campaignId,
          sent: result.tier1.sent,
          tier1Status: result.tier1.status,
          escalationScheduled: result.escalationScheduled,
        },
      });
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "The broadcast could not be started.");
    } finally {
      setSending(false);
    }
  };

  return (
    <AdminFrame>
      <PageHeader
        back="/admin/pulse"
        icon={<Megaphone />}
        title="Smart Volunteering Announcement"
        sub="Reach the right volunteers, faster and smarter."
      />
      <section className="ad-banner">
        <span className="ad-icon-circle ad-icon-circle--solid">
          <Sparkles />
        </span>
        <div>
          <h2>AI-Powered Volunteer Targeting</h2>
          <p>Volunteers are grouped by location, past participation and availability.</p>
        </div>
        <img src={target} alt="" className="ad-banner__art" width={816} height={816} />
      </section>
      <PulseConnectionPanel />
      {pulseSession.status === "signed-in" && (
        <>
          {loading && (
            <p className="ad-empty">Loading opportunity from the notification service…</p>
          )}
          {loadError && (
            <p className="ad-error ad-error--box" role="alert">
              Could not load opportunity: {loadError}
            </p>
          )}
          {!loading && !loadError && !ev && (
            <p className="ad-error ad-error--box" role="alert">
              This opportunity was not found in the connected API. Return to PULSE and select a
              server opportunity.
            </p>
          )}
          {ev && (
            <>
              <EventSummaryCard ev={ev} />

              <section className="ad-card ad-block">
                <div className="ad-block__row">
                  <h2 className="ad-block__title">
                    <Smartphone /> Student push notification preview
                  </h2>
                  <span className="ad-chip ad-chip--yellow">Tier {previewTier}</span>
                </div>
                <p className="ad-hint">
                  Preview the notification content students see on their phones. Choose a tier to
                  preview its title.
                </p>
                <div className="ad-push-preview">
                  <div className="ad-push-preview__device" aria-label="Mobile notification preview">
                    <span className="ad-push-preview__notch" aria-hidden />
                    <div className="ad-push-preview__screen-label">
                      <strong>Maatram Foundation</strong>
                      <span>Lock screen preview</span>
                    </div>
                    <article className="ad-push-preview__notification">
                      <span className="ad-push-preview__app-icon">
                        <Megaphone size={18} />
                      </span>
                      <div className="ad-push-preview__content">
                        <div className="ad-push-preview__meta">
                          <strong>MAATRAM</strong>
                          <span>now</span>
                        </div>
                        <h3>
                          {{ 1: "🌱", 2: "🌿", 3: "🌳" }[previewTier]} New Volunteering Opportunity!
                        </h3>
                        <p>
                          {ev.name} – {ev.location}
                          <br />
                          <br />
                          Maatram Foundation has announced a new volunteering opportunity on{" "}
                          {ev.date}. Join us and make a difference!
                        </p>
                      </div>
                    </article>
                  </div>
                  <div className="ad-push-preview__side">
                    <strong>Preview a broadcast tier</strong>
                    <div className="ad-push-preview__tiers" role="group" aria-label="Preview tier">
                      {audienceTiers.map((tier) => (
                        <button
                          key={tier.tier}
                          type="button"
                          className={`ad-btn ad-btn--sm ${previewTier === tier.tier ? "ad-btn--primary" : "ad-btn--ghost"}`}
                          aria-pressed={previewTier === tier.tier}
                          onClick={() => setPreviewTier(tier.tier)}
                        >
                          Tier {tier.tier}
                        </button>
                      ))}
                    </div>
                    <p className="ad-hint">
                      The backend uses the same event details for each tier, with a different tier
                      marker. PULSE chooses recipients; only students with active registered device
                      tokens can receive a mobile push.
                    </p>
                  </div>
                </div>
              </section>

              <section className="ad-card ad-block">
                <div className="ad-block__row">
                  <h2 className="ad-block__title">
                    <Sparkles className="ad-sparkle" /> Matching Insights
                  </h2>
                  <Info size={18} className="ad-muted" />
                </div>
                <div className="ad-insights">
                  {matchingInsights.map((insight, index) => {
                    const icons = [<Target />, <MapPin />, <CalendarCheck />, <UsersRound />];
                    return (
                      <div key={insight.label} className="ad-insight">
                        <span className="ad-icon-circle">{icons[index]}</span>
                        <strong>{insight.label}</strong>
                        <small>{insight.sub}</small>
                        <b>{insight.value}%</b>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="ad-card ad-block">
                <div className="ad-block__row">
                  <h2 className="ad-block__title">
                    <UserRoundCheck /> PULSE audience expansion
                  </h2>
                  <span className="ad-chip ad-chip--yellow">Managed by the server</span>
                </div>
                <div className="ad-tiers">
                  {audienceTiers.map((tier) => (
                    <div key={tier.tier} className="ad-tier">
                      <span className="ad-tier__radio">{tier.tier}</span>
                      <span className="ad-tier__text">
                        <strong>
                          Tier {tier.tier}: {tier.label}
                        </strong>
                        <small>{tier.detail}</small>
                      </span>
                      <span className="ad-tier__count">
                        <b>{tier.reach}</b>
                        <small>reach</small>
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              {!canBroadcast && (
                <p className="ad-error ad-error--box" role="status">
                  {ev.apiStatus === "FULL"
                    ? "This opportunity is full. New registrations should use the waitlist."
                    : ev.broadcastStopped
                      ? "Broadcasting has been stopped for this opportunity."
                      : "Only open opportunities can start a PULSE broadcast."}
                </p>
              )}
              {sendError && (
                <p className="ad-error ad-error--box" role="alert">
                  {sendError}
                </p>
              )}
              <div className="ad-confirm" role="status" aria-live="polite">
                <span className="ad-icon-circle ad-icon-circle--solid">
                  <CircleCheck />
                </span>
                <p>
                  Start an automated three-tier announcement for <strong>{ev.name}</strong>. The
                  server selects eligible volunteers and expands the audience if places remain.
                </p>
              </div>
              <button
                type="button"
                className="ad-btn ad-btn--primary ad-btn--wide"
                disabled={!canBroadcast || sending}
                onClick={() => void sendAnnouncement()}
              >
                <Send /> {sending ? "Starting broadcast…" : "Start PULSE Broadcast"}
              </button>
            </>
          )}
        </>
      )}
    </AdminFrame>
  );
}
