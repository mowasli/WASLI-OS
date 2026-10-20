"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleAlert,
  Command,
  FileText,
  FolderClosed,
  LayoutDashboard,
  LayoutGrid,
  List,
  LockKeyhole,
  LogOut,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Unplug,
  Users,
  X,
} from "lucide-react";
import type {
  WorkspaceId,
  SessionState,
  Task,
  Project,
  TaskStatus,
  Workspace,
} from "@/lib/types";
import { api, Modal, ProjectForm, TaskForm } from "@/components/forms";
import { OperationsPanel } from "@/components/operations-panel";
import {
  Assistant,
  Connections,
  Intelligence,
  Knowledge,
} from "@/components/features";
type Scope = "global" | WorkspaceId;
type View =
  | "overview"
  | "tasks"
  | "projects"
  | "calendar"
  | "intelligence"
  | "knowledge"
  | "connections"
  | "settings"
  | "operations";
type TaskView = "list" | "kanban" | "calendar";
const labels = {
  global: "Mission Control",
  wasl: "WASL Ecosystems",
  thv: "Tech Horizons Ventures",
  personal: "Personal",
  independent: "Freelancing & Volunteering",
};
const arabicLabels = {
  global: "مركز القيادة",
  wasl: "وصل للمنظومات",
  thv: "تك هورايزنز فنتشرز",
  personal: "المساحة الشخصية",
  independent: "العمل المستقل والتطوع",
};
const desc = {
  global: "Your worlds, working together.",
  wasl: "Build ecosystems. Connect possibilities.",
  thv: "Structure the work. Move ventures forward.",
  personal: "Your space to think, grow, and focus.",
  independent: "Meaningful work. Independent impact.",
};
const statuses: TaskStatus[] = ["todo", "in_progress", "blocked", "done"];
const statusLabel = {
  todo: "To do",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
};
const colors = {
  wasl: "#002bd9",
  thv: "#176349",
  personal: "#9d7b48",
  independent: "#ed5a1e",
};
function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(
    new Date(),
  );
}
function niceDate(d: string | null) {
  return d
    ? new Date(d.slice(0, 10) + "T12:00:00").toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      })
    : "No date";
}
function Brand({ id, small = false }: { id: Scope; small?: boolean }) {
  if (id === "wasl")
    return (
      <img
        className={`brand-image ${small ? "small" : ""}`}
        src="/brand/wasl-logo-blue.png"
        alt="WASL Ecosystems official logo"
      />
    );
  if (id === "thv")
    return (
      <img
        className={`brand-image thv ${small ? "small" : ""}`}
        src="/brand/thv-logo.png"
        alt="Tech Horizons Ventures official logo"
      />
    );
  if (id === "global")
    return (
      <span className="product-symbol">
        <Command size={small ? 18 : 24} />
      </span>
    );
  return (
    <span className={`lettermark ${id}`}>
      {id === "personal" ? "MA" : "F / V"}
    </span>
  );
}
function Empty({
  icon = <FolderClosed size={25} />,
  title,
  children,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
function Auth({
  state,
  onReady,
}: {
  state: SessionState;
  onReady: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      await api(`/api/auth/${state.setupRequired ? "setup" : "login"}`, {
        method: "POST",
        body: JSON.stringify({
          email: f.get("email"),
          password: f.get("password"),
          ...(state.setupRequired ? { name: f.get("name") } : {}),
        }),
      });
      onReady();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-shell">
      <div className="auth-brand">
        <div className="wordmark">
          <span className="product-symbol">
            <Command size={24} />
          </span>
          WASLI<span>OS</span>
        </div>
        <div>
          <span className="eyebrow light">ONE CLEAR DIRECTION</span>
          <h1>
            All your worlds.
            <br />
            One focused mind.
          </h1>
          <p>
            A private executive workspace for the work
            <br />
            only you can bring together.
          </p>
          <div className="auth-worlds">
            <span>WASL Ecosystems</span>
            <span>Tech Horizons Ventures</span>
            <span>Personal</span>
            <span>Independent</span>
          </div>
        </div>
        <small>
          <ShieldCheck size={15} />
          Private by design. Separate by workspace.
        </small>
      </div>
      <div className="auth-form-wrap">
        <div className="auth-form">
          <span className="eyebrow">YOUR EXECUTIVE WORKSPACE</span>
          <h2>
            {state.setupRequired
              ? "Make room for your best work."
              : "Welcome back."}
          </h2>
          <p>
            {state.setupRequired
              ? "Create the owner account for this local installation. Your four workspaces will be ready immediately."
              : "Sign in to pick up where you left off."}
          </p>
          <form onSubmit={submit} className="record-form">
            {state.setupRequired && (
              <label>
                Your name
                <input
                  name="name"
                  required
                  autoComplete="name"
                  placeholder="Mohammed Alwasli"
                />
              </label>
            )}
            <label>
              Email address
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@company.com"
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                minLength={state.setupRequired ? 12 : 1}
                required
                autoComplete={
                  state.setupRequired ? "new-password" : "current-password"
                }
                placeholder={
                  state.setupRequired
                    ? "At least 12 characters"
                    : "Your password"
                }
              />
            </label>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <button className="button primary auth-submit" disabled={busy}>
              {busy
                ? "Please wait…"
                : state.setupRequired
                  ? "Create my private workspace"
                  : "Sign in"}
              <ArrowRight size={17} />
            </button>
          </form>
          <div className="auth-note">
            <LockKeyhole size={15} />
            <span>
              Local PostgreSQL storage · No external accounts connected
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
export default function Home() {
  const [session, setSession] = useState<SessionState | null>(null),
    [scope, setScope] = useState<Scope>("global"),
    [view, setView] = useState<View>("overview"),
    [taskView, setTaskView] = useState<TaskView>("list"),
    [tasks, setTasks] = useState<Task[]>([]),
    [projects, setProjects] = useState<Project[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [category, setCategory] = useState("all"),
    [taskModal, setTaskModal] = useState<Task | "new" | null>(null),
    [projectModal, setProjectModal] = useState<Project | "new" | null>(null),
    [createDate, setCreateDate] = useState<string>(),
    [assistant, setAssistant] = useState(false),
    [mobileNav, setMobileNav] = useState(false),
    [arabic, setArabic] = useState(false),
    [toast, setToast] = useState(""),
    [globalCreate, setGlobalCreate] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const activeScope = useRef<Scope>("global");
  const refreshEpoch = useRef(0);
  const tr = (en: string, ar: string) => (arabic ? ar : en);
  const refreshSession = useCallback(async () => {
    try {
      setSession(await api<SessionState>("/api/auth/session"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);
  const refresh = useCallback(async () => {
    if (!session?.user) return;
    const epoch = ++refreshEpoch.current;
    setLoading(true);
    setError("");
    try {
      if (scope === "global") {
        const data = await api<{ tasks: Task[]; projects: Project[] }>(
          "/api/dashboard",
        );
        if (activeScope.current !== scope || epoch !== refreshEpoch.current)
          return;
        setTasks(data.tasks);
        setProjects(data.projects);
      } else {
        const [t, p] = await Promise.all([
          api<Task[]>(`/api/tasks?workspace=${scope}`),
          api<Project[]>(`/api/projects?workspace=${scope}`),
        ]);
        if (activeScope.current !== scope || epoch !== refreshEpoch.current)
          return;
        setTasks(t);
        setProjects(p);
      }
    } catch (e) {
      if (activeScope.current !== scope || epoch !== refreshEpoch.current)
        return;
      setTasks([]);
      setProjects([]);
      setError((e as Error).message);
    } finally {
      if (activeScope.current === scope && epoch === refreshEpoch.current)
        setLoading(false);
    }
  }, [scope, session?.user]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    function keys(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") setAssistant(false);
    }
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  const workspaces = session?.workspaces || [];
  const writable =
    scope !== "global" &&
    workspaces.find((w) => w.id === scope)?.role !== "viewer";
  function changeScope(s: Scope) {
    if (activeScope.current === s) {
      setView("overview");
      setSearch("");
      setFilter("all");
      setCategory("all");
      setMobileNav(false);
      setAssistant(false);
      return;
    }
    activeScope.current = s;
    refreshEpoch.current++;
    setTasks([]);
    setProjects([]);
    setError("");
    setLoading(true);
    setTaskModal(null);
    setProjectModal(null);
    setGlobalCreate(false);
    setScope(s);
    setView("overview");
    setSearch("");
    setFilter("all");
    setCategory("all");
    setMobileNav(false);
    setAssistant(false);
  }
  function newTask(date?: string) {
    if (scope !== "global" && !writable) {
      setToast(
        "Viewer access is read-only. Ask a workspace owner for editing access.",
      );
      return;
    }
    setCreateDate(date);
    if (scope === "global") setGlobalCreate(true);
    else setTaskModal("new");
  }
  async function updateTask(t: Task, patch: Partial<Task>) {
    try {
      await api(`/api/tasks/${t.id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      await refresh();
    } catch (e) {
      setToast((e as Error).message);
    }
  }
  const open = tasks.filter((t) => t.status !== "done"),
    overdue = open.filter((t) => t.dueDate && t.dueDate.slice(0, 10) < today()),
    dueToday = open.filter((t) => t.dueDate?.slice(0, 10) === today()),
    done = tasks.filter((t) => t.status === "done");
  const visible = useMemo(
    () =>
      tasks.filter(
        (t) =>
          (!search ||
            `${t.title} ${t.assignee} ${t.tags?.join(" ") || ""}`
              .toLowerCase()
              .includes(search.toLowerCase())) &&
          (filter === "all" ||
            (filter === "overdue"
              ? t.status !== "done" &&
                !!t.dueDate &&
                t.dueDate.slice(0, 10) < today()
              : filter === "today"
                ? t.dueDate?.slice(0, 10) === today()
                : filter === t.status)) &&
          (category === "all" || t.category === category),
      ),
    [tasks, search, filter, category],
  );
  const priorities = [...open]
    .sort((a, b) => {
      const p = { urgent: 4, high: 3, medium: 2, low: 1 };
      return (
        p[b.priority] +
          (b.important ? 2 : 0) -
          (p[a.priority] + (a.important ? 2 : 0)) ||
        (a.dueDate || "9999").localeCompare(b.dueDate || "9999")
      );
    })
    .slice(0, 3);
  const dateText = new Intl.DateTimeFormat(arabic ? "ar-EG" : "en-GB", {
    timeZone: "Africa/Cairo",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
  if (!session)
    return (
      <div className="loading-screen">
        <Command size={30} />
        <span>{error || "Opening your workspace…"}</span>
        {error && (
          <button className="button secondary" onClick={refreshSession}>
            Retry
          </button>
        )}
      </div>
    );
  if (!session.user) return <Auth state={session} onReady={refreshSession} />;
  function taskRows(items: Task[], compact = false) {
    return (
      <div className={`task-list ${compact ? "compact" : ""}`}>
        {items.map((t) => (
          <div
            className={`task-row ${t.status === "done" ? "completed" : ""}`}
            key={t.id}
          >
            <button
              className={`task-check ${t.status === "done" ? "checked" : ""}`}
              disabled={
                workspaces.find((w) => w.id === t.workspaceId)?.role ===
                "viewer"
              }
              aria-label={`Mark ${t.title} ${t.status === "done" ? "incomplete" : "complete"}`}
              onClick={() =>
                updateTask(t, { status: t.status === "done" ? "todo" : "done" })
              }
            >
              {t.status === "done" && <Check size={13} />}
            </button>
            <button
              className="task-title"
              onClick={() => {
                if (scope === "global") {
                  changeScope(t.workspaceId);
                  setToast(
                    "Workspace opened. Select the task to edit its details.",
                  );
                } else setTaskModal(t);
              }}
            >
              <strong>{t.title}</strong>
              <span>
                {scope === "global"
                  ? labels[t.workspaceId]
                  : t.projectId
                    ? projects.find((p) => p.id === t.projectId)?.name ||
                      "Project"
                    : "Independent task"}
                {t.assignee && ` · ${t.assignee}`}
              </span>
            </button>
            <span className={`priority ${t.priority}`}>
              <span />
              {t.priority}
            </span>
            <span
              className={`due-date ${t.dueDate && t.dueDate.slice(0, 10) < today() && t.status !== "done" ? "late" : ""}`}
            >
              <CalendarDays size={13} />
              {niceDate(t.dueDate)}
            </span>
            {!compact && (
              <select
                className="status-select"
                aria-label={`Status for ${t.title}`}
                value={t.status}
                disabled={
                  workspaces.find((w) => w.id === t.workspaceId)?.role ===
                  "viewer"
                }
                onChange={(e) =>
                  updateTask(t, { status: e.target.value as TaskStatus })
                }
              >
                {statuses.map((s) => (
                  <option value={s} key={s}>
                    {statusLabel[s]}
                  </option>
                ))}
              </select>
            )}
            <button
              className="icon-button row-arrow"
              aria-label={`Open ${t.title}`}
              onClick={() =>
                scope === "global"
                  ? changeScope(t.workspaceId)
                  : setTaskModal(t)
              }
            >
              <ArrowUpRight size={16} />
            </button>
          </div>
        ))}
      </div>
    );
  }
  const navItems: {
    id: View;
    label: string;
    ar: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: "overview",
      label: "Overview",
      ar: "نظرة عامة",
      icon: <LayoutDashboard size={18} />,
    },
    {
      id: "tasks",
      label: "Tasks",
      ar: "المهام",
      icon: <CheckCheck size={18} />,
    },
    {
      id: "projects",
      label: "Projects",
      ar: "المشاريع",
      icon: <FolderClosed size={18} />,
    },
    {
      id: "calendar",
      label: "Calendar",
      ar: "التقويم",
      icon: <CalendarDays size={18} />,
    },
  ];
  return (
    <div className={`app-shell theme-${scope}`} dir={arabic ? "rtl" : "ltr"}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {mobileNav && (
        <button
          className="mobile-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      )}
      <aside className={`sidebar ${mobileNav ? "is-open" : ""}`}>
        <div className="wordmark">
          <span className="product-symbol">
            <Command size={22} />
          </span>
          WASLI<span>OS</span>
          <span className="wordmark-beta">PRIVATE</span>
        </div>
        <button
          className={`mission-link ${scope === "global" ? "active" : ""}`}
          onClick={() => changeScope("global")}
        >
          <LayoutGrid size={18} />
          {tr("Mission Control", "مركز القيادة")}
          <span>G</span>
        </button>
        <span className="nav-caption">
          {tr("YOUR WORKSPACES", "مساحات العمل")}
        </span>
        <nav aria-label="Workspaces" className="workspace-nav">
          {workspaces.map((w) => (
            <button
              key={w.id}
              className={`workspace-nav-item ${scope === w.id ? "active" : ""}`}
              onClick={() => changeScope(w.id)}
            >
              <span className={`workspace-dot ${w.id}`} />
              <span>{arabic ? arabicLabels[w.id] : labels[w.id]}</span>
              <ChevronRight size={13} />
            </button>
          ))}
        </nav>
        <div className="sidebar-divider" />
        <span className="nav-caption">{tr("WORKSPACE", "مساحة العمل")}</span>
        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map((n) => (
            <button
              key={n.id}
              className={view === n.id ? "selected" : ""}
              onClick={() => {
                setView(n.id);
                if (n.id === "calendar") setTaskView("calendar");
                setMobileNav(false);
              }}
            >
              {n.icon}
              {tr(n.label, n.ar)}
              {n.id === "tasks" && open.length > 0 && (
                <span className="nav-count">{open.length}</span>
              )}
            </button>
          ))}
          {scope !== "global" && (
            <button
              className={view === "operations" ? "selected" : ""}
              onClick={() => {
                setView("operations");
                setMobileNav(false);
              }}
            >
              <Users size={18} />
              {scope === "thv"
                ? tr("SOPs & portfolio", "الإجراءات والمحفظة")
                : tr("Studio & relationships", "الاستوديو والعلاقات")}
            </button>
          )}
          {scope === "wasl" && (
            <>
              <button
                className={view === "intelligence" ? "selected" : ""}
                onClick={() => {
                  setView("intelligence");
                  setMobileNav(false);
                }}
              >
                <TrendingUp size={18} />
                {tr("Intelligence", "الاستخبارات")}
                <span className="nav-tag">BETA</span>
              </button>
              <button
                className={view === "knowledge" ? "selected" : ""}
                onClick={() => {
                  setView("knowledge");
                  setMobileNav(false);
                }}
              >
                <FileText size={18} />
                {tr("Company Brain", "ذاكرة الشركة")}
              </button>
            </>
          )}
        </nav>
        <div className="sidebar-bottom">
          <button className="assistant-nav" onClick={() => setAssistant(true)}>
            <Sparkles size={18} />
            <span>
              {tr("Chief of Staff", "رئيس الأركان")}
              <small>{tr("Clarity, on demand", "وضوح عند الطلب")}</small>
            </span>
            <ArrowUpRight size={16} />
          </button>
          <nav className="main-nav utility-nav">
            <button
              className={view === "connections" ? "selected" : ""}
              onClick={() => setView("connections")}
            >
              <Unplug size={17} />
              {tr("Connections", "الاتصالات")}
            </button>
            <button
              className={view === "settings" ? "selected" : ""}
              onClick={() => setView("settings")}
            >
              <Settings2 size={17} />
              {tr("Settings & access", "الإعدادات والصلاحيات")}
            </button>
          </nav>
          <div className="profile">
            <span className="avatar">{session.user.name.slice(0, 1)}</span>
            <div>
              <strong>{session.user.name}</strong>
              <small>
                {tr("Private executive workspace", "مساحة تنفيذية خاصة")}
              </small>
            </div>
            <button
              className="icon-button"
              aria-label="Sign out"
              onClick={async () => {
                await api("/api/auth/logout", { method: "POST" });
                changeScope("global");
                setTasks([]);
                setProjects([]);
                setSession(null);
                await refreshSession();
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobileNav(true)}
            >
              <Menu size={21} />
            </button>
            <span>WASLI OS</span>
            <ChevronRight size={14} />
            <strong>{arabic ? arabicLabels[scope] : labels[scope]}</strong>
          </div>
          <div className="topbar-actions">
            <div className="global-search">
              <Search size={16} />
              <input
                ref={searchRef}
                aria-label="Search tasks"
                placeholder={tr("Search your work…", "ابحث في عملك…")}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  if (e.target.value) setView("tasks");
                }}
              />
              <kbd>⌘ K</kbd>
            </div>
            <button
              className="language-button"
              onClick={() => setArabic(!arabic)}
              aria-label="Switch language"
            >
              {arabic ? "EN" : "عربي"}
            </button>
            <button
              className="icon-button assistant-top"
              aria-label="Open Chief of Staff"
              onClick={() => setAssistant(true)}
            >
              <Sparkles size={19} />
            </button>
          </div>
        </header>
        <main className="main-content" id="main-content">
          <div className="page-context">
            <span className="eyebrow">
              {scope === "global"
                ? tr("YOUR EXECUTIVE OVERVIEW", "نظرتك التنفيذية")
                : tr("PRIVATE WORKSPACE", "مساحة عمل خاصة")}
            </span>
            <span className="context-date">{dateText}</span>
          </div>
          <div className="page-heading">
            <div>
              {scope !== "global" && (
                <div className="workspace-brand-line">
                  <Brand id={scope} />
                  <span className="workspace-access">
                    <LockKeyhole size={11} />
                    {workspaces.find((w) => w.id === scope)?.role || "member"}
                  </span>
                </div>
              )}
              <h1>
                {view === "overview"
                  ? scope === "global"
                    ? tr(
                        "Good work starts with clarity.",
                        "العمل الجيد يبدأ بالوضوح.",
                      )
                    : arabic
                      ? arabicLabels[scope]
                      : labels[scope]
                  : view === "tasks"
                    ? tr("Your next moves.", "خطواتك القادمة.")
                    : view === "projects"
                      ? tr(
                          "Move the meaningful forward.",
                          "حرّك ما يصنع الفرق.",
                        )
                      : view === "calendar"
                        ? tr("Make time for what matters.", "وقت لما يهم.")
                        : view === "intelligence"
                          ? "Opportunity intelligence"
                          : view === "knowledge"
                            ? "Your institutional memory."
                            : view === "connections"
                              ? "Connect with intention."
                              : view === "operations"
                                ? "Build your operating rhythm."
                                : "Your workspace, your rules."}
              </h1>
              <p>
                {view === "overview"
                  ? desc[scope]
                  : view === "tasks"
                    ? "One trusted place for every next action."
                    : view === "projects"
                      ? "Turn strategic intent into steady progress."
                      : view === "calendar"
                        ? "Task deadlines, in perspective. Google meetings require a connected account."
                        : view === "intelligence"
                          ? "Source-backed research. No synthetic opportunities."
                          : view === "knowledge"
                            ? "Approved sources, clearly separated from assumptions."
                            : view === "connections"
                              ? "Connect services independently for each workspace."
                              : view === "operations"
                                ? "Relationships, processes, and commitments in their own context."
                                : "Manage membership and protect the boundaries of your work."}
              </p>
            </div>
            {(["overview", "tasks", "calendar"] as View[]).includes(view) && (
              <button
                className="button primary"
                onClick={() => newTask()}
                disabled={scope !== "global" && !writable}
              >
                <Plus size={17} />
                {tr("New task", "مهمة جديدة")}
              </button>
            )}
            {view === "projects" && (
              <button
                className="button primary"
                onClick={() =>
                  scope === "global"
                    ? setGlobalCreate(true)
                    : setProjectModal("new")
                }
                disabled={scope !== "global" && !writable}
              >
                <Plus size={17} />
                New project
              </button>
            )}
          </div>
          {error && (
            <div className="error-banner" role="alert">
              <CircleAlert size={17} />
              {error}
              <button onClick={refresh}>Retry</button>
            </div>
          )}
          {view === "overview" && (
            <>
              <section
                className="metric-strip"
                aria-label="Executive priorities"
              >
                <button
                  onClick={() => {
                    setView("tasks");
                    setFilter("today");
                  }}
                >
                  <span>{tr("DUE TODAY", "مستحقة اليوم")}</span>
                  <strong>
                    {dueToday.length}
                    <small>
                      <CalendarDays size={17} />
                    </small>
                  </strong>
                  <em>{tr("Your focus for the day", "تركيزك لهذا اليوم")}</em>
                </button>
                <button
                  onClick={() => {
                    setView("tasks");
                    setFilter("overdue");
                  }}
                >
                  <span>{tr("NEEDS ATTENTION", "تحتاج الانتباه")}</span>
                  <strong>
                    {overdue.length}
                    <small className={overdue.length ? "attention" : ""}>
                      <CircleAlert size={17} />
                    </small>
                  </strong>
                  <em>
                    {tr("Overdue, still actionable", "متأخرة وقابلة للتنفيذ")}
                  </em>
                </button>
                <button onClick={() => setView("projects")}>
                  <span>{tr("ACTIVE PROJECTS", "المشاريع النشطة")}</span>
                  <strong>
                    {projects.filter((p) => p.status === "active").length}
                    <small>
                      <FolderClosed size={17} />
                    </small>
                  </strong>
                  <em>{tr("Ideas becoming outcomes", "أفكار تتحول لنتائج")}</em>
                </button>
                <button
                  onClick={() => {
                    setView("tasks");
                    setFilter("done");
                  }}
                >
                  <span>{tr("COMPLETED TASKS", "المهام المكتملة")}</span>
                  <strong>
                    {done.length}
                    <small>
                      <CheckCheck size={17} />
                    </small>
                  </strong>
                  <em>
                    {tasks.length
                      ? `${Math.round((done.length / tasks.length) * 100)}% of your tracked work`
                      : "Progress begins with one action"}
                  </em>
                </button>
              </section>
              <div className="overview-grid">
                <section className="panel priority-panel">
                  <div className="section-header">
                    <div>
                      <span className="eyebrow">
                        {tr(
                          "LESS NOISE. MORE MOMENTUM.",
                          "تركيز أكبر. تقدم مستمر.",
                        )}
                      </span>
                      <h2>
                        {tr("Your top priorities", "أهم أولوياتك")}
                        <span className="count-bubble">
                          {priorities.length}
                        </span>
                      </h2>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setView("tasks")}
                    >
                      {tr("All tasks", "كل المهام")}
                      <ArrowUpRight size={15} />
                    </button>
                  </div>
                  {priorities.length ? (
                    taskRows(priorities, true)
                  ) : (
                    <Empty
                      icon={<Target size={27} />}
                      title={tr(
                        "A little intention goes a long way.",
                        "البداية بخطوة واضحة.",
                      )}
                      action={
                        <button
                          className="button secondary"
                          onClick={() => newTask()}
                        >
                          <Plus size={15} />
                          {tr("Add your first priority", "أضف أولويتك الأولى")}
                        </button>
                      }
                    >
                      {tr(
                        "Capture what matters. Your most urgent and important tasks will rise to the top.",
                        "سجّل ما يهم. ستظهر المهام الأكثر أهمية وإلحاحاً هنا.",
                      )}
                    </Empty>
                  )}
                  <div className="panel-footnote">
                    <span className="tiny-dot" />
                    Ranked by priority, strategic importance, then deadline
                  </div>
                </section>
                <section className="focus-panel">
                  <div className="focus-top">
                    <Sparkles size={19} />
                    <span>CHIEF OF STAFF</span>
                    <span className="local-pill">LOCAL</span>
                  </div>
                  <h2>
                    {open.length
                      ? overdue.length
                        ? "Clear the path ahead."
                        : "Make your next move count."
                      : "Start with one meaningful action."}
                  </h2>
                  <p>
                    {overdue.length
                      ? `${overdue.length} overdue ${overdue.length === 1 ? "task needs" : "tasks need"} a new decision: finish, reschedule, or delegate.`
                      : open.length
                        ? `You have ${open.length} open ${open.length === 1 ? "task" : "tasks"} across ${scope === "global" ? "your workspaces" : "this workspace"}. Choose the action that unlocks the most progress.`
                        : "Your workspace is clear. Capture a project, choose a priority, and build momentum on your terms."}
                  </p>
                  <button onClick={() => setAssistant(true)}>
                    Find my focus
                    <ArrowRight size={16} />
                  </button>
                  <div className="focus-note">
                    <ShieldCheck size={13} />
                    Rules-based guidance from your actual records
                  </div>
                </section>
              </div>
              {scope === "global" ? (
                <section className="worlds-section">
                  <div className="section-header">
                    <div>
                      <span className="eyebrow">
                        SEPARATE CONTEXTS. SHARED CLARITY.
                      </span>
                      <h2>{tr("Your four worlds", "عوالمك الأربعة")}</h2>
                    </div>
                    <span className="muted-label">
                      <LockKeyhole size={12} />
                      Private by workspace
                    </span>
                  </div>
                  <div className="workspace-cards">
                    {workspaces.map((w) => {
                      const wt = tasks.filter((t) => t.workspaceId === w.id);
                      return (
                        <button
                          className={`workspace-card ${w.id}`}
                          key={w.id}
                          onClick={() => changeScope(w.id)}
                        >
                          <div className="workspace-card-top">
                            <Brand id={w.id} small />
                            <ArrowUpRight size={18} />
                          </div>
                          <h3>{arabic ? arabicLabels[w.id] : labels[w.id]}</h3>
                          <p>{desc[w.id]}</p>
                          <div className="workspace-card-footer">
                            <span>
                              <strong>
                                {wt.filter((t) => t.status !== "done").length}
                              </strong>{" "}
                              open tasks
                            </span>
                            <span>
                              {
                                projects.filter(
                                  (p) =>
                                    p.workspaceId === w.id &&
                                    p.status === "active",
                                ).length
                              }{" "}
                              projects
                            </span>
                          </div>
                          <div className="workspace-progress">
                            <span
                              style={{
                                width: `${wt.length ? (wt.filter((t) => t.status === "done").length / wt.length) * 100 : 0}%`,
                              }}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ) : (
                <div className="overview-grid lower">
                  <section className="panel">
                    <div className="section-header">
                      <h2>Project portfolio</h2>
                      <button
                        className="text-button"
                        onClick={() => setView("projects")}
                      >
                        View projects
                        <ArrowUpRight size={15} />
                      </button>
                    </div>
                    {projects.length ? (
                      projects
                        .slice(0, 3)
                        .map((p) => (
                          <ProjectCard
                            key={p.id}
                            project={p}
                            tasks={tasks}
                            onOpen={() => setProjectModal(p)}
                            compact
                          />
                        ))
                    ) : (
                      <Empty
                        title="Make the big picture actionable."
                        action={
                          <button
                            className="text-button"
                            onClick={() => setProjectModal("new")}
                            disabled={!writable}
                          >
                            <Plus size={15} />
                            Create a project
                          </button>
                        }
                      >
                        Give an important outcome its own space.
                      </Empty>
                    )}
                  </section>
                  <section className="panel">
                    <div className="section-header">
                      <h2>Waiting on others</h2>
                      <span className="count-bubble">
                        {open.filter((t) => t.status === "blocked").length}
                      </span>
                    </div>
                    {open.filter((t) => t.status === "blocked").length ? (
                      taskRows(
                        open.filter((t) => t.status === "blocked").slice(0, 3),
                        true,
                      )
                    ) : (
                      <Empty
                        icon={<Users size={24} />}
                        title="No blockers on the radar."
                      >
                        Blocked tasks will appear here, with their follow-up
                        owner.
                      </Empty>
                    )}
                  </section>
                </div>
              )}
            </>
          )}
          {(view === "tasks" || view === "calendar") && (
            <section className="panel work-panel">
              <div className="work-toolbar">
                <div
                  className="view-tabs"
                  role="tablist"
                  aria-label="Task view"
                >
                  {(
                    [
                      {
                        id: "list",
                        icon: <List size={15} />,
                        label: tr("List", "قائمة"),
                      },
                      {
                        id: "kanban",
                        icon: <LayoutGrid size={15} />,
                        label: tr("Kanban", "لوحة"),
                      },
                      {
                        id: "calendar",
                        icon: <CalendarDays size={15} />,
                        label: tr("Calendar", "تقويم"),
                      },
                    ] as {
                      id: TaskView;
                      icon: React.ReactNode;
                      label: string;
                    }[]
                  ).map((v) => (
                    <button
                      key={v.id}
                      role="tab"
                      aria-selected={
                        (view === "calendar" ? "calendar" : taskView) === v.id
                      }
                      className={
                        (view === "calendar" ? "calendar" : taskView) === v.id
                          ? "active"
                          : ""
                      }
                      onClick={() => {
                        setView("tasks");
                        setTaskView(v.id);
                      }}
                    >
                      {v.icon}
                      {v.label}
                    </button>
                  ))}
                </div>
                <div className="work-filters">
                  <select
                    aria-label="Filter tasks"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="all">All tasks</option>
                    <option value="today">Due today</option>
                    <option value="overdue">Overdue</option>
                    {statuses.map((s) => (
                      <option key={s} value={s}>
                        {statusLabel[s]}
                      </option>
                    ))}
                  </select>
                  {scope === "independent" && (
                    <select
                      aria-label="Filter category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      <option value="all">All commitments</option>
                      <option value="freelance">Freelancing</option>
                      <option value="volunteer">Volunteering</option>
                    </select>
                  )}
                  <span className="result-count">{visible.length} tasks</span>
                </div>
              </div>
              {loading ? (
                <div className="inline-loading">Loading your work…</div>
              ) : view === "calendar" || taskView === "calendar" ? (
                <CalendarView
                  tasks={visible}
                  onCreate={newTask}
                  onOpen={(t) =>
                    scope === "global"
                      ? changeScope(t.workspaceId)
                      : setTaskModal(t)
                  }
                />
              ) : taskView === "kanban" ? (
                <div className="kanban">
                  {statuses.map((s) => (
                    <div
                      className="kanban-column"
                      key={s}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const t = tasks.find(
                          (t) => t.id === e.dataTransfer.getData("text/plain"),
                        );
                        if (t) void updateTask(t, { status: s });
                      }}
                    >
                      <div className="kanban-column-heading">
                        <span className={`status-dot ${s}`} />
                        <strong>{statusLabel[s]}</strong>
                        <span>
                          {visible.filter((t) => t.status === s).length}
                        </span>
                        <button
                          className="icon-button"
                          aria-label={`Add task in ${statusLabel[s]}`}
                          onClick={() => newTask()}
                        >
                          <Plus size={15} />
                        </button>
                      </div>
                      {visible
                        .filter((t) => t.status === s)
                        .map((t) => (
                          <article
                            className="kanban-card"
                            key={t.id}
                            draggable={
                              workspaces.find((w) => w.id === t.workspaceId)
                                ?.role !== "viewer"
                            }
                            onDragStart={(e) =>
                              e.dataTransfer.setData("text/plain", t.id)
                            }
                          >
                            <span className={`priority ${t.priority}`}>
                              <span />
                              {t.priority}
                            </span>
                            <button
                              className="kanban-title"
                              onClick={() =>
                                scope === "global"
                                  ? changeScope(t.workspaceId)
                                  : setTaskModal(t)
                              }
                            >
                              {t.title}
                            </button>
                            <div className="kanban-details">
                              <span>
                                <CalendarDays size={12} />
                                {niceDate(t.dueDate)}
                              </span>
                              {t.assignee && (
                                <span
                                  className="mini-avatar"
                                  title={t.assignee}
                                >
                                  {t.assignee[0]}
                                </span>
                              )}
                            </div>
                            <select
                              aria-label={`Status for ${t.title}`}
                              className="status-select"
                              value={t.status}
                              onChange={(e) =>
                                updateTask(t, {
                                  status: e.target.value as TaskStatus,
                                })
                              }
                              disabled={
                                workspaces.find((w) => w.id === t.workspaceId)
                                  ?.role === "viewer"
                              }
                            >
                              {statuses.map((v) => (
                                <option key={v} value={v}>
                                  {statusLabel[v]}
                                </option>
                              ))}
                            </select>
                          </article>
                        ))}
                      {!visible.filter((t) => t.status === s).length && (
                        <div className="column-empty">No tasks here yet</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : visible.length ? (
                <>
                  <div className="table-heading">
                    <span>TASK / PROJECT</span>
                    <span>PRIORITY</span>
                    <span>DUE DATE</span>
                    <span>STATUS</span>
                  </div>
                  {taskRows(visible)}
                </>
              ) : (
                <Empty
                  icon={<CheckCheck size={27} />}
                  title={
                    search
                      ? "No matching tasks."
                      : "A clear space for your next action."
                  }
                  action={
                    <button
                      className="button secondary"
                      onClick={() => newTask()}
                      disabled={scope !== "global" && !writable}
                    >
                      <Plus size={15} />
                      Create task
                    </button>
                  }
                >
                  {search
                    ? "Try a different task title, tag, or owner."
                    : "Your tasks are stored in PostgreSQL and stay with you after a refresh."}
                </Empty>
              )}
            </section>
          )}
          {view === "projects" && (
            <>
              <div className="projects-summary">
                <span>{projects.length} projects</span>
                <span>
                  {projects.filter((p) => p.status === "active").length} active
                </span>
                <span>
                  {projects.filter((p) => p.status === "completed").length}{" "}
                  completed
                </span>
              </div>
              {projects.length ? (
                <div className="projects-grid">
                  {projects
                    .filter(
                      (p) =>
                        !search ||
                        p.name.toLowerCase().includes(search.toLowerCase()),
                    )
                    .map((p) => (
                      <ProjectCard
                        key={p.id}
                        project={p}
                        tasks={tasks}
                        onOpen={() =>
                          scope === "global"
                            ? changeScope(p.workspaceId)
                            : setProjectModal(p)
                        }
                      />
                    ))}
                </div>
              ) : (
                <section className="panel">
                  <Empty
                    title="Give your ambition a plan."
                    action={
                      <button
                        className="button primary"
                        onClick={() =>
                          scope === "global"
                            ? setGlobalCreate(true)
                            : setProjectModal("new")
                        }
                        disabled={scope !== "global" && !writable}
                      >
                        <Plus size={16} />
                        Create your first project
                      </button>
                    }
                  >
                    Define an outcome, add milestones, and connect tasks to
                    meaningful progress.
                  </Empty>
                </section>
              )}
            </>
          )}
          {view === "connections" && <Connections key={scope} scope={scope} />}
          {view === "settings" && (
            <Settings
              key={scope}
              scope={scope}
              workspace={workspaces.find((w) => w.id === scope)}
              onToast={setToast}
            />
          )}
          {view === "intelligence" && (
            <Intelligence
              key={scope}
              scope={scope}
              canWrite={writable}
              onDataChanged={() => void refresh()}
              onOpenProject={(project) => {
                setView("projects");
                setProjectModal(project);
              }}
            />
          )}{" "}
          {view === "knowledge" && scope !== "global" && (
            <Knowledge key={scope} scope={scope} />
          )}{" "}
          {view === "operations" && scope !== "global" && (
            <OperationsPanel
              workspaceId={scope}
              role={workspaces.find((w) => w.id === scope)?.role || "viewer"}
            />
          )}
          <footer className="app-footer">
            <span>
              <span className="tiny-dot" />{" "}
              {loading ? "Syncing…" : "Persisted in PostgreSQL"}
            </span>
            <span>
              <LockKeyhole size={11} />
              Workspace boundaries enforced on the server
            </span>
            <span>Africa/Cairo</span>
          </footer>
        </main>
      </div>
      {assistant && (
        <Assistant
          key={scope}
          scope={scope}
          workspaces={workspaces}
          onClose={() => setAssistant(false)}
          onScope={(s) => {
            changeScope(s);
            setAssistant(true);
          }}
        />
      )}{" "}
      {taskModal && scope !== "global" && (
        <TaskForm
          readOnly={!writable}
          workspaceId={scope}
          task={taskModal === "new" ? undefined : taskModal}
          projects={projects}
          tasks={tasks}
          initialDate={createDate}
          onClose={() => setTaskModal(null)}
          onSaved={() => {
            void refresh();
            setToast("Task saved to your workspace.");
          }}
        />
      )}
      {projectModal && scope !== "global" && (
        <ProjectForm
          readOnly={!writable}
          workspaceId={scope}
          project={projectModal === "new" ? undefined : projectModal}
          onClose={() => setProjectModal(null)}
          onSaved={() => {
            void refresh();
            setToast("Project saved to your workspace.");
          }}
        />
      )}
      {globalCreate && (
        <Modal
          title="Choose a workspace"
          description="Every task and project belongs to one private workspace."
          onClose={() => setGlobalCreate(false)}
        >
          <div className="workspace-picker">
            {workspaces
              .filter((w) => w.role !== "viewer")
              .map((w) => (
                <button
                  key={w.id}
                  onClick={() => {
                    const isProject = view === "projects";
                    changeScope(w.id);
                    if (isProject) setProjectModal("new");
                    else setTaskModal("new");
                  }}
                >
                  <span className={`workspace-dot ${w.id}`} />
                  {labels[w.id]}
                  <ArrowRight size={17} />
                </button>
              ))}
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={15} />
          {toast}
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
function ProjectCard({
  project: p,
  tasks,
  onOpen,
  compact = false,
}: {
  project: Project;
  tasks: Task[];
  onOpen: () => void;
  compact?: boolean;
}) {
  const related = tasks.filter((t) => t.projectId === p.id),
    complete = related.filter((t) => t.status === "done").length,
    progress = related.length
      ? Math.round((complete / related.length) * 100)
      : 0;
  const risk = related.some(
    (t) =>
      t.status === "blocked" ||
      (t.status !== "done" && t.dueDate && t.dueDate < today()),
  );
  return (
    <button
      className={`project-card ${compact ? "compact" : ""}`}
      onClick={onOpen}
    >
      <div className="project-card-heading">
        <span
          className="project-folder"
          style={{ color: colors[p.workspaceId] }}
        >
          <FolderClosed size={19} />
        </span>
        <span className={`project-status ${p.status}`}>
          {p.status.replace("_", " ")}
        </span>
        <ArrowUpRight size={16} />
      </div>
      <h3>{p.name}</h3>
      {p.description && <p>{p.description}</p>}
      <div className="project-progress-label">
        <span>
          {complete} of {related.length} tasks completed
        </span>
        <strong>{progress}%</strong>
      </div>
      <div className="project-progress">
        <span
          style={{ width: `${progress}%`, background: colors[p.workspaceId] }}
        />
      </div>
      <div className="project-card-bottom">
        <span>
          <CalendarDays size={12} />
          {niceDate(p.dueDate)}
        </span>
        <span>
          {p.milestones?.filter((m) => m.complete).length || 0}/
          {p.milestones?.length || 0} milestones
        </span>
        {risk && (
          <span className="risk-label">
            <CircleAlert size={12} />
            At risk
          </span>
        )}
      </div>
    </button>
  );
}
function CalendarView({
  tasks,
  onCreate,
  onOpen,
}: {
  tasks: Task[];
  onCreate: (date?: string) => void;
  onOpen: (t: Task) => void;
}) {
  const [month, setMonth] = useState(() => new Date(today() + "T12:00:00"));
  const year = month.getFullYear(),
    m = month.getMonth();
  const first = new Date(year, m, 1),
    offset = (first.getDay() + 6) % 7,
    days = new Date(year, m + 1, 0).getDate();
  const cells = Array.from(
    { length: Math.ceil((offset + days) / 7) * 7 },
    (_, i) => i - offset + 1,
  );
  return (
    <div className="calendar">
      <div className="calendar-header">
        <h2>
          {month.toLocaleDateString("en-GB", {
            month: "long",
            year: "numeric",
          })}
        </h2>
        <div>
          <button
            className="button secondary small"
            onClick={() => setMonth(new Date(today() + "T12:00:00"))}
          >
            Today
          </button>
          <button
            className="icon-button"
            aria-label="Previous month"
            onClick={() => setMonth(new Date(year, m - 1, 1))}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className="icon-button"
            aria-label="Next month"
            onClick={() => setMonth(new Date(year, m + 1, 1))}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="calendar-weekdays">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((x) => (
          <span key={x}>{x}</span>
        ))}
      </div>
      <div className="calendar-grid">
        {cells.map((d, i) => {
          const date = `${year}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const matching = tasks.filter(
            (t) => t.dueDate?.slice(0, 10) === date,
          );
          return (
            <div
              className={`calendar-cell ${d < 1 || d > days ? "outside" : ""} ${date === today() ? "today" : ""}`}
              key={i}
            >
              {d > 0 && d <= days && (
                <>
                  <button
                    className="calendar-day"
                    aria-label={`Create task on ${date}`}
                    onClick={() => onCreate(date)}
                  >
                    {d}
                  </button>
                  {matching.map((t) => (
                    <button
                      key={t.id}
                      className={`calendar-task ${t.status === "done" ? "done" : ""}`}
                      style={{ borderInlineStartColor: colors[t.workspaceId] }}
                      title={t.title}
                      onClick={() => onOpen(t)}
                    >
                      {t.title}
                    </button>
                  ))}
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className="calendar-note">
        <Circle size={10} />
        {tasks.filter((t) => !t.dueDate).length} tasks without a due date · This
        calendar shows task deadlines, not external meetings.
      </div>
    </div>
  );
}
function Settings({
  scope,
  workspace,
  onToast,
}: {
  scope: Scope;
  workspace?: Workspace;
  onToast: (s: string) => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function member(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = e.currentTarget;
    const f = new FormData(form);
    try {
      await api("/api/members", {
        method: "POST",
        body: JSON.stringify({
          workspaceId: scope,
          email: f.get("email"),
          name: f.get("name"),
          password: f.get("password"),
          role: f.get("role"),
        }),
      });
      form.reset();
      onToast("Member access saved for this workspace.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="settings-grid">
      <section className="panel settings-panel">
        <div className="section-header">
          <h2>Workspace access</h2>
          <ShieldCheck size={20} />
        </div>
        {scope === "global" ? (
          <p className="muted-text">
            Select a workspace to manage its members. Global access does not
            grant access to every workspace.
          </p>
        ) : (
          <>
            <div className="access-summary">
              <span className={`workspace-dot ${scope}`} />
              <strong>{labels[scope]}</strong>
              <span className="role-badge">{workspace?.role}</span>
            </div>
            <p className="muted-text">
              Owners manage access. Editors can update workspace records.
              Viewers can read but cannot make changes.
            </p>
            {workspace?.role === "owner" ? (
              <form className="record-form" onSubmit={member}>
                <h3>Add a workspace member</h3>
                <label>
                  Name
                  <input name="name" required />
                </label>
                <label>
                  Email
                  <input name="email" type="email" required />
                </label>
                <label>
                  Temporary password
                  <input
                    name="password"
                    type="password"
                    minLength={12}
                    required
                    autoComplete="new-password"
                  />
                </label>
                <label>
                  Role
                  <select name="role">
                    <option value="viewer">Viewer — read only</option>
                    <option value="editor">Editor — create and update</option>
                    <option value="owner">Owner — manage access</option>
                  </select>
                </label>
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
                <button className="button primary" disabled={busy}>
                  {busy ? "Saving…" : "Add member"}
                </button>
              </form>
            ) : (
              <p className="notice-text">
                Only workspace owners can manage membership.
              </p>
            )}
          </>
        )}
      </section>
      <section className="panel settings-panel">
        <div className="section-header">
          <h2>Your data</h2>
          <LockKeyhole size={20} />
        </div>
        <p className="muted-text">
          Export the records you are authorized to access. This is a data
          export, not a complete database backup.
          {scope === "global" ? " Select a workspace before exporting." : ""}
        </p>
        <button
          className="button secondary"
          disabled={scope === "global"}
          onClick={async () => {
            try {
              const data = await api(
                `/api/export${scope === "global" ? "" : `?workspace=${scope}`}`,
              );
              const url = URL.createObjectURL(
                new Blob([JSON.stringify(data, null, 2)], {
                  type: "application/json",
                }),
              );
              const a = document.createElement("a");
              a.href = url;
              a.download = `wasli-${scope}-${today()}.json`;
              a.click();
              URL.revokeObjectURL(url);
              onToast("Export downloaded. Keep it in a secure location.");
            } catch (e) {
              onToast((e as Error).message);
            }
          }}
        >
          <ArrowDown size={16} />
          Export workspace data
        </button>
        <div className="security-facts">
          <h3>Security boundaries</h3>
          <p>
            <Check size={14} />
            Server-enforced workspace membership
          </p>
          <p>
            <Check size={14} />
            Role-aware record mutations
          </p>
          <p>
            <Check size={14} />
            Expiring, HTTP-only session cookies
          </p>
          <p>
            <Check size={14} />
            External actions require explicit approval
          </p>
        </div>
      </section>
    </div>
  );
}
