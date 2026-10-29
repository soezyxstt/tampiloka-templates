import type { LoyaltySummary, StoreConfig } from '../src/shared/contracts.ts';
import type { Env, Row, Session } from './types.ts';
import { configFor, q } from './db.ts';
import { capabilities, digest, fail, id, now, rateLimit, requireFeature, safeEqual, text } from './security.ts';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function memberRequired(config: StoreConfig) { requireFeature(capabilities(config),'customerAccounts'); }
const mail = (value: unknown) => {
  const email=text(value,'Email',150,true).toLowerCase();
  if (!EMAIL.test(email)) fail(422,'INVALID_EMAIL','Masukkan alamat email yang valid.');
  return email;
};
export async function memberSummary(env: Env, session: Session, config: StoreConfig): Promise<LoyaltySummary | null> {
  if (!capabilities(config).customerAccounts || !session.memberId) return null;
  const account=await q(env,'SELECT * FROM members WHERE scope=? AND id=?',session.scope,session.memberId).first<Row>();
  if (!account) return null;
  const {silverSpendIdr=1_000_000,goldSpendIdr=5_000_000}=config.loyalty||{};
  const tier=capabilities(config).membershipTiers ? (account.completed_spend>=goldSpendIdr?'Gold':account.completed_spend>=silverSpendIdr?'Silver':'Member') : 'Member';
  return {id:account.id,email:account.email,name:account.name,points:account.points_balance,tier,completedSpend:account.completed_spend,verificationRequired:false};
}
export async function beginMemberLogin(request: Request, env: Env, session: Session, input: Row) {
  const config=await configFor(env,session);memberRequired(config);
  const email=mail(input.email);
  const name=text(input.name,'Nama',100)||email.split('@')[0];
  const ip=request.headers.get('CF-Connecting-IP')||'local';
  await rateLimit(env,'otp-email:'+await digest(session.scope+email),4,3600);
  await rateLimit(env,'otp-ip:'+await digest(ip),16,3600);
  if(!session.demo && (!env.RESEND_API_KEY || !env.MEMBER_EMAIL_FROM)) fail(503,'EMAIL_NOT_CONFIGURED','Verifikasi member belum tersedia. Hubungi toko.');
  const code=String(new DataView(crypto.getRandomValues(new Uint8Array(4)).buffer).getUint32(0)%1_000_000).padStart(6,'0');
  const nonce=id();
  const hash=await digest(session.scope+':'+session.tokenHash+':'+nonce+':'+code);
  const expires=new Date(Date.now()+10*60_000).toISOString();
  await q(env,'INSERT INTO member_challenges(scope,session_id,email,name,code_hash,expires_at,tries) VALUES(?,?,?,?,?,?,0) ON CONFLICT(scope,session_id) DO UPDATE SET email=excluded.email,name=excluded.name,code_hash=excluded.code_hash,expires_at=excluded.expires_at,tries=0',session.scope,session.tokenHash,email,name,nonce+':'+hash,expires).run();
  if (!session.demo) {
    let success=false;
    try {
      const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','User-Agent':'TampilokaCommerce/1.0'},body:JSON.stringify({from:env.MEMBER_EMAIL_FROM,to:[email],subject:'Kode masuk member '+config.brand.name,text:'Kode verifikasi Anda: '+code+'. Berlaku selama 10 menit. Jangan berikan kode ini kepada siapa pun.'})});
      success=response.ok;
    } catch { /* Fail closed; do not leak provider details. */ }
    if(!success) {
      await q(env,'DELETE FROM member_challenges WHERE scope=? AND session_id=? AND code_hash=?',session.scope,session.tokenHash,nonce+':'+hash).run();
      fail(503,'EMAIL_UNAVAILABLE','Kode verifikasi belum dapat dikirim. Coba lagi nanti.');
    }
  }
  return session.demo?{sent:true,demoCode:code,expiresInSeconds:600}:{sent:true,expiresInSeconds:600};
}
export async function verifyMemberLogin(env: Env, session: Session, input: Row) {
  const config=await configFor(env,session);memberRequired(config);
  const code=text(input.code,'Kode verifikasi',6,true);
  if (!/^\d{6}$/.test(code)) fail(422,'INVALID_OTP','Kode harus berupa enam angka.');
  const row=await q(env,'SELECT * FROM member_challenges WHERE scope=? AND session_id=?',session.scope,session.tokenHash).first<Row>();
  if(!row || row.expires_at<=now() || row.tries>=5) fail(400,'OTP_EXPIRED','Kode tidak berlaku. Minta kode baru.');
  const [nonce,hash]=String(row.code_hash).split(':');
  const actual=await digest(session.scope+':'+session.tokenHash+':'+nonce+':'+code);
  const good=safeEqual(actual,hash);
  const attempt=await q(env,'UPDATE member_challenges SET tries=tries+1 WHERE scope=? AND session_id=? AND code_hash=? AND tries<5',session.scope,session.tokenHash,row.code_hash).run();
  if(!attempt.meta?.changes)fail(400,'OTP_EXPIRED','Kode tidak berlaku. Minta kode baru.');
  if(!good)fail(422,'INVALID_OTP','Kode verifikasi salah.');
  // The verified email, not a client-submitted member id, selects the account.
  const newId='mem_'+id();
  await q(env,'INSERT OR IGNORE INTO members(scope,id,email,name,created_at) VALUES(?,?,?,?,?)',session.scope,newId,row.email,row.name,now()).run();
  const account=await q(env,'SELECT id FROM members WHERE scope=? AND email=?',session.scope,row.email).first<{id:string}>();
  if(!account)fail(500,'ACCOUNT_FAILED','Akun member belum dapat dibuka.');
  const changed=await q(env,'DELETE FROM member_challenges WHERE scope=? AND session_id=? AND code_hash=?',session.scope,session.tokenHash,row.code_hash).run();
  if(!changed.meta?.changes)fail(409,'OTP_USED','Kode sudah dipakai.');
  await q(env,'UPDATE sessions SET member_id=? WHERE token_hash=? AND scope=?',account.id,session.tokenHash,session.scope).run();
  session.memberId=account.id;
  return memberSummary(env,session,config);
}
export async function signOutMember(env: Env,session: Session) {
  await q(env,'UPDATE sessions SET member_id=NULL WHERE token_hash=? AND scope=?',session.tokenHash,session.scope).run();
  session.memberId=null;
  return {signedOut:true};
}
