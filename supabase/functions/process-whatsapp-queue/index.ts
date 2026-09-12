import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
const url=Deno.env.get("SUPABASE_URL")!; const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const token=Deno.env.get("WHATSAPP_ACCESS_TOKEN"); const phoneId=Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
const templateName=Deno.env.get("WHATSAPP_TEMPLATE_NAME"); const templateLanguage=Deno.env.get("WHATSAPP_TEMPLATE_LANGUAGE") || "en_US";
const normalize=(raw:string)=>{ const d=raw.replace(/\D/g,""); if(d.startsWith("27")) return d; if(d.startsWith("0")) return `27${d.slice(1)}`; return d; };
Deno.serve(async(req)=>{
  if(req.method!=="POST") return new Response("Method not allowed",{status:405});
  if(!token||!phoneId) return new Response(JSON.stringify({error:"WhatsApp Cloud API secrets are not configured"}),{status:503,headers:{"content-type":"application/json"}});
  const sb=createClient(url,key,{auth:{persistSession:false}});
  const {data:rows,error}=await sb.from("whatsapp_notification_outbox").select("*").eq("status","pending").lt("attempts",5).order("created_at").limit(25);
  if(error) return new Response(JSON.stringify({error:error.message}),{status:500});
  let sent=0,failed=0;
  for(const row of rows??[]){
    try{
      const res=await fetch(`https://graph.facebook.com/v22.0/${phoneId}/messages`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify(templateName ? {messaging_product:"whatsapp",recipient_type:"individual",to:normalize(row.recipient),type:"template",template:{name:templateName,language:{code:templateLanguage},components:[{type:"body",parameters:[{type:"text",text:row.message}]}]}} : {messaging_product:"whatsapp",recipient_type:"individual",to:normalize(row.recipient),type:"text",text:{preview_url:false,body:row.message}})});
      const body=await res.text();
      if(!res.ok) throw new Error(body);
      await sb.from("whatsapp_notification_outbox").update({status:"sent",sent_at:new Date().toISOString(),attempts:row.attempts+1,last_error:null}).eq("id",row.id); sent++;
    }catch(e){ await sb.from("whatsapp_notification_outbox").update({status:row.attempts+1>=5?"failed":"pending",attempts:row.attempts+1,last_error:String(e).slice(0,1000)}).eq("id",row.id); failed++; }
  }
  return new Response(JSON.stringify({processed:(rows??[]).length,sent,failed}),{headers:{"content-type":"application/json"}});
});
