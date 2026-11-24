"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { SessionUser } from "@/lib/types";
import { Alert, Field } from "@/components/ui";

export default function Login() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [mfa, setMfa] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const go = (user: SessionUser) => {
    const next = params.get("next");
    const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
    router.replace(safeNext ?? (user.role === "MEMBER" ? "/dashboard" : "/admin"));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!mfa) {
        const r = await api<{ user?: SessionUser; mfaRequired?: boolean }>("/auth/login", { method: "POST", json: { email, password } });
        if (r.mfaRequired) setMfa(true);
        else if (r.user) go(r.user);
      } else {
        const r = await api<{ user: SessionUser }>("/auth/login/mfa", { method: "POST", json: { email, code } });
        go(r.user);
      }
    } catch (err) {
      if (err instanceof ApiError && err.data?.needsVerification) {
        router.push(`/verify-email?email=${encodeURIComponent(email)}`);
        return;
      }
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <h1 className="font-serif text-3xl text-white">{mfa ? "Two-step verification" : "Member login"}</h1>
        <p className="mt-1 text-sm text-slate-500">{mfa ? `Enter the 6-digit code sent to ${email}.` : "Welcome back to World Vista."}</p>
      </div>
      {!mfa ? (
        <>
          <Field label="Email"><input className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Password"><input className="input" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <div className="text-right text-sm"><Link href="/forgot-password" className="text-navy-700 underline">Forgot password?</Link></div>
        </>
      ) : (
        <Field label="Verification code"><input className="input text-center text-lg tracking-[0.5em]" inputMode="numeric" maxLength={6} required autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /></Field>
      )}
      <Alert>{error}</Alert>
      <button className="btn-lux w-full" disabled={busy}>{busy ? "Please wait…" : mfa ? "Verify & sign in" : "Sign in"}</button>
      {!mfa && <p className="text-center text-sm text-slate-600">New to World Vista? <Link href="/register" className="font-semibold text-navy-700 underline">Create an account</Link></p>}
    </form>
  );
}
