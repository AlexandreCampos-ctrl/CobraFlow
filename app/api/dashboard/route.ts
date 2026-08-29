import { env } from 'cloudflare:workers';
import { jsonError, requireTenant } from '../context';

export async function GET() {
  try {
    const tenant=await requireTenant(), now=Math.floor(Date.now()/1000), monthStart=Math.floor(new Date(new Date().getFullYear(),new Date().getMonth(),1).getTime()/1000);
    const [charges,payments,customers]=await env.DB.batch([
      env.DB.prepare(`SELECT COALESCE(SUM(CASE WHEN c.status NOT IN ('paid','cancelled') THEN c.amount_cents-COALESCE(p.paid,0) ELSE 0 END),0) receivable, COALESCE(SUM(CASE WHEN c.due_date < ? AND c.status NOT IN ('paid','cancelled') THEN c.amount_cents-COALESCE(p.paid,0) ELSE 0 END),0) overdue, COUNT(CASE WHEN c.due_date < ? AND c.status NOT IN ('paid','cancelled') THEN 1 END) overdue_count FROM charges c LEFT JOIN (SELECT charge_id,SUM(amount_cents) paid FROM payments WHERE status='confirmed' GROUP BY charge_id) p ON p.charge_id=c.id WHERE c.organization_id=?`).bind(now,now,tenant.organizationId),
      env.DB.prepare(`SELECT COALESCE(SUM(amount_cents),0) received FROM payments WHERE organization_id=? AND status='confirmed' AND paid_at>=?`).bind(tenant.organizationId,monthStart),
      env.DB.prepare(`SELECT COUNT(*) total FROM customers WHERE organization_id=? AND status='active'`).bind(tenant.organizationId),
    ]);
    return Response.json({...(charges.results?.[0]??{}),...(payments.results?.[0]??{}),customers:(customers.results?.[0] as {total?:number})?.total??0});
  } catch(error){return jsonError(error)}
}
