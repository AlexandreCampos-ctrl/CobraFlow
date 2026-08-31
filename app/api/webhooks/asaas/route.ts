import { env } from 'cloudflare:workers';
import { enforceRateLimit } from '../../context';

async function secureEqual(a:string,b:string){const encoder=new TextEncoder(),[da,db]=await Promise.all([crypto.subtle.digest('SHA-256',encoder.encode(a)),crypto.subtle.digest('SHA-256',encoder.encode(b))]);const left=new Uint8Array(da),right=new Uint8Array(db);let difference=0;for(let i=0;i<left.length;i++)difference|=left[i]^right[i];return difference===0}

export async function POST(request:Request){
  try{
    await enforceRateLimit(request,'asaas-webhook',120);
    const length=Number(request.headers.get('content-length')||0);if(length>131072)return new Response('Payload muito grande',{status:413});
    const expected=env.ASAAS_WEBHOOK_TOKEN||'',received=request.headers.get('asaas-access-token')||'';
    if(!expected||!received||!(await secureEqual(received,expected)))return new Response('Não autorizado',{status:401});
    const raw=await request.text();if(raw.length>131072)return new Response('Payload muito grande',{status:413});
    const body=JSON.parse(raw) as {event?:string;payment?:{id?:string;billingType?:string;paymentDate?:string;confirmedDate?:string}};
    const providerId=String(body.payment?.id||'');if(!providerId)return Response.json({ok:true});
    const order=await env.DB.prepare('SELECT id,organization_id,charge_id,status FROM payment_orders WHERE provider=? AND provider_payment_id=?').bind('asaas',providerId).first<{id:string;organization_id:string;charge_id:string;status:string}>();if(!order)return Response.json({ok:true});
    const event=String(body.event||''),status=event.replace('PAYMENT_',''),now=Math.floor(Date.now()/1000);
    if(!['RECEIVED','CONFIRMED'].includes(status)){await env.DB.prepare('UPDATE payment_orders SET status=?,updated_at=? WHERE id=?').bind(status||order.status,now,order.id).run();return Response.json({ok:true});}
    const key=`asaas:${providerId}`,exists=await env.DB.prepare('SELECT id FROM payments WHERE organization_id=? AND idempotency_key=?').bind(order.organization_id,key).first();if(exists)return Response.json({ok:true});
    const charge=await env.DB.prepare('SELECT amount_cents FROM charges WHERE id=? AND organization_id=?').bind(order.charge_id,order.organization_id).first<{amount_cents:number}>();if(!charge)return Response.json({ok:true});
    const id=crypto.randomUUID(),parsed=Date.parse(body.payment?.paymentDate||body.payment?.confirmedDate||''),paidAt=Number.isFinite(parsed)?Math.floor(parsed/1000):now;
    await env.DB.batch([env.DB.prepare('INSERT INTO payments (id,organization_id,charge_id,amount_cents,method,status,provider_reference,idempotency_key,paid_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(id,order.organization_id,order.charge_id,charge.amount_cents,String(body.payment?.billingType||'ONLINE'),'confirmed',providerId,key,paidAt,now,now),env.DB.prepare("UPDATE charges SET status='paid',updated_at=? WHERE id=? AND organization_id=?").bind(now,order.charge_id,order.organization_id),env.DB.prepare('UPDATE payment_orders SET status=?,updated_at=? WHERE id=?').bind(status,now,order.id),env.DB.prepare('INSERT INTO audit_logs (id,organization_id,action,entity_type,entity_id,after_json,created_at) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(),order.organization_id,'payment.webhook_confirmed','payment',id,JSON.stringify({provider:'asaas',providerId,event}),now)]);
    return Response.json({ok:true});
  }catch(error){if(error instanceof Response)return error;console.error(error);return new Response('Erro',{status:500})}
}
