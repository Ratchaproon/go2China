"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Compass, FileText, Flag, type LucideIcon, MapPin, MessageCircle, Paperclip, ReceiptText, Settings as SettingsIcon, ShieldCheck, Wallet, X } from "lucide-react";
import { Ic } from "@/components/icons";
import { StepsCard } from "@/components/Cards";
import { CardView } from "@/components/Cards";
import { Markdown } from "@/components/Markdown";
import { Onboarding, type OnboardingValues } from "@/components/Onboarding";
import { type DemoUser, Login } from "@/components/Login";
import { AccountsStrip, ActivityPanel, SettingsPanel, TodoCard, WalletPanel } from "@/components/Panels";
import { GuidePanel } from "@/components/Guide";
import { PlacesPanel } from "@/components/Places";
import type { GuideStep } from "@/lib/guide";
import type { Attachment, ToolTraceEntry } from "@/lib/agent";
import { api, fileToBase64, readToken, store } from "@/lib/client";
import { getCountry } from "@/lib/countries";
import { t } from "@/lib/i18n";
import { renderInvoice } from "@/lib/invoice";
import type { Lang, LedgerState, Settings } from "@/lib/ledger";
import type { LimitKey } from "@/lib/limits";
import type { SaveResult } from "@/components/Panels";
import type { UiCard } from "@/lib/tools";
import type { AgentStep } from "@/lib/steps";

type Tab = "chat" | "wallet" | "guide" | "places" | "activity" | "settings";

interface Msg {
  id: string;
  role: "user" | "assistant" | "notice";
  text: string;
  cards?: UiCard[];
  trace?: ToolTraceEntry[];
  steps?: AgentStep[];
  /** True while the agent is still working on this reply. */
  live?: boolean;
  attachmentName?: string;
  error?: boolean;
}

interface Saved {
  token: string;
  messages: Msg[];
}

// How much power the assistant has, visible on every screen: grey = read-only, blue = you approve everything, orange = some actions run on their own.
const MODE_STYLE: Record<Settings["agentMode"], { pill: string; text: string }> = {
  advisor: { pill: "border-border bg-surface-2", text: "text-muted" },
  copilot: { pill: "border-brand/25 bg-brand-soft", text: "text-brand" },
  autopilot: { pill: "border-warn/30 bg-warn-soft", text: "text-warn" },
};

