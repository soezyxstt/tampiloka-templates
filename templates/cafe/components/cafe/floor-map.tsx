'use client';

import { useState } from 'react';
import { useCafeLanguage } from '@/lib/language';
import { Button } from './ui-primitives';
import styles from './floor-map.module.css';

export function tableAvailability(table: any, waitlist: any[] = [], now = Date.now()) {
  if (!table.active || table.physicalState === 'OUT_OF_SERVICE') return 'inactive';
  if (table.physicalState === 'OCCUPIED') return 'occupied';
  if (table.physicalState === 'NEEDS_CLEANING') return 'dirty';
  if (waitlist.some(entry => entry.status === 'CALLED' && entry.heldTableId === table.id && Date.parse(entry.holdExpiresAt) > now)) return 'held';
  return table.physicalState === 'AVAILABLE' ? 'ready' : 'inactive';
}

export function tableAvailabilityLabel(state: string, tr: (id: string, en: string) => string) {
  return ({ ready: tr('Siap diisi', 'Ready to seat'), occupied: tr('Terisi', 'Occupied'), dirty: tr('Perlu dibersihkan', 'Needs cleaning'), held: tr('Untuk antrean', 'Held for waitlist'), inactive: tr('Nonaktif', 'Unavailable') } as Record<string, string>)[state];
}

