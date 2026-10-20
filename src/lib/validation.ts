import { z } from 'zod';
export const workspaceIdSchema = z.enum(['wasl', 'thv', 'personal', 'independent']);
export const idSchema = z.uuid();
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => { const d = new Date(`${v}T12:00:00Z`); return !isNaN(d.getTime()) && d.toISOString().slice(0,10) === v; }, 'Invalid calendar date').nullable();
const category = z.enum(['general','freelance','volunteer']);
export const taskSchema = z.object({
 workspaceId: workspaceIdSchema,
 projectId: idSchema.nullable().default(null),
 title: z.string().trim().min(1).max(300), description: z.string().max(20000).default(''),
 status: z.enum(['todo','in_progress','blocked','done']).default('todo'),
 priority: z.enum(['low','medium','high','urgent']).default('medium'),
 dueDate: dateSchema.default(null), assignee: z.string().trim().max(200).default(''),
 tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]), category: category.default('general'),
 estimatedMinutes: z.number().int().min(0).max(100000).default(0), important: z.boolean().default(false),
 dependencies: z.array(idSchema).max(100).default([]),
}).strict();
// Zod defaults are intentionally removed before partial updates: omitted fields
// must preserve persisted values rather than resetting to creation defaults.
export const taskPatchSchema = z.object({
 projectId:idSchema.nullable(), title:taskSchema.shape.title,
 description:taskSchema.shape.description.removeDefault(), status:taskSchema.shape.status.removeDefault(),
 priority:taskSchema.shape.priority.removeDefault(), dueDate:dateSchema,
 assignee:taskSchema.shape.assignee.removeDefault(), tags:taskSchema.shape.tags.removeDefault(),
 category, estimatedMinutes:taskSchema.shape.estimatedMinutes.removeDefault(), important:z.boolean(),
 dependencies:taskSchema.shape.dependencies.removeDefault(),
}).partial().strict();
export const projectSchema = z.object({
 workspaceId:workspaceIdSchema, name:z.string().trim().min(1).max(200), description:z.string().max(20000).default(''),
 status:z.enum(['active','on_hold','completed']).default('active'), dueDate:dateSchema.default(null), category:category.default('general'),
 milestones:z.array(z.object({id:z.string().min(1).max(100),title:z.string().trim().min(1).max(200),dueDate:dateSchema,complete:z.boolean()}).strict()).max(100).default([]),
}).strict();
export const projectPatchSchema = z.object({
 name:projectSchema.shape.name, description:projectSchema.shape.description.removeDefault(),
 status:projectSchema.shape.status.removeDefault(), dueDate:dateSchema, category,
 milestones:projectSchema.shape.milestones.removeDefault(),
}).partial().strict();
export const credentialsSchema = z.object({email:z.email().trim().toLowerCase().max(254),password:z.string().min(12).max(200)}).strict();
export const setupSchema = credentialsSchema.extend({name:z.string().trim().min(1).max(120)});
export const memberSchema = setupSchema.extend({workspaceId:workspaceIdSchema,role:z.enum(['owner','editor','viewer'])});
