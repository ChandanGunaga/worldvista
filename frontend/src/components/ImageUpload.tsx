"use client";
import { useRef, useState } from "react";

/** Uploads an image to /api/admin/uploads and returns its URL via onUploaded. */
export function ImageUpload({ onUploaded }: { onUploaded: (url: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr("");
    if (file.size > 5 * 1024 * 1024) return setErr("Max 5 MB");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/uploads", { method: "POST", body: fd, credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      onUploaded(data.url);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onChange} />
      <button type="button" className="btn-outline btn-sm" disabled={busy} onClick={() => ref.current?.click()}>{busy ? "Uploading…" : "Upload image"}</button>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </span>
  );
}
