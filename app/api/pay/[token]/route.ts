import { env } from 'cloudflare:workers';
import { enforceRateLimit } from '../../context';

type ChargeRow={id:string;organization_id:string;customer_id:string;description:string;amount_cents:number;due_date:number;customer_name:string;customer_document:string|null;customer_email:string|null;payment_environment:string};
const base=(mode:string)=>mode==='production'?'https://api.asaas.com/v3':'https://api-sandbox.asaas.com/v3';
async function call(path:string,mode:string,init?:RequestInit){
  const response=await fetch(`${base(mode)}${path}`,{...init,headers:{accept:'application/json','content-type':'application/json','User-Agent':'CobraFlow/1.0','access_token':String(env.ASAAS_API_KEY)}});
  const data=await response.json() as Record<string,unknown>;
  if(!response.ok)throw new Error('Falha no provedor de pagamento');
  return data;
}

export async function GET(request:Request,{params}:{params:Promise<{token:string}>}){
  try{
    await enforceRateLimit(request,'public-payment',10);
    if(!env.ASAAS_API_KEY)return new Response('Integração de pagamento ainda não conectada.',{status:503});
    const {token}=await params;
    if(!/^[a-f0-9]{32}$/.test(token))return new Response('Link inválido.',{status:404});
    const charge=await env.DB.prepare(`SELECT c.id,c.organization_id,c.customer_id,c.description,c.amount_cents,c.due_date,cu.name customer_name,cu.document customer_document,cu.email customer_email,o.payment_environment FROM charges c JOIN customers cu ON cu.id=c.customer_id JOIN organizations o ON o.id=c.organization_id WHERE c.public_token=? AND c.status NOT IN ('paid','cancelled') LIMIT 1`).bind(token).first<ChargeRow>();
    if(!charge)return new Response('Cobrança indisponível.',{status:404});
    const existing=await env.DB.prepare("SELECT invoice_url FROM payment_orders WHERE charge_id=? AND status NOT IN ('RECEIVED','CONFIRMED','REFUNDED','DELETED') ORDER BY created_at DESC LIMIT 1").bind(charge.id).first<{invoice_url:string|null}>();
    if(existing?.invoice_url)return Response.redirect(existing.invoice_url,303);
    let mapping=await env.DB.prepare("SELECT provider_customer_id FROM provider_customers WHERE organization_id=? AND customer_id=? AND provider='asaas'").bind(charge.organization_id,charge.customer_id).first<{provider_customer_id:string}>();
    if(!mapping){
      const created=await call('/customers',charge.payment_environment,{method:'POST',body:JSON.stringify({name:charge.customer_name,cpfCnpj:charge.customer_document||undefined,email:charge.customer_email||undefined,externalReference:charge.customer_id})});
      const providerCustomerId=String(created.id||'');if(!providerCustomerId)throw new Error('Cliente não criado');
      const now=Math.floor(Date.now()/1000);
      await env.DB.prepare('INSERT INTO provider_customers (id,organization_id,customer_id,provider,provider_customer_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(),charge.organization_id,charge.customer_id,'asaas',providerCustomerId,now,now).run();
      mapping={provider_customer_id:providerCustomerId};
    }
    const created=await call('/payments',charge.payment_environment,{method:'POST',body:JSON.stringify({customer:mapping.provider_customer_id,billingType:'UNDEFINED',value:charge.amount_cents/100,dueDate:new Date(charge.due_date*1000).toISOString().slice(0,10),description:charge.description,externalReference:charge.id})});
    const providerId=String(created.id||''),invoiceUrl=String(created.invoiceUrl||'');if(!providerId||!invoiceUrl)throw new Error('Resposta incompleta');
    const now=Math.floor(Date.now()/1000);
    await env.DB.batch([env.DB.prepare('INSERT INTO payment_orders (id,organization_id,charge_id,provider,provider_payment_id,status,billing_type,invoice_url,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),charge.organization_id,charge.id,'asaas',providerId,String(created.status||'PENDING'),String(created.billingType||'UNDEFINED'),invoiceUrl,now,now),env.DB.prepare('INSERT INTO audit_logs (id,organization_id,action,entity_type,entity_id,after_json,created_at) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(),charge.organization_id,'payment_order.created','charge',charge.id,JSON.stringify({provider:'asaas',providerId}),now)]);
    return Response.redirect(invoiceUrl,303);
  }catch(error){if(error instanceof Response)return error;console.error(error);return new Response('Não foi possível iniciar o pagamento.',{status:502})}
}
