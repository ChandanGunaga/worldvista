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
    <article className="container-x max-w-3xl py-16">
      <h1 className="text-4xl text-navy-950">{d.page.title}</h1>
      <p className="mt-2 text-xs text-slate-500">{d.page.isPolicy && `Version ${d.page.version} · `}Last updated {fmtDate(d.page.updatedAt)}</p>
      <div className="mt-8"><Markdown>{d.page.body}</Markdown></div>
    </article>
  );
}
