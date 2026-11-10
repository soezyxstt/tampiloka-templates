'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useCafeLanguage } from '@/lib/language';
import { createOrderNotificationTracker, type NewOrderNotice, type OrderNotificationSnapshot } from '@/lib/order-notification-tracker';

type SoundState = 'off' | 'enabling' | 'on' | 'paused' | 'unavailable';
type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

/** Mount once in the staff header. The first staff snapshot establishes a baseline. */
export function OrderNotifications({ snapshot, active = true }: { snapshot?: OrderNotificationSnapshot | null; active?: boolean }) {
  const { language, t } = useCafeLanguage();
  const [sound, setSound] = useState<SoundState>('off');
  const soundRef = useRef<SoundState>('off');
  const contextRef = useRef<AudioContext | null>(null);
  const armed = useRef(false);
  const activeRef = useRef(active);
  const languageRef = useRef(language);
  const tracker = useRef(createOrderNotificationTracker());
  const notifyRef = useRef<(order: NewOrderNotice) => void>(() => {});
  const hiddenOrders = useRef<NewOrderNotice[]>([]);
  const nextSoundAt = useRef(0);
  useEffect(() => {
    activeRef.current = active;
    languageRef.current = language;
    soundRef.current = sound;
  }, [active, language, sound]);

  const play = useCallback(() => {
    const context = contextRef.current;
    if (!armed.current || !context || context.state !== 'running') return;
    const start = Math.max(context.currentTime, nextSoundAt.current);
    nextSoundAt.current = start + 0.35;
    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 740;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.23);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    } catch { setSound('paused'); }
  }, []);

  const toggleSound = useCallback(async () => {
    if (soundRef.current === 'enabling') return;
    if (armed.current && soundRef.current === 'on') {
      armed.current = false;
      const previous = contextRef.current;
      contextRef.current = null;
      if (previous) { previous.onstatechange = null; void previous.close().catch(() => {}); }
      soundRef.current = 'off';
      setSound('off');
      return;
    }
    const Audio = window.AudioContext || (window as AudioWindow).webkitAudioContext;
    if (!Audio) { setSound('unavailable'); return; }
    try {
      // Construct and resume synchronously inside the click handler, before any await.
      let context = contextRef.current;
      if (!context) {
        const created = new Audio();
        created.addEventListener('statechange', () => {
          if (armed.current && contextRef.current === created) setSound(created.state === 'running' ? 'on' : 'paused');
        });
        context = created;
        contextRef.current = created;
      }
      nextSoundAt.current = context.currentTime;
      armed.current = true;
      soundRef.current = 'enabling';
      setSound('enabling');
      const resumed = context.resume();
      // Some browsers leave resume pending if audio cannot be unlocked.
      await Promise.race([resumed, new Promise<void>(resolve => setTimeout(resolve, 2000))]);
      if (contextRef.current === context && armed.current) {
        const state = context.state === 'running' ? 'on' : 'paused';
        soundRef.current = state;
        setSound(state);
        if (state === 'on') play();
      }
    } catch {
      armed.current = false;
      const previous = contextRef.current;
      contextRef.current = null;
      if (previous) { previous.onstatechange = null; void previous.close().catch(() => {}); }
      soundRef.current = 'unavailable';
      setSound('unavailable');
    }
  }, [play]);

  useEffect(() => {
    const announce = (order: NewOrderNotice) => {
      const english = languageRef.current === 'en';
      const table = english && order.tableLabel === 'Bungkus' ? 'Takeaway' : order.tableLabel;
      toast(english ? 'New order' : 'Pesanan baru', {
        description: `${english ? 'Order from' : 'Pesanan dari'} ${order.customerName}${table ? ` · ${table}` : ''}`,
      });
    };
    const notify = (order: NewOrderNotice) => {
      if (!activeRef.current) return;
      play();
      if (document.hidden) hiddenOrders.current.push(order);
      else announce(order);
    };
    notifyRef.current = notify;
    const onOrder = (event: Event) => {
      const order = (event as CustomEvent<NewOrderNotice>).detail;
      if (order && activeRef.current && tracker.current.observeEvent(order)) notify(order);
    };
    const onVisibility = () => {
      if (document.hidden || !hiddenOrders.current.length) return;
      const orders = hiddenOrders.current;
      hiddenOrders.current = [];
      if (!activeRef.current) return;
      const english = languageRef.current === 'en';
      if (orders.length === 1) { announce(orders[0]); return; }
      const preview = orders.slice(0, 3).map(order => {
        const table = english && order.tableLabel === 'Bungkus' ? 'Takeaway' : order.tableLabel;
        return `${order.customerName}${table ? ` (${table})` : ''}`;
      }).join(', ');
      toast(english ? 'New orders' : 'Pesanan baru', {
        description: `${orders.length} ${english ? 'new orders' : 'pesanan baru'}: ${preview}${orders.length > 3 ? '…' : ''}`,
      });
    };
    window.addEventListener('cafe:new-order', onOrder);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      notifyRef.current = () => {};
      window.removeEventListener('cafe:new-order', onOrder);
      document.removeEventListener('visibilitychange', onVisibility);
      armed.current = false;
      const context = contextRef.current;
      contextRef.current = null;
      if (context) { context.onstatechange = null; void context.close().catch(() => {}); }
    };
  }, [play]);

  useEffect(() => {
    if (!active) { hiddenOrders.current = []; tracker.current.deactivate(); return; }
    for (const order of tracker.current.observeSnapshot(snapshot)) notifyRef.current(order);
  }, [active, snapshot]);

  if (!active) return null;
  const label = sound === 'on' ? t('Suara pesanan aktif', 'Order sound on')
    : sound === 'enabling' ? t('Mengaktifkan suara', 'Enabling sound')
      : sound === 'paused' ? t('Suara terjeda — aktifkan lagi', 'Sound paused — enable again')
        : sound === 'unavailable' ? t('Suara tidak tersedia — coba lagi', 'Sound unavailable — try again')
          : t('Suara pesanan nonaktif', 'Order sound off');
  return <Button variant="secondary" aria-pressed={sound === 'on'} disabled={sound === 'enabling'} onClick={() => { void toggleSound(); }}>{label}</Button>;
}
