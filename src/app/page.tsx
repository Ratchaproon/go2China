"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Compass, FileText, Flag, type LucideIcon, MapPin, MessageCircle, Paperclip, Plane, ReceiptText, Settings as SettingsIcon, Wallet, Wrench, X } from "lucide-react";
import { Ic } from "@/components/icons";
import { CardView } from "@/components/Cards";
import { Markdown } from "@/components/Markdown";
import { Onboarding, type OnboardingValues } from "@/components/Onboarding";
import { AccountsStrip, ActivityPanel, SettingsPanel, WalletPanel } from "@/components/Panels";
import { GuidePanel } from "@/components/Guide";
import { PlacesPanel } from "@/components/Places";
import type { GuideStep } from "@/lib/guide";
import type { Attachment, ToolTraceEntry } from "@/lib/agent";
import { api, fileToBase64, readToken, store } from "@/lib/client";
import { getCountry } from "@/lib/countries";
import { t } from "@/lib/i18n";
import { renderInvoice } from "@/lib/invoice";
import type { Lang, LedgerState, Settings } from "@/lib/ledger";
import type { UiCard } from "@/lib/tools";

type Tab = "chat" | "wallet" | "guide" | "places" | "activity" | "settings";

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
  const [prevProfile, setPrevProfile] = useState<Partial<OnboardingValues>>({});
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

  async function toggleStep(stepId: string, done: boolean) {
    if (!token) return;
    setBusy(true);
    try {
      const r = await api<{ token: string }>("/api/guide", { token, stepId, done });
      setToken(r.token);
    } catch (e) {
      handleAuthFailure(e as Error);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function explainStep(s: GuideStep) {
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
    store.remove(STORAGE_KEY);
    setOnboardingLang(lang);
    if (state) {
      const p = state.profile;
      setPrevProfile({
        name: p.name, homeCountry: p.homeCountry, destCountry: p.destCountry,
        studentType: p.studentType ?? "degree", stayMonths: p.stayMonths ?? 11,
        // Default university names are generated per destination, so only keep a name the student typed.
        university: p.university.startsWith("Demo University of") ? "" : p.university,
      });
    }
    setTab("chat");
    setError("");
    setToken(null);
    setMessages([]);
  }

  if (!loaded) return null;
  if (!token || !state) {
    return <Onboarding initial={{ ...prevProfile, language: onboardingLang }} busy={busy} error={error} onSubmit={start} />;
  }

  const home = getCountry(state.profile.homeCountry);
  const dest = getCountry(state.profile.destCountry);
  const tabs: { id: Tab; label: string; icon: LucideIcon }[] = [
    { id: "chat", label: d.chat, icon: MessageCircle },
    { id: "wallet", label: d.wallet, icon: Wallet },
    { id: "guide", label: d.guide, icon: Compass },
    { id: "places", label: d.places, icon: MapPin },
    { id: "activity", label: d.activity, icon: ReceiptText },
    { id: "settings", label: d.settings, icon: SettingsIcon },
  ];
  const modeLabel = { advisor: d.advisor, copilot: d.copilot, autopilot: d.autopilot }[state.settings.agentMode];

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
          <img src="/icon.svg" alt="" className="h-8 w-8" />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold leading-tight tracking-tight">go2China</p>
            <p className="truncate text-xs text-muted" title={`${home.name} to ${dest.name}`}>
              {home.flag} <span className="font-semibold text-text">{home.code}</span>
              <Plane aria-hidden className="mx-1.5 inline h-3.5 w-3.5 align-[-0.15em] text-brand" />
              {dest.flag} <span className="font-semibold text-text">{dest.code}</span>
            </p>
          </div>
          <span className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted">{modeLabel}</span>
        </div>
        <nav className="mx-auto hidden max-w-3xl gap-5 px-4 sm:flex">
          {tabs.map((x) => (
            <button
              key={x.id}
              onClick={() => setTab(x.id)}
              className={`-mb-px border-b-2 pb-2.5 pt-1 text-sm font-medium ${tab === x.id ? "border-brand text-text" : "border-transparent text-muted hover:text-text"}`}
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
                <div className="overflow-hidden rounded-2xl border border-border bg-surface">
                  <div className="px-5 pb-3 pt-5">
                    <p className="text-xl font-semibold tracking-tight">{d.hello}{state.profile.name ? `, ${state.profile.name}` : ""}</p>
                    <p className="mt-1 text-muted">{d.tagline}</p>
                  </div>
                  <ul className="divide-y divide-border border-y border-border">
                    {[d.guideSuggestion, d.placesSuggestion, ...d.suggestions].map((s) => (
                      <li key={s}>
                        <button onClick={() => send(s)} className="w-full px-5 py-3 text-left text-[15px] hover:bg-bg">
                          {s}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="px-5 py-4">
                    <p className="text-sm font-semibold text-muted">{d.tryDemo}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button onClick={() => demoInvoice(false)} className="rounded-full border border-border px-3 py-1.5 text-sm font-medium hover:border-brand"><Ic icon={FileText} className="mr-1" />{d.sampleInvoice}</button>
                      <button onClick={() => demoInvoice(true)} className="rounded-full border border-bad/40 px-3 py-1.5 text-sm font-medium text-bad hover:border-bad"><Ic icon={Flag} className="mr-1" />{d.suspiciousInvoice}</button>
                    </div>
                    <p className="mt-3 text-xs text-muted">{d.sandboxNote}</p>
                  </div>
                </div>
              )}
              {messages.map((m) => (
                <div key={m.id}>
                  {m.role === "user" && (
                    <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-ink px-4 py-2.5 text-on-ink">
                      {m.attachmentName && <p className="mb-1 text-xs opacity-80"><Ic icon={Paperclip} className="mr-1" />{m.attachmentName}</p>}
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
                        <div className="rounded-2xl rounded-bl-sm bg-surface px-4 py-3 leading-relaxed shadow-[0_1px_0_var(--border)]">
                          <Markdown text={m.text} />
                        </div>
                      )}
                      {m.cards?.map((c, i) => <CardView key={i} card={c} state={state} lang={lang} d={d} busy={busy} onDecide={decideAction} onOpenGuide={() => setTab("guide")} onOpenPlaces={() => setTab("places")} />)}
                      {m.trace && m.trace.length > 0 && (
                        <details className="text-xs text-muted">
                          <summary className="cursor-pointer"><Ic icon={Wrench} className="mr-1" />{m.trace.length} tool calls</summary>
                          <ul className="mt-1 space-y-0.5 font-mono">
                            {m.trace.map((x, i) => <li key={i}>{x.tier} · {x.name}{x.isError ? " (error)" : ""}</li>)}
                          </ul>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {busy && (
                <div className="flex w-fit items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-muted">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-brand" /> {d.thinking}
                </div>
              )}
              <div ref={endRef} />
            </div>
          </>
        )}
        {tab === "wallet" && <WalletPanel state={state} lang={lang} d={d} busy={busy} onDecide={decideAction} />}
        {tab === "guide" && <GuidePanel state={state} d={d} busy={busy} onToggle={toggleStep} onExplain={explainStep} />}
        {tab === "places" && <PlacesPanel state={state} lang={lang} d={d} />}
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

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface/95 backdrop-blur">
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
                    <Ic icon={Paperclip} className="mr-1" />{attachment.name}
                    <button type="button" className="ml-2 align-middle" aria-label="Remove" onClick={() => setAttachment(null)}><X aria-hidden className="h-3.5 w-3.5" /></button>
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
              <button type="button" onClick={() => fileRef.current?.click()} aria-label={d.attach} title={d.attach} className="rounded-xl border border-border bg-bg p-3">
                <Paperclip aria-hidden className="h-5 w-5" />
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
                className="max-h-36 min-h-12 min-w-0 flex-1 resize-none rounded-xl border border-border bg-bg px-4 py-3 outline-none placeholder:overflow-hidden placeholder:text-ellipsis placeholder:whitespace-nowrap focus:border-brand"
              />
              <button disabled={busy || (!input.trim() && !attachment)} className="rounded-xl bg-ink px-4 py-3 font-semibold text-on-ink disabled:opacity-40">
                {d.send}
              </button>
            </div>
          </form>
        )}
        <nav className="mx-auto flex max-w-3xl justify-around px-1 pb-2 sm:hidden">
          {tabs.map((x) => (
            <button
              key={x.id}
              onClick={() => setTab(x.id)}
              aria-current={tab === x.id ? "page" : undefined}
              className={`relative flex min-w-0 flex-1 flex-col items-center border-t-2 px-0.5 pt-1.5 text-[11px] leading-tight ${tab === x.id ? "border-brand font-semibold text-text" : "border-transparent text-muted"}`}
            >
              <x.icon aria-hidden className="mb-0.5 h-5 w-5" strokeWidth={tab === x.id ? 2.25 : 1.75} />
              {x.label}
              {x.id === "wallet" && state.pending.length > 0 && (
                <span className="absolute right-[22%] top-1 h-2 w-2 rounded-full bg-accent" aria-label={`${state.pending.length} ${d.pendingCount}`} />
              )}
            </button>
          ))}
        </nav>
        <div className="hidden pb-3 sm:block" />
      </div>
    </div>
  );
}
