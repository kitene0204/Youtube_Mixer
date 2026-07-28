import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Disc, Zap } from 'lucide-react';
import { DeckId } from '../types';

interface TurntableJogwheelProps {
  deckId: DeckId;
  isPlaying: boolean;
  thumbnail: string;
  playbackRate: number;
  isScratching: boolean;
  scratchDirection: 'forward' | 'backward' | null;
  onScratch: (direction: 'forward' | 'backward', deltaSeconds: number) => void;
  accentColor: 'cyan' | 'orange';
}

export const TurntableJogwheel: React.FC<TurntableJogwheelProps> = ({
  deckId,
  isPlaying,
  thumbnail,
  playbackRate,
  isScratching,
  scratchDirection,
  onScratch,
  accentColor,
}) => {
  const jogwheelRef = useRef<HTMLDivElement>(null);
  const [rotationAngle, setRotationAngle] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const lastAngleRef = useRef<number | null>(null);

  // Auto rotation loop when track is playing normally
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      if (isPlaying && !isDragging && !isScratching) {
        // Standard 33 RPM rotation speed scaled by playback rate
        const rpmSpeed = 33.33 * playbackRate;
        const degreesPerSec = (rpmSpeed * 360) / 60;
        setRotationAngle((prev) => (prev + degreesPerSec * deltaTime) % 360);
      } else if (isScratching && scratchDirection) {
        // Keyboard scratch rotation animation
        const scratchSpeed = scratchDirection === 'forward' ? 720 : -720; // fast rotation
        setRotationAngle((prev) => (prev + scratchSpeed * deltaTime) % 360);
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, isDragging, isScratching, scratchDirection, playbackRate]);

  // Calculate mouse angle relative to jogwheel center
  const getAngleFromEvent = useCallback((e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent) => {
    if (!jogwheelRef.current) return 0;
    const rect = jogwheelRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

    const dx = clientX - centerX;
    const dy = clientY - centerY;

    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    if (angle < 0) angle += 360;
    return angle;
  }, []);

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const angle = getAngleFromEvent(e);
    lastAngleRef.current = angle;
  };

  useEffect(() => {
    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging || lastAngleRef.current === null) return;

      const currentAngle = getAngleFromEvent(e);
      let angleDiff = currentAngle - lastAngleRef.current;

      // Handle crossing 0 / 360 boundary
      if (angleDiff > 180) angleDiff -= 360;
      if (angleDiff < -180) angleDiff += 360;

      if (Math.abs(angleDiff) > 0.5) {
        const direction: 'forward' | 'backward' = angleDiff > 0 ? 'forward' : 'backward';
        // Map angle rotation to seek seconds delta
        const deltaSeconds = (angleDiff / 360) * 1.8; // 1 full turn ~ 1.8s seek

        setRotationAngle((prev) => (prev + angleDiff) % 360);
        onScratch(direction, deltaSeconds);
        lastAngleRef.current = currentAngle;
      }
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      lastAngleRef.current = null;
    };

    if (isDragging) {
      window.addEventListener('mousemove', handlePointerMove);
      window.addEventListener('mouseup', handlePointerUp);
      window.addEventListener('touchmove', handlePointerMove);
      window.addEventListener('touchend', handlePointerUp);
    }

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [isDragging, getAngleFromEvent, onScratch]);

  const borderGlowClass = accentColor === 'cyan'
    ? 'border-cyan-500/50 shadow-[0_0_25px_rgba(6,182,212,0.3)]'
    : 'border-orange-500/50 shadow-[0_0_25px_rgba(249,115,22,0.3)]';

  const activeScratchGlow = (isScratching || isDragging)
    ? (accentColor === 'cyan' ? 'shadow-[0_0_40px_rgba(6,182,212,0.7)] border-cyan-400' : 'shadow-[0_0_40px_rgba(249,115,22,0.7)] border-orange-400')
    : borderGlowClass;

  const ringColor = accentColor === 'cyan' ? '#06b6d4' : '#f97316';

  return (
    <div className="relative flex flex-col items-center justify-center p-2 select-none">
      {/* Jogwheel Outer Ring Container */}
      <div
        ref={jogwheelRef}
        onMouseDown={handlePointerDown}
        onTouchStart={handlePointerDown}
        className={`relative w-56 h-56 md:w-64 md:h-64 rounded-full cursor-grab active:cursor-grabbing border-4 transition-shadow duration-150 flex items-center justify-center bg-gradient-to-b from-zinc-900 via-zinc-950 to-black ${activeScratchGlow}`}
      >
        {/* Outer Ribbed Metallic CDJ Grip Ring */}
        <div className="absolute inset-1 rounded-full border border-zinc-800 bg-[radial-gradient(circle,_transparent_60%,_rgba(0,0,0,0.8)_100%)] opacity-90 pointer-events-none" />

        {/* LED Position Marker Ring */}
        <svg className="absolute inset-0 w-full h-full transform -rotate-90 pointer-events-none">
          <circle
            cx="50%"
            cy="50%"
            r="46%"
            fill="none"
            stroke={ringColor}
            strokeWidth="3"
            strokeDasharray="4 8"
            className="opacity-40"
          />
          {/* Active position needle marker */}
          <line
            x1="50%"
            y1="50%"
            x2={`${50 + 46 * Math.cos((rotationAngle * Math.PI) / 180)}%`}
            y2={`${50 + 46 * Math.sin((rotationAngle * Math.PI) / 180)}%`}
            stroke={ringColor}
            strokeWidth="4"
            strokeLinecap="round"
            className="drop-shadow-[0_0_8px_currentColor]"
          />
        </svg>

        {/* Spinning Vinyl Record Body */}
        <div
          className="relative w-44 h-44 md:w-52 md:h-52 rounded-full flex items-center justify-center bg-zinc-950 shadow-inner overflow-hidden border border-zinc-800"
          style={{ transform: `rotate(${rotationAngle}deg)` }}
        >
          {/* Vinyl Grooves Texture */}
          <div className="absolute inset-0 bg-[repeating-radial-gradient(circle_at_center,_#18181b_0px,_#18181b_2px,_#09090b_3px,_#09090b_4px)] opacity-90" />

          {/* Vinyl Gloss / Shimmer Glare Effect */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />

          {/* Center Record Label / Album Artwork */}
          <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden border-2 border-zinc-700 shadow-lg flex items-center justify-center bg-zinc-900">
            {thumbnail ? (
              <img
                src={thumbnail}
                alt="Track Center Label"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <Disc className="w-10 h-10 text-zinc-600 animate-pulse" />
            )}

            {/* Center Spindle Hole */}
            <div className="absolute w-4 h-4 rounded-full bg-black border border-zinc-500 shadow-inner" />
          </div>

          {/* White Scratch Position Line on Record */}
          <div className="absolute top-1/2 left-1/2 w-1/2 h-1 bg-white/80 origin-left transform -translate-y-1/2 shadow-sm" />
        </div>

        {/* Scratching Status Overlay Badge */}
        {(isScratching || isDragging) && (
          <div className="absolute bottom-3 px-3 py-1 rounded-full bg-black/80 backdrop-blur-md border border-zinc-700 text-xs font-mono font-bold flex items-center gap-1 animate-bounce text-yellow-400">
            <Zap className="w-3 h-3 fill-yellow-400" />
            SCRATCH {scratchDirection === 'backward' ? '◀◀ REVERSE' : '▶▶ FORWARD'}
          </div>
        )}
      </div>

      {/* Instructions label below jogwheel */}
      <div className="mt-2 text-[11px] text-zinc-400 font-mono tracking-tight flex items-center gap-1">
        <span>{deckId === 'left' ? '🔑 키보드 A / F 스크래치' : '🔑 키보드 ← / → 스크래치'}</span>
        <span className="text-zinc-600">|</span>
        <span>마우스 드래그</span>
      </div>
    </div>
  );
};
