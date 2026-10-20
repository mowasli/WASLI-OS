"use client";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CircleAlert,
  FileText,
  LockKeyhole,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";
import type { Project, Workspace, WorkspaceId } from "@/lib/types";
import { api, Modal } from "./forms";
type Scope = "global" | WorkspaceId;
const names = {
  global: "Mission Control",
  wasl: "WASL Ecosystems",
  thv: "Tech Horizons Ventures",
  personal: "Personal",
  independent: "Freelancing & Volunteering",
};
interface Citation {
  title: string;
  url: string;
}
interface ChatMessage {
  id?: string;
  role: string;
  content: string;
  sources?: Citation[];
}
export function Assistant({
  scope,
  workspaces,
  onClose,
  onScope,
}: {
  scope: Scope;
  workspaces: Workspace[];
  onClose: () => void;
  onScope: (s: Scope) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]),
    [input, setInput] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    if (scope === "global") return;
    let active = true;
    setLoading(true);
    api<{ messages: ChatMessage[] }>(`/api/assistant?workspace=${scope}`)
      .then((r) => {
        if (active) setMessages(r.messages);
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [scope]);
  async function send(message: string) {
    if (!message.trim() || scope === "global") return;
    setInput("");
    setError("");
    setMessages((m) => [...m, { role: "user", content: message }]);
    setBusy(true);
    try {
      const r = await api<{
        answer: string;
        mode: string;
        sources: Citation[];
      }>("/api/assistant", {
        method: "POST",
        body: JSON.stringify({ workspaceId: scope, message }),
      });
      setMessages((m) => [
        ...m,
        { role: "assistant", content: r.answer, sources: r.sources },
      ]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="assistant-layer">
      <button
        className="assistant-backdrop"
        aria-label="Close assistant"
        onClick={onClose}
      />
      <section className="assistant-drawer" aria-label="Chief of Staff">
        <header>
          <span className="assistant-avatar">
            <Sparkles size={20} />
          </span>
          <div>
            <h2>Chief of Staff</h2>
            <p>
              {scope === "global"
                ? "Choose one workspace to begin"
                : names[scope]}{" "}
              · Rules-based local assistant
            </p>
          </div>
          <button
            className="icon-button"
            aria-label="Close Chief of Staff"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        <div className="assistant-messages">
          {scope === "global" ? (
            <>
              <div className="assistant-welcome">
                <LockKeyhole size={25} />
                <h3>Context is a boundary.</h3>
                <p>
                  Choose a workspace before asking a question. Company documents
                  and private conversations stay within their own scope.
                </p>
              </div>
              <div className="workspace-picker">
                {workspaces.map((w) => (
                  <button key={w.id} onClick={() => onScope(w.id)}>
                    <span className={`workspace-dot ${w.id}`} />
                    {names[w.id]}
                    <ArrowRight size={15} />
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              {loading && (
                <p className="assistant-thinking">
                  Loading your private conversation…
                </p>
              )}
              {!loading && !messages.length && (
                <>
                  <div className="assistant-welcome">
                    <Sparkles size={27} />
                    <h3>
                      Less sorting.
                      <br />
                      More moving forward.
                    </h3>
                    <p>
                      I can summarize your actual tasks, deadlines, blockers,
                      and project progress, and cite authorized profile
                      excerpts. No language model is connected.
                    </p>
                  </div>
                  <div className="assistant-prompts">
                    {[
                      "What should I focus on today?",
                      "What am I behind on?",
                      "Prepare a weekly status update",
                    ].map((q) => (
                      <button key={q} onClick={() => send(q)}>
                        {q}
                        <ArrowUpRight size={14} />
                      </button>
                    ))}
                  </div>
                </>
              )}
              {messages.map((m, i) => (
                <div className={`chat-message ${m.role}`} key={m.id || i}>
                  <span>{m.role === "user" ? "YOU" : "CHIEF OF STAFF"}</span>
                  <p>{m.content}</p>
                  {m.sources && m.sources.length > 0 && (
                    <div className="chat-sources">
                      {m.sources.map((s, i) => (
                        <a
                          key={i}
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {s.title}
                          <ArrowUpRight size={10} />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {busy && (
                <div className="assistant-thinking">
                  Reviewing this workspace…
                </div>
              )}
              {error && (
                <p role="alert" className="form-error">
                  {error}
                </p>
              )}
            </>
          )}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <div className="assistant-input">
            <textarea
              aria-label="Message Chief of Staff"
              rows={2}
              disabled={scope === "global"}
              placeholder="Ask about your work…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button
              className="button primary"
              aria-label="Send message"
              disabled={busy || !input.trim() || scope === "global"}
            >
              <ArrowUpRight size={18} />
            </button>
          </div>
          <p>
            <ShieldCheck size={11} />
            Read-only guidance. Conversations are stored in this workspace.
          </p>
        </form>
      </section>
    </div>
  );
}
interface IntegrationState {
  google: { configured: boolean; missing: string[]; invalid: string[] };
  services: { service: string; status: string; selectedFiles: number }[];
}
const services = [
  {
    id: "drive",
    name: "Google Drive",
    letter: "D",
    text: "Retrieve metadata only for files you explicitly select and authorize.",
    scopes: "Read selected files and document metadata",
  },
  {
    id: "gmail",
    name: "Gmail",
    letter: "M",
    text: "Retrieve authorized message references. Email bodies and automatic task extraction are pending.",
    scopes: "Read-only email access",
  },
  {
    id: "calendar",
    name: "Google Calendar",
    letter: "C",
    text: "Retrieve meetings and availability. External event creation is not enabled.",
    scopes: "Read-only calendar access",
  },
];
export function Connections({ scope }: { scope: Scope }) {
  const [data, setData] = useState<IntegrationState | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [response, setResponse] = useState<unknown>(),
    [selection, setSelection] = useState(false),
    [info, setInfo] = useState("");
  const load = useCallback(async () => {
    if (scope === "global") return;
    try {
      setData(
        await api<IntegrationState>(`/api/integrations?workspace=${scope}`),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }, [scope]);
  useEffect(() => {
    void load();
  }, [load]);
  async function connect(service: string) {
    setBusy(service);
    setError("");
    try {
      const r = await api<{ authorizationUrl: string }>(
        "/api/integrations/google/connect",
        {
          method: "POST",
          body: JSON.stringify({ workspaceId: scope, service }),
        },
      );
      const url = new URL(r.authorizationUrl);
      if (url.protocol !== "https:" || url.hostname !== "accounts.google.com")
        throw new Error(
          "The authorization response was not a trusted Google URL.",
        );
      window.location.assign(url.toString());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function read(service: string) {
    setBusy(service);
    setError("");
    try {
      setResponse(
        await api(
          `/api/integrations/google/read?workspace=${scope}&service=${service}`,
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function disconnect(service: string) {
    if (
      !confirm(
        `Disconnect ${service} in this workspace? Local encrypted tokens and selections will be removed. This does not revoke authorization at Google.`,
      )
    )
      return;
    try {
      await api("/api/integrations/google/disconnect", {
        method: "POST",
        body: JSON.stringify({
          workspaceId: scope,
          service,
          confirm: true,
          revokeAtGoogle: false,
        }),
      });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function selectFiles(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (
      !confirm(
        "Authorize only these selected file IDs for metadata retrieval in this workspace? Google must separately permit app access.",
      )
    )
      return;
    try {
      await api("/api/integrations/google/drive/selection", {
        method: "POST",
        body: JSON.stringify({
          workspaceId: scope,
          fileIds: String(f.get("fileIds"))
            .split(/[\s,]+/)
            .filter(Boolean),
          confirm: true,
        }),
      });
      setSelection(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <div className="notice">
        <ShieldCheck size={18} />
        <div>
          <strong>
            {scope === "global"
              ? "Choose a workspace to manage connections."
              : data?.services.some((s) => s.status === "connected")
                ? "Account connections are private to this workspace."
                : "No usable external accounts are connected in this workspace."}
          </strong>
          <p>
            Each workspace has independent OAuth grants. Services use read-only
            access; external writes are not implemented.
          </p>
        </div>
      </div>
      {error && (
        <div className="error-banner" role="alert">
          <CircleAlert size={17} />
          {error}
        </div>
      )}
      <div className="connection-grid">
        {services.map((c) => {
          const state = data?.services.find((s) => s.service === c.id),
            connected =
              state && ["connected", "refresh_pending"].includes(state.status);
          return (
            <section className="panel connection-card" key={c.id}>
              <span className="connection-icon">{c.letter}</span>
              <span className="connection-status">
                {state?.status.replaceAll("_", " ") || "Not connected"}
              </span>
              <h3>{c.name}</h3>
              <p>{c.text}</p>
              <div className="connection-scope">
                <LockKeyhole size={12} />
                {c.scopes}
              </div>
              <button
                className="button secondary"
                disabled={scope === "global" || busy === c.id}
                onClick={() => (connected ? read(c.id) : connect(c.id))}
              >
                {busy === c.id
                  ? "Please wait…"
                  : connected
                    ? "Retrieve authorized data"
                    : `Connect ${c.name}`}
                <ArrowUpRight size={14} />
              </button>
              {connected && (
                <div className="connection-controls">
                  {c.id === "drive" && (
                    <button
                      className="text-button"
                      onClick={() => setSelection(true)}
                    >
                      Select authorized file IDs ({state.selectedFiles})
                    </button>
                  )}
                  <button
                    className="text-button"
                    onClick={() => disconnect(c.id)}
                  >
                    Disconnect
                  </button>
                </div>
              )}
              <button
                className="text-button requirements-link"
                onClick={() =>
                  setInfo(
                    `${c.name}: ${data?.google.configured ? "OAuth server configuration is present. Live connection is not verified until authorization and a data request succeed." : `Server configuration needed: ${[...(data?.google.missing || ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI", "TOKEN_ENCRYPTION_KEY"]), ...(data?.google.invalid || [])].join(", ")}.`} Credentials belong in protected server configuration; never enter them in chat. ${c.scopes}.`,
                  )
                }
              >
                Connection requirements
              </button>
            </section>
          );
        })}
      </div>
      {info && (
        <Modal title="Connection requirements" onClose={() => setInfo("")}>
          <p className="modal-prose">{info}</p>
          <div className="dialog-actions">
            <button className="button primary" onClick={() => setInfo("")}>
              Understood
            </button>
          </div>
        </Modal>
      )}
      {response !== undefined && (
        <Modal
          title="Authorized service response"
          description="A real read-only response from this workspace's connected Google account."
          onClose={() => setResponse(undefined)}
          wide
        >
          <pre className="service-response">
            {JSON.stringify(response, null, 2)}
          </pre>
        </Modal>
      )}
      {selection && (
        <Modal
          title="Authorize Drive documents"
          description="Only these explicit file IDs may be retrieved in this workspace. Selection does not automatically index document content."
          onClose={() => setSelection(false)}
        >
          <form className="record-form" onSubmit={selectFiles}>
            <label>
              Google Drive file IDs
              <textarea
                name="fileIds"
                rows={4}
                required
                placeholder="Comma or newline-separated file IDs"
              />
            </label>
            <p className="muted-text">
              Google must separately grant this app access to each file.
              Folder-wide or account-wide indexing is not enabled.
            </p>
            <button className="button primary">
              Save authorized selection
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
interface Opportunity {
  id: string;
  title: string;
  organization: string;
  country: string;
  description: string;
  sourceUrl: string;
  deadline: string | null;
  lastVerifiedAt: string;
  status: string;
  eligibility: string;
  fitScore: number;
  scoreMethod: string;
  recommendedAction: string;
  verificationNote: string;
  saved?: boolean;
  tags?: string[];
  notes?: string;
  comments?: { id: string; author: string; body: string; createdAt: string }[];
  projectId?: string | null;
}
interface IntelligenceOverview {
  records: Opportunity[];
  sources: {
    id: string;
    name: string;
    endpoint: string;
    lastAttemptAt: string | null;
    lastSuccessAt: string | null;
    lastError: string | null;
  }[];
  jobs: {
    id: string;
    status: string;
    startedAt: string;
    discovered: number;
    updated: number;
    error: string | null;
    sourceResults: {
      sourceId: string;
      status: string;
      error?: string;
      fetched: number;
    }[];
  }[];
  schedule: { status: string; timezone: string; localTime: string };
  scoreWeights: Record<string, number>;
}
export function Intelligence({
  scope,
  canWrite = true,
  onDataChanged,
  onOpenProject,
}: {
  scope: Scope;
  canWrite?: boolean;
  onDataChanged?: () => void;
  onOpenProject?: (project: Project) => void;
}) {
  const [data, setData] = useState<IntelligenceOverview | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState("all"),
    [sort, setSort] = useState("newest"),
    [savedOnly, setSavedOnly] = useState(false);
  const load = useCallback(async () => {
    try {
      setData(
        await api<IntelligenceOverview>(`/api/intelligence?workspace=${scope}`),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }, [scope]);
  useEffect(() => {
    void load();
  }, [load]);
  async function scan() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/intelligence/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: scope }),
      });
      const result = await r.json();
      if (!r.ok)
        setError(
          result.error ||
            "No configured sources were retrieved successfully. See job history for the recorded source errors.",
        );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      await load();
      setBusy(false);
    }
  }
  const records =
    data?.records
      .filter(
        (r) =>
          (status === "all" || r.status === status) &&
          (!savedOnly || r.saved) &&
          (!query ||
            `${r.title} ${r.organization} ${r.country} ${r.tags?.join(" ") || ""}`
              .toLowerCase()
              .includes(query.toLowerCase())),
      )
      .sort((a, b) =>
        sort === "fit"
          ? b.fitScore - a.fitScore
          : sort === "deadline"
            ? (a.deadline || "9999").localeCompare(b.deadline || "9999")
            : b.lastVerifiedAt.localeCompare(a.lastVerifiedAt),
      ) || [];
  return (
    <>
      <div className="intelligence-banner">
        <div>
          <span className="eyebrow">EVIDENCE BEFORE RECOMMENDATIONS</span>
          <h2>Real signals. Clear provenance.</h2>
          <p>
            Every opportunity needs an authentic source, verification status,
            and an eligibility check.
          </p>
        </div>
        <button
          className="button primary"
          onClick={scan}
          disabled={busy || !canWrite}
        >
          <Search size={16} />
          {busy ? "Scanning sources…" : "Scan now"}
        </button>
      </div>
      <div className="notice">
        <CircleAlert size={18} />
        <div>
          <strong>Daily scheduling requires deployment.</strong>
          <p>
            The daily target is {data?.schedule.localTime || "08:00"}{" "}
            Africa/Cairo. No background schedule is claimed as live until a
            deployed job succeeds.
          </p>
        </div>
      </div>
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      <section className="panel">
        <div className="section-header">
          <h2>
            Opportunities
            <span className="count-bubble">{data?.records.length || 0}</span>
          </h2>
          <div className="intelligence-filters">
            <input
              aria-label="Search opportunities"
              placeholder="Search source records…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              aria-label="Filter opportunity status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="all">All statuses</option>
              {["new", "updated", "expired", "unverified", "archived"].map(
                (s) => (
                  <option key={s}>{s}</option>
                ),
              )}
            </select>
            <select
              aria-label="Sort opportunities"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="newest">Recently retrieved</option>
              <option value="fit">Highest fit score</option>
              <option value="deadline">Nearest deadline</option>
            </select>
            <label className="saved-filter">
              <input
                type="checkbox"
                checked={savedOnly}
                onChange={(e) => setSavedOnly(e.target.checked)}
              />
              Saved only
            </label>
          </div>
        </div>
        {records.length ? (
          records.map((o) => (
            <article className="intelligence-record" key={o.id}>
              <div className="record-topline">
                <span className="eyebrow">
                  {o.organization} · {o.country}
                </span>
                <span className="record-status">{o.status}</span>
              </div>
              <h3>{o.title}</h3>
              <p dir="auto">{o.description.length > 360 ? o.description.slice(0,360) + '…' : o.description || 'No source description supplied.'}</p>
              {o.description.length > 360 && <details className="source-excerpt"><summary>Read full source text</summary><p dir="auto">{o.description}</p></details>}
              <div className="opportunity-facts">
                <span>
                  Fit: <strong>{o.fitScore}/100</strong> · rules-based
                </span>
                <span>
                  Eligibility: <strong>{o.eligibility}</strong>
                </span>
                <span>Deadline: {o.deadline || "Not verified"}</span>
                <span>Action: {o.recommendedAction}</span>
              </div>
              <p className="verification-note">{o.verificationNote}</p>
              <div className="record-bottomline">
                <a href={o.sourceUrl} target="_blank" rel="noreferrer">
                  Official source
                  <ArrowUpRight size={13} />
                </a>
                <span>
                  Retrieved{" "}
                  {new Date(o.lastVerifiedAt).toLocaleString("en-GB", {
                    timeZone: "Africa/Cairo",
                  })}
                </span>
              </div>
              <OpportunityActions
                opportunity={o}
                canWrite={canWrite}
                onOpenProject={onOpenProject}
                onChanged={async () => {
                  await load();
                  onDataChanged?.();
                }}
              />
            </article>
          ))
        ) : (
          <div className="empty-state">
            <div className="empty-icon">
              <TrendingUp size={27} />
            </div>
            <h3>
              {query
                ? "No matching source records."
                : "No opportunities have been collected."}
            </h3>
            <p>
              Use Scan now to retrieve permitted real sources. Failed or
              unavailable sources are logged, never filled with fabricated
              records.
            </p>
          </div>
        )}
      </section>
      <div className="research-details-grid">
        <section className="panel job-log">
          <div className="section-header">
            <h2>Source coverage</h2>
          </div>
          {data?.sources.map((s) => (
            <div className="source-record" key={s.id}>
              <strong>{s.name}</strong>
              <span>
                {s.lastSuccessAt
                  ? "Last success: " +
                    new Date(s.lastSuccessAt).toLocaleString("en-GB", {
                      timeZone: "Africa/Cairo",
                    })
                  : s.lastAttemptAt
                    ? "Attempted · no successful retrieval"
                    : "Not accessed yet"}
              </span>
              {s.lastError && <p className="source-error">{s.lastError}</p>}
              <a href={s.endpoint} target="_blank" rel="noreferrer">
                Official API
                <ArrowUpRight size={11} />
              </a>
            </div>
          ))}
          {data?.scoreWeights && (
            <div className="score-explainer">
              <h3>Transparent fit weights</h3>
              {Object.entries(data.scoreWeights).map(([name, value]) => (
                <span key={name}>
                  {name}: {value}%
                </span>
              ))}
              <p>
                Attractiveness never overrides mandatory eligibility. Retrieval
                does not verify eligibility or that a call is open.
              </p>
            </div>
          )}
        </section>
        <section className="panel job-log">
          <div className="section-header">
            <h2>Research job history</h2>
          </div>
          {data?.jobs.length ? (
            data.jobs.slice(0, 8).map((j) => (
              <details className="source-record" key={j.id}>
                <summary>
                  <strong>{j.status}</strong>
                  <span>
                    {new Date(j.startedAt).toLocaleString("en-GB", {
                      timeZone: "Africa/Cairo",
                    })}
                  </span>
                </summary>
                <p>
                  {j.discovered} discovered · {j.updated} updated
                </p>
                {j.error && <p className="source-error">{j.error}</p>}
                {j.sourceResults.map((s, i) => (
                  <p
                    className={
                      s.status === "failed" ? "source-error" : "muted-text"
                    }
                    key={i}
                  >
                    {s.sourceId}: {s.status} · {s.fetched} records{" "}
                    {s.error || ""}
                  </p>
                ))}
              </details>
            ))
          ) : (
            <div className="empty-state">
              <h3>No research runs yet.</h3>
              <p>Manual and scheduled attempts will be logged here.</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
interface KnowledgeDocument {
  id: string;
  documentId: string;
  title: string;
  section: string;
  content: string;
  sourceUrl: string;
  sourceType: string;
  verifiedAt: string;
  evidence: string;
}
export function Knowledge({ scope }: { scope: WorkspaceId }) {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]),
    [query, setQuery] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(true);
  const search = useCallback(
    async (value: string) => {
      setBusy(true);
      setError("");
      try {
        const r = await api<{ documents: KnowledgeDocument[] }>(
          `/api/knowledge?workspace=${scope}&query=${encodeURIComponent(value)}`,
        );
        setDocuments(r.documents);
      } catch (e) {
        setError((e as Error).message);
        setDocuments([]);
      } finally {
        setBusy(false);
      }
    },
    [scope],
  );
  useEffect(() => {
    void search("");
  }, [search]);
  return (
    <>
      <div className="notice">
        <ShieldCheck size={18} />
        <div>
          <strong>
            Authorized source: WASL company profile, September 2026.
          </strong>
          <p>
            Search indexed excerpts with slide-level citations. This is local
            lexical retrieval; Google Drive and semantic search are not
            connected. The starter kit's example company is never treated as a
            WASL fact.
          </p>
        </div>
      </div>
      <form
        className="knowledge-search"
        onSubmit={(e) => {
          e.preventDefault();
          void search(query);
        }}
      >
        <Search size={17} />
        <input
          aria-label="Search company knowledge"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search capabilities, programs, positioning…"
        />
        <button className="button primary" disabled={busy}>
          {busy ? "Searching…" : "Search knowledge"}
        </button>
      </form>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <section className="panel">
        <div className="section-header">
          <h2>
            Documented facts
            <span className="count-bubble">{documents.length}</span>
          </h2>
          <span className="muted-label">Source facts · not AI inference</span>
        </div>
        {documents.length ? (
          documents.map((d) => (
            <article key={d.id} className="knowledge-record">
              <span className="eyebrow">{d.section}</span>
              <h3>{d.title}</h3>
              <p>{d.content}</p>
              <a href={d.sourceUrl} target="_blank" rel="noreferrer">
                <FileText size={12} />
                View cited source
                <ArrowUpRight size={12} />
              </a>
            </article>
          ))
        ) : (
          <div className="empty-state">
            <div className="empty-icon">
              <FileText size={27} />
            </div>
            <h3>
              {busy
                ? "Loading authorized references…"
                : "No matching authorized excerpts."}
            </h3>
            <p>
              Try capabilities, programs, strategy, or positioning. Missing
              information remains missing.
            </p>
          </div>
        )}
      </section>
    </>
  );
}

function OpportunityActions({
  opportunity: o,
  canWrite,
  onChanged,
  onOpenProject,
}: {
  opportunity: Opportunity;
  canWrite: boolean;
  onChanged: () => Promise<void>;
  onOpenProject?: (project: Project) => void;
}) {
  const [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function patch(fields: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      await api(`/api/intelligence/${o.id}`, {
        method: "PATCH",
        body: JSON.stringify(fields),
      });
      await onChanged();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function convert() {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ created: boolean; project: Project }>(
        `/api/intelligence/${o.id}/convert`,
        { method: "POST", body: "{}" },
      );
      setMessage(
        result.created
          ? "Research project created. Open Projects to plan the next steps."
          : "A research project already exists for this source. Open Projects to continue.",
      );
      await onChanged();
      onOpenProject?.(result.project);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const fields: Record<string, unknown> = {
      tags: String(f.get("tags") || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      notes: String(f.get("notes") || ""),
    };
    const comment = String(f.get("comment") || "").trim();
    if (comment) fields.comment = comment;
    if (await patch(fields)) setEditing(false);
  }
  return (
    <div className="opportunity-actions">
      {o.tags && o.tags.length > 0 && (
        <div className="opportunity-tags">
          {o.tags.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      )}
      <div className="opportunity-buttons">
        <button
          className={`text-button ${o.saved ? "saved" : ""}`}
          disabled={!canWrite || busy}
          onClick={() => patch({ saved: !o.saved })}
        >
          {o.saved ? "✓ Saved for review" : "Save for review"}
        </button>
        <button
          className="text-button"
          disabled={!canWrite || busy}
          onClick={() => {
            setError("");
            setEditing(true);
          }}
        >
          Notes & comments{o.comments?.length ? ` (${o.comments.length})` : ""}
        </button>
        <button
          className="text-button"
          disabled={!canWrite || busy}
          onClick={() =>
            patch({
              status: o.status === "archived" ? "unverified" : "archived",
            })
          }
        >
          {o.status === "archived" ? "Restore as unverified" : "Archive"}
        </button>
        <button
          className="text-button"
          disabled={!canWrite || busy}
          onClick={convert}
        >
          {o.projectId ? "Open research project" : "Create research project"}
          <ArrowUpRight size={12} />
        </button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="opportunity-action-message" role="status">
          {message} This does not apply or contact the buyer.
        </p>
      )}
      {editing && (
        <Modal
          title="Research notes & evidence gaps"
          description="Your notes are internal context. They do not change the source's eligibility or verification status."
          onClose={() => setEditing(false)}
          wide
        >
          <form className="record-form" onSubmit={save}>
            <label>
              Tags
              <input
                name="tags"
                defaultValue={o.tags?.join(", ")}
                placeholder="partnership, capacity building"
              />
            </label>
            <label>
              Research notes
              <textarea
                name="notes"
                rows={5}
                defaultValue={o.notes || ""}
                maxLength={10000}
                placeholder="What is known, what needs verification, and next steps…"
              />
            </label>
            <label>
              Add a comment
              <textarea
                name="comment"
                rows={3}
                maxLength={2000}
                placeholder="A decision, evidence gap, or follow-up…"
              />
            </label>
            {o.comments && o.comments.length > 0 && (
              <div className="opportunity-comments">
                {o.comments.map((c) => (
                  <div key={c.id}>
                    <strong>{c.author}</strong>
                    <span>
                      {new Date(c.createdAt).toLocaleString("en-GB", {
                        timeZone: "Africa/Cairo",
                      })}
                    </span>
                    <p>{c.body}</p>
                  </div>
                ))}
              </div>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="dialog-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
              <button className="button primary" disabled={busy}>
                {busy ? "Saving…" : "Save research notes"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
