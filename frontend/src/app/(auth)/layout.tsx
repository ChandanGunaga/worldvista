import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden bg-navy-950 lg:block">
        <Image src="/images/hero.jpg" alt="" fill className="object-cover opacity-60" sizes="50vw" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/30 to-transparent" />
        <div className="absolute bottom-12 left-12 right-12 text-white">
          <p className="font-serif text-4xl italic">&ldquo;More Meaningful Life&rdquo;</p>
          <p className="mt-3 text-sm font-semibold tracking-[0.3em] text-gold-400">TRAVEL • LEARN • EXPERIENCE</p>
        </div>
      </div>
      <div className="flex flex-col">
        <div className="bg-navy-900 px-6 py-3 lg:bg-transparent">
          <Link href="/" className="inline-block rounded-lg lg:bg-navy-900 lg:px-2"><Image src="/logo.png" alt="World Vista" width={150} height={50} className="h-10 w-auto" /></Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 py-10">
          <div className="w-full max-w-md"><Suspense>{children}</Suspense></div>
        </div>
      </div>
    </div>
  );
}
