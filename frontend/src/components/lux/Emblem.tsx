import Image from "next/image";
import clsx from "clsx";

/** Floating gold W emblem inside a slowly rotating gold ring. */
export function Emblem({ className, size = "lg" }: { className?: string; size?: "md" | "lg" }) {
  const box = size === "lg" ? "h-[340px] w-[340px] sm:h-[440px] sm:w-[440px]" : "h-[260px] w-[260px] sm:h-[320px] sm:w-[320px]";
  return (
    <div className={clsx("relative mx-auto grid place-items-center", box, className)} aria-hidden>
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(226,176,74,.28)_0%,rgba(226,176,74,0)_65%)]" />
      <div className="absolute inset-[6%] animate-spin-slow rounded-full p-[2px] [background:conic-gradient(from_0deg,transparent_0deg,#f7d27a_70deg,transparent_140deg,#b8862b_220deg,transparent_300deg)]">
        <div className="h-full w-full rounded-full bg-onyx-900" />
      </div>
      <div className="absolute inset-[16%] rounded-full border border-gold-500/25" />
      <div className="absolute inset-[24%] rounded-full border border-dashed border-gold-500/20" />
      {[...Array(8)].map((_, i) => (
        <span
          key={i}
          className="absolute h-1 w-1 animate-twinkle rounded-full bg-gold-200"
          style={{ top: `${50 + 46 * Math.sin((i * Math.PI) / 4)}%`, left: `${50 + 46 * Math.cos((i * Math.PI) / 4)}%`, animationDelay: `${i * 0.4}s` }}
        />
      ))}
      <Image src="/images/emblem-w.png" alt="" width={700} height={350} priority className="relative w-[58%] animate-float drop-shadow-[0_20px_40px_rgba(226,176,74,.35)]" />
    </div>
  );
}
