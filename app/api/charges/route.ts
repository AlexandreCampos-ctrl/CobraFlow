import { env } from 'cloudflare:workers';
import { clean, jsonError, requirePermission, requireTenant } from '../context';

export async function GET() {
  try {
    const tenant = await requireTenant();
    const result = await env.DB.prepare(`SELECT c.id,c.number,c.description,c.amount_cents,c.due_date,c.status,c.payment_method,c.public_token,cu.name customer_name,COALESCE(SUM(p.amount_cents),0) paid_cents
      FROM charges c JOIN customers cu ON cu.id=c.customer_id AND cu.organization_id=c.organization_id
      LEFT JOIN payments p ON p.charge_id=c.id AND p.organization_id=c.organization_id AND p.status='confirmed'
      WHERE c.organization_id=? GROUP BY c.id ORDER BY c.due_date ASC LIMIT 100`).bind(tenant.organizationId).all();
    return Response.json({ charges: result.results });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    const tenant = await requireTenant();
    requirePermission(tenant,'charge:write');
    const body = await request.json() as Record<string, unknown>;
    const customerId = clean(body.customerId, 50), description = clean(body.description, 180), method = clean(body.paymentMethod, 30) || 'PIX';
    const amountCents = Number(body.amountCents), due = clean(body.dueDate, 10), idempotencyKey = clean(request.headers.get('idempotency-key'), 80) || crypto.randomUUID();
    if (!customerId || description.length < 2 || !Number.isInteger(amountCents) || amountCents < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(due)) return Response.json({error:'Dados da cobrança inválidos.'},{status:400});
    const owns = await env.DB.prepare('SELECT id FROM customers WHERE id=? AND organization_id=? AND status=?').bind(customerId, tenant.organizationId, 'active').first();
    if (!owns) return Response.json({error:'Cliente não encontrado.'},{status:404});
    const duplicate = await env.DB.prepare('SELECT id,number FROM charges WHERE organization_id=? AND idempotency_key=?').bind(tenant.organizationId,idempotencyKey).first();
    if (duplicate) return Response.json(duplicate);
    const now = Math.floor(Date.now()/1000), id=crypto.randomUUID(), number=`COB-${String(Date.now()).slice(-7)}`, dueDate=Math.floor(new Date(`${due}T12:00:00Z`).getTime()/1000),publicToken=crypto.randomUUID().replaceAll('-','');
    await env.DB.batch([
      env.DB.prepare('INSERT INTO charges (id,organization_id,customer_id,number,description,amount_cents,due_date,status,payment_method,idempotency_key,public_token,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,tenant.organizationId,customerId,number,description,amountCents,dueDate,'pending',method,idempotencyKey,publicToken,now,now),
      env.DB.prepare('INSERT INTO audit_logs (id,organization_id,user_id,action,entity_type,entity_id,after_json,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),tenant.organizationId,tenant.userId,'charge.created','charge',id,JSON.stringify({number,amountCents,due,method}),now),
    ]);
    return Response.json({id,number,paymentPath:`/pagar/${publicToken}`},{status:201});
  } catch(error) { return jsonError(error); }
}
