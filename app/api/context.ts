import { env } from 'cloudflare:workers';
import { headers } from 'next/headers';
import { getChatGPTUser } from '../chatgpt-auth';

export type UserRole = 'admin'|'finance'|'supervisor'|'operator'|'viewer';
export type TenantContext = { organizationId: string; userId: string; name: string; email: string; role: UserRole };

export async function requireTenant(): Promise<TenantContext> {
  const requestHeaders=await headers(),origin=requestHeaders.get('origin'),host=requestHeaders.get('host'),site=requestHeaders.get('sec-fetch-site');
  if((site&&site!=='same-origin')||(origin&&host&&new URL(origin).host!==host))throw new Response('Origem não permitida',{status:403});
  const identity = await getChatGPTUser();
  if (!identity) throw new Response('Não autenticado', { status: 401 });

  const existing = await env.DB.prepare(
    'SELECT id, organization_id, name, email, role FROM users WHERE external_id = ? AND status = ? LIMIT 1',
  ).bind(identity.userId, 'active').first<{id:string; organization_id:string; name:string; email:string; role:UserRole}>();
  if (existing) return { organizationId: existing.organization_id, userId: existing.id, name: existing.name, email: existing.email, role: existing.role };

  const now = Math.floor(Date.now() / 1000);
  const invite = await env.DB.prepare("SELECT id,organization_id,role FROM team_invites WHERE lower(email)=lower(?) AND status='pending' AND expires_at>? LIMIT 1").bind(identity.email,now).first<{id:string;organization_id:string;role:UserRole}>();
  if(invite){const userId=crypto.randomUUID();await env.DB.batch([
    env.DB.prepare('INSERT INTO users (id,organization_id,external_id,email,name,role,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(userId,invite.organization_id,identity.userId,identity.email,identity.displayName,invite.role,'active',now,now),
    env.DB.prepare("UPDATE team_invites SET status='accepted',updated_at=? WHERE id=?").bind(now,invite.id),
    env.DB.prepare('INSERT INTO audit_logs (id,organization_id,user_id,action,entity_type,entity_id,created_at) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(),invite.organization_id,userId,'team.invite_accepted','user',userId,now),
  ]);return {organizationId:invite.organization_id,userId,name:identity.displayName,email:identity.email,role:invite.role}}

  const organizationId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const companyName = identity.fullName ? `Empresa de ${identity.fullName}` : 'Minha empresa';
  await env.DB.batch([
    env.DB.prepare('INSERT INTO organizations (id,name,status,created_at,updated_at) VALUES (?,?,?,?,?)').bind(organizationId, companyName, 'active', now, now),
    env.DB.prepare('INSERT INTO users (id,organization_id,external_id,email,name,role,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(userId, organizationId, identity.userId, identity.email, identity.displayName, 'admin', 'active', now, now),
  ]);
  return { organizationId, userId, name: identity.displayName, email: identity.email, role: 'admin' };
}

const permissions:Record<string,UserRole[]>={
  'team:manage':['admin'], 'customer:write':['admin','finance','supervisor','operator'],
  'charge:write':['admin','finance','supervisor','operator'], 'payment:write':['admin','finance','supervisor'],
  'settings:write':['admin'], 'reports:read':['admin','finance','supervisor','viewer'],
};
export function requirePermission(context:TenantContext,permission:keyof typeof permissions){if(!permissions[permission].includes(context.role))throw new Response('Sem permissão',{status:403})}

export function jsonError(error: unknown) {
  if (error instanceof Response) return error;
  console.error(error);
  return Response.json({ error: 'Não foi possível concluir a operação.' }, { status: 500 });
}

export function clean(value: unknown, max = 160) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export async function enforceRateLimit(request:Request,scope:string,max:number,windowSeconds=60){
  const ip=request.headers.get('cf-connecting-ip')||'unknown',bytes=new TextEncoder().encode(`${scope}:${ip}`),digest=await crypto.subtle.digest('SHA-256',bytes),fingerprint=Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');
  const now=Math.floor(Date.now()/1000),windowStart=Math.floor(now/windowSeconds)*windowSeconds,key=`${scope}:${fingerprint}`;
  await env.DB.prepare('INSERT INTO rate_limits (key,window_start,count,expires_at) VALUES (?,?,1,?) ON CONFLICT(key,window_start) DO UPDATE SET count=count+1').bind(key,windowStart,windowStart+windowSeconds*2).run();
  const row=await env.DB.prepare('SELECT count FROM rate_limits WHERE key=? AND window_start=?').bind(key,windowStart).first<{count:number}>();
  if((row?.count??1)>max)throw new Response('Muitas tentativas. Aguarde um minuto.',{status:429,headers:{'retry-after':String(windowSeconds)}});
  if(Math.random()<0.02)await env.DB.prepare('DELETE FROM rate_limits WHERE expires_at<?').bind(now).run();
}
