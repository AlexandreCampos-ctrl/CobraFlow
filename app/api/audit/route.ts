import { env } from 'cloudflare:workers';
import { jsonError, requireTenant } from '../context';
export async function GET(){try{const tenant=await requireTenant();const result=await env.DB.prepare(`SELECT a.id,a.action,a.entity_type,a.entity_id,a.after_json,a.created_at,COALESCE(u.name,'Sistema') user_name FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id AND u.organization_id=a.organization_id WHERE a.organization_id=? ORDER BY a.created_at DESC LIMIT 150`).bind(tenant.organizationId).all();return Response.json({events:result.results});}catch(error){return jsonError(error)}}
