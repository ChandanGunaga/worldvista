"use client";
import { useApi } from "@/components/useApi";
import { PageHeader, Spinner } from "@/components/ui";

const INFO: Record<string, { name: string; what: string; env: string }> = {
  email: { name: "Email (SMTP)", what: "Verification codes, receipts and notifications by email.", env: "SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM" },
  payments: { name: "Razorpay payments", what: "Online payment for tour quotes and course fees.", env: "RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET" },
  cloudinary: { name: "Cloudinary images", what: "Permanent cloud storage for uploaded images (otherwise saved on the server disk).", env: "CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET" },
  whatsapp: { name: "WhatsApp (Twilio)", what: "Enquiry, payment-link and receipt messages on WhatsApp.", env: "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM" },
  sentry: { name: "Sentry monitoring", what: "Alerts you when the server hits an error.", env: "SENTRY_DSN" },
};

export default function IntegrationsPage() {
  const { data } = useApi<{ integrations: Record<string, boolean> }>("/admin/integrations");
  if (!data) return <Spinner />;
  return (
    <>
      <PageHeader title="Integrations" subtitle="Third-party services. Each switches on automatically when its keys are set in the backend environment." />
      <div className="grid gap-4 md:grid-cols-2">
        {Object.entries(INFO).map(([k, i]) => {
          const on = data.integrations[k];
          return (
            <div key={k} className="card p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-sans text-lg font-semibold text-navy-950">{i.name}</h2>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${on ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{on ? "Connected" : "Not configured"}</span>
              </div>
              <p className="mt-2 text-sm text-slate-600">{i.what}</p>
              {!on && <p className="mt-3 font-mono text-xs text-slate-500">Set: {i.env}</p>}
            </div>
          );
        })}
      </div>
    </>
  );
}
