import QRCode from 'qrcode';

// Build a QR that points to the frontend visitor page with encoded payload.
// Scanning the QR will open the frontend route which will decode and render the payload.
export async function makeEventVisitorQR(payload) {
  const wrapper = { k: 'ev-visitor', v: payload };
  const json = JSON.stringify(wrapper);

  // base64 encode the JSON (URL-safe)
  const b64 = Buffer.from(json).toString('base64');

  // frontend base url: prefer env var, fallback to localhost
  const base = process.env.FRONTEND_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const targetUrl = `${base.replace(/\/$/, '')}/visitor-qr?d=${encodeURIComponent(b64)}`;

  // Generate a PNG that contains the target URL so scanners will open it
  const dataUrl = await QRCode.toDataURL(targetUrl, { margin: 1, scale: 6 });
  return dataUrl;
}
