import { env } from 'cloudflare:workers';
import { clean, jsonError, requirePermission, requireTenant } from '../context';

export async function GET(){try{const tenant=await requireTenant();const result=await env.DB.prepare(`SELECT p.id,p.amount_cents,p.method,p.status,p.paid_at,c.number,cu.name customer_name FROM payments p JOIN charges c ON c.id=p.charge_id AND c.organization_id=p.organization_id JOIN customers cu ON cu.id=c.customer_id AND cu.organization_id=p.organization_id WHERE p.organization_id=? ORDER BY p.created_at DESC LIMIT 50`).bind(tenant.organizationId).all();return Response.json({payments:result.results})}catch(error){return jsonError(error)}}

export async function POST(request:Request){try{const tenant=await requireTenant();requirePermission(tenant,'payment:write');const body=await request.json() as Record<string,unknown>,chargeId=clean(body.chargeId,50),method=clean(body.method,30)||'PIX',amountCents=Number(body.amountCents),key=clean(request.headers.get('idempotency-key'),80)||crypto.randomUUID();
  if(!chargeId||!Number.isInteger(amountCents)||amountCents<1)return Response.json({error:'Pagamento inválido.'},{status:400});
  const duplicate=await env.DB.prepare('SELECT id FROM payments WHERE organization_id=? AND idempotency_key=?').bind(tenant.organizationId,key).first();if(duplicate)return Response.json(duplicate);
  const charge=await env.DB.prepare("SELECT id,amount_cents,status FROM charges WHERE id=? AND organization_id=? AND status NOT IN ('paid','cancelled')").bind(chargeId,tenant.organizationId).first<{id:string;amount_cents:number;status:string}>();if(!charge)return Response.json({error:'Cobrança não encontrada ou encerrada.'},{status:404});
  const paid=await env.DB.prepare("SELECT COALESCE(SUM(amount_cents),0) total FROM payments WHERE charge_id=? AND organization_id=? AND status='confirmed'").bind(chargeId,tenant.organizationId).first<{total:number}>(),remaining=charge.amount_cents-(paid?.total??0);
  if(amountCents>remaining)return Response.json({error:`O valor máximo para baixa é ${remaining} centavos.`},{status:400});
  const now=Math.floor(Date.now()/1000),id=crypto.randomUUID(),next=amountCents===remaining?'paid':'partially_paid';
  await env.DB.batch([
    env.DB.prepare('INSERT INTO payments (id,organization_id,charge_id,amount_cents,method,status,provider_reference,idempotency_key,paid_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(id,tenant.organizationId,chargeId,amountCents,method,'confirmed',null,key,now,now,now),
    env.DB.prepare('UPDATE charges SET status=?,updated_at=? WHERE id=? AND organization_id=?').bind(next,now,chargeId,tenant.organizationId),
    env.DB.prepare('INSERT INTO audit_logs (id,organization_id,user_id,action,entity_type,entity_id,after_json,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),tenant.organizationId,tenant.userId,'payment.confirmed','payment',id,JSON.stringify({chargeId,amountCents,method,status:next}),now),
  ]);return Response.json({id,status:next},{status:201});
}catch(error){return jsonError(error)}}
