'use client';
import { useCafeLanguage } from '@/lib/language';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Button,
  Input,
  Label,
  SelectField,
  StatusLabel,
  InlineError,
} from './ui-primitives';
import { validateTablePlacements, type Point2D } from '@/src/domain/rules';
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Check,
  Save,
  SlidersHorizontal,
} from 'lucide-react';

const PRESET_POLYGONS: Record<'RECTANGLE' | 'L_SHAPE' | 'U_SHAPE', Point2D[]> = {
  RECTANGLE: [
    { x: 0, y: 0 },
    { x: 10000, y: 0 },
    { x: 10000, y: 8000 },
    { x: 0, y: 8000 },
  ],
  L_SHAPE: [
    { x: 0, y: 0 },
    { x: 10000, y: 0 },
    { x: 10000, y: 5000 },
    { x: 6500, y: 5000 },
    { x: 6500, y: 8000 },
    { x: 0, y: 8000 },
  ],
  U_SHAPE: [
    { x: 0, y: 0 },
    { x: 3200, y: 0 },
    { x: 3200, y: 3000 },
    { x: 6800, y: 3000 },
    { x: 6800, y: 0 },
    { x: 10000, y: 0 },
    { x: 10000, y: 8000 },
    { x: 0, y: 8000 },
  ],
};

function formatTableStateLabel(state: string, tr: (id: string, en: string) => string): {
  label: string;
  tone: 'success' | 'info' | 'warning' | 'danger';
} {
  switch (state) {
    case 'AVAILABLE':
      return { label: tr('Kosong', 'Available'), tone: 'success' };
    case 'OCCUPIED':
      return { label: tr('Terisi', 'Occupied'), tone: 'info' };
    case 'NEEDS_CLEANING':
      return { label: tr('Perlu Dibersihkan', 'Needs cleaning'), tone: 'warning' };
    default:
      return { label: tr('Nonaktif', 'Inactive'), tone: 'danger' };
  }
}

