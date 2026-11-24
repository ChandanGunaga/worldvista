"use client";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { Alert, Field } from "@/components/ui";

export default function ForgotPassword() {
  const [step, setStep] = useState<"request" | "reset" | "done">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ kind: "error" | "success" | "info"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (step === "request") {
        const r = await api<{ message: string }>("/auth/forgot-password", { method: "POST", json: { email } });
        setMsg({ kind: "info", text: r.message });
        setStep("reset");
      } else {
        await api("/auth/reset-password", { method: "POST", json: { email, code, password } });
        setStep("done");
      }
    } catch (err) {
      setMsg({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (step === "done")
    return (
      <div className="space-y-5">
        <h1 className="font-serif text-3xl text-white">Password updated</h1>
        <Alert kind="success">Your password has been reset. All other sessions were signed out.</Alert>
        <Link href="/login" className="btn-lux w-full">Sign in</Link>
      </div>
    );

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <h1 className="font-serif text-3xl text-white">Reset your password</h1>
        <p className="mt-1 text-sm text-slate-500">{step === "request" ? "We'll email you a 6-digit reset code." : "Enter the code and choose a new password."}</p>
      </div>
      <Field label="Email"><input className="input" type="email" required value={email} disabled={step === "reset"} onChange={(e) => setEmail(e.target.value)} /></Field>
      {step === "reset" && (
        <>
          <Field label="Reset code"><input className="input text-center tracking-[0.5em]" inputMode="numeric" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /></Field>
          <Field label="New password" hint="8+ characters with a letter and a number"><input className="input" type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        </>
      )}
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
      <button className="btn-lux w-full" disabled={busy}>{busy ? "Please wait…" : step === "request" ? "Send reset code" : "Update password"}</button>
      <p className="text-center text-sm"><Link href="/login" className="text-navy-700 underline">Back to sign in</Link></p>
    </form>
  );
}
