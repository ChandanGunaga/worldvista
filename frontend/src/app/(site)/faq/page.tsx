import type { Metadata } from "next";
import { serverApi } from "@/lib/api";
import type { Faq } from "@/lib/types";

export const metadata: Metadata = { title: "FAQs" };

export default async function FaqPage() {
  const data = await serverApi<{ faqs: Faq[] }>("/public/faqs");
  return (
    <div className="container-x max-w-3xl py-16">
      <p className="eyebrow">Help</p>
      <h1 className="mt-2 text-4xl text-navy-950">Frequently asked questions</h1>
      <div className="mt-10 space-y-3">
        {(data?.faqs ?? []).map((f) => (
          <details key={f.id} className="card p-5">
            <summary className="cursor-pointer font-semibold text-navy-950">{f.question}</summary>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{f.answer}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
