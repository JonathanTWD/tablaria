import type { BarcodeDetector as Detector, BarcodeFormat } from "barcode-detector/ponyfill";

/** QR labels and the barcodes printed on products (EAN, UPC, Code 128…). */
const FORMATS: BarcodeFormat[] = [
  "qr_code",
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "code_39",
  "itf",
  "data_matrix",
];

export interface BarcodeReader {
  /** The first code in the frame, or null. */
  read: (source: HTMLVideoElement) => Promise<string | null>;
}

function readerFrom(detector: Detector): BarcodeReader {
  return {
    read: async (source) => {
      const [code] = await detector.detect(source);
      return code?.rawValue || null;
    },
  };
}

/**
 * The browser's own BarcodeDetector where it reads QR codes (Chrome, Android),
 * otherwise ZXing compiled to WebAssembly (Safari, Firefox), loaded only now
 * and served from this origin: no CDN, and the CSP allows it (ADR-051).
 */
export async function createBarcodeReader(): Promise<BarcodeReader> {
  // Not in TypeScript's DOM library yet; the ponyfill's type describes the same API.
  const Native = (window as Window & { BarcodeDetector?: typeof Detector }).BarcodeDetector;
  if (Native) {
    const supported = await Native.getSupportedFormats();
    if (supported.includes("qr_code")) {
      return readerFrom(new Native({ formats: FORMATS.filter((format) => supported.includes(format)) }));
    }
  }
  const [{ BarcodeDetector, setZXingModuleOverrides }, { default: wasmUrl }] = await Promise.all([
    import("barcode-detector/ponyfill"),
    import("zxing-wasm/reader/zxing_reader.wasm?url"),
  ]);
  setZXingModuleOverrides({
    locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? wasmUrl : prefix + path),
  });
  return readerFrom(new BarcodeDetector({ formats: FORMATS }));
}
