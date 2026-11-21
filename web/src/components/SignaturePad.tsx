import React, { useEffect, useRef, useState } from 'react';
import { COLORS } from '../theme';

interface Props {
  initialSignature?: string;
  onSave: (base64: string) => void;
  onClose: () => void;
}

export const SignaturePad: React.FC<Props> = ({ initialSignature, onSave, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Support High DPI
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0F293A';
    ctx.lineWidth = 2.5;

    // If there's an initial signature, draw it
    if (initialSignature) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        setHasDrawn(true);
      };
      img.src = initialSignature;
    }
  }, [initialSignature]);

  const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handlePointerUp = () => {
    setIsDrawing(false);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!hasDrawn) {
      alert('يرجى التوقيع أولاً');
      return;
    }
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        backgroundColor: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
      }}
    >
      <div
        style={{
          padding: '16px',
          borderBottom: `1px solid ${COLORS.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            fontSize: '14px',
            color: COLORS.muted,
            fontWeight: '700',
            padding: '6px 12px',
          }}
        >
          رجوع
        </button>
        <h3 style={{ fontSize: '16px', fontWeight: '800', color: COLORS.ink }}>
          توقيع ممثل المنشأة / المعاين
        </h3>
        <button
          type="button"
          onClick={handleClear}
          style={{
            fontSize: '14px',
            color: COLORS.red,
            fontWeight: '700',
            padding: '6px 12px',
          }}
        >
          مسح
        </button>
      </div>

      <div
        style={{
          flex: 1,
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F8FAFC',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '280px',
            borderRadius: '16px',
            border: `2px dashed ${COLORS.primary}`,
            backgroundColor: '#FFFFFF',
            position: 'relative',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            overflow: 'hidden',
          }}
        >
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            style={{
              width: '100%',
              height: '100%',
              touchAction: 'none',
              cursor: 'crosshair',
            }}
          />
          {!hasDrawn && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94A3B8',
                fontSize: '15px',
                pointerEvents: 'none',
                fontWeight: '600',
              }}
            >
              ✍️ وقّع بيدك أو بالقلم هنا
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '16px', borderTop: `1px solid ${COLORS.border}` }} className="safe-bottom">
        <button
          type="button"
          onClick={handleConfirm}
          style={{
            width: '100%',
            padding: '15px',
            backgroundColor: COLORS.green,
            color: '#FFFFFF',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: '800',
          }}
        >
          حفظ التوقيع
        </button>
      </div>
    </div>
  );
};
