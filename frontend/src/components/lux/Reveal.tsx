"use client";
import { useEffect, useRef, type ElementType, type ReactNode } from "react";
import clsx from "clsx";

/** Fades/slides its children in when they scroll into view. */
export function Reveal({
  children,
  as: Tag = "div",
  className,
  delay = 0,
  variant = "up",
}: {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  delay?: number;
  variant?: "up" | "left" | "right" | "zoom";
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.classList.add("is-visible");
          io.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag
      ref={ref}
      className={clsx("reveal", variant !== "up" && `reveal-${variant}`, className)}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
