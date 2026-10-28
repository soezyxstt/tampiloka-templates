'use client';

import * as React from 'react';
import Image from 'next/image';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { ChevronLeft, ChevronRight, Images } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ImageCarouselProps {
  photos: string[];
  altPrefix: string;
  activeIndex?: number;
  onIndexChange?: (index: number) => void;
  heightClassName?: string;
  showThumbnails?: boolean;
  className?: string;
}

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? '100%' : '-100%',
    opacity: 0.35,
    scale: 0.98,
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? '100%' : '-100%',
    opacity: 0.35,
    scale: 0.98,
  }),
};

const swipeConfidenceThreshold = 6000;
const swipePower = (offset: number, velocity: number) => {
  return Math.abs(offset) * velocity;
};

/**
 * Reusable Animated Image Carousel with directional slide transitions,
 * touch/drag swipe support, animated thumbnail selector, and reduced-motion compliance.
 */
export function ImageCarousel({
  photos,
  altPrefix,
  activeIndex: controlledIndex,
  onIndexChange,
  heightClassName = 'h-[220px] sm:h-[260px]',
  showThumbnails = true,
  className,
}: ImageCarouselProps) {
  const shouldReduceMotion = useReducedMotion();
  const [[internalPage, direction], setPage] = React.useState<[number, number]>([
    controlledIndex ?? 0,
    0,
  ]);

  const page = controlledIndex ?? internalPage;

  const validPhotos = React.useMemo(
    () => (Array.isArray(photos) ? photos.filter(Boolean) : []),
    [photos]
  );

  if (validPhotos.length === 0) {
    return null;
  }

  const safeIndex = ((page % validPhotos.length) + validPhotos.length) % validPhotos.length;

  const paginate = (newDirection: number) => {
    if (validPhotos.length <= 1) return;
    const nextIdx =
      ((safeIndex + newDirection) % validPhotos.length + validPhotos.length) %
      validPhotos.length;
    setPage([nextIdx, newDirection]);
    onIndexChange?.(nextIdx);
  };

  const goToIndex = (targetIdx: number) => {
    if (targetIdx === safeIndex) return;
    const dir = targetIdx > safeIndex ? 1 : -1;
    setPage([targetIdx, dir]);
    onIndexChange?.(targetIdx);
  };

  return (
    <div className={cn('space-y-2.5 select-none', className)}>
      {/* Main Sliding Viewport */}
      <div
        className={cn(
          'relative w-full overflow-hidden rounded-[12px] bg-[#F2EFE9] border border-[var(--border)] group',
          heightClassName
        )}
      >
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={`${safeIndex}_${validPhotos[safeIndex]}`}
            custom={direction}
            variants={shouldReduceMotion ? undefined : slideVariants}
            initial={shouldReduceMotion ? { opacity: 0 } : 'enter'}
            animate={shouldReduceMotion ? { opacity: 1 } : 'center'}
            exit={shouldReduceMotion ? { opacity: 0 } : 'exit'}
            transition={
              shouldReduceMotion
                ? { duration: 0.15 }
                : {
                    x: { type: 'spring', stiffness: 320, damping: 32, mass: 0.9 },
                    opacity: { duration: 0.2 },
                    scale: { duration: 0.2 },
                  }
            }
            drag={validPhotos.length > 1 ? 'x' : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.75}
            onDragEnd={(_, { offset, velocity }) => {
              const swipe = swipePower(offset.x, velocity.x);
              if (swipe < -swipeConfidenceThreshold || offset.x < -55) {
                paginate(1);
              } else if (swipe > swipeConfidenceThreshold || offset.x > 55) {
                paginate(-1);
              }
            }}
            className={cn(
              'relative w-full h-full',
              validPhotos.length > 1 ? 'cursor-grab active:cursor-grabbing' : ''
            )}
          >
            <Image
              src={validPhotos[safeIndex]}
              alt={`${altPrefix} - Foto ${safeIndex + 1}`}
              fill
              className="object-cover pointer-events-none"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        </AnimatePresence>

        {/* Left / Right Slide Controls + Counter when multiple photos exist */}
        {validPhotos.length > 1 && (
          <>
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={(e) => {
                e.stopPropagation();
                paginate(-1);
              }}
              aria-label="Foto sebelumnya"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 z-10 min-h-[38px] min-w-[38px] rounded-[8px] bg-black/65 hover:bg-black/80 text-white backdrop-blur-xs flex items-center justify-center transition-colors cursor-pointer shadow-sm"
            >
              <ChevronLeft className="w-5 h-5" />
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={(e) => {
                e.stopPropagation();
                paginate(1);
              }}
              aria-label="Foto berikutnya"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 z-10 min-h-[38px] min-w-[38px] rounded-[8px] bg-black/65 hover:bg-black/80 text-white backdrop-blur-xs flex items-center justify-center transition-colors cursor-pointer shadow-sm"
            >
              <ChevronRight className="w-5 h-5" />
            </motion.button>

            {/* Animated Progress Dots + Numeric Counter */}
            <div className="absolute bottom-2.5 inset-x-3 z-10 flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-[6px] bg-black/55 backdrop-blur-xs pointer-events-auto">
                {validPhotos.map((_, idx) => {
                  const isActive = idx === safeIndex;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        goToIndex(idx);
                      }}
                      aria-label={`Pilih foto ${idx + 1}`}
                      className="p-0.5 cursor-pointer"
                    >
                      <motion.span
                        animate={{
                          width: isActive ? 18 : 6,
                          backgroundColor: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.45)',
                        }}
                        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                        className="block h-1.5 rounded-[3px]"
                      />
                    </button>
                  );
                })}
              </div>

              <span className="px-2 py-0.5 rounded-[6px] bg-black/70 backdrop-blur-xs text-white text-[11px] font-semibold tabular-nums inline-flex items-center gap-1">
                <Images className="w-3 h-3" />
                Foto {safeIndex + 1} / {validPhotos.length}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Animated Thumbnail Strip */}
      {showThumbnails && validPhotos.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto py-0.5 no-scrollbar">
          {validPhotos.map((photoUrl, idx) => {
            const isActive = idx === safeIndex;
            return (
              <motion.button
                key={`${photoUrl}_${idx}`}
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => goToIndex(idx)}
                aria-label={`Thumbnail ${idx + 1}`}
                className={cn(
                  'relative w-16 h-12 rounded-[8px] overflow-hidden shrink-0 cursor-pointer transition-opacity',
                  isActive ? 'opacity-100' : 'opacity-60 hover:opacity-90'
                )}
              >
                <Image
                  src={photoUrl}
                  alt={`Thumbnail ${idx + 1}`}
                  fill
                  className="object-cover"
                  referrerPolicy="no-referrer"
                />
                {isActive && (
                  <motion.span
                    layoutId={`thumb-ring-${altPrefix}`}
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute inset-0 rounded-[8px] border-2 border-[var(--primary)] pointer-events-none"
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Compact Animated Thumbnail Slider for Menu Rows
 * Allows sliding between photos right on the menu item thumbnail OR clicking to open detail modal.
 */
export function ThumbnailImageSlider({
  photos,
  itemName,
  externalCode,
  onOpenDetail,
  className,
}: {
  photos: string[];
  itemName: string;
  externalCode?: string;
  onOpenDetail: () => void;
  className?: string;
}) {
  const shouldReduceMotion = useReducedMotion();
  const [[idx, direction], setSlide] = React.useState<[number, number]>([0, 0]);
  const validPhotos = React.useMemo(
    () => (Array.isArray(photos) ? photos.filter(Boolean) : []),
    [photos]
  );

  const safeIdx =
    validPhotos.length > 0
      ? ((idx % validPhotos.length) + validPhotos.length) % validPhotos.length
      : 0;

  const stepPhoto = (e: React.MouseEvent, delta: number) => {
    e.stopPropagation();
    if (validPhotos.length <= 1) return;
    const next = ((safeIdx + delta) % validPhotos.length + validPhotos.length) % validPhotos.length;
    setSlide([next, delta]);
  };

  return (
    <div
      className={cn(
        'w-[92px] h-[92px] sm:w-[104px] sm:h-[104px] relative rounded-[10px] overflow-hidden border border-[var(--border)] bg-[#F2EFE9] shrink-0 group select-none',
        className
      )}
    >
      <button
        type="button"
        onClick={onOpenDetail}
        aria-label={`Lihat detail dan foto ${itemName}`}
        className="w-full h-full relative block cursor-pointer"
      >
        {validPhotos.length > 0 ? (
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <motion.div
              key={`${safeIdx}_${validPhotos[safeIdx]}`}
              custom={direction}
              variants={shouldReduceMotion ? undefined : slideVariants}
              initial={shouldReduceMotion ? { opacity: 0 } : 'enter'}
              animate={shouldReduceMotion ? { opacity: 1 } : 'center'}
              exit={shouldReduceMotion ? { opacity: 0 } : 'exit'}
              transition={
                shouldReduceMotion
                  ? { duration: 0.12 }
                  : {
                      x: { type: 'spring', stiffness: 340, damping: 32, mass: 0.85 },
                      opacity: { duration: 0.18 },
                    }
              }
              className="relative w-full h-full"
            >
              <Image
                src={validPhotos[safeIdx]}
                alt={`${itemName} - Foto ${safeIdx + 1}`}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                referrerPolicy="no-referrer"
              />
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center">
            <span className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase">
              {externalCode}
            </span>
            <span className="text-[11px] text-[var(--muted-foreground)]">Tanpa foto</span>
          </div>
        )}
      </button>

      {validPhotos.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => stepPhoto(e, -1)}
            aria-label={`Geser foto ${itemName} sebelumnya`}
            className="absolute left-1 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-[6px] bg-black/60 hover:bg-black/80 text-white flex items-center justify-center opacity-85 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => stepPhoto(e, 1)}
            aria-label={`Geser foto ${itemName} berikutnya`}
            className="absolute right-1 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-[6px] bg-black/60 hover:bg-black/80 text-white flex items-center justify-center opacity-85 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-pointer"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <span className="pointer-events-none absolute bottom-1 right-1 z-10 px-1.5 py-0.5 rounded-[4px] bg-black/70 text-white text-[10px] font-semibold inline-flex items-center gap-1 tabular-nums">
            <Images className="w-2.5 h-2.5" />
            {safeIdx + 1}/{validPhotos.length}
          </span>
        </>
      )}
    </div>
  );
}
