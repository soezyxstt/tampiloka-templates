import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { useCommerce } from '../lib/store';
import { Button, Field, InlineError, Input } from './ui';
import { money } from '../lib/format';

export function MemberAccess() {
  const {data,refresh,notify}=useCommerce();
  const [email,setEmail]=useState('');
  const [name,setName]=useState('');
  const [code,setCode]=useState('');
  const [demoCode,setDemoCode]=useState('');
  const [step,setStep]=useState<'email'|'code'>('email');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  if(!data?.capabilities.customerAccounts)return null;
  const member=data.loyalty;
  if(member)return <section className="form-section">
    <h2>Member {data.config.brand.name}</h2>
    <div className="form-grid">
      <div><strong>{member.name}</strong><p className="help-text">{member.email}</p></div>
      <div><strong>{member.tier}</strong><p className="help-text">{member.points.toLocaleString('id-ID')} poin · Total belanja {money(member.completedSpend)}</p></div>
    </div>
    <Button variant="quiet" compact onClick={async()=>{try{await api.memberLogout();await refresh();notify('Keluar dari akun member.');}catch(e){setError(e instanceof Error?e.message:'Gagal keluar.');}}}>Keluar dari member</Button>
    <InlineError>{error}</InlineError>
  </section>;
  const start=async(event:FormEvent)=>{
    event.preventDefault();setBusy(true);setError('');
    try{const response=await api.memberStart({email,name});setDemoCode(response.demoCode||'');setStep('code');}
    catch(e){setError(e instanceof Error?e.message:'Kode belum dapat dikirim.');}finally{setBusy(false);}
  };
  const verify=async(event:FormEvent)=>{
    event.preventDefault();setBusy(true);setError('');
    try{await api.memberVerify({code});await refresh();notify('Akun member terverifikasi.');}
    catch(e){setError(e instanceof Error?e.message:'Kode verifikasi tidak benar.');}finally{setBusy(false);}
  };
  return <section className="form-section">
    <h2>Member dan poin</h2>
    <p className="help-text">Masuk menggunakan kode yang dikirim ke email untuk mengumpulkan dan menukar poin.</p>
    {step==='email'?<form onSubmit={start} className="form-grid">
      <Field label="Email member"><Input type="email" required autoComplete="email" value={email} onChange={event=>setEmail(event.target.value)} /></Field>
      <Field label="Nama"><Input autoComplete="name" value={name} onChange={event=>setName(event.target.value)} /></Field>
      <Button type="submit" loading={busy}>Kirim kode</Button>
    </form>:<form onSubmit={verify} className="form-grid">
      <Field label="Kode 6 digit"><Input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event=>setCode(event.target.value)} /></Field>
      {data.demo&&<p className="help-text">Kode khusus demo: <strong>{demoCode}</strong>. Tidak ada email sungguhan yang dikirim.</p>}
      <div><Button type="submit" loading={busy}>Verifikasi</Button><Button variant="quiet" onClick={()=>setStep('email')}>Ubah email</Button></div>
    </form>}
    <InlineError>{error}</InlineError>
  </section>;
}
