import { randomUUID } from 'node:crypto';
import { db, type Database } from './db';
import { requireMembership } from './auth';
import { workspaceIdSchema } from './validation';
import { ensureKnowledge, searchKnowledge, type Citation } from './knowledge';

export interface AssistantAnswer { answer: string; mode: 'rules-based'; sources: Citation[]; workspaceId: string; actionsTaken: false; }
export interface AssistantMessage { id: string; role: 'user' | 'assistant'; content: string; mode: 'rules-based'; sources: Citation[]; createdAt: string; }
type TaskRow = { id: string; title: string; status: string; priority: string; due_date: string | null; assignee: string; important: boolean; estimated_minutes: number; project_id: string | null; };
type ProjectRow = { id: string; name: string; status: string; due_date: string | null; };

const priorityRank: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
function describe(tasks: TaskRow[], empty: string): string {
  return tasks.length ? tasks.slice(0, 10).map((t, index) => `${index + 1}. ${t.title} — ${t.priority}; ${t.status.replace('_', ' ')}${t.due_date ? `; due ${t.due_date}` : '; no due date'}${t.assignee ? `; assigned to ${t.assignee}` : ''}`).join('\n') : empty;
}
function localDate(now: Date): string { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); }

export async function answerAssistant(userId: string, workspaceId: string, message: string, database?: Database, now = new Date()): Promise<AssistantAnswer> {
  const scope = workspaceIdSchema.parse(workspaceId);
  const connection = database ?? await db();
  await requireMembership(userId, scope, false, connection);
  await ensureKnowledge(connection);
  const text = message.trim();
  if (!text || text.length > 6000) throw new Error('Message must contain 1–6000 characters');
  const query = text.toLocaleLowerCase();
  const today = localDate(now);
  // Both queries require an explicit workspace predicate. Global private context
  // and cross-company search are deliberately unsupported, even for the owner.
  const tasks = (await connection.query<TaskRow>('SELECT id,title,status,priority,due_date,assignee,important,estimated_minutes,project_id FROM tasks WHERE workspace_id=$1 ORDER BY created_at', [scope])).rows;
  const projects = (await connection.query<ProjectRow>('SELECT id,name,status,due_date FROM projects WHERE workspace_id=$1 ORDER BY created_at', [scope])).rows;
  const open = tasks.filter(t => t.status !== 'done');
  const overdue = open.filter(t => t.due_date && t.due_date < today);
  const blocked = open.filter(t => t.status === 'blocked');
  const ranked = [...open].sort((a, b) => {
    const score = (t: TaskRow) => (t.due_date && t.due_date < today ? 10 : 0) + (t.due_date === today ? 6 : 0) + (priorityRank[t.priority] ?? 0) + (t.important ? 3 : 0) - (t.status === 'blocked' ? 2 : 0);
    return score(b) - score(a) || (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999');
  });
  let answer: string;
  let sources: Citation[] = [];
  const operationalSource = { title: `Persisted ${scope} tasks and projects · ${today} (Cairo)`, url: `/api/tasks?workspace=${scope}` };
  if (/\b(delete|send|publish|deploy|email|invite|transfer|ignore (all|previous)|system prompt|reveal|secret|credential|token|password)\b|احذف|أرسل|انشر|كلمة المرور/.test(query)) {
    answer = 'I do not take external actions, modify records, reveal credentials, or follow instructions embedded in documents. This assistant is read-only and scoped to the selected workspace. Use the task form to review and confirm any task changes.';
  } else if (/\b(create|add|capture|remind|schedule)\b|أنشئ|اضف|أضف/.test(query)) {
    answer = 'Use “New task” to review the title, workspace, priority, and due date, then explicitly save it. I have not created or scheduled anything. I can summarize today’s priorities, overdue work, blockers, project risks, or the weekly status from this workspace’s saved records.';
  } else if (/overdue|behind|late|متأخر/.test(query)) {
    answer = `Overdue work as of ${today} (Africa/Cairo):\n${describe(overdue, 'There are no overdue open tasks in this workspace.')}\nA passed deadline never marks a task complete.`;
    sources = [operationalSource];
  } else if (/waiting|blocked|follow.up|انتظر|عالق|متوقف/.test(query)) {
    answer = `Waiting on others / blocked work:\n${describe(blocked, 'No tasks are explicitly marked blocked in this workspace.')}\nOnly saved blocked statuses are reported; an assignee alone does not establish a blocker.`;
    sources = [operationalSource];
  } else if (/risk|project|مشروع|مخاطر/.test(query)) {
    const atRisk = projects.filter(p => p.status !== 'completed' && ((p.due_date && p.due_date < today) || open.some(t => t.project_id === p.id && (t.status === 'blocked' || (t.due_date && t.due_date < today)))));
    answer = `Project risk signals:\n${atRisk.length ? atRisk.map(p => `• ${p.name}${p.due_date ? ` — due ${p.due_date}` : ''}; overdue deadline or linked overdue/blocked tasks`).join('\n') : 'No overdue project dates or linked blocked/overdue tasks were found.'}\nThese are deterministic signals, not a complete risk assessment; project plans and missing information still need review.`;
    sources = [operationalSource];
  } else if (/weekly|status|brief|report|أسبوع|تقرير/.test(query)) {
    const done = tasks.filter(t => t.status === 'done');
    answer = `Workspace status snapshot — ${today} (Africa/Cairo)\n${open.length} open tasks; ${done.length} completed tasks (all time); ${overdue.length} overdue; ${blocked.length} blocked.\n${projects.filter(p => p.status === 'active').length} active projects.\nSuggested next priorities:\n${describe(ranked.slice(0, 3), 'Add real projects and tasks to generate a useful brief.')}\nThis is a current snapshot, not a historical weekly activity report; no completion timestamps or calendar connection are inferred.`;
    sources = [operationalSource];
  } else if (/today|priorit|urgent|delegate|focus|finish|workload|اليوم|أولو|أهم/.test(query)) {
    answer = `Suggested priorities for ${today} (Africa/Cairo):\n${describe(ranked.slice(0, 3), 'No open tasks are saved in this workspace. Create a task to begin.')}\nRanked by overdue/due-today dates, saved priority, importance, and explicit blockers. This is a rules-based suggestion; no strategic impact or availability is inferred.`;
    sources = [operationalSource];
  } else {
    const knowledge = await searchKnowledge(userId, scope, text, connection);
    if (knowledge.length) {
      const selected = knowledge.slice(0, 3);
      answer = `Source text from this workspace’s authorized knowledge:\n\n${selected.map((entry, index) => `[${index + 1}] ${entry.section}\n${entry.content}`).join('\n\n')}\n\nSource context: the company-profile text is extracted directly from the supplied September 2026 slides, with paragraph whitespace normalized. Section labels are editorial metadata. This is not newly verified live research. Program concepts and intended outcomes do not establish live cohorts, measured achievements, current partnerships, funding availability, or data-sharing permission. Missing operating status, budgets, achievements, and private company facts are not inferred.`;
      sources = selected.map(entry => ({ title: `${entry.title} · ${entry.section}`, url: entry.sourceUrl }));
    } else {
      answer = 'I found no matching authorized knowledge in this workspace. I cannot search another workspace’s private documents, even when you own both. I can summarize this workspace’s saved priorities, overdue work, blockers, project risks, or status. This rules-based assistant does not access email, calendar, Google Drive, or an external language model.';
    }
  }
  const result: AssistantAnswer = { answer, mode: 'rules-based', sources, workspaceId: scope, actionsTaken: false };
  await connection.transaction(async tx => {
    await tx.query('INSERT INTO assistant_messages(id,workspace_id,user_id,role,content,sources) VALUES($1,$2,$3,$4,$5,$6::jsonb)', [randomUUID(), scope, userId, 'user', text, '[]']);
    await tx.query('INSERT INTO assistant_messages(id,workspace_id,user_id,role,content,sources) VALUES($1,$2,$3,$4,$5,$6::jsonb)', [randomUUID(), scope, userId, 'assistant', answer, JSON.stringify(sources)]);
  });
  return result;
}

export async function assistantHistory(userId: string, workspaceId: string, database?: Database): Promise<AssistantMessage[]> {
  const scope = workspaceIdSchema.parse(workspaceId);
  const connection = database ?? await db();
  await requireMembership(userId, scope, false, connection);
  await ensureKnowledge(connection);
  const result = await connection.query<{ id: string; role: 'user' | 'assistant'; content: string; mode: 'rules-based'; sources: Citation[]; created_at: string | Date }>('SELECT id,role,content,mode,sources,created_at FROM (SELECT id,role,content,mode,sources,created_at,sequence FROM assistant_messages WHERE workspace_id=$1 AND user_id=$2 ORDER BY sequence DESC LIMIT 100) history ORDER BY sequence', [scope, userId]);
  return result.rows.map(row => ({ id: row.id, role: row.role, content: row.content, mode: row.mode, sources: row.sources, createdAt: new Date(row.created_at).toISOString() }));
}
