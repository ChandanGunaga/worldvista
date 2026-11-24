import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { BackToTop } from "@/components/lux/BackToTop";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site-dark flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <BackToTop />
    </div>
  );
}
