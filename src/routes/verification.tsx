import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { A, Hl, Logo, Screen } from "@/components/mq";
import { mockStudent } from "@/data/mock";
import { loginStudent } from "@/lib/student-api";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/verification")({
  head: () => seo("Verifying Your Maatram ID", "Fetching and verifying your Maatram profile."),
  component: Verifying,
});

// Demo credentials that match the backend seed data
const DEMO_IDENTIFIER = "sanjai.r@demo.maatram.local";
const DEMO_PASSWORD = "Maatram@Student1";

const TOKEN_KEY = "maatram-student-notification-token";
const USER_KEY = "maatram-student-notification-user";

const steps = [
  { t: "QR Code Scanned", s: `ID Detected: ${mockStudent.maatramId}` },
  { t: "Fetching Your Details", s: "Retrieving from Maatram database..." },
  { t: "Verifying Profile", s: "Matching your student record..." },
  { t: "Preparing Your Dashboard", s: "Almost there..." },
];

function Verifying() {
  const navigate = useNavigate();
  const [active, setActive] = useState(2);
  const loginAttempted = useRef(false);

  // On step 2 ("Fetching Your Details"), do the real backend login silently
  useEffect(() => {
    if (active !== 2 || loginAttempted.current) return;
    loginAttempted.current = true;
    void (async () => {
      try {
        const session = await loginStudent(DEMO_IDENTIFIER, DEMO_PASSWORD);
        sessionStorage.setItem(TOKEN_KEY, session.token);
        sessionStorage.setItem(USER_KEY, JSON.stringify(session.user));
      } catch {
        // Backend may be offline — app still works with mock data
      }
    })();
  }, [active]);

  useEffect(() => {
    if (active > steps.length) {
      const t = setTimeout(() => navigate({ to: "/verified" }), 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setActive((a) => a + 1), 1300);
    return () => clearTimeout(t);
  }, [active, navigate]);

  return (
    <Screen deco="tl" footer="building">
      <div style={{ marginTop: 26 }}>
        <Logo />
      </div>
      <div className="mq-verify__ring">
        <svg className="mq-spinring" viewBox="0 0 100 100" aria-hidden>
          <circle
            cx="50"
            cy="50"
            r="47"
            fill="none"
            stroke="#FEC802"
            strokeWidth="1.6"
            strokeDasharray="40 18 8 30"
            strokeLinecap="round"
          />
        </svg>
        <img src={`${A}/illustrations/verification-id-badge.png`} alt="Maatram ID being verified" />
      </div>
      <h1 className="mq-title mq-title--md" style={{ marginTop: 18 }}>
        Verifying Your <Hl>Maatram</Hl> ID...
      </h1>
      <p className="mq-sub">Scanning and fetching your profile details from the Maatram database</p>
      <ol className="mq-timeline">
        {steps.map((st, i) => {
          const n = i + 1;
          const state = n < active ? "done" : n === active ? "active" : "idle";
          return (
            <li key={st.t}>
              <span
                className={`mq-dot ${state === "done" ? "mq-dot--done" : state === "active" ? "mq-dot--active" : ""}`}
              >
                {state === "done" && <Check size={16} strokeWidth={3.5} />}
              </span>
              {state === "idle" ? (
                <span className="mq-idle">{st.t}</span>
              ) : (
                <div>
                  <strong>{st.t}</strong>
                  <small>{st.s}</small>
                </div>
              )}
              {state === "active" ? (
                <span className="mq-dots">
                  <i />
                  <i />
                  <i />
                </span>
              ) : (
                <span />
              )}
            </li>
          );
        })}
      </ol>
    </Screen>
  );
}