/** Shared geometry for floor service and editing. Text stays upright as tables rotate. */
export function FloorMap({ room, tables, waitlistEntries = [], selectedTableId, onSelect, now, detailId }: {
  room: any; tables: any[]; waitlistEntries?: any[]; selectedTableId?: string;
  onSelect: (tableId: string) => void; now?: number; detailId?: string;
}) {
  const { t: tr } = useCafeLanguage();
  const [zoom, setZoom] = useState(false);
  const polygon = room?.polygonJson || [];
  const width = Math.max(1000, Number(room?.widthMm) || 0, ...polygon.map((p: any) => p.x));
  const height = Math.max(1000, Number(room?.heightMm) || 0, ...polygon.map((p: any) => p.y));
  const pad = 600;
  // At the minimum canvas width, all labels are at least 12 CSS pixels.
  const textSize = (width + pad * 2) * 12 / 640;
  const counts = tables.reduce((all: Record<string, number>, table) => {
    const state = tableAvailability(table, waitlistEntries, now); all[state] = (all[state] || 0) + 1; return all;
  }, {});
  return <div className={styles.root}>
    <div className={styles.legend} aria-label={tr('Status meja di area ini', 'Table status in this area')}>
      {['ready', 'occupied', 'dirty', 'held', 'inactive'].map(state => <span key={state} data-state={state}><i aria-hidden="true" />{tableAvailabilityLabel(state, tr)} <strong>{counts[state] || 0}</strong></span>)}
    </div>
    <div className={styles.viewport} data-testid="floor-plan-svg-container" tabIndex={0} aria-label={tr('Denah meja, geser untuk melihat seluruh area', 'Floor plan, scroll to see the entire area')}>
      <svg viewBox={`${-pad} ${-pad} ${width + pad * 2} ${height + pad * 2}`} className={styles.map} style={{ minWidth: zoom ? 960 : 640 }} role="group" aria-label={tr(`Denah ruang ${room?.name || ''}`, `Floor plan of ${room?.name || ''}`)}>
        <polygon points={polygon.map((p: any) => `${p.x},${p.y}`).join(' ')} fill="var(--surface)" stroke="var(--border-strong)" strokeWidth={30} />
        {(room?.obstaclesJson || []).map((obstacle: any) => <g key={obstacle.id}>
          <rect x={obstacle.xMm} y={obstacle.yMm} width={obstacle.widthMm} height={obstacle.heightMm} rx={80} fill="var(--surface-muted)" stroke="var(--border-strong)" strokeWidth={20} />
          <text x={obstacle.xMm + obstacle.widthMm / 2} y={obstacle.yMm + obstacle.heightMm / 2} textAnchor="middle" dominantBaseline="middle" fill="var(--muted-foreground)" fontSize={textSize}>{obstacle.label}</text>
        </g>)}
        {tables.map(table => {
          const state = tableAvailability(table, waitlistEntries, now);
          const w = Number(table.widthMm), h = Number(table.heightMm);
          const cx = Number(table.xMm) + w / 2, cy = Number(table.yMm) + h / 2;
          const selected = selectedTableId === table.id;
          const seats = Math.max(0, Math.min(50, Number(table.capacity) || 0));
          const circle = table.shape === 'CIRCLE';
          const seatSize = 220;
          const chairPoints = Array.from({ length: seats }, (_, i) => {
            if (circle) {
              const angle = 2 * Math.PI * i / seats - Math.PI / 2;
              const radius = Math.min(w, h) / 2 + seatSize;
              return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius, rotation: angle * 180 / Math.PI + 90 };
            }
            const topCount = Math.ceil(seats / 2), top = i < topCount;
            const index = top ? i : i - topCount, count = top ? topCount : seats - topCount;
            return { x: Number(table.xMm) + w * (index + 1) / (count + 1), y: top ? Number(table.yMm) - seatSize : Number(table.yMm) + h + seatSize, rotation: 0 };
          });
          // Hit boxes remain at least 44px at minimum zoom, independently of physical size.
          const hitSize = (width + pad * 2) * 44 / 640;
          const radians = Number(table.rotationDeg || 0) * Math.PI / 180;
          const extentY = circle ? Math.min(w, h) / 2 : Math.abs(Math.sin(radians)) * w / 2 + Math.abs(Math.cos(radians)) * h / 2;
          const labelY = cy + extentY + seatSize * 1.5 + textSize * 1.2;
          return <g key={table.id} data-table-id={table.id} data-state={state} className={styles.table} role="button" tabIndex={0} aria-pressed={selected} aria-controls={detailId}
            aria-label={tr(`Meja ${table.label}, ${seats} kursi, ${tableAvailabilityLabel(state, tr)}`, `Table ${table.label}, ${seats} seats, ${tableAvailabilityLabel(state, tr)}`)}
            onClick={() => onSelect(table.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(table.id); } }}>
            <title>{tr(`Meja ${table.label} · ${seats} kursi`, `Table ${table.label} · ${seats} seats`)}</title>
            <rect className={styles.hit} x={cx - Math.max(hitSize, w) / 2} y={cy - Math.max(hitSize, h) / 2} width={Math.max(hitSize, w)} height={Math.max(hitSize, h)} fill="transparent" />
            <g transform={`rotate(${table.rotationDeg || 0} ${cx} ${cy})`} aria-hidden="true" className={styles.furniture}>
              {chairPoints.map((point, i) => <rect key={i} data-chair="" x={point.x - seatSize / 2} y={point.y - seatSize / 2} width={seatSize} height={seatSize} rx={60} transform={`rotate(${point.rotation} ${point.x} ${point.y})`} />)}
              {circle ? <circle cx={cx} cy={cy} r={Math.min(w, h) / 2} className={styles.top} /> : <rect x={table.xMm} y={table.yMm} width={w} height={h} rx={80} className={styles.top} />}
              <rect x={Number(table.xMm) - 100} y={Number(table.yMm) - 100} width={w + 200} height={h + 200} rx={circle ? Math.min(w, h) / 2 : 160} className={styles.selection} />
            </g>
            <g pointerEvents="none" textAnchor="middle" fill="var(--foreground)">
              <text x={cx} y={cy - textSize * .15} fontSize={textSize * 1.2} fontWeight="700">{table.label}</text>
              <text x={cx} y={cy + textSize * 1.15} fontSize={textSize}>{seats} {tr('kursi', 'seats')}</text>
              <text x={cx} y={labelY} fontSize={textSize} className={styles.stateText}>{tableAvailabilityLabel(state, tr)}</text>
              {selected && <text x={cx + w / 2 + textSize * .7} y={cy - extentY} fontSize={textSize * 1.2} fontWeight="700" fill="var(--primary-ink)">✓</text>}
            </g>
          </g>;
        })}
      </svg>
    </div>
    <div className={styles.footer}><Button size="sm" variant="ghost" aria-pressed={zoom} onClick={() => setZoom(value => !value)}>{zoom ? tr('Ukuran normal', 'Normal size') : tr('Perbesar denah', 'Enlarge plan')}</Button></div>
  </div>;
}
