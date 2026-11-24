import type { Metadata } from "next";
import Link from "next/link";
import { serverApi } from "@/lib/api";
import type { Faq } from "@/lib/types";
import { PageHero } from "@/components/lux/PageHero";
import { Reveal } from "@/components/lux/Reveal";
import { Emblem } from "@/components/lux/Emblem";

export const metadata: Metadata = { title: "FAQ" };

export default async function FaqPage() {
  const data = await serverApi<{ faqs: Faq[] }>("/public/faqs");
  return (
    <>
      <PageHero chip="FAQ & answers" title={<>Get every <span className="text-gold-grad italic">single</span> answer</>} sub="Everything you need to know about journeys, the academy and your membership." />
      <section className="container-x grid gap-16 py-24 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          {(data?.faqs ?? []).map((f, i) => (
            <Reveal key={f.id} delay={Math.min(i, 6) * 70}>
              <details className="faq-item rounded-2xl border border-white/[0.08] bg-onyx-800 transition-colors" open={i === 0}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 p-6 text-lg font-semibold text-white">
                  {f.question}
                  <span className="faq-icon text-2xl font-light text-gold-300 transition-transform duration-300">+</span>
                </summary>
                <p className="px-6 pb-6 leading-relaxed text-white/60">{f.answer}</p>
              </details>
            </Reveal>
          ))}
        </div>
        <div className="lg:sticky lg:top-32 lg:self-start">
          <Reveal variant="zoom" className="hidden lg:block"><Emblem size="md" /></Reveal>
          <Reveal className="lux-card-gold mt-6 p-8 text-center">
            <h2 className="font-serif text-2xl text-white">Still have a question?</h2>
            <p className="mt-2 text-white/55">Our team usually replies within 1–2 business days.</p>
            <Link href="/contact" className="btn-lux mt-6">Contact us</Link>
          </Reveal>
        </div>
      </section>
    </>
  );
}
