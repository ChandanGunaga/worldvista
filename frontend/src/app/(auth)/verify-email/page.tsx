"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { Alert, Field } from "@/components/ui";

export default function VerifyEmail() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api("/auth/verify-email", { method: "POST", json: { email, code } });
      router.replace("/dashboard");
    } catch (err) {
      setMsg({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    try {
      const r = await api<{ message: string }>("/auth/resend-verification", { method: "POST", json: { email } });
      setMsg({ kind: "success", text: r.message });
    } catch (err) {
      setMsg({ kind: "error", text: (err as Error).message });
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <h1 className="text-3xl text-navy-950">Verify your email</h1>
        <p className="mt-1 text-sm text-slate-500">We sent a 6-digit code to your email. It expires in 10 minutes.</p>
      </div>
      <Field label="Email"><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      <Field label="Verification code"><input className="input text-center text-lg tracking-[0.5em]" inputMode="numeric" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /></Field>
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
      <button className="btn-navy w-full" disabled={busy}>{busy ? "Verifying…" : "Verify email"}</button>
      <button type="button" onClick={resend} className="w-full text-sm text-navy-700 underline">Resend code</button>
    </form>
  );
}
