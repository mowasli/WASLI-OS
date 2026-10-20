"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Task, Project, WorkspaceId, Milestone } from "@/lib/types";
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const r = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const data = await r.json();
  if (!r.ok)
    throw new Error(data.error || "The request could not be completed.");
  return data;
}
export function Modal({
  title,
  description,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className={`dialog-content ${wide ? "wide" : ""}`}>
          <div className="dialog-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>
                {description || "Changes are saved to your private workspace."}
              </Dialog.Description>
            </div>
            <Dialog.Close className="icon-button" aria-label="Close dialog">
              <X size={20} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function TaskForm({
  workspaceId,
  task,
  projects,
  tasks,
  onClose,
  onSaved,
  initialDate,
  readOnly = false,
}: {
  workspaceId: WorkspaceId;
  task?: Task;
  projects: Project[];
  tasks: Task[];
  onClose: () => void;
  onSaved: () => void;
  initialDate?: string;
  readOnly?: boolean;
}) {
  const [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      await api(task ? `/api/tasks/${task.id}` : "/api/tasks", {
        method: task ? "PATCH" : "POST",
        body: JSON.stringify({
          ...(!task ? { workspaceId } : {}),
          title: f.get("title"),
          description: f.get("description"),
          status: f.get("status"),
          priority: f.get("priority"),
          dueDate: f.get("dueDate") || null,
          projectId: f.get("projectId") || null,
          assignee: f.get("assignee"),
          tags: String(f.get("tags"))
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          category: f.get("category"),
          estimatedMinutes: Number(f.get("estimatedMinutes") || 0),
          important: f.get("important") === "on",
          dependencies: f.getAll("dependencies"),
        }),
      });
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function remove() {
    if (!confirm("Delete this task permanently? This action cannot be undone."))
      return;
    setSaving(true);
    try {
      await api(`/api/tasks/${task!.id}`, { method: "DELETE" });
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }
  if (readOnly && task)
    return (
      <Modal
        title={task.title}
        description="Read-only workspace access"
        onClose={onClose}
      >
        <div className="read-only-record">
          <p>{task.description || "No description provided."}</p>
          <dl>
            <dt>Status</dt>
            <dd>{task.status.replaceAll("_", " ")}</dd>
            <dt>Priority</dt>
            <dd>{task.priority}</dd>
            <dt>Due date</dt>
            <dd>{task.dueDate || "No date"}</dd>
            <dt>Owner</dt>
            <dd>{task.assignee || "Unassigned"}</dd>
            <dt>Project</dt>
            <dd>
              {projects.find((p) => p.id === task.projectId)?.name ||
                "No project"}
            </dd>
          </dl>
        </div>
        <div className="dialog-actions">
          <button className="button secondary" onClick={onClose}>
            Close details
          </button>
        </div>
      </Modal>
    );
  return (
    <Modal
      title={task ? "Edit task" : "Create a task"}
      description="Give your next action a home. Only this workspace can access its details."
      onClose={onClose}
      wide
    >
      <form onSubmit={submit} className="record-form">
        <label>
          Task title
          <input
            name="title"
            required
            maxLength={240}
            defaultValue={task?.title}
            autoFocus
            placeholder="What needs to happen?"
          />
        </label>
        <label>
          Description
          <textarea
            name="description"
            rows={3}
            defaultValue={task?.description}
            placeholder="Context, next steps, or a useful reference…"
          />
        </label>
        <div className="form-grid">
          <label>
            Status
            <select aria-label="Status" name="status" defaultValue={task?.status || "todo"}>
              <option value="todo">To do</option>
              <option value="in_progress">In progress</option>
              <option value="blocked">Blocked</option>
              <option value="done">Done</option>
            </select>
          </label>
          <label>
            Priority
            <select aria-label="Priority" name="priority" defaultValue={task?.priority || "medium"}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>
          <label>
            Due date
            <input
              name="dueDate"
              type="date"
              defaultValue={task?.dueDate?.slice(0, 10) || initialDate || ""}
            />
          </label>
          <label>
            Project
            <select aria-label="Project" name="projectId" defaultValue={task?.projectId || ""}>
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Assignee / follow-up owner
            <input
              name="assignee"
              maxLength={160}
              defaultValue={task?.assignee || ""}
              placeholder="Name or email"
            />
          </label>
          <label>
            Estimate (minutes)
            <input
              type="number"
              min={0}
              max={100000}
              name="estimatedMinutes"
              defaultValue={task?.estimatedMinutes || 0}
            />
          </label>
          <label>
            Tags
            <input
              name="tags"
              defaultValue={task?.tags.join(", ")}
              placeholder="strategy, follow-up"
            />
          </label>
          <label>
            Category
            <select aria-label="Category" name="category" defaultValue={task?.category || "general"}>
              <option value="general">General</option>
              <option value="freelance">Freelancing</option>
              <option value="volunteer">Volunteering</option>
            </select>
          </label>
        </div>
        <label className="checkbox-label">
          <input
            type="checkbox"
            name="important"
            defaultChecked={task?.important}
          />
          Strategically important
        </label>
        {tasks.filter((t) => t.id !== task?.id).length > 0 && (
          <fieldset className="dependency-field">
            <legend>Depends on</legend>
            {tasks
              .filter((t) => t.id !== task?.id)
              .map((t) => (
                <label key={t.id} className="checkbox-label">
                  <input
                    type="checkbox"
                    name="dependencies"
                    value={t.id}
                    defaultChecked={task?.dependencies.includes(t.id)}
                  />
                  {t.title}
                </label>
              ))}
          </fieldset>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          {task && (
            <button
              type="button"
              className="button danger ghost"
              onClick={remove}
              disabled={saving}
            >
              <Trash2 size={16} />
              Delete task
            </button>
          )}
          <button className="button secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={saving}>
            {saving ? "Saving…" : task ? "Save changes" : "Create task"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function ProjectForm({
  workspaceId,
  project,
  onClose,
  onSaved,
  readOnly = false,
}: {
  workspaceId: WorkspaceId;
  project?: Project;
  onClose: () => void;
  onSaved: () => void;
  readOnly?: boolean;
}) {
  const [milestones, setMilestones] = useState<Milestone[]>(
      project?.milestones || [],
    ),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const f = new FormData(e.currentTarget);
    try {
      await api(project ? `/api/projects/${project.id}` : "/api/projects", {
        method: project ? "PATCH" : "POST",
        body: JSON.stringify({
          ...(!project ? { workspaceId } : {}),
          name: f.get("name"),
          description: f.get("description"),
          status: f.get("status"),
          dueDate: f.get("dueDate") || null,
          category: f.get("category"),
          milestones,
        }),
      });
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function remove() {
    if (
      !confirm(
        "Delete this project? Its tasks will be retained without a project.",
      )
    )
      return;
    try {
      await api(`/api/projects/${project!.id}`, { method: "DELETE" });
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (readOnly && project)
    return (
      <Modal
        title={project.name}
        description="Read-only workspace access"
        onClose={onClose}
      >
        <div className="read-only-record">
          <p>{project.description || "No objective provided."}</p>
          <dl>
            <dt>Status</dt>
            <dd>{project.status.replaceAll("_", " ")}</dd>
            <dt>Target date</dt>
            <dd>{project.dueDate || "No date"}</dd>
          </dl>
          <h3>Milestones</h3>
          {project.milestones.map((m) => (
            <p key={m.id}>
              {m.complete ? "✓" : "○"} {m.title} {m.dueDate || ""}
            </p>
          ))}
        </div>
        <div className="dialog-actions">
          <button className="button secondary" onClick={onClose}>
            Close details
          </button>
        </div>
      </Modal>
    );
  return (
    <Modal
      title={project ? "Edit project" : "Create a project"}
      onClose={onClose}
      wide
    >
      <form className="record-form" onSubmit={submit}>
        <label>
          Project name
          <input
            required
            name="name"
            maxLength={200}
            defaultValue={project?.name}
            placeholder="Name your next chapter"
            autoFocus
          />
        </label>
        <label>
          Objective
          <textarea
            name="description"
            rows={3}
            defaultValue={project?.description}
            placeholder="What does success look like?"
          />
        </label>
        <div className="form-grid">
          <label>
            Status
            <select aria-label="Status" name="status" defaultValue={project?.status || "active"}>
              <option value="active">Active</option>
              <option value="on_hold">On hold</option>
              <option value="completed">Completed</option>
            </select>
          </label>
          <label>
            Target date
            <input
              name="dueDate"
              type="date"
              defaultValue={project?.dueDate?.slice(0, 10) || ""}
            />
          </label>
          <label>
            Category
            <select
              name="category"
              defaultValue={project?.category || "general"}
            >
              <option value="general">General</option>
              <option value="freelance">Freelancing</option>
              <option value="volunteer">Volunteering</option>
            </select>
          </label>
        </div>
        <div className="milestone-heading">
          <strong>Milestones</strong>
          <button
            type="button"
            className="text-button"
            onClick={() =>
              setMilestones([
                ...milestones,
                {
                  id: crypto.randomUUID(),
                  title: "",
                  dueDate: null,
                  complete: false,
                },
              ])
            }
          >
            <Plus size={14} />
            Add milestone
          </button>
        </div>
        {milestones.map((m, i) => (
          <div className="milestone-row" key={m.id}>
            <input
              type="checkbox"
              aria-label={`Complete milestone ${i + 1}`}
              checked={m.complete}
              onChange={(e) =>
                setMilestones(
                  milestones.map((x) =>
                    x.id === m.id ? { ...x, complete: e.target.checked } : x,
                  ),
                )
              }
            />
            <input
              required
              aria-label={`Milestone ${i + 1} title`}
              value={m.title}
              onChange={(e) =>
                setMilestones(
                  milestones.map((x) =>
                    x.id === m.id ? { ...x, title: e.target.value } : x,
                  ),
                )
              }
              placeholder="Milestone title"
            />
            <input
              type="date"
              aria-label={`Milestone ${i + 1} date`}
              value={m.dueDate || ""}
              onChange={(e) =>
                setMilestones(
                  milestones.map((x) =>
                    x.id === m.id
                      ? { ...x, dueDate: e.target.value || null }
                      : x,
                  ),
                )
              }
            />
            <button
              className="icon-button"
              type="button"
              aria-label={`Remove milestone ${i + 1}`}
              onClick={() =>
                setMilestones(milestones.filter((x) => x.id !== m.id))
              }
            >
              <X size={16} />
            </button>
          </div>
        ))}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          {project && (
            <button
              type="button"
              className="button danger ghost"
              onClick={remove}
            >
              <Trash2 size={16} />
              Delete project
            </button>
          )}
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={saving}>
            {saving ? "Saving…" : project ? "Save project" : "Create project"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
