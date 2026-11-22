"use client";
import clsx from "clsx";
import { useApi } from "@/components/useApi";
import { Empty, PageHeader, Spinner } from "@/components/ui";
import { api, fmtDate } from "@/lib/api";

type N = { id: string; title: string; body: string; createdAt: string; readAt: string | null };

export default function Notifications() {
  const { data, loading, reload } = useApi<{ notifications: N[] }>("/member/notifications");
  return (
    <>
      <PageHeader title="Notifications" action={<button className="btn-outline btn-sm" onClick={async () => { await api("/member/notifications/read-all", { method: "POST" }); reload(); }}>Mark all read</button>} />
      {loading ? <Spinner /> : data?.notifications.length ? (
        <ul className="space-y-3">
          {data.notifications.map((n) => (
            <li key={n.id} className={clsx("card p-4", !n.readAt && "border-l-4 border-l-gold-500")}>
              <div className="font-medium text-navy-950">{n.title}</div>
              <div className="text-sm text-slate-600">{n.body}</div>
              <div className="mt-1 text-xs text-slate-400">{fmtDate(n.createdAt, true)}</div>
            </li>
          ))}
        </ul>
      ) : <Empty>No notifications.</Empty>}
    </>
  );
}
