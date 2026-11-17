import { useEffect, useRef, useState } from "react";
import { normalizeFriendCode } from "../../shared/social";

interface Detector {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
}
type DetectorFactory = new (options: { formats: string[] }) => Detector;

export function codeFromScan(value: string, origin: string): string | null {
  const direct = normalizeFriendCode(value);
  if (direct) return direct;
  try {
    const url = new URL(value);
    if (url.origin !== origin || url.pathname !== "/friends") return null;
    return normalizeFriendCode(url.searchParams.get("code"));
  } catch {
    return null;
  }
}

/** Optional camera feature; iOS browsers without BarcodeDetector use manual code. */
export function FriendScanner({
  onDetected,
  onClose,
}: {
  onDetected: (code: string) => void;
  onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let disposed = false;
    let frame = 0;
    let stream: MediaStream | null = null;
    const api = window as unknown as { BarcodeDetector?: DetectorFactory };
    const DetectorClass = api.BarcodeDetector;
    if (!DetectorClass || !navigator.mediaDevices?.getUserMedia) {
      setError("Camera scanning isn't supported here. Enter the code instead.");
      return;
    }
    let detector: Detector;
    try {
      detector = new DetectorClass({ formats: ["qr_code"] });
    } catch {
      setError("Camera scanning isn't supported here. Enter the code instead.");
      return;
    }
    void navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      })
      .then(async (camera) => {
        if (disposed || !video.current) {
          camera.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = camera;
        const node = video.current;
        node.srcObject = camera;
        try {
          await node.play();
          const scan = async () => {
            if (disposed) return;
            try {
              const codes = await detector.detect(node);
              for (const code of codes) {
                const valid = codeFromScan(
                  code.rawValue,
                  window.location.origin,
                );
                if (valid) {
                  onDetected(valid);
                  return;
                }
              }
            } catch {
              // A temporarily unreadable frame is not a permission error.
            }
            if (!disposed) frame = requestAnimationFrame(() => void scan());
          };
          frame = requestAnimationFrame(() => void scan());
        } catch {
          if (!disposed) setError("The camera could not start.");
        }
      })
      .catch(() => {
        if (!disposed) setError("Camera permission was denied or unavailable.");
      });
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
      if (video.current) video.current.srcObject = null;
    };
  }, [onDetected]);

  return (
    <div
      className="social-scanner"
      role="region"
      aria-label="Scan friend QR code"
    >
      <div className="social-scanner-head">
        <strong>Scan a friend code</strong>
        <button type="button" onClick={onClose}>
          Close camera
        </button>
      </div>
      {!error ? (
        <>
          <video
            ref={video}
            muted
            playsInline
            autoPlay
            aria-label="Camera QR scanner"
          />
          <p className="muted">Point the camera at a Daydle invitation QR.</p>
        </>
      ) : (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
    </div>
  );
}
