import { env } from 'cloudflare:workers';
import { clean, jsonError, requirePermission, requireTenant } from '../../context';

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  try{const tenant=await requireTenant();requirePermission(tenant,'charge:write');const {id}=await params,body=await request.json() as Record<string,unknown>,status=clean(body.status,20),action=clean(body.action,30);
    const current=await env.DB.prepare('SELECT id,status,number,public_token FROM charges WHERE id=? AND organization_id=?').bind(id,tenant.organizationId).first<{id:string;status:string;number:string;public_token:string|null}>();
    if(!current)return Response.json({error:'Cobrança não encontrada.'},{status:404});
    if(action==='create_payment_link'){const token=current.public_token||crypto.randomUUID().replaceAll('-','');if(!current.public_token)await env.DB.prepare('UPDATE charges SET public_token=?,updated_at=? WHERE id=? AND organization_id=?').bind(token,Math.floor(Date.now()/1000),id,tenant.organizationId).run();return Response.json({paymentPath:`/pagar/${token}`})}
    if(status!=='cancelled')return Response.json({error:'Transição de status não permitida.'},{status:400});
    if(current.status==='paid')return Response.json({error:'Uma cobrança paga não pode ser cancelada.'},{status:409});
    const now=Math.floor(Date.now()/1000);
    await env.DB.batch([
      env.DB.prepare('UPDATE charges SET status=?,updated_at=? WHERE id=? AND organization_id=?').bind(status,now,id,tenant.organizationId),
      env.DB.prepare('INSERT INTO audit_logs (id,organization_id,user_id,action,entity_type,entity_id,before_json,after_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),tenant.organizationId,tenant.userId,'charge.cancelled','charge',id,JSON.stringify(current),JSON.stringify({status}),now),
    ]);return Response.json({id,status});
  }catch(error){return jsonError(error)}}
