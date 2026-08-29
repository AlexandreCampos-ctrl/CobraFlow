import { env } from 'cloudflare:workers';
import { clean, jsonError, requirePermission, requireTenant, type UserRole } from '../context';

const roles:UserRole[]=['admin','finance','supervisor','operator','viewer'];
export async function GET(){try{const tenant=await requireTenant();const [users,invites]=await env.DB.batch([
  env.DB.prepare('SELECT id,name,email,role,status,created_at FROM users WHERE organization_id=? ORDER BY created_at').bind(tenant.organizationId),
  env.DB.prepare("SELECT id,email,role,status,expires_at,created_at FROM team_invites WHERE organization_id=? AND status='pending' ORDER BY created_at DESC").bind(tenant.organizationId),
]);return Response.json({users:users.results,invites:invites.results,currentRole:tenant.role})}catch(error){return jsonError(error)}}

export async function POST(request:Request){try{const tenant=await requireTenant();requirePermission(tenant,'team:manage');const body=await request.json() as Record<string,unknown>,email=clean(body.email,160).toLowerCase(),role=clean(body.role,20) as UserRole;if(!/^\S+@\S+\.\S+$/.test(email)||!roles.includes(role))return Response.json({error:'Convite inválido.'},{status:400});
  const member=await env.DB.prepare('SELECT id FROM users WHERE organization_id=? AND lower(email)=lower(?)').bind(tenant.organizationId,email).first();if(member)return Response.json({error:'Este usuário já faz parte da equipe.'},{status:409});
  const id=crypto.randomUUID(),now=Math.floor(Date.now()/1000),expires=now+604800;
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO team_invites (id,organization_id,email,role,status,invited_by,expires_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(organization_id,email) DO UPDATE SET role=excluded.role,status='pending',invited_by=excluded.invited_by,expires_at=excluded.expires_at,updated_at=excluded.updated_at`).bind(id,tenant.organizationId,email,role,'pending',tenant.userId,expires,now,now),
    env.DB.prepare('INSERT INTO audit_logs (id,organization_id,user_id,action,entity_type,entity_id,after_json,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),tenant.organizationId,tenant.userId,'team.invited','team_invite',id,JSON.stringify({email,role}),now),
  ]);return Response.json({id,email,role},{status:201});
}catch(error){return jsonError(error)}}
