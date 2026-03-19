import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '../lib/utils';
import {
  APP_HEADER_HEIGHT_PX,
  getOverlayContainerStyle,
  getOverlaySurfaceStyle,
} from './overlayLayout';

export type OverlayVariant = 'modal' | 'drawer';

export interface OverlaySurfaceProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  variant?: OverlayVariant;
  closeOnBackdrop?: boolean;
  className?: string;
  backdropClassName?: string;
}

function getSurfaceMotion(variant: OverlayVariant) {
  if (variant === 'drawer') {
    return {
      initial: { opacity: 0, x: 28 },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: 28 },
    };
  }

  return {
    initial: { opacity: 0, scale: 0.96, y: 24 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.96, y: 24 },
  };
}

export function OverlaySurface({
  isOpen,
  onClose,
  children,
  variant = 'modal',
  closeOnBackdrop = true,
  className,
  backdropClassName,
}: OverlaySurfaceProps) {
  const surfaceMotion = getSurfaceMotion(variant);

  return (
    <AnimatePresence>
      {isOpen ? (
        <div className="fixed inset-0 z-[60]">
          <div
            className="absolute inset-x-0 top-0"
            style={{ height: `${APP_HEADER_HEIGHT_PX}px` }}
          />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className={cn(
              'absolute inset-x-0 bottom-0 top-12 bg-zinc-950/45 backdrop-blur-sm',
              backdropClassName,
            )}
            onClick={closeOnBackdrop ? onClose : undefined}
          />
          <div
            className={cn(
              'relative flex h-full',
              variant === 'drawer'
                ? 'items-stretch justify-end'
                : 'items-start justify-center lg:items-center',
            )}
            style={getOverlayContainerStyle()}
          >
            <motion.div
              {...surfaceMotion}
              transition={{
                type: 'spring',
                stiffness: 360,
                damping: 28,
                mass: 0.82,
              }}
              style={variant === 'drawer' ? undefined : getOverlaySurfaceStyle()}
              className={cn(
                'relative flex w-full flex-col overflow-hidden border border-zinc-200/80 bg-white shadow-2xl shadow-zinc-950/12 dark:border-zinc-800 dark:bg-zinc-900',
                variant === 'drawer'
                  ? 'max-w-xl self-stretch rounded-[28px]'
                  : 'max-w-md rounded-[28px]',
                className,
              )}
            >
              {children}
            </motion.div>
          </div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
