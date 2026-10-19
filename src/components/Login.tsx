"use client";
import { useState } from "react";
import { ArrowLeftRight, BadgeCheck, ListChecks, Lock, Mail, Smartphone } from "lucide-react";
import { LANGS, t } from "@/lib/i18n";
import type { Lang } from "@/lib/ledger";

// Demo sign-in. There is no account system: the number is pre-filled, the
// one-time code is shown on screen, and nothing leaves the browser. It exists
// so the demo starts the way a banking app does.

export const DEMO_CODE = "246810";
const DEMO_PHONE = "81 234 5678";
// example.com is reserved for documentation, so it can never reach a real inbox.
const DEMO_EMAIL = "student@example.com";
const DIAL_CODES = ["+66", "+86", "+84", "+62", "+81", "+82", "+60", "+65", "+63", "+91", "+44", "+1"];

export type SignInMethod = "phone" | "email";

export interface DemoUser {
  /** Phone number or email address the demo user signed in with. */
  contact: string;
  method: SignInMethod;
  signedInAt: string;
}

export function Login({ lang, onLang, onSignIn }: { lang: Lang; onLang: (l: Lang) => void; onSignIn: (u: DemoUser) => void }) {
  const d = t(lang);
  const [method, setMethod] = useState<SignInMethod>("phone");
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [dial, setDial] = useState("+66");
  const [phone, setPhone] = useState(DEMO_PHONE);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const field = "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-base text-text outline-none focus:border-brand";

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const contactOk = method === "phone" ? phone.replace(/\D/g, "").length >= 6 : emailOk;
  const finish = (m: SignInMethod = method) =>
    onSignIn({ contact: m === "phone" ? `${dial} ${phone}` : email.trim(), method: m, signedInAt: new Date().toISOString() });
  const switchMethod = (m: SignInMethod) => {
    setMethod(m);
    setSent(false);
    setCode("");
    setErr("");
  };

  return (
    <main className="grid min-h-dvh md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="flex flex-col justify-between bg-navy px-6 py-8 text-white md:px-12 md:py-12">
        <div className="flex items-center gap-2.5">
          <img src="/icon.svg" alt="" className="h-9 w-9 rounded-lg ring-1 ring-white/20" />
          <span className="text-lg font-bold tracking-tight">WeXchange</span>
        </div>
        <div className="mt-10 max-w-md md:mt-0">
          <h1 className="text-2xl font-bold leading-snug tracking-tight md:text-[2rem] md:leading-tight">{d.loginHeadline}</h1>
          <ul className="mt-6 hidden space-y-3 text-white/85 md:block">
            {[ArrowLeftRight, BadgeCheck, ListChecks].map((Icon, i) => (
              <li key={i} className="flex items-start gap-3">
                <Icon aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-white/70" />
                <span>{d.loginPoints[i]}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-8 hidden text-sm text-white/60 md:block">{d.sandboxNote}</p>
      </section>

      <section className="flex items-center justify-center px-4 py-10 md:px-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex justify-end">
            <label className="sr-only" htmlFor="login-lang">{d.language}</label>
            <select
              id="login-lang"
              value={lang}
              onChange={(e) => onLang(e.target.value as Lang)}
              className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm"
            >
              {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">{d.signInTitle}</h2>
          <p className="mt-1.5 text-muted">{method === "phone" ? d.signInSub : d.signInSubEmail}</p>

          <div role="tablist" aria-label={d.signInMethod} className="mt-6 grid grid-cols-2 rounded-lg bg-surface-2 p-1">
            {(["phone", "email"] as SignInMethod[]).map((m) => (
              <button
                key={m}
                role="tab"
                type="button"
                aria-selected={method === m}
                onClick={() => switchMethod(m)}
                className={`flex items-center justify-center gap-2 rounded-md py-2 text-sm font-semibold ${method === m ? "bg-surface text-text shadow-[0_1px_2px_rgba(15,27,61,.12)]" : "text-muted hover:text-text"}`}
              >
                {m === "phone" ? <Smartphone aria-hidden className="h-4 w-4" /> : <Mail aria-hidden className="h-4 w-4" />}
                {m === "phone" ? d.phoneTab : d.emailTab}
              </button>
            ))}
          </div>

          <form
            className="mt-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!sent) {
                setSent(true);
                return;
              }
              if (code.replace(/\D/g, "") !== DEMO_CODE) {
                setErr(d.wrongCode);
                return;
              }
              finish();
            }}
          >
            {method === "phone" ? (
              <div>
                <label className="block text-sm font-medium text-muted" htmlFor="login-phone">{d.phoneLabel}</label>
                <div className="mt-1 flex gap-2">
                  <select aria-label="Country code" value={dial} onChange={(e) => setDial(e.target.value)} disabled={sent} className="rounded-lg border border-border bg-surface px-2 text-base">
                    {DIAL_CODES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                  <input
                    id="login-phone"
                    inputMode="tel"
                    autoComplete="off"
                    value={phone}
                    disabled={sent}
                    onChange={(e) => setPhone(e.target.value.replace(/[^\d ]/g, "").slice(0, 16))}
                    className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2.5 text-base outline-none focus:border-brand disabled:opacity-70"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-muted" htmlFor="login-email">{d.emailLabel}</label>
                <input
                  id="login-email"
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  value={email}
                  disabled={sent}
                  maxLength={120}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`${field} disabled:opacity-70`}
                />
                {!emailOk && email.length > 3 && <p className="mt-1.5 text-sm text-warn">{d.invalidEmail}</p>}
              </div>
            )}
            {sent && (
              <button type="button" onClick={() => { setSent(false); setCode(""); setErr(""); }} className="-mt-2 text-sm font-semibold text-brand">
                {method === "phone" ? d.changeNumber : d.changeEmail}
              </button>
            )}

            {sent && (
              <div>
                <div className="mb-2 flex items-center justify-between rounded-lg bg-brand-soft px-3 py-2 text-sm">
                  <span className="text-muted">{d.demoCodeHint}</span>
                  <span className="tabular font-bold tracking-[0.2em] text-brand">{DEMO_CODE}</span>
                </div>
                <label className="block text-sm font-medium text-muted" htmlFor="login-code">{d.codeLabel}</label>
                <input
                  id="login-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  maxLength={6}
                  value={code}
                  onChange={(e) => { setCode(e.target.value.replace(/\D/g, "")); setErr(""); }}
                  className={`${field} tabular tracking-[0.3em]`}
                />
                {err && <p className="mt-1.5 text-sm text-bad" role="alert">{err}</p>}
              </div>
            )}

            <button
              disabled={!contactOk || (sent && code.length !== 6)}
              className="w-full rounded-lg bg-ink py-3 text-base font-semibold text-on-ink disabled:opacity-50"
            >
              {sent ? d.signIn : d.sendCode}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-border" />
          </div>
          <button onClick={() => finish("phone")} className="w-full rounded-lg border border-border bg-surface py-3 font-semibold hover:border-brand">
            {d.demoAccount}
          </button>

          <p className="mt-6 flex gap-2 text-xs leading-relaxed text-muted">
            <Lock aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {d.demoLoginNote}
          </p>
        </div>
      </section>
    </main>
  );
}
