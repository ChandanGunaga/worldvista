import { env, features } from "./env";

/**
 * Sends a WhatsApp message via Twilio when configured; otherwise a no-op.
 * Never throws: messaging failures must not break the main request.
 * Note: WhatsApp requires pre-approved templates for business-initiated messages
 * outside the 24-hour customer-service window.
 */
export async function sendWhatsApp(phone: string | null | undefined, body: string) {
  if (!features.whatsapp || !phone) return;
  const to = normalizePhone(phone);
  if (!to) return;
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.twilio.accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${env.twilio.accountSid}:${env.twilio.authToken}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ From: `whatsapp:${env.twilio.whatsappFrom}`, To: `whatsapp:${to}`, Body: body }),
    });
    if (!res.ok) console.error("WhatsApp send failed", res.status);
  } catch (e) {
    console.error("WhatsApp send error", (e as Error).message);
  }
}

/** Accepts +countrycode numbers; bare 10-digit numbers are treated as Indian (+91). */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+") && digits.length >= 10) return digits;
  const d = digits.replace(/\D/g, "");
  if (d.length === 10) return `+91${d}`;
  if (d.length >= 11 && d.length <= 15) return `+${d}`;
  return null;
}
