import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { db, type Database } from './db';
import { requireMembership } from './auth';
import { workspaceIdSchema } from './validation';
import profileSource from '../data/wasl-profile.json';

export interface Citation { title: string; url: string; }
export interface KnowledgeResult {
  id: string; documentId: string; title: string; section: string; content: string;
  sourceUrl: string; sourceType: string; verifiedAt: string; evidence: 'source-fact';
  sourceSha256?: string; contentKind: 'extracted-slide-text' | 'stored-reference';
}

const documentId = 'b9d193a2-4ec9-46c1-b4d5-3996f0136f00';
const sourceTitle = 'WASL Ecosystems — Company Profile, September 2026';
// Raw source text extracted from paragraph/run XML, without summarization.
// Editorial section names are metadata; all content comes directly from the deck.
const profile: [string, string][] = profileSource.slides.map(slide => [slide.section, slide.text]);

const initialized = new WeakMap<Database, Promise<void>>();
export async function ensureKnowledge(database: Database): Promise<void> {
  // Never create tables or ingest reference material into a remote production DB.
  if (process.env.DATABASE_URL) return;
  let pending = initialized.get(database);
  if (!pending) {
    pending = (async () => {
      await database.exec(await readFile(path.join(process.cwd(), 'supabase/migrations/0003_knowledge.sql'), 'utf8'));
      await database.transaction(async tx => {
        const existing = await tx.query('SELECT id FROM knowledge_documents WHERE id=$1', [documentId]);
        if (existing.rows.length) return;
        const url = `/api/knowledge?workspace=wasl&document=${documentId}`;
        await tx.query('INSERT INTO knowledge_documents(id,workspace_id,title,source_url,source_type) VALUES($1,$2,$3,$4,$5)', [documentId, 'wasl', sourceTitle, url, 'user-supplied-company-profile']);
        for (const [section, content] of profile) {
          await tx.query('INSERT INTO knowledge_chunks(id,document_id,workspace_id,section,content) VALUES($1,$2,$3,$4,$5)', [randomUUID(), documentId, 'wasl', section, content]);
        }
      });
    })();
    initialized.set(database, pending);
    pending.catch(() => initialized.delete(database));
  }
  await pending;
}

const stopWords = new Set(['the','a','an','and','or','of','to','for','is','are','what','who','how','does','do','me','tell','about','company','please','in','on','our','my','this','that','من','ما','عن','في','هي','هو','و']);
function tokens(value: string): string[] {
  return [...new Set(value.toLocaleLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? [])].filter(t => !stopWords.has(t)).map(t => t.length > 4 && t.endsWith('s') ? t.slice(0, -1) : t);
}
function safeSourceUrl(url: string, workspace: string, id: string): string {
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  try { if (new URL(url).protocol === 'https:') return url; } catch { /* Fall back to authenticated local source. */ }
  return `/api/knowledge?workspace=${encodeURIComponent(workspace)}&document=${encodeURIComponent(id)}`;
}
export async function searchKnowledge(userId: string, workspaceId: string, query = '', database?: Database): Promise<KnowledgeResult[]> {
  const workspace = workspaceIdSchema.parse(workspaceId);
  const connection = database ?? await db();
  await requireMembership(userId, workspace, false, connection);
  await ensureKnowledge(connection);
  const result = await connection.query<{ id: string; document_id: string; title: string; section: string; content: string; source_url: string; source_type: string; verified_at: string | Date }>(
    'SELECT c.id,c.document_id,d.title,c.section,c.content,d.source_url,d.source_type,c.verified_at FROM knowledge_chunks c JOIN knowledge_documents d ON d.id=c.document_id AND d.workspace_id=c.workspace_id WHERE c.workspace_id=$1 ORDER BY c.section,c.id LIMIT 500', [workspace]);
  const terms = tokens(query);
  const scored = result.rows.map(row => {
    const haystack = `${row.section} ${row.content}`.toLocaleLowerCase();
    const heading = row.section.toLocaleLowerCase();
    const score = terms.reduce((n, term) => n + (haystack.includes(term) ? 1 : 0) + (heading.includes(term) ? 2 : 0), 0);
    return { row, score };
  }).filter(item => !terms.length || item.score > 0).sort((a, b) => b.score - a.score ||
    Number(a.row.section.match(/^Slide (\d+)/)?.[1] ?? 99) - Number(b.row.section.match(/^Slide (\d+)/)?.[1] ?? 99));
  return scored.slice(0, query ? 6 : 30).map(({ row }) => ({
    id: row.id, documentId: row.document_id, title: row.title, section: row.section, content: row.content,
    sourceUrl: `${safeSourceUrl(row.source_url, workspace, row.document_id)}#slide-${row.section.match(/^Slide (\d+)/)?.[1] ?? row.id}`,
    sourceType: row.source_type, verifiedAt: new Date(row.verified_at).toISOString(), evidence: 'source-fact',
    ...(row.document_id === documentId ? { sourceSha256: profileSource.sourceSha256 } : {}),
    contentKind: row.document_id === documentId ? 'extracted-slide-text' : 'stored-reference',
  }));
}
