import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bell,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  CircleCheck,
  ClipboardList,
  MapPin,
  RefreshCw,
  Send,
  UsersRound,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AdminFrame, AdminBack, Chip, Progress, categoryTone } from "@/components/admin/admin-ui";
import { useAdmin } from "@/components/admin/AdminState";
import { PulseConnectionPanel } from "@/components/admin/PulseConnectionPanel";
import {
  getOrganiserOpportunities,
  getPulseBroadcastStatus,
  type BroadcastStatus,
  type PulseEvent,
} from "@/lib/pulse-api";
import { seo } from "@/lib/seo";
import p1 from "@/assets/admin/volunteer-portrait-01.jpg";
import p2 from "@/assets/admin/volunteer-portrait-02.jpg";
import p3 from "@/assets/admin/volunteer-portrait-03.jpg";
import p4 from "@/assets/admin/volunteer-portrait-04.jpg";

export const Route = createFileRoute("/admin/pulse/success")({
  validateSearch: (s: Record<string, unknown>) => ({
    event: typeof s["event"] === "string" ? s["event"] : "",
    campaignId: typeof s["campaignId"] === "string" ? s["campaignId"] : "",
    sent: Math.max(0, Number(s["sent"]) || 0),
    tier1Status: typeof s["tier1Status"] === "string" ? s["tier1Status"] : "",
    escalationScheduled: s["escalationScheduled"] === true || s["escalationScheduled"] === "true",
  }),
  head: () =>
    seo("PULSE Broadcast", "View the result and status of your Maatram opportunity broadcast."),
  component: Sent,
});

function Sent() {
  const { event, campaignId, sent, tier1Status } = Route.useSearch();
  const { pulseSession } = useAdmin();
  const success = Boolean(campaignId) && tier1Status === "completed";
  const [opportunity, setOpportunity] = useState<PulseEvent | null>(null);
  const [campaign, setCampaign] = useState<BroadcastStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshError, setRefreshError] = useState("");

  const refresh = useCallback(async () => {
    if (!pulseSession.token || !event || !campaignId) return;
    setLoading(true);
    setRefreshError("");
    try {
      const [opportunities, status] = await Promise.all([
        getOrganiserOpportunities(pulseSession.token),
        getPulseBroadcastStatus(pulseSession.token, event),
      ]);
      setOpportunity(opportunities.find((item) => item.id === event) ?? null);
      setCampaign(status);
    } catch (error) {
      setRefreshError(
        error instanceof Error ? error.message : "Unable to refresh broadcast status.",
      );
    } finally {
      setLoading(false);
    }
  }, [pulseSession.token, event, campaignId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <AdminFrame className="ad-page--success">
      <header className="ad-header">
        <AdminBack to="/admin/pulse" />
      </header>
      <PulseConnectionPanel />

      {pulseSession.status === "signed-in" && (
        <>
          <div className="ad-sending">
            {[p1, p2, p3, p4].map((portrait, index) => (
              <span
                key={portrait}
                className={`ad-sending__p ad-sending__p--${index + 1} ${success ? "ok" : ""}`}
              >
                <img src={portrait} alt="" />
                <i>
                  <CircleCheck size={12} />
                </i>
              </span>
            ))}
            <div className="ad-phone">
              <span className="ad-phone__notch" />
              <Send className="ad-phone__plane" />
              <strong>{success ? "PULSE Broadcast Started" : "Broadcast Not Started"}</strong>
            </div>
          </div>
          <div className="ad-send-progress">
            <Progress value={success ? 100 : 0} />
            <p>
              <span>
                {success ? `${sent} volunteers targeted in Tier 1.` : "No broadcast was started."}
              </span>
              <b>{success ? "100%" : "0%"}</b>
            </p>
          </div>

          {success ? (
            <>
              <div className="ad-success-badge">
                <CircleCheck />
              </div>
              <h2 className="ad-big-title">
                PULSE Broadcast Started <span aria-hidden>🎉</span>
              </h2>
              <p className="ad-big-sub">
                The backend targeted <strong>{sent.toLocaleString("en-IN")}</strong> volunteers in
                Tier 1. Later tiers are managed by the server when places remain. Device push
                delivery depends on active student device registrations and Firebase configuration.
              </p>
              {opportunity && (
                <article className="ad-card ad-sent-card">
                  <img src={opportunity.image} alt="" />
                  <div>
                    <Chip tone={categoryTone(opportunity.category)}>{opportunity.category}</Chip>
                    <h3>{opportunity.name}</h3>
                    <p className="ad-inline-meta">
                      <CalendarDays />
                      {opportunity.date}
                    </p>
                    <p className="ad-inline-meta">
                      <MapPin />
                      {opportunity.fullLocation}
                    </p>
                  </div>
                  <span className="ad-chip ad-chip--green ad-sent-card__chip">
                    <CircleCheck size={14} /> Campaign started
                  </span>
                </article>
              )}
              {campaign && (
                <section className="ad-card ad-block">
                  <div className="ad-block__row">
                    <h2 className="ad-block__title">Live PULSE campaign status</h2>
                    <button
                      type="button"
                      className="ad-btn ad-btn--ghost ad-btn--sm"
                      onClick={() => void refresh()}
                      disabled={loading}
                    >
                      <RefreshCw size={16} /> {loading ? "Refreshing…" : "Refresh"}
                    </button>
                  </div>
                  <p className="ad-hint">
                    Campaign {campaign.campaignId} · {campaign.status} · {campaign.targeted}{" "}
                    volunteers targeted
                  </p>
                  <div className="ad-tiers">
                    {campaign.tiers.map((tier) => (
                      <div key={tier.tierName} className="ad-tier">
                        <span className="ad-tier__radio">{tier.tierName.replace("TIER_", "")}</span>
                        <span className="ad-tier__text">
                          <strong>{tier.tierName.replace("_", " ")}</strong>
                          <small>{tier.status}</small>
                        </span>
                        <span className="ad-tier__count">
                          <b>{tier.audienceCount}</b>
                          <small>targeted</small>
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              {refreshError && (
                <p className="ad-error ad-error--box" role="alert">
                  The broadcast request succeeded, but status refresh failed: {refreshError}
                </p>
              )}
              <section className="ad-next">
                <h3>What happens next?</h3>
                <ol>
                  <li>
                    <span>
                      <Bell />
                    </span>
                    Matched students with active device tokens can receive push notifications.
                  </li>
                  <li>
                    <span>
                      <ClipboardList />
                    </span>
                    Registration and capacity changes are handled by the backend.
                  </li>
                  <li>
                    <span>
                      <UsersRound />
                    </span>
                    RESERVE offers an opened slot to the next eligible waitlisted volunteer.
                  </li>
                </ol>
              </section>
            </>
          ) : (
            <p className="ad-error ad-error--box" role="alert">
              The selected opportunity could not start a PULSE campaign. Return to the opportunity
              list, check its status, and try again.
            </p>
          )}
        </>
      )}

      <div className="ad-sticky-actions ad-sticky-actions--two">
        <Link
          to="/admin/manage/$section"
          params={{ section: "communities" }}
          className="ad-btn ad-btn--ghost"
        >
          <UsersRound /> View Community
        </Link>
        <Link
          to="/admin/manage/$section"
          params={{ section: "events" }}
          className="ad-btn ad-btn--primary"
        >
          <ChartNoAxesColumnIncreasing /> Track Registrations
        </Link>
      </div>
    </AdminFrame>
  );
}
