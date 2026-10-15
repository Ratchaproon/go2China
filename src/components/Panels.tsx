"use client";
import { useState } from "react";
import { formatMoney, getCountry } from "@/lib/countries";
import { CATEGORY_LABELS, LANGS, type Dict } from "@/lib/i18n";
import type { AgentMode, AuditDecision, Lang, LedgerState, Settings } from "@/lib/ledger";
import { PendingCard } from "./Cards";

export function AccountsStrip({ state, lang, d }: { state: LedgerState; lang: Lang; d: Dict }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {state.accounts.map((a) => (
        <div key={a.currency} className="min-w-36 shrink-0 rounded-2xl border border-border bg-surface px-3 py-2">
          <p className="truncate text-xs text-muted">{a.label}</p>
          <p className="tabular font-bold">{formatMoney(a.currency, a.balance, lang)}</p>
        </div>
      ))}
      {state.pending.length > 0 && (
        <div className="shrink-0 rounded-2xl border border-brand bg-brand-soft px-3 py-2 text-sm font-semibold text-brand">
          {state.pending.length} {d.pendingCount}
        </div>
      )}
      <span className="sr-only">{d.accounts}</span>
    </div>
  );
}

export function WalletPanel({
  state, lang, d, busy, onDecide,
}: { state: LedgerState; lang: Lang; d: Dict; busy: boolean; onDecide: (id: string, approve: boolean) => void }) {
  const labels = CATEGORY_LABELS[lang];
  return (
    <div className="space-y-6">
      {state.pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-bold">{d.pendingTitle}</h2>
          {state.pending.map((p) => <PendingCard key={p.id} p={p} d={d} busy={busy} onDecide={onDecide} />)}
        </section>
      )}
      <section>
        <h2 className="mb-2 font-bold">{d.accounts}</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {state.accounts.map((a) => (
            <div key={a.currency} className="rounded-2xl border border-border bg-surface p-4">
              <p className="text-sm text-muted">{a.label} · {a.currency}</p>
              <p className="tabular text-2xl font-extrabold">{formatMoney(a.currency, a.balance, lang)}</p>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-2 font-bold">{d.payees}</h2>
        <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
          {state.payees.map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{p.name}</p>
                <p className="truncate text-muted">{p.bankName} · ••••{p.accountNumber.slice(-4)} · {p.currency}</p>
              </div>
              {p.verified && <span className="rounded-full bg-ok-soft px-2 py-0.5 text-xs font-semibold text-ok">{d.verified}</span>}
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-2 font-bold">{d.transactions}</h2>
        <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
          {state.transactions.slice(0, 40).map((tx) => (
            <div key={tx.id} className="flex items-center gap-3 p-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate">{tx.description}</p>
                <p className="text-xs text-muted">{tx.ts.slice(0, 10)} · {labels[tx.category] ?? tx.category}</p>
              </div>
              <span className={`tabular shrink-0 font-semibold ${tx.amount < 0 ? "" : "text-ok"}`}>
                {tx.amount > 0 ? "+" : ""}{formatMoney(tx.currency, tx.amount, lang)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const decisionStyle: Record<AuditDecision, string> = {
  read: "bg-surface-2 text-muted",
  auto_executed: "bg-ok-soft text-ok",
  approved: "bg-ok-soft text-ok",
  pending_confirmation: "bg-brand-soft text-brand",
  rejected: "bg-surface-2 text-text",
  expired: "bg-surface-2 text-muted",
  blocked: "bg-bad-soft text-bad",
  flagged: "bg-bad-soft text-bad",
};

export function ActivityPanel({ state, d }: { state: LedgerState; d: Dict }) {
  const exportLog = () => {
    const blob = new Blob(
      [JSON.stringify({ exportedAt: new Date().toISOString(), sessionId: state.sessionId, profile: state.profile, settings: state.settings, audit: state.audit, transactions: state.transactions }, null, 2)],
      { type: "application/json" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `go2china-audit-${state.sessionId}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const actor = { agent: d.agent, user: d.you, system: d.system };
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="font-bold">{d.auditLog}</h2>
        <button onClick={exportLog} className="ml-auto rounded-xl border border-border px-3 py-1.5 text-sm font-semibold">{d.exportEvidence}</button>
      </div>
      <p className="mb-3 text-sm text-muted">{d.auditHint}</p>
      <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
        {state.audit.map((e) => (
          <div key={e.id} className="p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="tabular text-xs text-muted">{new Date(e.ts).toLocaleTimeString()}</span>
              <span className="font-semibold">{actor[e.actor]}</span>
              <span className="font-mono text-xs">{e.action}</span>
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">{d.tiers[e.tier]}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${decisionStyle[e.decision]}`}>{e.decision}</span>
            </div>
            {e.detail && <p className="mt-1 break-words text-muted">{e.detail}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SettingsPanel({
  state, d, busy, onSave, onLanguage, onReset,
}: {
  state: LedgerState; d: Dict; busy: boolean;
  onSave: (s: Partial<Settings>) => Promise<void>;
  onLanguage: (l: Lang) => void;
  onReset: () => void;
}) {
  const [s, setS] = useState<Settings>(state.settings);
  const [saved, setSaved] = useState(false);
  const modes: { id: AgentMode; label: string; desc: string }[] = [
    { id: "advisor", label: d.advisor, desc: d.advisorDesc },
    { id: "copilot", label: d.copilot, desc: d.copilotDesc },
    { id: "autopilot", label: d.autopilot, desc: d.autopilotDesc },
  ];
  const num = (k: "autoApproveLimitUsd" | "perTxnLimitUsd" | "dailyLimitUsd", label: string, max: number) => (
    <label className="block text-sm font-medium">
      {label}
      <input
        type="number" min={0} max={max} value={s[k]}
        onChange={(e) => setS({ ...s, [k]: Math.max(0, Math.min(max, Number(e.target.value) || 0)) })}
        className="tabular mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2"
      />
    </label>
  );
  const home = getCountry(state.profile.homeCountry);
  const dest = getCountry(state.profile.destCountry);
  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 font-bold">{d.agentMode}</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {modes.map((m) => (
            <button
              key={m.id}
              onClick={() => setS({ ...s, agentMode: m.id })}
              className={`rounded-2xl border-2 p-3 text-left ${s.agentMode === m.id ? "border-brand bg-brand-soft" : "border-border bg-surface"}`}
            >
              <p className="font-bold">{m.label}</p>
              <p className="text-xs text-muted">{m.desc}</p>
            </button>
          ))}
        </div>
      </section>
      <section className="grid gap-3 sm:grid-cols-3">
        {num("autoApproveLimitUsd", d.autoLimit, 500)}
        {num("perTxnLimitUsd", d.perTxn, 50_000)}
        {num("dailyLimitUsd", d.daily, 100_000)}
      </section>
      <button
        disabled={busy}
        onClick={async () => {
          await onSave(s);
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        }}
        className="brand-gradient rounded-xl px-5 py-2.5 font-semibold text-white disabled:opacity-50"
      >
        {saved ? `✓ ${d.saved}` : d.save}
      </button>

      <section>
        <h2 className="mb-2 font-bold">{d.language}</h2>
        <div className="flex flex-wrap gap-2">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => onLanguage(l.code)}
              className={`rounded-full border px-3 py-1.5 text-sm ${state.profile.language === l.code ? "border-brand bg-brand-soft font-semibold text-brand" : "border-border"}`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <p className="text-sm text-muted">{home.flag} {home.name} → {dest.flag} {dest.name} · {state.profile.university} · {state.profile.studentId}</p>
        <button onClick={onReset} className="mt-3 rounded-xl border border-border px-4 py-2 text-sm font-semibold">
          {d.changeRoute} / {d.resetSession}
        </button>
      </section>
      <p className="text-xs text-muted">{d.sandboxNote}</p>
    </div>
  );
}
