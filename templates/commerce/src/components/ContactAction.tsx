import { Copy, Download } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useCommerce } from '../lib/store';
import { Button, Modal, Textarea } from './ui';

export function ContactAction({ message = 'Halo, saya ingin bertanya tentang produk di toko ini.', children, className = '' }: { message?: string; children: ReactNode; className?: string }) {
  const { data, notify } = useCommerce(); const [open, setOpen] = useState(false); const phone = data?.config.brand.whatsapp.replace(/\D/g, '');
  const copy = () => { void navigator.clipboard.writeText(message).then(() => notify('Contoh pesan disalin.')).catch(() => notify('Pilih dan salin teks dari kolom pesan.', 'error')); };
  const download = () => { const url = URL.createObjectURL(new Blob([message], { type: 'text/plain;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = 'contoh-pesan-belanja.txt'; a.click(); URL.revokeObjectURL(url); };
  if (data && !data.demo && phone) return <a className={className} href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">{children}</a>;
  return <><button type="button" className={className} onClick={() => setOpen(true)}>{children}</button><Modal open={open} onClose={() => setOpen(false)} title={data?.demo ? 'Contoh pesan WhatsApp' : 'Kontak toko'} description={data?.demo ? 'Lihat pesan yang akan diterima toko. Demo ini tidak mengirim pesan ke nomor mana pun.' : 'Nomor WhatsApp toko belum diatur.'}><div className="dialog-form"><Textarea aria-label="Contoh pesan belanja" readOnly rows={9} value={message} /><div className="dialog-actions"><Button variant="secondary" onClick={download}><Download size={16} />Unduh pesan</Button><Button onClick={copy}><Copy size={16} />Salin pesan</Button></div></div></Modal></>;
}
