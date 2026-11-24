"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";

export function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setShow(window.scrollY > 700);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <button
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={clsx(
        "fixed bottom-6 right-6 z-40 grid h-12 w-12 place-items-center rounded-full bg-gold-grad text-onyx-950 shadow-glow transition duration-300 hover:-translate-y-1",
        show ? "opacity-100" : "pointer-events-none translate-y-4 opacity-0",
      )}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
    </button>
  );
}
