"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { CardView } from "@/components/Cards";
import { Markdown } from "@/components/Markdown";
import { Onboarding, type OnboardingValues } from "@/components/Onboarding";
import { AccountsStrip, ActivityPanel, SettingsPanel, WalletPanel } from "@/components/Panels";
import { PaperworkPanel } from "@/components/Paperwork";
import type { PaperStep } from "@/lib/paperwork";
import type { Attachment, ToolTraceEntry } from "@/lib/agent";
import { api, fileToBase64, readToken, store } from "@/lib/client";
import { getCountry } from "@/lib/countries";
import { t } from "@/lib/i18n";
import { renderInvoice } from "@/lib/invoice";
import type { Lang, LedgerState, Settings } from "@/lib/ledger";
import type { UiCard } from "@/lib/tools";

type Tab = "chat" | "wallet" | "paperwork" | "activity" | "settings";

interface Msg {
  id: string;
  role: "user" | "assistant" | "notice";
  text: string;
  cards?: UiCard[];
  trace?: ToolTraceEntry[];
  attachmentName?: string;
  error?: boolean;
}

interface Saved {
  token: string;
  messages: Msg[];
}

const STORAGE_KEY = "go2china:v1";
const MAX_FILE_BYTES = 3_000_000;
const ACCEPT = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"] as const;

let counter = 0;
const mid = () => `m${Date.now().toString(36)}${(counter++).toString(36)}`;

async function shrinkImage(file: File): Promise<Blob> {
  if (file.size <= 1_500_000 || file.type === "application/pdf" || file.type === "image/gif") return file;
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob((b) => r(b!), "image/jpeg", 0.85));
}

