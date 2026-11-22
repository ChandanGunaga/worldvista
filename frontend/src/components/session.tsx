"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { SessionUser } from "@/lib/types";

type Ctx = { user: SessionUser | null; loading: boolean; logout: () => Promise<void> };
const SessionContext = createContext<Ctx>({ user: null, loading: true, logout: async () => {} });

/** Loads the session and redirects to /login when absent. `admin` requires a staff role. */
export function SessionGate({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ user: SessionUser }>("/auth/me")
      .then(({ user }) => {
        if (admin && user.role === "MEMBER") router.replace("/dashboard");
        else setUser(user);
      })
      .catch(() => router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`))
      .finally(() => setLoading(false));
  }, [admin, router]);

  const logout = async () => {
    await api("/auth/logout", { method: "POST" });
    router.replace("/login");
  };

  if (loading || !user) return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Loading…</div>;
  return <SessionContext.Provider value={{ user, loading, logout }}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);
