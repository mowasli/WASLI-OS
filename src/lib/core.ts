import { randomUUID } from 'node:crypto';
import { db, type Database } from './db';
import { ApiError, audit, hashPassword, localAuthEnabled, requireMembership } from './auth';
import { idSchema, memberSchema, projectPatchSchema, projectSchema, taskPatchSchema, taskSchema, workspaceIdSchema } from './validation';
import type { Project, Role, Task, User, WorkspaceId } from './types';

const taskFields = `t.id,t.workspace_id AS "workspaceId",t.project_id AS "projectId",t.title,t.description,t.status,t.priority,t.due_date AS "dueDate",t.assignee,t.tags,t.category,t.estimated_minutes AS "estimatedMinutes",t.important,t.created_at::text AS "createdAt",t.updated_at::text AS "updatedAt",COALESCE((SELECT jsonb_agg(d.dependency_id) FROM task_dependencies d WHERE d.task_id=t.id),'[]'::jsonb) AS dependencies`;
const projectFields = `id,workspace_id AS "workspaceId",name,description,status,due_date AS "dueDate",category,milestones,created_at::text AS "createdAt",updated_at::text AS "updatedAt"`;

export async function listTasks(userId:string,workspaceId:string):Promise<Task[]> {
  await requireMembership(userId,workspaceId); return (await (await db()).query<Task>(`SELECT ${taskFields} FROM tasks t WHERE t.workspace_id=$1 ORDER BY t.created_at DESC`,[workspaceId])).rows;
}
export async function listProjects(userId:string,workspaceId:string):Promise<Project[]> {
  await requireMembership(userId,workspaceId); return (await (await db()).query<Project>(`SELECT ${projectFields} FROM projects WHERE workspace_id=$1 ORDER BY created_at DESC`,[workspaceId])).rows;
}
export async function getTask(userId:string,id:string,database?:Database,write=false):Promise<Task> {
  idSchema.parse(id); const tx=database??await db(); const result=await tx.query<Task>(`SELECT ${taskFields} FROM tasks t WHERE t.id=$1`,[id]);
  const task=result.rows[0]; if(!task) throw new ApiError(404,'Task not found'); await requireMembership(userId,task.workspaceId,write,tx); return task;
}
export async function getProject(userId:string,id:string,database?:Database,write=false):Promise<Project> {
  idSchema.parse(id); const tx=database??await db(); const result=await tx.query<Project>(`SELECT ${projectFields} FROM projects WHERE id=$1`,[id]);
  const project=result.rows[0]; if(!project) throw new ApiError(404,'Project not found'); await requireMembership(userId,project.workspaceId,write,tx); return project;
}
async function validateTaskLinks(tx:Database,workspaceId:WorkspaceId,taskId:string,projectId:string|null,dependencies:string[],status:string):Promise<void> {
  if(projectId) {
    const p=await tx.query<{workspace_id:string}>('SELECT workspace_id FROM projects WHERE id=$1',[projectId]);
    if(p.rows[0]?.workspace_id!==workspaceId) throw new ApiError(400,'Project must belong to the same workspace');
  }
  if(new Set(dependencies).size!==dependencies.length) throw new ApiError(400,'Duplicate dependencies are not allowed');
  for(const dependencyId of dependencies) {
    if(dependencyId===taskId) throw new ApiError(400,'A task cannot depend on itself');
    const dep=await tx.query<{workspace_id:string;status:string}>('SELECT workspace_id,status FROM tasks WHERE id=$1',[dependencyId]);
    if(dep.rows[0]?.workspace_id!==workspaceId) throw new ApiError(400,'Dependencies must belong to the same workspace');
    if(status==='done' && dep.rows[0]?.status!=='done') throw new ApiError(409,'Complete the prerequisite tasks before completing this task');
    const cycle=await tx.query('WITH RECURSIVE chain(id) AS (SELECT dependency_id FROM task_dependencies WHERE task_id=$1 UNION SELECT d.dependency_id FROM task_dependencies d JOIN chain c ON d.task_id=c.id) SELECT id FROM chain WHERE id=$2 LIMIT 1',[dependencyId,taskId]);
    if(cycle.rows.length) throw new ApiError(400,'Task dependencies cannot form a cycle');
  }
}
async function saveDependencies(tx:Database,id:string,workspaceId:WorkspaceId,dependencies:string[]):Promise<void> {
  await tx.query('DELETE FROM task_dependencies WHERE task_id=$1',[id]);
  for(const dep of dependencies) await tx.query('INSERT INTO task_dependencies(task_id,dependency_id,workspace_id) VALUES($1,$2,$3)',[id,dep,workspaceId]);
}
export async function createTask(userId:string,input:unknown):Promise<Task> {
  const data=taskSchema.parse(input); await requireMembership(userId,data.workspaceId,true); const id=randomUUID();
  return (await db()).transaction(async tx=>{
    await tx.query('SELECT id FROM workspaces WHERE id=$1 FOR UPDATE',[data.workspaceId]);
    await requireMembership(userId,data.workspaceId,true,tx);
    await validateTaskLinks(tx,data.workspaceId,id,data.projectId,data.dependencies,data.status);
    await tx.query('INSERT INTO tasks(id,workspace_id,project_id,title,description,status,priority,due_date,assignee,tags,category,estimated_minutes,important) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',[id,data.workspaceId,data.projectId,data.title,data.description,data.status,data.priority,data.dueDate,data.assignee,JSON.stringify(data.tags),data.category,data.estimatedMinutes,data.important]);
    await saveDependencies(tx,id,data.workspaceId,data.dependencies); await audit(tx,userId,data.workspaceId,'task.created',id); return getTask(userId,id,tx);
  });
}
export async function updateTask(userId:string,id:string,input:unknown):Promise<Task> {
  const patch=taskPatchSchema.parse(input); if(!Object.keys(patch).length) throw new ApiError(400,'No task changes supplied');
  const existing=await getTask(userId,id,undefined,true);
  return (await db()).transaction(async tx=>{
    await tx.query('SELECT id FROM workspaces WHERE id=$1 FOR UPDATE',[existing.workspaceId]);
    const current=await getTask(userId,id,tx,true); const data={...current,...patch};
    await validateTaskLinks(tx,data.workspaceId,id,data.projectId,data.dependencies,data.status);
    await tx.query('UPDATE tasks SET project_id=$2,title=$3,description=$4,status=$5,priority=$6,due_date=$7,assignee=$8,tags=$9,category=$10,estimated_minutes=$11,important=$12,updated_at=now() WHERE id=$1',[id,data.projectId,data.title,data.description,data.status,data.priority,data.dueDate,data.assignee,JSON.stringify(data.tags),data.category,data.estimatedMinutes,data.important]);
    await saveDependencies(tx,id,data.workspaceId,data.dependencies); await audit(tx,userId,data.workspaceId,'task.updated',id); return getTask(userId,id,tx);
  });
}
export async function deleteTask(userId:string,id:string):Promise<void> {
  const task=await getTask(userId,id,undefined,true);
  await (await db()).transaction(async tx=>{await requireMembership(userId,task.workspaceId,true,tx); await tx.query('DELETE FROM tasks WHERE id=$1',[id]); await audit(tx,userId,task.workspaceId,'task.deleted',id);});
}
function validateMilestones(milestones:Project['milestones']):void { if(new Set(milestones.map(x=>x.id)).size!==milestones.length) throw new ApiError(400,'Milestone IDs must be unique'); }
export async function createProject(userId:string,input:unknown,database?:Database):Promise<Project> {
  const data=projectSchema.parse(input); validateMilestones(data.milestones); const id=randomUUID();
  const write=async(tx:Database):Promise<Project>=>{
    await requireMembership(userId,data.workspaceId,true,tx);
    await tx.query('INSERT INTO projects(id,workspace_id,name,description,status,due_date,category,milestones) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,data.workspaceId,data.name,data.description,data.status,data.dueDate,data.category,JSON.stringify(data.milestones)]);
    await audit(tx,userId,data.workspaceId,'project.created',id); return getProject(userId,id,tx);
  };
  // Composition callers may supply their existing transaction so linked records
  // and the project commit or roll back together; never open a nested transaction.
  return database?write(database):(await db()).transaction(write);
}
export async function updateProject(userId:string,id:string,input:unknown):Promise<Project> {
  const patch=projectPatchSchema.parse(input); if(!Object.keys(patch).length) throw new ApiError(400,'No project changes supplied');
  return (await db()).transaction(async tx=>{
    const current=await getProject(userId,id,tx,true); const data={...current,...patch}; validateMilestones(data.milestones);
    await tx.query('UPDATE projects SET name=$2,description=$3,status=$4,due_date=$5,category=$6,milestones=$7,updated_at=now() WHERE id=$1',[id,data.name,data.description,data.status,data.dueDate,data.category,JSON.stringify(data.milestones)]);
    await audit(tx,userId,data.workspaceId,'project.updated',id); return getProject(userId,id,tx);
  });
}
export async function deleteProject(userId:string,id:string):Promise<void> {
  const project=await getProject(userId,id,undefined,true);
  await (await db()).transaction(async tx=>{
    await requireMembership(userId,project.workspaceId,true,tx); await tx.query('UPDATE tasks SET project_id=null,updated_at=now() WHERE project_id=$1',[id]);
    await tx.query('DELETE FROM projects WHERE id=$1',[id]); await audit(tx,userId,project.workspaceId,'project.deleted',id);
  });
}
export async function dashboard(userId:string):Promise<{tasks:Task[];projects:Project[]}> {
  const database=await db();
  const tasks=(await database.query<Task>(`SELECT t.id,t.workspace_id AS "workspaceId",t.project_id AS "projectId",t.title,'' AS description,t.status,t.priority,t.due_date AS "dueDate",'' AS assignee,'[]'::jsonb AS tags,t.category,t.estimated_minutes AS "estimatedMinutes",t.important,t.created_at::text AS "createdAt",t.updated_at::text AS "updatedAt",'[]'::jsonb AS dependencies FROM tasks t JOIN workspace_memberships m ON m.workspace_id=t.workspace_id WHERE m.user_id=$1 ORDER BY t.created_at DESC`,[userId])).rows;
  const projects=(await database.query<Project>(`SELECT p.id,p.workspace_id AS "workspaceId",p.name,'' AS description,p.status,p.due_date AS "dueDate",p.category,'[]'::jsonb AS milestones,p.created_at::text AS "createdAt",p.updated_at::text AS "updatedAt" FROM projects p JOIN workspace_memberships m ON m.workspace_id=p.workspace_id WHERE m.user_id=$1 ORDER BY p.created_at DESC`,[userId])).rows;
  return {tasks,projects};
}
export async function listMembers(userId:string,workspaceId:string):Promise<(User&{role:Role})[]> {
  const role=await requireMembership(userId,workspaceId); if(role!=='owner') throw new ApiError(403,'Only workspace owners can manage members');
  return (await (await db()).query<User&{role:Role}>('SELECT u.id,u.email,u.name,m.role FROM app_users u JOIN workspace_memberships m ON m.user_id=u.id WHERE m.workspace_id=$1 ORDER BY u.name',[workspaceId])).rows;
}
export async function addMember(userId:string,input:unknown):Promise<User&{role:Role}> {
  if(!localAuthEnabled()) throw new ApiError(503,'Local account provisioning is disabled for production');
  const data=memberSchema.parse(input); if(await requireMembership(userId,data.workspaceId)!=='owner') throw new ApiError(403,'Only workspace owners can manage members');
  const passwordHash=await hashPassword(data.password);
  return (await db()).transaction(async tx=>{
    await tx.query('SELECT id FROM workspaces WHERE id=$1 FOR UPDATE',[data.workspaceId]);
    if(await requireMembership(userId,data.workspaceId,false,tx)!=='owner') throw new ApiError(403,'Only workspace owners can manage members');
    const existing=(await tx.query<User>('SELECT id,email,name FROM app_users WHERE email=$1',[data.email])).rows[0];
    const member=existing??{id:randomUUID(),email:data.email,name:data.name};
    if(!existing) await tx.query('INSERT INTO app_users(id,email,name,password_hash) VALUES($1,$2,$3,$4)',[member.id,member.email,member.name,passwordHash]);
    await tx.query('INSERT INTO workspace_memberships(user_id,workspace_id,role) VALUES($1,$2,$3) ON CONFLICT(user_id,workspace_id) DO NOTHING',[member.id,data.workspaceId,data.role]);
    const role=(await tx.query<{role:Role}>('SELECT role FROM workspace_memberships WHERE user_id=$1 AND workspace_id=$2',[member.id,data.workspaceId])).rows[0].role;
    await audit(tx,userId,data.workspaceId,'member.added',member.id); return {...member,role};
  });
}
export async function changeMember(userId:string,memberId:string,workspaceId:string,role:Role|null):Promise<void> {
  idSchema.parse(memberId); const workspace=workspaceIdSchema.parse(workspaceId);
  if(await requireMembership(userId,workspace)!=='owner') throw new ApiError(403,'Only workspace owners can manage members');
  await (await db()).transaction(async tx=>{
    await tx.query('SELECT id FROM workspaces WHERE id=$1 FOR UPDATE',[workspace]);
    if(await requireMembership(userId,workspace,false,tx)!=='owner') throw new ApiError(403,'Only workspace owners can manage members');
    const current=(await tx.query<{role:Role}>('SELECT role FROM workspace_memberships WHERE user_id=$1 AND workspace_id=$2',[memberId,workspace])).rows[0];
    if(!current) throw new ApiError(404,'Membership not found');
    if(current.role==='owner' && role!=='owner') {
      const owners=(await tx.query<{count:string}>('SELECT count(*)::text AS count FROM workspace_memberships WHERE workspace_id=$1 AND role=\'owner\'',[workspace])).rows[0];
      if(Number(owners.count)<=1) throw new ApiError(409,'A workspace must retain at least one owner');
    }
    if(role) await tx.query('UPDATE workspace_memberships SET role=$3 WHERE user_id=$1 AND workspace_id=$2',[memberId,workspace,role]);
    else await tx.query('DELETE FROM workspace_memberships WHERE user_id=$1 AND workspace_id=$2',[memberId,workspace]);
    await audit(tx,userId,workspace,role?'member.role_changed':'member.removed',memberId);
  });
}
