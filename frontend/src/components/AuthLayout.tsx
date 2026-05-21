import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";

import { Logo } from "./Logo";

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: Props) {
  return (
    <div className="grid h-full grid-cols-1 lg:grid-cols-[1.1fr,1fr]">
      <aside className="relative hidden overflow-hidden lg:flex brand-radial">
        <div className="relative z-10 flex h-full w-full flex-col justify-between p-12 text-white">
          <Logo variant="light" />

          <div className="max-w-md space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-gold-400/30 bg-gold-400/10 px-3 py-1 text-xs font-medium text-gold-300 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-gold-400" />
              Meet Aria · your AI Concierge
            </div>
            <h2 className="text-4xl font-bold leading-tight tracking-tight">
              Here to help.
              <br />
              <span className="text-gold-400">Here to listen.</span>
              <br />
              Here for you.
            </h2>
            <p className="text-base leading-relaxed text-navy-100">
              Aria is your AI Concierge — warm, intelligent, and grounded in
              your business knowledge. Employees get a tireless teammate; your
              customers get effortless, on-brand support.
            </p>
          </div>

          <div className="flex items-center gap-6 text-xs text-navy-200/80">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-glow" />
              Powered by Gemini on Vertex AI
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-gold-400/15 blur-3xl" />
        <div className="pointer-events-none absolute -top-24 -left-12 h-72 w-72 rounded-full bg-sky-400/15 blur-3xl" />
      </aside>

      <main className="flex items-center justify-center p-6 sm:p-10 bg-white">
        <div className="w-full max-w-md animate-fade-in">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <div className="space-y-1.5 mb-7">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-navy-800">
              {title}
            </h1>
            {subtitle && <p className="text-sm text-navy-400">{subtitle}</p>}
          </div>
          {children}
          {footer && (
            <div className="mt-6 text-center text-sm text-navy-400">{footer}</div>
          )}
        </div>
      </main>
    </div>
  );
}
