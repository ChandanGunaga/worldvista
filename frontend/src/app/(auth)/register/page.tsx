"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { Alert, Field } from "@/components/ui";

export default function Register() {
  const router = useRouter();
  const params = useSearchParams();
  const [f, setF] = useState({
    fullName: "", email: "", mobile: "", password: "", confirm: "", country: "India", address: "",
    sponsorId: params.get("ref") ?? "", side: params.get("side") === "RIGHT" ? "RIGHT" : "LEFT", consent: false,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (f.password !== f.confirm) return setError("Passwords do not match");
    setBusy(true);
    setError("");
    try {
      const body: Partial<typeof f> = { ...f };
      delete body.confirm;
      await api("/auth/register", { method: "POST", json: { ...body, consent: f.consent || undefined } });
      router.push(`/verify-email?email=${encodeURIComponent(f.email)}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h1 className="font-serif text-3xl text-white">Create your account</h1>
        <p className="mt-1 text-sm text-slate-500">Join World Vista to manage trips, courses and support.</p>
      </div>
      <Field label="Full name"><input className="input" required autoComplete="name" value={f.fullName} onChange={set("fullName")} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email"><input className="input" type="email" required autoComplete="email" value={f.email} onChange={set("email")} /></Field>
        <Field label="Mobile"><input className="input" required autoComplete="tel" value={f.mobile} onChange={set("mobile")} /></Field>
        <Field label="Password" hint="8+ characters with a letter and a number"><input className="input" type="password" required autoComplete="new-password" value={f.password} onChange={set("password")} /></Field>
        <Field label="Confirm password"><input className="input" type="password" required autoComplete="new-password" value={f.confirm} onChange={set("confirm")} /></Field>
        <Field label="Country"><input className="input" required autoComplete="country-name" value={f.country} onChange={set("country")} /></Field>
        <Field label="City / address"><input className="input" autoComplete="street-address" value={f.address} onChange={set("address")} /></Field>
        <Field label="Referrer ID (optional)"><input className="input uppercase" placeholder="WV123456" value={f.sponsorId} onChange={set("sponsorId")} /></Field>
        {f.sponsorId && (
          <Field label="Team side">
            <select className="input" value={f.side} onChange={set("side")}><option value="LEFT">Left</option><option value="RIGHT">Right</option></select>
          </Field>
        )}
      </div>
      <label className="flex items-start gap-3 text-sm text-slate-600">
        <input type="checkbox" className="mt-1 h-4 w-4 accent-gold-400" checked={f.consent} onChange={set("consent")} required />
        <span>I agree to the <Link href="/legal/terms" target="_blank" className="underline">Terms & Conditions</Link> and <Link href="/legal/privacy" target="_blank" className="underline">Privacy Policy</Link>, and I have read the <Link href="/legal/disclaimer" target="_blank" className="underline">Disclaimer</Link>.</span>
      </label>
      <Alert>{error}</Alert>
      <button className="btn-lux w-full" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
      <p className="text-center text-sm text-slate-600">Already a member? <Link href="/login" className="font-semibold text-navy-700 underline">Sign in</Link></p>
    </form>
  );
}
