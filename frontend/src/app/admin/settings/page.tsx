"use client";
import { useEffect, useState } from "react";
import { useApi } from "@/components/useApi";
import { Alert, Field, PageHeader, Spinner } from "@/components/ui";
import { api } from "@/lib/api";

const GROUPS = {
  contact: { title: "Contact details", hint: "Shown on the public Contact page and footer.", fields: [["email", "Support email"], ["phone", "Phone"], ["whatsapp", "WhatsApp"], ["address", "Address"], ["hours", "Support hours"]] },
  company: { title: "Company details", hint: "Legal entity information shown in the footer and policies.", fields: [["legalName", "Legal name"], ["registration", "Registration / CIN"], ["gstin", "GSTIN"]] },
} as const;
type Key = keyof typeof GROUPS;

function Group({ k, initial }: { k: Key; initial: Record<string, string> }) {
  const g = GROUPS[k];
  const [vals, setVals] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  useEffect(() => setVals(Object.fromEntries(g.fields.map(([f]) => [f, initial[f] ?? ""]))), [initial, g.fields]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api(`/admin/settings/${k}`, { method: "PUT", json: vals });
      setMsg({ kind: "success", text: "Saved." });
    } catch (e) {
      setMsg({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="card space-y-4 p-6">
      <div>
        <h2 className="text-xl text-navy-950">{g.title}</h2>
        <p className="text-sm text-slate-500">{g.hint}</p>
      </div>
      {g.fields.map(([f, label]) => (
        <Field key={f} label={label}>
          {f === "address" ? (
            <textarea className="input" rows={3} maxLength={1000} value={vals[f] ?? ""} onChange={(e) => setVals({ ...vals, [f]: e.target.value })} />
          ) : (
            <input className="input" maxLength={1000} value={vals[f] ?? ""} onChange={(e) => setVals({ ...vals, [f]: e.target.value })} />
          )}
        </Field>
      ))}
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
      <div className="flex justify-end"><button className="btn-navy" disabled={busy}>{busy ? "Saving…" : "Save"}</button></div>
    </form>
  );
}

export default function SettingsPage() {
  const { data, error, loading } = useApi<{ settings: Record<string, Record<string, string>> }>("/admin/settings");
  if (loading && !data) return <Spinner />;
  if (error || !data) return <Alert>{error}</Alert>;
  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Group k="contact" initial={data.settings.contact ?? {}} />
        <Group k="company" initial={data.settings.company ?? {}} />
      </div>
    </>
  );
}
