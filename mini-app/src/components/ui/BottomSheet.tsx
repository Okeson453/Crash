import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function BottomSheet({ isOpen, onClose, title, children }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[60] bg-black/50 animate-fade-in"
      onClick={handleOverlayClick}
      aria-modal="true"
      role="dialog"
    >
      <div
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 bg-tg-bg rounded-t-2xl max-h-[85vh] overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-tg-bg z-10 px-4 pt-3 pb-2 border-b border-tg-hint/10">
          <div className="w-12 h-1 bg-tg-hint/30 rounded-full mx-auto mb-3" />
          <div className="flex items-center justify-between">
            {title && (
              <h2 className="text-lg font-semibold text-tg-text">{title}</h2>
            )}
            <button
              onClick={onClose}
              className="touch-target p-2 rounded-full hover:bg-tg-section transition-colors ml-auto"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-tg-hint" />
            </button>
          </div>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export function useBottomSheet() {
  const bottomSheet = useUIStore((s) => s.bottomSheet);
  const bottomSheetData = useUIStore((s) => s.bottomSheetData);
  const showBottomSheet = useUIStore((s) => s.showBottomSheet);
  const hideBottomSheet = useUIStore((s) => s.hideBottomSheet);

  return {
    isOpen: bottomSheet !== null,
    type: bottomSheet,
    data: bottomSheetData,
    show: showBottomSheet,
    hide: hideBottomSheet,
  };
}
