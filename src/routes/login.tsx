import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { Camera, Image as ImageIcon, QrCode } from "lucide-react";
import { Hl, Screen, Strokes, TopNav } from "@/components/mq";
import { loginStudent, STUDENT_TOKEN_KEY, STUDENT_USER_KEY } from "@/lib/student-api";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/login")({
  head: () => seo("Scan Your Maatram ID", "Scan the QR code on your Maatram ID card to log in."),
  component: Scanner,
});

function Scanner() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"scan" | "credentials">("scan");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const readerRef = useRef<BrowserQRCodeReader | null>(null);
  const scannedRef = useRef(false);

  useEffect(
    () => () => {
      controlsRef.current?.stop();
    },
    [],
  );

  function stopCamera() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setCameraActive(false);
  }

  function acceptQr(value: string) {
    if (scannedRef.current) return;
    const maatramId = value.trim().toUpperCase();
    if (!/^[A-Z0-9-]{3,30}$/.test(maatramId)) {
      setScannerError("This QR code does not contain a valid Maatram ID.");
      return;
    }

    scannedRef.current = true;
    stopCamera();
    setIdentifier(maatramId);
    setScannerError("");
    setError("");
    setStep("credentials");
  }

  async function startCamera() {
    if (!videoRef.current || cameraStarting || cameraActive) return;
    setScannerError("");
    scannedRef.current = false;
    setCameraStarting(true);
    try {
      const reader = (readerRef.current ??= new BrowserQRCodeReader());
      controlsRef.current = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result) => {
          if (result) acceptQr(result.getText());
        },
      );
      setCameraActive(true);
    } catch (reason) {
      setScannerError(
        reason instanceof Error
          ? reason.message
          : "Could not open the camera. Allow camera access or enter your Maatram ID manually.",
      );
    } finally {
      setCameraStarting(false);
    }
  }

  async function scanImage(file: File) {
    setScannerError("");
    scannedRef.current = false;
    stopCamera();
    try {
      const reader = (readerRef.current ??= new BrowserQRCodeReader());
      const imageUrl = URL.createObjectURL(file);
      try {
        const result = await reader.decodeFromImageUrl(imageUrl);
        acceptQr(result.getText());
      } finally {
        URL.revokeObjectURL(imageUrl);
      }
    } catch (reason) {
      setScannerError(
        reason instanceof Error
          ? `Could not read a QR code from that image: ${reason.message}`
          : "Could not read a Maatram ID QR code from that image.",
      );
    }
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const session = await loginStudent(identifier.trim().toUpperCase(), password);
      sessionStorage.setItem(STUDENT_TOKEN_KEY, session.token);
      sessionStorage.setItem(STUDENT_USER_KEY, JSON.stringify(session.user));
      navigate({ to: "/verification" });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to verify this student account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen deco="tr" footer="waves">
      <TopNav back="/welcome" />
      <div style={{ position: "relative", marginTop: 18 }}>
        <h1 className="mq-title mq-title--lg">
          Scan Your <Hl>Maatram ID</Hl>
        </h1>
        <Strokes style={{ right: "2%", top: -36 }} />
      </div>
      <p className="mq-sub">
        Scan your Maatram ID and sign in with the password for your student account.
      </p>
      {step === "scan" ? (
        <>
          <div className="mq-scanner">
            <video ref={videoRef} muted playsInline aria-label="Camera QR scanner" />
            {!cameraActive && (
              <div className="mq-scanner__placeholder">
                <QrCode size={44} aria-hidden="true" />
                <span>Start the camera and point it at your Maatram ID QR code</span>
              </div>
            )}
            {cameraActive && <div className="mq-scanner__line" />}
            {cameraActive && (
              <div className="mq-scanner__status" role="status">
                Point the camera at your Maatram ID QR code
              </div>
            )}
          </div>
          {scannerError && (
            <p className="mq-auth-error" role="alert">
              {scannerError}
            </p>
          )}
          <div className="mq-scan-actions">
            <button
              className="mq-scan-action"
              type="button"
              aria-pressed={cameraActive || cameraStarting}
              disabled={cameraStarting}
              onClick={() => (cameraActive ? stopCamera() : void startCamera())}
            >
              <span>
                <Camera size={26} />
              </span>
              <span>
                {cameraStarting ? "Starting…" : cameraActive ? "Stop Camera" : "Start Camera"}
              </span>
            </button>
            <button
              className="mq-scan-action"
              type="button"
              onClick={() => fileRef.current?.click()}
            >
              <span>
                <ImageIcon size={26} />
              </span>
              <span>Scan from Gallery</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void scanImage(file);
                event.currentTarget.value = "";
              }}
            />
          </div>
          <button
            type="button"
            className="mq-auth-link"
            onClick={() => {
              stopCamera();
              setStep("credentials");
            }}
          >
            Enter Maatram ID manually
          </button>
        </>
      ) : (
        <section className="mq-student-auth">
          <h2>Verify your student account</h2>
          <p>Use the password connected to your Maatram student account.</p>
          <form onSubmit={(event) => void signIn(event)}>
            <label>
              <span>Maatram ID</span>
              <input
                autoComplete="username"
                required
                maxLength={30}
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value.toUpperCase())}
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
              <p className="mq-auth-error" role="alert">
                {error}
              </p>
            )}
            <button className="mq-auth-submit" type="submit" disabled={busy}>
              {busy ? "Verifying…" : "Sign in"}
            </button>
          </form>
          <button
            type="button"
            className="mq-auth-link"
            onClick={() => {
              setPassword("");
              setError("");
              scannedRef.current = false;
              setStep("scan");
            }}
          >
            Scan a different QR code
          </button>
        </section>
      )}
    </Screen>
  );
}
