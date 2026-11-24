import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { serverApi, fmtDate } from "@/lib/api";
import type { Page } from "@/lib/types";
import { Markdown } from "@/components/Markdown";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const d = await serverApi<{ page: Page }>(`/public/pages/${params.slug}`);
  return { title: d?.page.title ?? "Policy" };
}

export default async function LegalPage({ params }: { params: { slug: string } }) {
  const d = await serverApi<{ page: Page }>(`/public/pages/${params.slug}`);
  if (!d) notFound();
  return (
    <article className="container-x max-w-3xl pb-24 pt-40">
      <span className="chip">Policies</span>
      <h1 className="mt-5 font-serif text-4xl text-white sm:text-5xl">{d.page.title}</h1>
      <p className="mt-3 text-xs text-white/40">{d.page.isPolicy && `Version ${d.page.version} · `}Last updated {fmtDate(d.page.updatedAt)}</p>
      <div className="lux-card mt-10 p-8 sm:p-10"><Markdown>{d.page.body}</Markdown></div>
    </article>
  );
}
