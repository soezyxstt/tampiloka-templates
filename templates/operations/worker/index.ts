import { BACKUP_MAX_BYTES } from './backup.ts';
import { passwordHash } from './password.ts';
import rawConfig from '../config/operations.json' with { type: 'json' };
import { validateInstallation } from '../config/validate.ts';
import { DomainError, check, record, str, canonical } from '../src/domain/core.ts';
import type { Env } from './types.ts';
import type { StoreCall } from './store.ts';
export { OperationsStore } from './store.ts';
const config=validateInstallation(rawConfig),encoder=new TextEncoder();
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const json=(v:unknown,status=200,cookie?:string)=>Response.json(v,{status,headers:{...headers,...(cookie?{'Set-Cookie':cookie}:{})}});
const hex=(bytes:ArrayBuffer)=>Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
const unhex=(s:string)=>{check(/^(?:[0-9a-f]{2})+$/i.test(s),'CREDENTIAL_CONFIG','Invalid credential encoding');return Uint8Array.from(s.match(/../g)!,v=>parseInt(v,16));};
const digest=async(s:string)=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(s)));
async function body(r:Request){const limit=new URL(r.url).pathname==='/api/restore'?BACKUP_MAX_BYTES:1024*1024;check(Number(r.headers.get('content-length')??0)<=limit,'BODY_TOO_LARGE',`Request maximum is ${limit} bytes`);const reader=r.body?.getReader();check(reader,'BODY_REQUIRED','JSON body required');const chunks:Uint8Array[]=[];let length=0;while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>limit){await reader.cancel();throw new DomainError(413,'BODY_TOO_LARGE',`Request maximum is ${limit} bytes`);}chunks.push(value);}const merged=new Uint8Array(length);let offset=0;for(const c of chunks){merged.set(c,offset);offset+=c.length;}try{return record(JSON.parse(new TextDecoder().decode(merged)));}catch(e){if(e instanceof DomainError)throw e;throw new DomainError(400,'INVALID_JSON','Invalid JSON object');}}
async function hmac(secret:string,text:string){const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);return {key,signature:await crypto.subtle.sign('HMAC',key,encoder.encode(text))};}
async function credential(env:Env,p:Record<string,unknown>){check(env.OPERATIONS_AUTH,'AUTH_NOT_CONFIGURED','Production credentials have not been provisioned');const users=JSON.parse(env.OPERATIONS_AUTH) as {username:string;userId:string;salt:string;hash:string;iterations:number;kdf:string;passes:number}[];const username=str(p.username);check(typeof p.password==='string'&&p.password.length>0&&p.password.length<=1000,'INVALID_INPUT','Password is required');const password=p.password;const user=users.find(u=>u.username===username);check(!user||user.kdf==='pbkdf2-sha256-chain-v1','CREDENTIAL_CONFIG','Reprovision credentials with Worker-compatible versioned KDF');const salt=user?.salt??'00000000000000000000000000000000';check(unhex(salt).length>=16,'CREDENTIAL_CONFIG','Use at least 16 random salt bytes');const actual=await passwordHash(password,unhex(salt),user?.iterations??100000,user?.passes??3);const expected=unhex(user?.hash??'00'.repeat(32));check(expected.length===32,'CREDENTIAL_CONFIG','Expected a 256-bit credential hash');const comparison=await hmac(crypto.randomUUID(),hex(expected.buffer as ArrayBuffer));const ok=await crypto.subtle.verify('HMAC',comparison.key,comparison.signature,encoder.encode(hex(actual)));return {allowed:!!user&&ok,userId:user?.userId??'owner'};}
export default {
 async scheduled(_event:unknown,env:Env,ctx:{waitUntil(promise:Promise<unknown>):void}) {
 // Cron has no HTTP route and cannot choose another business, preset, or user.
 if(env.BACKUP_ENABLED!=='true')return;
 check(env.DEMO_MODE==='false','BACKUP_REAL_ONLY','Scheduled backups require explicit real installation mode');
 ctx.waitUntil(env.OPERATIONS.getByName(`real:${config.business.id}`).scheduledBackup());
 },
 async fetch(request:Request,env:Env):Promise<Response>{try{
 const url=new URL(request.url);if(!url.pathname.startsWith('/api/'))return env.ASSETS?env.ASSETS.fetch(request):new Response('Not found',{status:404});
 check(['GET','POST'].includes(request.method),'METHOD_NOT_ALLOWED','Method not supported');
 if(request.method==='POST'){check(request.headers.get('Origin')===url.origin,'FORBIDDEN','Same-origin request required');check(request.headers.get('Content-Type')?.split(';')[0]==='application/json','CONTENT_TYPE','Use application/json');}
 check(!request.headers.get('Sec-Fetch-Site')||['same-origin','none'].includes(request.headers.get('Sec-Fetch-Site')!),'FORBIDDEN','Same-origin API access required');
 const demo=env.DEMO_MODE==='true',cookieName=url.protocol==='https:'?'__Host-operations':'operations';
 const cookie=request.headers.get('Cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(`${cookieName}=`))?.slice(cookieName.length+1)??'';
 const pieces=cookie.split('.');const valid=(pieces.length===2||demo&&(pieces.length===3||pieces.length===4&&pieces[3]==='legacy'))&&(demo?/^[0-9a-f-]{36}$/.test(pieces[0]):pieces[0]===config.business.id)&&/^[a-zA-Z0-9_-]{10,100}$/.test(pieces[1]);
 let legacy=demo&&valid&&(pieces.length===2||pieces[3]==='legacy');
 const roomName=(room:string,preset:string)=>demo?`demo:${room}${legacy&&preset===config.preset?'':':'+preset}`:`real:${room}`;
 let room=demo?(valid?pieces[0]:crypto.randomUUID()):config.business.id;const tokenHash=await digest(valid?pieces[1]:'unauthenticated');
 const sourcePreset=pieces[2]??config.preset;check(!demo||['food','retail','supplies'].includes(sourcePreset),'PRESET_INVALID','Invalid demo cookie preset');let preset=sourcePreset as 'food'|'retail'|'supplies';
 const input=request.method==='POST'?await body(request):{};if(demo&&url.pathname==='/api/demo/session'&&input.preset){check(['food','retail','supplies'].includes(String(input.preset)),'PRESET_INVALID','Unknown demo preset');preset=input.preset as typeof preset;}if(demo&&url.pathname==='/api/demo/session'&&input.newSession===true){room=crypto.randomUUID();legacy=false;}const c:StoreCall={action:'',input,tokenHash,demo,preset,csrf:request.headers.get('X-CSRF-Token')??''};
 const endpoint=url.pathname,recoveryScope=await digest(`operations-recovery:${roomName(room,preset)}`);
 const requestedScope=request.headers.get('X-Operations-Scope');if(requestedScope)check(requestedScope===recoveryScope,'RECOVERY_SCOPE_INVALID','Recovery belongs to another installation');
 if(endpoint==='/api/demo/session'&&request.method==='POST'){check(demo,'FORBIDDEN','Demo login is disabled');c.action='login';}
 else if(endpoint==='/api/login'&&request.method==='POST'){check(!demo,'FORBIDDEN','Use demo persona login');c.bucket=await digest(request.headers.get('CF-Connecting-IP')??'local');const limited=await env.OPERATIONS.getByName(roomName(room,preset)).call({...c,action:'login-attempt'});if(limited&&typeof limited==='object'&&'__domainError' in limited){const e=record((limited as Record<string,unknown>).__domainError);throw new DomainError(Number(e.status),String(e.code),String(e.message));}const auth=await credential(env,input);c.action='login';c.loginAllowed=auth.allowed;c.userId=auth.userId;c.bucket=await digest(request.headers.get('CF-Connecting-IP')??'local');}
 else if(endpoint==='/api/session'&&request.method==='GET')c.action='session';
 else if(endpoint==='/api/logout'&&request.method==='POST')c.action='logout';
 else if(endpoint==='/api/state'&&request.method==='GET')c.action='state';
 else if(endpoint==='/api/commands'&&request.method==='POST')c.action='command';
 else if(endpoint.startsWith('/api/commands/')&&request.method==='GET'){c.action='result';c.input={id:decodeURIComponent(endpoint.slice('/api/commands/'.length))};}
 else if(endpoint==='/api/search'&&request.method==='GET'){c.action='search';c.input={q:url.searchParams.get('q')??''};}
 else if(endpoint.startsWith('/api/documents/')&&request.method==='GET'){c.action='document';c.input={id:decodeURIComponent(endpoint.slice('/api/documents/'.length))};}
 else if(endpoint==='/api/report'&&request.method==='GET'){c.action='report';c.input={query:url.searchParams.toString()};}
 else if(endpoint==='/api/backup/status'&&request.method==='GET')c.action='backup-status';
 else if(endpoint==='/api/backup'&&request.method==='GET')c.action='backup';
 else if(endpoint==='/api/restore'&&request.method==='POST'){c.action='restore';check(env.BACKUP_SECRET&&env.BACKUP_SECRET.length>=32,'BACKUP_NOT_CONFIGURED','Configure 32+ character BACKUP_SECRET');const data=record(input.backup),signature=str(input.signature);const signed=await hmac(env.BACKUP_SECRET,canonical(data));check(await crypto.subtle.verify('HMAC',signed.key,unhex(signature),encoder.encode(canonical(data))),'BACKUP_SIGNATURE','Backup integrity check failed');c.input=data;}
 else throw new DomainError(404,'NOT_FOUND','API endpoint not found');
 let newToken='';if(c.action==='login'){newToken=crypto.randomUUID()+crypto.randomUUID();c.newTokenHash=await digest(newToken);c.newCsrf=crypto.randomUUID();}
 if(c.action==='login'&&demo&&valid&&input.newSession!==true&&preset!==sourcePreset){
 const source=env.OPERATIONS.getByName(roomName(room,sourcePreset));const bridge=await source.call({...c,action:'authorize-switch',preset:sourcePreset as typeof preset});
 if(bridge&&typeof bridge==='object'&&'__domainError' in bridge){const e=record((bridge as Record<string,unknown>).__domainError);throw new DomainError(Number(e.status),String(e.code),String(e.message));}check(record(bridge).authorized,'FORBIDDEN','Authenticate source demo before switching');c.loginAllowed=true;
 }
 const stub=env.OPERATIONS.getByName(roomName(room,preset));const result=await stub.call(c);if(result&&typeof result==='object'&&'__domainError' in result){const e=record((result as Record<string,unknown>).__domainError);throw new DomainError(Number(e.status),String(e.code),String(e.message),e.details);}
 if(c.action==='login'){if(record(result).loginFailed)throw new DomainError(401,'LOGIN_FAILED','Invalid login credentials');return json({...record(result),recoveryScope},200,`${cookieName}=${room}.${newToken}${demo?'.'+preset+(legacy&&input.newSession!==true?'.legacy':''):''}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200${url.protocol==='https:'?'; Secure':''}`);}
 if(c.action==='state')return json({...record(result),recoveryScope});
 if(c.action==='session')return json({...record(result),recoveryScope});
 if(c.action==='logout')return json(result,200,`${cookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${url.protocol==='https:'?'; Secure':''}`);
 if(c.action==='backup'){check(env.BACKUP_SECRET&&env.BACKUP_SECRET.length>=32,'BACKUP_NOT_CONFIGURED','Configure 32+ character BACKUP_SECRET');const signed=await hmac(env.BACKUP_SECRET,canonical(result));const envelope={backup:result,signature:hex(signed.signature)};check(encoder.encode(JSON.stringify(envelope)).byteLength<=BACKUP_MAX_BYTES,'BACKUP_TOO_LARGE','Backup exceeds restore body limit');return json(envelope);}
 if((c.action==='command'||c.action==='result')&&record(result).state)return json({...record(result),state:{...record(record(result).state),recoveryScope}});
 if(c.action==='report'&&url.searchParams.get('format')==='csv')return new Response(String(record(result).csv),{headers:{...headers,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="operations-report.csv"'}});
 return json(result);
 }catch(e){if(e instanceof DomainError)return json({error:{code:e.code,message:e.message,details:e.details}},e.status);console.error(JSON.stringify({event:'operations.request.failed',category:'internal'}));return json({error:{code:'INTERNAL_ERROR',message:'Operation could not be confirmed. Check the command identity before retrying.'}},500);}}
};