export function FloorPlanEditor({
  rooms,
  tables,
  waitlistEntries,
  onSaveOrPublish,
  onTableAction,
  busy,
  actorName,
}: {
  rooms: any[];
  tables: any[];
  waitlistEntries: any[];
  onSaveOrPublish: (payload: any) => Promise<void>;
  onTableAction: (payload: any) => Promise<void>;
  busy: boolean;
  actorName: string;
}) {
  const { language, t: tr } = useCafeLanguage();
  const translateValidation = (message: string) => {
    if (language === 'id') return message;
    const fixed: Record<string, string> = {
      'Poligon ruang minimal memiliki 3 titik.': 'The room polygon must have at least 3 points.',
      'Poligon ruang maksimal 200 titik.': 'The room polygon cannot exceed 200 points.',
      'Luas ruang tidak boleh nol.': 'The room area cannot be zero.',
      'Garis batas ruang tidak boleh saling berpotongan.': 'Room boundaries cannot cross.',
    };
    return fixed[message] || message
      .replace(/^Label meja duplikat: (.*)\.$/, 'Duplicate table label: $1.')
      .replace(/^Meja (.*) melewati batas poligon ruang\.$/, 'Table $1 extends beyond the room boundary.')
      .replace(/^Meja (.*) tumpang tindih dengan meja (.*)\.$/, 'Table $1 overlaps table $2.')
      .replace(/^Jarak kursi antara meja (.*) dan (.*) cukup rapat \(< 45 cm\)\.$/, 'Seating between tables $1 and $2 is close (< 45 cm).');
  };
  const [selectedRoomId, setSelectedRoomId] = useState<string>(rooms[0]?.id || 'room_indoor');
  const [editMode, setEditMode] = useState<boolean>(false);
  const currentRoom = rooms.find((r) => r.id === selectedRoomId) || rooms[0];

  const [shapePreset, setShapePreset] = useState<'RECTANGLE' | 'L_SHAPE' | 'U_SHAPE'>(
    (currentRoom?.shapePreset as any) || 'L_SHAPE'
  );
  const [polygon, setPolygon] = useState<Point2D[]>(
    (currentRoom?.polygonJson as Point2D[]) || PRESET_POLYGONS.L_SHAPE
  );

  const roomTablesInit = useMemo(
    () => tables.filter((t) => t.roomId === selectedRoomId),
    [tables, selectedRoomId]
  );

  const [draftTables, setDraftTables] = useState<any[]>(roomTablesInit);
  const [selectedTableId, setSelectedTableId] = useState<string>(roomTablesInit[0]?.id || 'tbl_m01');
  const [warningsAcknowledged, setWarningsAcknowledged] = useState<boolean>(false);
  const [editorMessage, setEditorMessage] = useState<string>('');
  const [editorError, setEditorError] = useState<string>('');

  const handleSwitchRoom = (roomId: string) => {
    setSelectedRoomId(roomId);
    const rm = rooms.find((r) => r.id === roomId);
    if (rm) {
      setShapePreset((rm.shapePreset as any) || 'RECTANGLE');
      setPolygon((rm.polygonJson as Point2D[]) || PRESET_POLYGONS.RECTANGLE);
    }
    const filtered = tables.filter((t) => t.roomId === roomId);
    setDraftTables(filtered);
    setSelectedTableId(filtered[0]?.id || '');
    setEditorError('');
    setEditorMessage('');
  };

  // Layout drafts own geometry only. Occupancy and cleaning must always use the
  // latest shared snapshot, including a departure made in another staff tab.
  const displayTables = editMode ? draftTables.map(table => {
    const live = tables.find(current => current.id === table.id);
    return live ? { ...table, physicalState: live.physicalState, active: live.active } : table;
  }) : roomTablesInit;
  const selectedTable = displayTables.find((t) => t.id === selectedTableId) || displayTables[0];
  const applyTableAction = async (payload: any) => {
    setEditorError(''); setEditorMessage('');
    try {
      await onTableAction(payload);
      setEditorMessage(payload.action === 'MARK_CLEAN' ? tr("Meja sudah bersih dan siap untuk tamu berikutnya.", "The table is clean and ready for the next guest.") : payload.action === 'ENABLE_TABLE' ? tr("Meja diaktifkan. Periksa dan bersihkan sebelum digunakan.", "Table activated. Check and clean it before use.") : tr("Meja dinonaktifkan sementara.", "Table temporarily deactivated."));
    } catch (caught) { setEditorError(caught instanceof Error ? caught.message : tr("Status meja belum diperbarui.", "The table status was not updated.")); }
  };

  const updateSelectedTable = (patch: Partial<any>) => {
    if (!selectedTable) return;
    setDraftTables((prev) =>
      prev.map((t) => (t.id === selectedTable.id ? { ...t, ...patch } : t))
    );
    setEditorError('');
    setEditorMessage('');
  };

  const validation = useMemo(() => {
    return validateTablePlacements({
      roomPolygon: polygon,
      tables: draftTables.map((t) => ({
        id: t.id,
        label: t.label,
        xMm: Number(t.xMm),
        yMm: Number(t.yMm),
        widthMm: Number(t.widthMm),
        heightMm: Number(t.heightMm),
        rotationDeg: Number(t.rotationDeg || 0),
      })),
    });
  }, [polygon, draftTables]);

  const polygonPointsAttr = polygon.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <div className="space-y-4">
      {/* Top Bar: Room Selector + Toggle Layout Edit Mode */}
      <div className="pb-3 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <SelectField
            id="editor-room-select"
            aria-label={tr("Pilih area ruang", "Choose room area")}
            value={selectedRoomId}
            onChange={(e) => handleSwitchRoom(e.target.value)}
            wrapperClassName="w-auto min-w-[230px]"
          >
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({tr('Lantai', 'Floor')} {r.floor})
              </option>
            ))}
          </SelectField>

          {editMode && (
            <SelectField
              id="editor-preset-select"
              aria-label={tr("Bentuk ruangan", "Room shape")}
              value={shapePreset}
              onChange={(e) => {
                const nextPreset = e.target.value as 'RECTANGLE' | 'L_SHAPE' | 'U_SHAPE';
                setShapePreset(nextPreset);
                setPolygon(PRESET_POLYGONS[nextPreset]);
              }}
              wrapperClassName="w-auto min-w-[210px]"
            >
              <option value="L_SHAPE">{tr("Bentuk Ruangan L", "L-shaped room")}</option>
              <option value="RECTANGLE">{tr("Persegi Panjang (10m × 8m)", "Rectangle (10m × 8m)")}</option>
              <option value="U_SHAPE">{tr("Bentuk Ruangan U", "U-shaped room")}</option>
            </SelectField>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={editMode ? 'subtle' : 'secondary'}
            size="sm"
            onClick={() => setEditMode(!editMode)}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>{editMode ? tr("Selesai Atur Posisi", "Finish editing positions") : tr("Atur Posisi & Denah", "Edit positions & layout")}</span>
          </Button>

          {editMode && (
            <>
              <Button
                variant="secondary"
                size="sm"
                disabled={busy || !validation.valid}
                onClick={async () => {
                  setEditorError('');
                  try {
                    await onSaveOrPublish({
                      action: 'SAVE_DRAFT',
                      roomId: selectedRoomId,
                      shapePreset,
                      polygon,
                      tables: draftTables,
                      warningsAcknowledged,
                      actorName,
                    });
                    setEditorMessage(tr('Draft denah berhasil disimpan.', 'Layout draft saved.'));
                  } catch (err: any) {
                    setEditorError(err.message);
                  }
                }}
              >
                <Save className="w-4 h-4" />
                <span>{tr("Simpan Draft", "Save draft")}</span>
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={busy || !validation.valid}
                onClick={async () => {
                  setEditorError('');
                  try {
                    await onSaveOrPublish({
                      action: 'PUBLISH_DRAFT',
                      roomId: selectedRoomId,
                      shapePreset,
                      polygon,
                      tables: draftTables,
                      warningsAcknowledged,
                      actorName,
                    });
                    setEditorMessage(tr('Denah berhasil diterapkan.', 'Layout applied.'));
                    setEditMode(false);
                  } catch (err: any) {
                    setEditorError(err.message);
                  }
                }}
              >
                <Check className="w-4 h-4" />
                <span>{tr("Terapkan Denah", "Apply layout")}</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Validation Status & Warnings */}
      {!validation.valid && <InlineError message={validation.errors.map(translateValidation).join(' · ')} />}
      {editorError && <InlineError message={editorError} />}
      {editorMessage && <StatusLabel label={editorMessage} tone="success" />}

      {editMode && validation.warnings.length > 0 && (
        <div className="py-2.5 px-3 rounded-[8px] bg-[var(--status-warning-bg)] text-[var(--status-warning-fg)] text-[13px] flex flex-wrap items-center justify-between gap-3">
          <span>{tr("Catatan jarak:", "Spacing note:")} {validation.warnings.map(translateValidation).join(' ')}</span>
          <label className="inline-flex items-center gap-2 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={warningsAcknowledged}
              onChange={(e) => setWarningsAcknowledged(e.target.checked)}
              className="w-4 h-4 accent-[var(--primary-ink)]"
            />
            <span>{tr("Tetap lanjutkan", "Continue anyway")}</span>
          </label>
        </div>
      )}

      {/* Main Split: Visual Floor Map (7 cols) + Selected Table Inspector (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-2">
          <div
            data-testid="floor-plan-svg-container"
            className="w-full overflow-x-auto bg-[var(--surface-muted)] border border-[var(--border)] rounded-[10px] p-3"
          >
            <svg
              viewBox="-400 -400 10800 8800"
              className="w-full h-auto max-h-[420px]"
              role="img"
              aria-label={tr(`Denah ruang ${currentRoom?.name}`, `Floor plan of ${currentRoom?.name}`)}
            >
              {[0, 2000, 4000, 6000, 8000, 10000].map((gx) => (
                <line
                  key={`gx_${gx}`}
                  x1={gx}
                  y1={0}
                  x2={gx}
                  y2={8000}
                  stroke="var(--border)"
                  strokeWidth={20}
                />
              ))}
              {[0, 2000, 4000, 6000, 8000].map((gy) => (
                <line
                  key={`gy_${gy}`}
                  x1={0}
                  y1={gy}
                  x2={10000}
                  y2={gy}
                  stroke="var(--border)"
                  strokeWidth={20}
                />
              ))}

              <polygon
                points={polygonPointsAttr}
                fill="#FFFFFF"
                stroke="var(--status-success-fg)"
                strokeWidth={55}
              />

              {((currentRoom?.obstaclesJson as any[]) || []).map((obs: any) => (
                <g key={obs.id}>
                  <rect
                    x={obs.xMm}
                    y={obs.yMm}
                    width={obs.widthMm}
                    height={obs.heightMm}
                    rx={60}
                    fill="var(--surface-muted)"
                    stroke="var(--border-strong)"
                    strokeWidth={25}
                  />
                  <text
                    x={obs.xMm + obs.widthMm / 2}
                    y={obs.yMm + obs.heightMm / 2 + 70}
                    textAnchor="middle"
                    fill="var(--muted-foreground)"
                    fontSize="240"
                    fontWeight="600"
                  >
                    {obs.label}
                  </text>
                </g>
              ))}

              {displayTables.map((t) => {
                const isSelected = t.id === selectedTable?.id;
                const heldWl = waitlistEntries.find(
                  (w) => w.heldTableId === t.id && w.status === 'CALLED' && Date.parse(w.holdExpiresAt) > Date.now()
                );

                let fill = 'var(--status-success-bg)';
                let stroke = 'var(--status-success-fg)';
                let stateShort = tr('Kosong', 'Available');

                if (t.physicalState === 'OCCUPIED') {
                  fill = 'var(--status-info-bg)';
                  stroke = 'var(--status-info-fg)';
                  stateShort = tr('Terisi', 'Occupied');
                } else if (t.physicalState === 'NEEDS_CLEANING') {
                  fill = 'var(--status-warning-bg)';
                  stroke = 'var(--status-warning-fg)';
                  stateShort = tr('Bersihkan', 'Clean');
                } else if (t.physicalState === 'OUT_OF_SERVICE') {
                  fill = 'var(--status-danger-bg)';
                  stroke = 'var(--status-danger-fg)';
                  stateShort = tr('Nonaktif', 'Inactive');
                } else if (heldWl) {
                  fill = 'var(--status-warning-bg)';
                  stroke = 'var(--status-warning-fg)';
                  stateShort = tr(`Ditahan ${heldWl.publicSequence}`, `Held ${heldWl.publicSequence}`);
                }

                const cx = Number(t.xMm) + Number(t.widthMm) / 2;
                const cy = Number(t.yMm) + Number(t.heightMm) / 2;

                return (
                  <g
                    key={t.id}
                    role="button"
                    tabIndex={0}
                    aria-label={tr(`Denah meja ${t.label} · ${stateShort}`, `Table layout ${t.label} · ${stateShort}`)}
                    aria-pressed={isSelected}
                    onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedTableId(t.id); } }}
                    transform={`rotate(${t.rotationDeg || 0} ${cx} ${cy})`}
                    onClick={() => setSelectedTableId(t.id)}
                    className="cursor-pointer"
                  >
                    {t.shape === 'CIRCLE' ? (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={Math.min(Number(t.widthMm), Number(t.heightMm)) / 2}
                        fill={fill}
                        stroke={isSelected ? 'var(--foreground)' : stroke}
                        strokeWidth={isSelected ? 70 : 35}
                      />
                    ) : (
                      <rect
                        x={t.xMm}
                        y={t.yMm}
                        width={t.widthMm}
                        height={t.heightMm}
                        rx={80}
                        fill={fill}
                        stroke={isSelected ? 'var(--foreground)' : stroke}
                        strokeWidth={isSelected ? 70 : 35}
                      />
                    )}
                    <text
                      x={cx}
                      y={cy - 35}
                      textAnchor="middle"
                      fill="var(--foreground)"
                      fontSize="250"
                      fontWeight="700"
                    >
                      {t.label}
                    </text>
                    <text
                      x={cx}
                      y={cy + 185}
                      textAnchor="middle"
                      fill="var(--muted-foreground)"
                      fontSize="185"
                      fontWeight="500"
                    >
                      {stateShort}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[12px] text-[var(--muted-foreground)] px-1">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--status-success-fg)]" /> {tr("Kosong", "Available")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--status-info-fg)]" /> {tr("Terisi Tamu", "Occupied")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--status-warning-fg)]" /> {tr("Perlu Dibersihkan", "Needs cleaning")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--status-danger-fg)]" /> {tr("Nonaktif", "Inactive")}
            </span>
          </div>
        </div>

        {/* Right Column: Clean Selected Table Controls & Status List (No heavy nested cards) */}
        <div className="lg:col-span-5 space-y-5">
          {selectedTable && (
            <div className="pb-4 border-b border-[var(--border)] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="font-heading text-[17px] font-bold">
                    {tr("Meja", "Table")} {selectedTable.label}
                  </h3>
                  <p className="text-[13px] text-[var(--muted-foreground)]">
                    {selectedTable.areaName} · {tr('Kapasitas', 'Capacity')} {selectedTable.capacity} {tr("kursi", "seats")}
                  </p>
                </div>
                <StatusLabel
                  label={formatTableStateLabel(selectedTable.physicalState, tr).label}
                  tone={formatTableStateLabel(selectedTable.physicalState, tr).tone}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {selectedTable.physicalState === 'NEEDS_CLEANING' && (
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      applyTableAction({
                        action: 'MARK_CLEAN',
                        tableId: selectedTable.id,
                        actorName,
                      })
                    }
                  >
                    {tr("Tandai Bersih & Siap Pakai", "Mark clean & ready")}
                  </Button>
                )}
                {selectedTable.physicalState === 'AVAILABLE' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      applyTableAction({
                        action: 'DISABLE_TABLE',
                        tableId: selectedTable.id,
                        reason: 'Perawatan meja oleh staf',
                        actorName,
                      })
                    }
                  >
                    {tr("Nonaktifkan Sementara", "Temporarily deactivate")}
                  </Button>
                )}
                {selectedTable.physicalState === 'OUT_OF_SERVICE' && (
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      applyTableAction({
                        action: 'ENABLE_TABLE',
                        tableId: selectedTable.id,
                        actorName,
                      })
                    }
                  >
                    {tr("Aktifkan Meja Kembali", "Reactivate table")}
                  </Button>
                )}
              </div>

              <AnimatePresence>
                {editMode && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="pt-3 border-t border-[var(--border)] space-y-3 overflow-hidden"
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => updateSelectedTable({ xMm: Number(selectedTable.xMm) - 200 })}
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>{tr("Kiri", "Left")}</span>
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => updateSelectedTable({ xMm: Number(selectedTable.xMm) + 200 })}
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                        <span>{tr("Kanan", "Right")}</span>
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => updateSelectedTable({ yMm: Number(selectedTable.yMm) - 200 })}
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                        <span>{tr("Atas", "Up")}</span>
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => updateSelectedTable({ yMm: Number(selectedTable.yMm) + 200 })}
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                        <span>{tr("Bawah", "Down")}</span>
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          updateSelectedTable({
                            rotationDeg: ((Number(selectedTable.rotationDeg) || 0) + 15) % 360,
                          })
                        }
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                        <span>{tr("Putar 15°", "Rotate 15°")}</span>
                      </Button>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5">
                      <div className="space-y-1">
                        <Label htmlFor="tbl-label-input">{tr("Label Meja", "Table label")}</Label>
                        <Input
                          id="tbl-label-input"
                          value={selectedTable.label}
                          onChange={(e) => updateSelectedTable({ label: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="tbl-cap-input">{tr("Kursi", "Seats")}</Label>
                        <Input
                          id="tbl-cap-input"
                          type="number"
                          min={1}
                          max={20}
                          value={selectedTable.capacity}
                          onChange={(e) =>
                            updateSelectedTable({ capacity: Number(e.target.value) })
                          }
                          className="tabular-nums"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="tbl-shape-select">{tr("Bentuk", "Shape")}</Label>
                        <SelectField
                          id="tbl-shape-select"
                          value={selectedTable.shape}
                          onChange={(e) => updateSelectedTable({ shape: e.target.value })}
                        >
                          <option value="RECTANGLE">{tr("Persegi Panjang", "Rectangle")}</option>
                          <option value="SQUARE">{tr("Persegi", "Square")}</option>
                          <option value="CIRCLE">{tr("Bulat", "Circle")}</option>
                        </SelectField>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Clean Hairline List of Tables in Room */}
          <div className="space-y-2">
            <h4 className="font-heading text-[16px] font-semibold text-[var(--foreground)]">
              {tr('Meja', 'Tables')} ({displayTables.length})
            </h4>
            <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
              {displayTables.map((t) => {
                const st = formatTableStateLabel(t.physicalState, tr);
                const active = t.id === selectedTable?.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-label={tr(`Meja ${t.label} · ${t.capacity} kursi · ${st.label}`, `Table ${t.label} · ${t.capacity} seats · ${st.label}`)}
                    aria-pressed={active}
                    onClick={() => setSelectedTableId(t.id)}
                    className={`w-full py-2.5 px-2 flex items-center justify-between gap-2 text-left text-[14px] transition-colors cursor-pointer ${
                      active
                        ? 'bg-[var(--accent-surface)] font-semibold'
                        : 'hover:bg-[var(--accent-surface)]/40'
                    }`}
                  >
                    <div>
                      <span className="text-[var(--foreground)]">{tr("Meja", "Table")} {t.label}</span>
                      <span className="ml-2 text-[12px] text-[var(--muted-foreground)]">
                        {t.capacity} {tr("kursi", "seats")}
                      </span>
                    </div>
                    <StatusLabel label={st.label} tone={st.tone} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
