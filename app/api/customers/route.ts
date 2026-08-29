import { env } from 'cloudflare:workers';
import { clean, jsonError, requirePermission, requireTenant } from '../context';

export async function GET() {
  try {
    const tenant = await requireTenant();
    const result = await env.DB.prepare('SELECT id,type,name,document,email,phone,status,created_at FROM customers WHERE organization_id = ? AND status != ? ORDER BY name LIMIT 100').bind(tenant.organizationId, 'archived').all();
    return Response.json({ customers: result.results });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    const tenant = await requireTenant();
    requirePermission(tenant,'customer:write');
    const body = await request.json() as Record<string, unknown>;
    const name = clean(body.name, 120), type = clean(body.type, 2) || 'PJ';
    if (name.length < 2 || !['PF','PJ'].includes(type)) return Response.json({ error: 'Informe um cliente válido.' }, { status: 400 });
    const now = Math.floor(Date.now() / 1000), id = crypto.randomUUID();
    const document = clean(body.document, 20) || null, email = clean(body.email, 160) || null, phone = clean(body.phone, 30) || null;
    await env.DB.batch([
      env.DB.prepare('INSERT INTO customers (id,organization_id,type,name,document,email,phone,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(id, tenant.organizationId, type, name, document, email, phone, 'active', now, now),
      env.DB.prepare('INSERT INTO audit_logs (id,organization_id,user_id,action,entity_type,entity_id,after_json,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), tenant.organizationId, tenant.userId, 'customer.created', 'customer', id, JSON.stringify({name,type,document}), now),
    ]);
    return Response.json({ id, name }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
