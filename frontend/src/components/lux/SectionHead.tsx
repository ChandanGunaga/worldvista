import type { ReactNode } from "react";
import clsx from "clsx";
import { Reveal } from "./Reveal";

export function SectionHead({ chip, title, sub, center = true, className }: { chip?: string; title: ReactNode; sub?: ReactNode; center?: boolean; className?: string }) {
  return (
    <Reveal className={clsx(center && "text-center", className)}>
      {chip && <span className="chip">{chip}</span>}
      <h2 className="lux-title mt-5">{title}</h2>
      {center && <div className="lux-rule" />}
      {sub && <p className={clsx("lux-sub mt-5", center && "mx-auto max-w-2xl")}>{sub}</p>}
    </Reveal>
  );
}
