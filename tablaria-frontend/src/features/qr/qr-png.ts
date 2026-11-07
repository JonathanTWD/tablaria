import QRCode from "qrcode";

/** The same code as a PNG file, for labels made in another program. */
export async function downloadQrPng(value: string, fileName: string): Promise<void> {
  const href = await QRCode.toDataURL(value, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 600,
  });
  const link = document.createElement("a");
  link.href = href;
  link.download = fileName;
  link.click();
}
