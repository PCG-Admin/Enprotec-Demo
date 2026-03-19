import React, { useEffect, useRef, useState } from 'react';

type SignaturePadProps = {
  label: string;
  value?: string | null;
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
  height?: number;
};

const SignaturePad: React.FC<SignaturePadProps> = ({
  label,
  value = null,
  onChange,
  disabled = false,
  height = 120,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const valueRef = useRef<string | null>(value);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasInk, setHasInk] = useState(Boolean(value));

  const syncCanvasSize = (dataUrl?: string | null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth * ratio;
    const scaledHeight = height * ratio;

    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.width = width;
    canvas.height = scaledHeight;
    context.setTransform(1, 0, 0, 1, 0, 0); // reset transforms before scaling
    context.scale(ratio, ratio);
    context.lineWidth = 2;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#0f172a';
    context.clearRect(0, 0, width, scaledHeight);

    if (dataUrl) {
      const image = new Image();
      image.onload = () => {
        context.clearRect(0, 0, width, scaledHeight);
        context.drawImage(image, 0, 0, width / ratio, height);
      };
      image.src = dataUrl;
    }
  };

  useEffect(() => {
    valueRef.current = value;
    syncCanvasSize(value);
    // Resize canvas if the container width changes.
    const resizeObserver = new ResizeObserver(syncCanvasSize);
    if (canvasRef.current) {
      resizeObserver.observe(canvasRef.current);
    }
    return () => resizeObserver.disconnect();
  }, [value, height]);

  const getCoords = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const coords = getCoords(event);
    const context = canvasRef.current?.getContext('2d');
    if (!context || !coords) return;
    setIsDrawing(true);
    context.beginPath();
    context.moveTo(coords.x, coords.y);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return;
    const coords = getCoords(event);
    const context = canvasRef.current?.getContext('2d');
    if (!context || !coords) return;
    context.lineTo(coords.x, coords.y);
    context.stroke();
  };

  const finishDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    context?.closePath();
    setHasInk(true);
    onChange(canvas.toDataURL('image/png'));
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    valueRef.current = null;
    syncCanvasSize(null);
    setHasInk(false);
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <label className="block font-medium text-zinc-700 text-sm">{label}</label>
      <div className="relative">
        <canvas
          ref={canvasRef}
          className={`w-full border border-zinc-300 rounded-md bg-white ${disabled ? 'opacity-70 cursor-not-allowed' : 'cursor-crosshair'}`}
          style={{ height }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrawing}
          onPointerLeave={finishDrawing}
        />
        {!hasInk && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-zinc-400">
            Sign here
          </span>
        )}
      </div>
      <div className="flex justify-between items-center">
        <span className="text-xs text-zinc-500">Use your mouse or finger to sign.</span>
        <button
          type="button"
          onClick={clearSignature}
          className="text-xs px-3 py-1 rounded-md bg-zinc-200 text-zinc-700 hover:bg-zinc-300 transition-colors disabled:opacity-60"
          disabled={disabled || !hasInk}
        >
          Clear
        </button>
      </div>
    </div>
  );
};

export default SignaturePad;
