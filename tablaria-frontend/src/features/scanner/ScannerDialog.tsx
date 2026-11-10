import { ScanLine } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createBarcodeReader } from "./barcode-reader";

/** Frames read per second: enough to feel instant without heating the phone. */
const READ_INTERVAL_MS = 200;

type CameraStatus = "starting" | "scanning" | "denied" | "missing" | "insecure" | "failed";

function failure(error: unknown): CameraStatus {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") return "denied";
    if (error.name === "NotFoundError" || error.name === "OverconstrainedError") return "missing";
  }
  return "failed";
}

/**
 * Reads a QR label or a barcode with the camera (ADR-051). The code can also
 * be typed: the camera may be missing or blocked, and keyboards need a way in.
 */
export function ScannerDialog({
  open,
  onOpenChange,
  description,
  onScan,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What a scan does here, e.g. "Abre la etiqueta de un registro o busca su código". */
  description: string;
  onScan: (value: string) => void;
}) {
  const { t } = useTranslation(["scanner", "common"]);
  const ids = useId();
  const [typed, setTyped] = useState("");
  const viewfinder = useRef<HTMLDivElement>(null);

  const finish = (value: string) => {
    setTyped("");
    onOpenChange(false);
    onScan(value);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (typed.trim()) {
      finish(typed.trim());
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={t("common:close")}
        className="sm:max-w-md"
        // On a touch screen the typed field would raise the keyboard over the camera:
        // focus starts on the viewfinder instead, still inside the dialog.
        initialFocus={() => (window.matchMedia("(pointer: coarse)").matches ? viewfinder.current : true)}
      >
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {/* Mounted only while open: the camera turns off as soon as the dialog closes. */}
        <div ref={viewfinder} tabIndex={-1} className="outline-none">
          {open && <Camera onRead={finish} />}
        </div>
        <form onSubmit={submit} className="flex items-end gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label htmlFor={`${ids}-code`} className="text-sm font-medium">
              {t("manual")}
            </label>
            <Input
              id={`${ids}-code`}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              className="h-9"
            />
          </div>
          <Button type="submit" className="h-9" disabled={!typed.trim()}>
            {t("submit")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Camera({ onRead }: { onRead: (value: string) => void }) {
  const { t } = useTranslation("scanner");
  const video = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<CameraStatus>(() =>
    typeof navigator.mediaDevices?.getUserMedia === "function" ? "starting" : "insecure",
  );
  // The latest callback, without restarting the camera when the parent re-renders.
  const read = useRef(onRead);
  useEffect(() => {
    read.current = onRead;
  });

  useEffect(() => {
    if (typeof navigator.mediaDevices?.getUserMedia !== "function") return;
    let stopped = false;
    let stream: MediaStream | undefined;
    let timer: number | undefined;

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        const element = video.current;
        if (stopped || !element) return;
        element.srcObject = stream;
        await element.play();
        const reader = await createBarcodeReader();
        if (stopped) return;
        setStatus("scanning");
        const tick = async () => {
          if (stopped) return;
          const code = element.readyState >= 2 ? await reader.read(element).catch(() => null) : null;
          if (stopped) return;
          if (code) {
            stopped = true;
            navigator.vibrate?.(60);
            read.current(code);
            return;
          }
          timer = window.setTimeout(() => void tick(), READ_INTERVAL_MS);
        };
        void tick();
      } catch (error) {
        if (!stopped) setStatus(failure(error));
      }
    };
    void start();

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const working = status === "starting" || status === "scanning";
  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-black">
        <video ref={video} muted playsInline aria-hidden="true" className="size-full object-cover" />
        {status === "scanning" && (
          // Where to hold the code; decorative, the status line says it.
          <div aria-hidden="true" className="pointer-events-none absolute inset-[18%] rounded-lg border-2 border-white/80" />
        )}
        {!working && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-sm text-white/90">
            <ScanLine aria-hidden="true" className="size-8 text-white/60" />
          </div>
        )}
      </div>
      <p role="status" className="text-sm text-muted-foreground">
        {t(`status.${status}`)}
      </p>
    </div>
  );
}
