export type WorkspaceId = 'wasl' | 'thv' | 'personal' | 'independent';
export type Role = 'owner' | 'editor' | 'viewer';
export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export interface Workspace { id: WorkspaceId; name: string; role: Role; }
export interface User { id: string; email: string; name: string; }
export interface Task { id: string; workspaceId: WorkspaceId; projectId: string | null; title: string; description: string; status: TaskStatus; priority: Priority; dueDate: string | null; assignee: string; tags: string[]; category: 'general' | 'freelance' | 'volunteer'; estimatedMinutes: number; important: boolean; dependencies: string[]; createdAt: string; updatedAt: string; }
export interface Milestone { id: string; title: string; dueDate: string | null; complete: boolean; }
export interface Project { id: string; workspaceId: WorkspaceId; name: string; description: string; status: 'active' | 'on_hold' | 'completed'; dueDate: string | null; category: 'general' | 'freelance' | 'volunteer'; milestones: Milestone[]; createdAt: string; updatedAt: string; }
export interface SessionState { user: User | null; setupRequired: boolean; workspaces: Workspace[]; authProvider:'local'|'supabase'|'disabled'; authEnabled:boolean; localAuthEnabled:boolean; }
export interface AuditEvent { id:string; workspaceId:string; action:string; entityId:string; createdAt:string; }