export default function Home() {
  const [loaded, setLoaded] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [tab, setTab] = useState<Tab>("chat");
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [onboardingLang, setOnboardingLang] = useState<Lang>("en");
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const state: LedgerState | null = useMemo(() => {
    if (!token) return null;
    try {
      return readToken(token);
    } catch {
      return null;
    }
  }, [token]);

  const lang: Lang = state?.profile.language ?? onboardingLang;
  const d = t(lang);

  useEffect(() => {
    const saved = store.get<Saved>(STORAGE_KEY);
    if (saved?.token) {
      setToken(saved.token);
      setMessages(saved.messages ?? []);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (token) store.set(STORAGE_KEY, { token, messages: messages.slice(-60) } satisfies Saved);
  }, [token, messages, loaded]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    if (messages.length || busy) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy, tab]);

  async function start(v: OnboardingValues) {
    setBusy(true);
    setError("");
    try {
      const r = await api<{ token: string }>("/api/session", v);
      setToken(r.token);
      setMessages([]);
      setTab("chat");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function handleAuthFailure(e: Error) {
    if (/signature|token/i.test(e.message)) {
      store.remove(STORAGE_KEY);
      setToken(null);
    }
  }

  async function send(text: string, att: Attachment | null = attachment) {
    if (!token || busy || (!text.trim() && !att)) return;
    const userMsg: Msg = { id: mid(), role: "user", text: text.trim(), attachmentName: att?.name };
    const history = messages
      .filter((m) => !m.error)
      .map((m) => ({
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        text: (m.role === "notice" ? `[App notice] ${m.text}` : m.attachmentName ? `[Uploaded ${m.attachmentName}] ${m.text}` : m.text).slice(0, 8000),
      }))
      .slice(-30);
    setMessages((ms) => [...ms, userMsg]);
    setInput("");
    setAttachment(null);
    setBusy(true);
    try {
      const r = await api<{ token: string; text: string; cards: UiCard[]; trace: ToolTraceEntry[] }>("/api/chat", {
        token, message: text.trim(), history, attachment: att ?? undefined,
      });
      setToken(r.token);
      setMessages((ms) => [...ms, { id: mid(), role: "assistant", text: r.text, cards: r.cards, trace: r.trace }]);
    } catch (e) {
      handleAuthFailure(e as Error);
      setMessages((ms) => [...ms, { id: mid(), role: "notice", text: (e as Error).message || d.errorGeneric, error: true }]);
    } finally {
      setBusy(false);
    }
  }

  async function decideAction(id: string, approve: boolean) {
    if (!token) return;
    setBusy(true);
    try {
      const r = await api<{ token: string; outcome: { ok: boolean; message: string; reasons?: string[] } }>("/api/actions", { token, actionId: id, approve });
      setToken(r.token);
      const text = [r.outcome.message, ...(r.outcome.reasons ?? [])].join("\n");
      setMessages((ms) => [...ms, { id: mid(), role: "notice", text, error: !r.outcome.ok }]);
    } catch (e) {
      handleAuthFailure(e as Error);
      setMessages((ms) => [...ms, { id: mid(), role: "notice", text: (e as Error).message, error: true }]);
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings(s: Partial<Settings> & { language?: Lang }) {
    if (!token) return;
    setBusy(true);
    try {
      const r = await api<{ token: string }>("/api/settings", { token, ...s });
      setToken(r.token);
    } catch (e) {
      handleAuthFailure(e as Error);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function togglePaperwork(stepId: string, done: boolean) {
    if (!token) return;
    setBusy(true);
    try {
      const r = await api<{ token: string }>("/api/paperwork", { token, stepId, done });
      setToken(r.token);
    } catch (e) {
      handleAuthFailure(e as Error);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function explainStep(s: PaperStep) {
    setTab("chat");
    send(`${d.explainPrompt} "${s.title}" (step id: ${s.id})`, null);
  }

  async function pickFile(file: File) {
    const type = file.type as Attachment["mediaType"];
    if (!ACCEPT.includes(type)) return setError("PNG, JPEG, WEBP, GIF or PDF only.");
    const blob = await shrinkImage(file);
    if (blob.size > MAX_FILE_BYTES) return setError("File is larger than 3 MB.");
    setError("");
    setAttachment({ name: file.name, mediaType: (blob.type || type) as Attachment["mediaType"], data: await fileToBase64(blob) });
  }

  async function demoInvoice(suspicious: boolean) {
    if (!state) return;
    const blob = await renderInvoice(state, suspicious);
    const att: Attachment = { name: suspicious ? "invoice-urgent.png" : "tuition-invoice.png", mediaType: "image/png", data: await fileToBase64(blob) };
    await send(d.invoicePrompt, att);
  }

  function reset() {
    if (!confirm(d.resetConfirm)) return;
    store.remove(STORAGE_KEY);
    setOnboardingLang(lang);
    setToken(null);
    setMessages([]);
  }

  if (!loaded) return null;
  if (!token || !state) {
    return <Onboarding initial={{ language: onboardingLang }} busy={busy} error={error} onSubmit={start} />;
  }

  const home = getCountry(state.profile.homeCountry);
  const dest = getCountry(state.profile.destCountry);
  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "chat", label: d.chat, icon: "💬" },
    { id: "wallet", label: d.wallet, icon: "👛" },
    { id: "paperwork", label: d.paperwork, icon: "🛂" },
    { id: "activity", label: d.activity, icon: "🧾" },
    { id: "settings", label: d.settings, icon: "⚙️" },
  ];
  const modeLabel = { advisor: d.advisor, copilot: d.copilot, autopilot: d.autopilot }[state.settings.agentMode];

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <img src="/icon.svg" alt="" className="h-8 w-8" />
          <div className="min-w-0 flex-1">
            <p className="font-extrabold leading-tight">go2China</p>
            <p className="truncate text-xs text-muted">{home.flag} {home.name} → {dest.flag} {dest.name}</p>
          </div>
          <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">{modeLabel}</span>
        </div>
        <nav className="mx-auto hidden max-w-3xl gap-1 px-4 pb-2 sm:flex">
          {tabs.map((x) => (
            <button
              key={x.id}
              onClick={() => setTab(x.id)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${tab === x.id ? "bg-text text-bg" : "text-muted"}`}
            >
              {x.label}{x.id === "wallet" && state.pending.length > 0 ? ` (${state.pending.length})` : ""}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-44 pt-4 sm:pb-36">
        {tab === "chat" && (
          <>
            <AccountsStrip state={state} lang={lang} d={d} />
            <div className="mt-4 space-y-4">
              {messages.length === 0 && (
                <div className="rounded-3xl border border-border bg-surface p-5">
                  <p className="text-lg font-bold">👋 {state.profile.name ? `${state.profile.name}, ` : ""}{d.tagline}</p>
                  <p className="mt-1 text-sm text-muted">{d.sandboxNote}</p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {[d.paperworkSuggestion, ...d.suggestions].map((s) => (
                      <button key={s} onClick={() => send(s)} className="rounded-2xl border border-border bg-surface-2 p-3 text-left text-sm hover:border-brand">
                        {s}
                      </button>
                    ))}
                  </div>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">{d.tryDemo}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button onClick={() => demoInvoice(false)} className="rounded-full border border-brand px-3 py-1.5 text-sm font-semibold text-brand">📄 {d.sampleInvoice}</button>
                    <button onClick={() => demoInvoice(true)} className="rounded-full border border-bad px-3 py-1.5 text-sm font-semibold text-bad">🚩 {d.suspiciousInvoice}</button>
                  </div>
                </div>
              )}
              {messages.map((m) => (
                <div key={m.id}>
                  {m.role === "user" && (
                    <div className="ml-auto w-fit max-w-[85%] rounded-3xl rounded-br-md bg-brand px-4 py-2.5 text-white">
                      {m.attachmentName && <p className="mb-1 text-xs opacity-80">📎 {m.attachmentName}</p>}
                      <p className="whitespace-pre-wrap">{m.text}</p>
                    </div>
                  )}
                  {m.role === "notice" && (
                    <p className={`mx-auto w-fit max-w-[90%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-center text-sm ${m.error ? "bg-bad-soft text-bad" : "bg-ok-soft text-ok"}`}>
                      {m.text}
                    </p>
                  )}
                  {m.role === "assistant" && (
                    <div className="max-w-[95%] space-y-3">
                      {m.text && (
                        <div className="rounded-3xl rounded-bl-md border border-border bg-surface px-4 py-3 leading-relaxed">
                          <Markdown text={m.text} />
                        </div>
                      )}
                      {m.cards?.map((c, i) => <CardView key={i} card={c} state={state} lang={lang} d={d} busy={busy} onDecide={decideAction} onOpenPaperwork={() => setTab("paperwork")} />)}
                      {m.trace && m.trace.length > 0 && (
                        <details className="text-xs text-muted">
                          <summary className="cursor-pointer">🔧 {m.trace.length} tool calls</summary>
                          <ul className="mt-1 space-y-0.5 font-mono">
                            {m.trace.map((x, i) => <li key={i}>{x.tier} · {x.name}{x.isError ? " ✗" : ""}</li>)}
                          </ul>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {busy && (
                <div className="flex w-fit items-center gap-2 rounded-3xl border border-border bg-surface px-4 py-3 text-sm text-muted">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-brand" /> {d.thinking}
                </div>
              )}
              <div ref={endRef} />
            </div>
          </>
        )}
        {tab === "wallet" && <WalletPanel state={state} lang={lang} d={d} busy={busy} onDecide={decideAction} />}
        {tab === "paperwork" && <PaperworkPanel state={state} d={d} busy={busy} onToggle={togglePaperwork} onExplain={explainStep} />}
        {tab === "activity" && <ActivityPanel state={state} d={d} />}
        {tab === "settings" && (
          <SettingsPanel
            key={state.sessionId}
            state={state} d={d} busy={busy}
            onSave={(s) => saveSettings(s)}
            onLanguage={(l) => saveSettings({ language: l })}
            onReset={reset}
          />
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-bg/95 backdrop-blur">
        {tab === "chat" && (
          <form
            className="mx-auto max-w-3xl px-4 pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            {(attachment || error) && (
              <div className="mb-2 flex items-center gap-2 text-sm">
                {attachment && (
                  <span className="rounded-full bg-brand-soft px-3 py-1 text-brand">
                    📎 {attachment.name}
                    <button type="button" className="ml-2" aria-label="Remove" onClick={() => setAttachment(null)}>✕</button>
                  </span>
                )}
                {error && <span className="text-bad">{error}</span>}
              </div>
            )}
            <div className="flex items-end gap-2">
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPT.join(",")}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) pickFile(f);
                  e.target.value = "";
                }}
              />
              <button type="button" onClick={() => fileRef.current?.click()} aria-label={d.attach} title={d.attach} className="rounded-2xl border border-border bg-surface p-3">
                📎
              </button>
              <textarea
                value={input}
                rows={1}
                maxLength={4000}
                placeholder={d.placeholder}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                className="max-h-36 min-h-12 flex-1 resize-none rounded-2xl border border-border bg-surface px-4 py-3 outline-none focus:border-brand"
              />
              <button disabled={busy || (!input.trim() && !attachment)} className="brand-gradient rounded-2xl px-4 py-3 font-semibold text-white disabled:opacity-40">
                {d.send}
              </button>
            </div>
          </form>
        )}
        <nav className="mx-auto flex max-w-3xl justify-around px-2 py-2 sm:hidden">
          {tabs.map((x) => (
            <button key={x.id} onClick={() => setTab(x.id)} className={`flex min-w-0 flex-1 flex-col items-center px-0.5 text-[11px] leading-tight ${tab === x.id ? "font-bold text-brand" : "text-muted"}`}>
              <span className="text-lg">{x.icon}</span>
              {x.label}{x.id === "wallet" && state.pending.length > 0 ? ` (${state.pending.length})` : ""}
            </button>
          ))}
        </nav>
        <div className="hidden pb-3 sm:block" />
      </div>
    </div>
  );
}