const STORAGE_KEY = "go2china:v1";
const AUTH_KEY = "go2china:auth";
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
  const [user, setUser] = useState<DemoUser | null>(null);
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
    setUser(store.get<DemoUser>(AUTH_KEY));
    const saved = store.get<Saved>(STORAGE_KEY);
    if (saved?.token) {
      setToken(saved.token);
      // A reply interrupted by a reload can't resume streaming.
      setMessages((saved.messages ?? []).map((m) => (m.live ? { ...m, live: false } : m)));
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
    const replyId = mid();
    const patch = (fn: (m: Msg) => Msg) => setMessages((ms) => ms.map((m) => (m.id === replyId ? fn(m) : m)));
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, message: text.trim(), history, attachment: att ?? undefined }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      setMessages((ms) => [...ms, { id: replyId, role: "assistant", text: "", steps: [], live: true }]);
      // Newline-delimited JSON: step lines while the agent works, then one done/error line.
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let finished = false;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const ev = JSON.parse(line);
          if (ev.type === "step") patch((m) => ({ ...m, steps: [...(m.steps ?? []), ev.step] }));
          else if (ev.type === "done") {
            finished = true;
            setToken(ev.token);
            patch((m) => ({ ...m, text: ev.text, cards: ev.cards, trace: ev.trace, steps: ev.steps, live: false }));
          } else if (ev.type === "error") {
            throw new Error(ev.message);
          }
        }
      }
      if (!finished) throw new Error(d.errorGeneric);
    } catch (e) {
      handleAuthFailure(e as Error);
      setMessages((ms) => [
        ...ms.map((m) => (m.id === replyId ? { ...m, live: false } : m)),
        { id: mid(), role: "notice" as const, text: (e as Error).message || d.errorGeneric, error: true },
      ]);
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

  type SettingsBody = Partial<Settings> & { language?: Lang; pin?: string; cancel?: LimitKey };
  async function saveSettings(body: SettingsBody): Promise<SaveResult> {
    if (!token) return { ok: false, message: d.errorGeneric };
    setBusy(true);
    try {
      const r = await api<{ token: string }>("/api/settings", { token, ...body });
      setToken(r.token);
      return { ok: true };
    } catch (e) {
      handleAuthFailure(e as Error);
      return { ok: false, code: (e as Error & { code?: string }).code, message: (e as Error).message };
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

  function ask(text: string) {
    setTab("chat");
    send(text, null);
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

  function signIn(u: DemoUser) {
    store.set(AUTH_KEY, u);
    setUser(u);
  }

  function signOut() {
    // Signing out keeps the sandbox wallet on this device, like closing a banking app.
    store.remove(AUTH_KEY);
    setUser(null);
    setTab("chat");
  }

  if (!loaded) return null;
  if (!user) return <Login lang={lang} onLang={setOnboardingLang} onSignIn={signIn} />;
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
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 pb-2 pt-3 sm:pt-4">
          <img src="/icon.svg" alt="" className="h-9 w-9 rounded-lg sm:h-10 sm:w-10" />
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold leading-tight tracking-tight sm:text-lg">go2China</p>
            <p className="truncate text-xs font-medium text-muted">
              <span title={home.name}>{home.flag} {home.name}</span>
              <span aria-hidden className="mx-1">→</span>
              <span title={dest.name}>{dest.flag} {dest.name}</span>
              <span className="ml-2 rounded bg-surface-2 px-1.5 py-px text-[11px]">{d.sandbox}</span>
            </p>
          </div>
          <button
            onClick={() => setTab("settings")}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-left sm:px-4 sm:py-2 ${MODE_STYLE[state.settings.agentMode].pill}`}
            title={d.agentMode}
          >
            <ShieldCheck aria-hidden className={`h-4 w-4 shrink-0 ${MODE_STYLE[state.settings.agentMode].text}`} />
            <span className="leading-tight">
              <span className={`block text-xs font-bold sm:text-sm ${MODE_STYLE[state.settings.agentMode].text}`}>{modeLabel}</span>
              <span className="hidden text-xs text-muted sm:block">{d.modeHint[state.settings.agentMode]}</span>
            </span>
          </button>
        </div>
        <nav className="mx-auto hidden max-w-5xl gap-7 px-4 sm:flex">
          {tabs.map((x) => (
            <button
              key={x.id}
              onClick={() => setTab(x.id)}
              aria-current={tab === x.id ? "page" : undefined}
              className={`relative -mb-px border-b-[3px] px-0.5 pb-2.5 pt-2 text-[15px] ${tab === x.id ? "border-accent font-bold text-text" : "border-transparent font-medium text-muted hover:text-text"}`}
            >
              {x.label}
              {x.id === "wallet" && state.pending.length > 0 && (
                <span className="absolute -right-2 top-2 h-2 w-2 rounded-full bg-accent" aria-label={`${state.pending.length} ${d.pendingCount}`} />
              )}
            </button>
          ))}
        </nav>
      </header>

      <main className={`mx-auto w-full flex-1 px-4 pb-44 pt-5 sm:pb-36 sm:pt-8 ${tab === "chat" ? "max-w-3xl" : "max-w-5xl"}`}>
        {tab === "chat" && (
          <>
            <AccountsStrip state={state} lang={lang} d={d} />
            <div className="mt-4 space-y-4">
              {messages.length === 0 && (
                <TodoCard state={state} lang={lang} d={d} onOpenWallet={() => setTab("wallet")} onPayTuition={() => demoInvoice(false)} onAsk={ask} />
              )}
              {messages.length === 0 && (
                <div className="overflow-hidden rounded-2xl border border-border bg-surface">
                  <div className="px-5 pb-3 pt-5">
                    <p className="text-xl font-semibold tracking-tight">{d.hello}{state.profile.name ? `, ${state.profile.name}` : ""}</p>
                    <p className="mt-1 text-muted">{d.tagline}</p>
                  </div>
                  <ul className="divide-y divide-border border-y border-border">
                    {/* Money first (tuition, top-up, budget, bank account), then the guide and places. */}
                    {[d.suggestions[0], d.suggestions[3], d.suggestions[2], d.suggestions[1], d.guideSuggestion, d.placesSuggestion].map((s) => (
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
                      {(m.live || (m.steps?.length ?? 0) > 0 || (m.trace?.length ?? 0) > 0) && (
                        <StepsCard steps={m.steps} trace={m.trace} cards={m.cards ?? []} state={state} d={d} live={m.live} />
                      )}
                      {m.text && (
                        <div className="rounded-2xl rounded-bl-sm bg-surface px-4 py-3 leading-relaxed shadow-[0_1px_0_var(--border)]">
                          <Markdown text={m.text} />
                        </div>
                      )}
                      {m.cards?.map((c, i) => <CardView key={i} card={c} state={state} lang={lang} d={d} busy={busy} onDecide={decideAction} onOpenGuide={() => setTab("guide")} onOpenPlaces={() => setTab("places")} onAsk={ask} />)}
                    </div>
                  )}
                </div>
              ))}
              {busy && !messages.some((m) => m.live) && (
                <div className="flex w-fit items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-muted">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-brand" /> {d.thinking}
                </div>
              )}
              <div ref={endRef} />
            </div>
          </>
        )}
        {tab === "wallet" && <WalletPanel state={state} lang={lang} d={d} busy={busy} onDecide={decideAction} onAsk={ask} />}
        {tab === "guide" && <GuidePanel state={state} d={d} busy={busy} onToggle={toggleStep} onExplain={explainStep} />}
        {tab === "places" && <PlacesPanel state={state} lang={lang} d={d} />}
        {tab === "activity" && <ActivityPanel state={state} lang={lang} d={d} />}
        {tab === "settings" && (
          <SettingsPanel
            key={state.sessionId}
            state={state} lang={lang} d={d} busy={busy}
            onSave={(s) => saveSettings(s)}
            onLanguage={(l) => { void saveSettings({ language: l }); }}
            onReset={reset}
            onSignOut={signOut}
            phone={user.contact ?? (user as { phone?: string }).phone ?? ""}
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
              className={`relative flex min-w-0 flex-1 flex-col items-center border-t-2 px-0.5 pt-1.5 text-[11px] leading-tight ${tab === x.id ? "border-accent font-bold text-brand" : "border-transparent text-muted"}`}
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
