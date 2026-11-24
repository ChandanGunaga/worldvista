import Image from "next/image";
import type { ReactNode } from "react";

/** Inner-page banner: image with slow zoom, dark gradient, chip + title. */
export function PageHero({ chip, title, sub, image = "/images/dubai-wide.jpg", children }: { chip: string; title: ReactNode; sub?: ReactNode; image?: string; children?: ReactNode }) {
  return (
    <section className="relative isolate overflow-hidden bg-onyx-950 pb-20 pt-40 sm:pb-24 sm:pt-48">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <Image src={image} alt="" fill priority unoptimized={image.startsWith("/uploads/")} className="animate-kenburns object-cover opacity-40" sizes="100vw" />
      </div>
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-onyx-950/70 via-onyx-950/60 to-onyx-900" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-px bg-gradient-to-r from-transparent via-gold-500/40 to-transparent" />
      <div className="container-x text-center">
        <span className="chip animate-rise">{chip}</span>
        <h1 className="mx-auto mt-6 max-w-4xl animate-rise font-serif text-4xl leading-[1.08] text-white [animation-delay:120ms] sm:text-6xl">{title}</h1>
        {sub && <p className="mx-auto mt-6 max-w-2xl animate-rise text-lg text-white/65 [animation-delay:240ms]">{sub}</p>}
        {children && <div className="mt-8 animate-rise [animation-delay:360ms]">{children}</div>}
      </div>
    </section>
  );
}
