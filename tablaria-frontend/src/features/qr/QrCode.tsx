import QRCode from "qrcode";
import { cn } from "@/lib/utils";

/**
 * A QR code drawn as an SVG path, one square per dark module, so it prints
 * sharp at any size. Medium error correction survives a scuffed label.
 */
export function QrCode({
  value,
  label,
  className,
}: {
  value: string;
  /** What the code is, for screen readers: "Código QR de Taladro". */
  label: string;
  className?: string;
}) {
  const { modules } = QRCode.create(value, { errorCorrectionLevel: "M" });
  const quiet = 2;
  const size = modules.size + quiet * 2;
  let path = "";
  for (let row = 0; row < modules.size; row++) {
    for (let column = 0; column < modules.size; column++) {
      if (modules.get(row, column)) {
        path += `M${column + quiet} ${row + quiet}h1v1h-1z`;
      }
    }
  }
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className={cn("bg-white", className)}
    >
      <path d={path} fill="#000" />
    </svg>
  );
}

