import React, { useEffect, useRef, useState } from 'react';
import { COLORS } from '../theme';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export const BottomSheet: React.FC<Props> = ({ isOpen, onClose, children }) => {
  const [dragY, setDragY] = useState(0);
  const startYRef = useRef<number | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setDragY(0);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startYRef.current === null) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - startYRef.current;
    if (deltaY > 0) {
      setDragY(deltaY);
    }
  };

  const handleTouchEnd = () => {
    if (dragY > 100) {
      onClose();
    }
    setDragY(0);
    startYRef.current = null;
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      {/* Backdrop */}
      <div
        className="animate-fade-in"
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(15, 41, 58, 0.55)',
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Sheet Content */}
      <div
        ref={sheetRef}
        className="animate-slide-up safe-bottom"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '500px',
          maxHeight: '85vh',
          backgroundColor: COLORS.surface,
          borderTopLeftRadius: '22px',
          borderTopRightRadius: '22px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: dragY === 0 ? 'transform 0.15s ease-out' : 'none',
          overflow: 'hidden',
        }}
      >
        {/* Swipe Handle */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            width: '100%',
            padding: '10px 0 6px 0',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            cursor: 'grab',
            touchAction: 'none',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '5px',
              borderRadius: '3px',
              backgroundColor: '#CBD5E1',
            }}
          />
        </div>

        {/* Inner Scrollable Body */}
        <div
          className="scroll-container"
          style={{
            padding: '8px 16px 20px 16px',
            overflowY: 'auto',
            maxHeight: 'calc(85vh - 30px)',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
