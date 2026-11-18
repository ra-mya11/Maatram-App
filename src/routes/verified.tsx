import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BookOpen,
  Building2,
  CalendarDays,
  GraduationCap,
  Landmark,
  MapPin,
  QrCode,
} from "lucide-react";
import { A, Hl, Logo, PrimaryButton, Screen } from "@/components/mq";
import {
  SOCKET_URL,
  STUDENT_TOKEN_KEY,
  STUDENT_USER_KEY,
  type StudentAccount,
} from "@/lib/student-api";
import { subscribeToPush } from "@/lib/web-push";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/verified")({
  head: () =>
    seo("Login Successful", "Your Maatram ID has been verified and your profile is ready."),
  component: Verified,
});

function Verified() {
  const navigate = useNavigate();
  const [student, setStudent] = useState<StudentAccount | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState("");

  useEffect(() => {
    if (!sessionStorage.getItem(STUDENT_TOKEN_KEY)) {
      navigate({ to: "/login" });
      return;
    }

    try {
      const stored = sessionStorage.getItem(STUDENT_USER_KEY);
      if (!stored) throw new Error("Student session is missing.");
      const account = JSON.parse(stored) as StudentAccount;
      if (account.role !== "VOLUNTEER" || typeof account.name !== "string") {
        throw new Error("Student session is invalid.");
      }
      setStudent(account);
    } catch {
      sessionStorage.removeItem(STUDENT_TOKEN_KEY);
      sessionStorage.removeItem(STUDENT_USER_KEY);
      navigate({ to: "/login" });
    }
  }, [navigate]);

  const role = typeof window !== "undefined" ? sessionStorage.getItem("maatram-role") : "student";
  const category = role === "alumni" ? "Alumni" : "Student Volunteer";
  const profile = student?.profile;
  const photo = profile?.profilePhoto
    ? profile.profilePhoto.startsWith("http")
      ? profile.profilePhoto
      : `${SOCKET_URL}${profile.profilePhoto.startsWith("/") ? "" : "/"}${profile.profilePhoto}`
    : null;
  const initials =
    student?.name
      .split(/\s+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "M";

  function unlockDashboardAudio() {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      ctx.resume().catch(() => {});
    }
  }

  function continueToDashboard() {
    try {
      sessionStorage.removeItem("maatram-dashboard-entered");
      sessionStorage.removeItem("maatram-blast-shown");
      sessionStorage.setItem("maatram-blast-pending", "true");
    } catch {
      /* ignore */
    }
    navigate({ to: "/dashboard" });
  }

  async function enableNotificationsAndContinue() {
    const token = sessionStorage.getItem(STUDENT_TOKEN_KEY);
    if (!token) {
      navigate({ to: "/login" });
      return;
    }
    setPushBusy(true);
    setPushError("");
    try {
      await subscribeToPush(token);
      continueToDashboard();
    } catch (reason) {
      setPushError(
        reason instanceof Error ? reason.message : "Could not enable browser notifications.",
      );
    } finally {
      setPushBusy(false);
    }
  }

  return (
    <Screen deco="tl" footer="building">
      <div style={{ marginTop: 26 }}>
        <Logo />
      </div>
      <div className="mq-check">
        <img className="l" src={`${A}/decorations/yellow-emphasis-strokes.png`} alt="" />
        <img src={`${A}/illustrations/success-checkmark.png`} alt="Success" />
        <img className="r" src={`${A}/decorations/yellow-emphasis-strokes.png`} alt="" />
      </div>
      <h1 className="mq-title mq-title--lg mq-title--italic">
        Login <Hl>Successful!</Hl>
      </h1>
      <p className="mq-sub" style={{ maxWidth: "30ch" }}>
        Your Maatram ID has been verified and your profile has been fetched successfully.
      </p>
      <section className="mq-profile">
        {photo ? (
          <img
            className="mq-profile__photo"
            src={photo}
            alt={student ? `${student.name} profile` : "Student profile"}
          />
        ) : (
          <div
            className="mq-profile__photo mq-profile__placeholder"
            role="img"
            aria-label="Profile photo not provided"
          >
            {initials}
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <h2>{student?.name ?? "Student"}</h2>
          <div className="mq-idpill">
            <span>
              Maatram ID: <b>{profile?.maatramId ?? "Not assigned"}</b>
            </span>
            <QrCode size={22} />
          </div>
          <div className="mq-pinfo">
            <GraduationCap />
            <span>{category}</span>
          </div>
          <div className="mq-pinfo">
            <Landmark />
            <span>{profile?.college ?? "College not provided"}</span>
          </div>
          <div className="mq-pinfo">
            <BookOpen />
            <span>
              {profile?.department ?? "Department not provided"}
              <br />({profile?.academicYear ?? profile?.degree ?? "Academic year not provided"})
            </span>
          </div>
        </div>
      </section>
      <section className="mq-triple">
        <div>
          <CalendarDays size={26} />
          <small>Academic year</small>
          <strong>{profile?.academicYear ?? "—"}</strong>
        </div>
        <div>
          <MapPin size={24} />
          <small>City</small>
          <strong>{profile?.city ?? "—"}</strong>
        </div>
        <div>
          <Building2 size={24} />
          <small>District</small>
          <strong>{profile?.district ?? "—"}</strong>
        </div>
      </section>
      <div style={{ margin: "22px 8% 6px" }}>
        <PrimaryButton
          disabled={pushBusy}
          onClick={() => {
            const attempt = enableNotificationsAndContinue();
            unlockDashboardAudio();
            void attempt;
          }}
        >
          {pushBusy ? "Enabling notifications…" : "Enable notifications & continue"}
        </PrimaryButton>
        {pushError && (
          <p className="mq-auth-error" role="alert">
            {pushError}
          </p>
        )}
        <button
          type="button"
          className="mq-auth-link"
          onClick={() => {
            unlockDashboardAudio();
            continueToDashboard();
          }}
        >
          Continue without notifications
        </button>
      </div>
    </Screen>
  );
}
