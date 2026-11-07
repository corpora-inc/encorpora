import { useEffect, useRef } from "react";
import styles from "./Join.module.css";

type Detect = (video: HTMLVideoElement) => Promise<string | null>;
type Detector = {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
};
type DetectorClass = {
  new (options: { formats: string[] }): Detector;
  getSupportedFormats: () => Promise<string[]>;
};

/** The browser's own reader when it has one; otherwise jsQR, loaded only now. */
async function makeDetect(): Promise<Detect> {
  const Native = (window as unknown as { BarcodeDetector?: DetectorClass })
    .BarcodeDetector;
  if (Native && (await Native.getSupportedFormats()).includes("qr_code")) {
    const detector = new Native({ formats: ["qr_code"] });
    return async (video) => (await detector.detect(video))[0]?.rawValue ?? null;
  }
  const { default: jsQR } = await import("jsqr");
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  return async (video) => {
    const scale = Math.min(1, 720 / Math.max(video.videoWidth, 1));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    if (!canvas.width || !canvas.height) return null;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const { data, width, height } = context.getImageData(
      0,
      0,
      canvas.width,
      canvas.height,
    );
    return (
      jsQR(data, width, height, { inversionAttempts: "dontInvert" })?.data ??
      null
    );
  };
}

export const canScan = () => !!navigator.mediaDevices?.getUserMedia;

/** The camera, in the space the code field holds. Reads until it finds a code;
 * the camera turns off the moment this leaves. */
export function CardScanner({
  onRead,
  onFailure,
}: {
  /** Every code it reads. True when this one was the sign-in it wanted. */
  onRead: (text: string) => boolean;
  onFailure: (message: string) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const handlers = useRef({ onRead, onFailure });
  handlers.current = { onRead, onFailure };
  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (stopped) return;
        const element = video.current!;
        element.srcObject = stream;
        await element.play();
        const detect = await makeDetect();
        const look = async () => {
          if (stopped) return;
          const text = await detect(element).catch((error) => {
            console.warn("Card scan frame failed", error);
            return null;
          });
          if (stopped) return;
          if (text && handlers.current.onRead(text)) return;
          timer = setTimeout(() => void look(), 180);
        };
        void look();
      } catch (error) {
        if (stopped) return;
        console.error("Card scanner could not start", error);
        handlers.current.onFailure(
          (error as Error).name === "NotAllowedError"
            ? "The camera is off. Type your class code instead."
            : "The camera didn’t start. Type your class code instead.",
        );
      }
    })();
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);
  return (
    <div className={styles.viewfinder}>
      <video ref={video} muted playsInline aria-hidden="true" />
      <span className={styles.target} aria-hidden="true" />
    </div>
  );
}
