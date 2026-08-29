import { env } from 'cloudflare:workers';
import { clean, jsonError, requirePermission, requireTenant } from '../../context';

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  try{const tenant=await requireTenant();requirePermission(tenant,'customer:write');const {id}=await params,body=await request.json() as Record<string,unknown>;
    const current=await env.DB.prepare('SELECT id,name,type,document,email,phone,status FROM customers WHERE id=? AND organization_id=?').bind(id,tenant.organizationId).first();
    if(!current)return Response.json({error:'Cliente não encontrado.'},{status:404});
    const name=clean(body.name,120),type=clean(body.type,2),document=clean(body.document,20)||null,email=clean(body.email,160)||null,phone=clean(body.phone,30)||null;
    if(name.length<2||!['PF','PJ'].includes(type))return Response.json({error:'Dados inválidos.'},{status:400});
    const now=Math.floor(Date.now()/1000);
    await env.DB.batch([
      env.DB.prepare('UPDATE customers SET name=?,type=?,document=?,email=?,phone=?,updated_at=? WHERE id=? AND organization_id=?').bind(name,type,document,email,phone,now,id,tenant.organizationId),
      env.DB.prepare('INSERT INTO audit_logs (id,organization_id,user_id,action,entity_type,entity_id,before_json,after_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),tenant.organizationId,tenant.userId,'customer.updated','customer',id,JSON.stringify(current),JSON.stringify({name,type,document,email,phone}),now),
    ]);return Response.json({id,name});
  }catch(error){return jsonError(error)}}

export async function DELETE(_:Request,{params}:{params:Promise<{id:string}>}){
  try{const tenant=await requireTenant();requirePermission(tenant,'customer:write');const {id}=await params,now=Math.floor(Date.now()/1000);
    const open=await env.DB.prepare("SELECT COUNT(*) total FROM charges WHERE customer_id=? AND organization_id=? AND status NOT IN ('paid','cancelled')").bind(id,tenant.organizationId).first<{total:number}>();
    if((open?.total??0)>0)return Response.json({error:'Arquive as cobranças abertas antes de arquivar o cliente.'},{status:409});
    const result=await env.DB.prepare("UPDATE customers SET status='archived',updated_at=? WHERE id=? AND organization_id=? AND status='active'").bind(now,id,tenant.organizationId).run();
    if(!result.meta.changes)return Response.json({error:'Cliente não encontrado.'},{status:404});
    await env.DB.prepare('INSERT INTO audit_logs (id,organization_id,user_id,action,entity_type,entity_id,created_at) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(),tenant.organizationId,tenant.userId,'customer.archived','customer',id,now).run();
    return Response.json({ok:true});
  }catch(error){return jsonError(error)}}
