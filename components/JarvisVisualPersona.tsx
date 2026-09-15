import React, { useState, useEffect, useRef } from 'react';

export type PersonaMode = 'background' | 'avatar' | 'docked' | 'spotlight';

export interface JarvisVisualPersonaProps {
  /** Direct URL for the looping Jarvis video file */
  videoUrl?: string;
  /** Direct URL for the static fallback poster cover image */
  imageUrl?: string;
  /** Current presentation mode */
  mode?: PersonaMode;
  /** Whether Jarvis is actively vocalizing via TTS or audio stream */
  isSpeaking?: boolean;
  /** Whether Jarvis is currently formulating or generating text */
  isGenerating?: boolean;
  /** Opacity factor for background ambient mode (0.05 to 1.0) */
  ambientOpacity?: number;
  /** Avatar size preset when in 'avatar' mode */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Optional interactive controls toggle */
  showControls?: boolean;
  /** Custom status or telemetry text */
  statusText?: string;
  /** Callback when mode is switched via interactive controls */
  onModeChange?: (mode: PersonaMode) => void;
  /** Additional container CSS classes */
  className?: string;
}

const DEFAULT_VIDEO_URL = '/jarvis-video.mp4';
const DEFAULT_IMAGE_URL = '/jarvis-wallpaper.jpg';

export const JarvisVisualPersona: React.FC<JarvisVisualPersonaProps> = ({
  videoUrl = DEFAULT_VIDEO_URL,
  imageUrl = DEFAULT_IMAGE_URL,
  mode = 'avatar',
  isSpeaking = false,
  isGenerating = false,
  ambientOpacity = 0.35,
  size = 'md',
  showControls = false,
  statusText,
  onModeChange,
  className = '',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [hasPlaybackError, setHasPlaybackError] = useState(false);
  const [internalMode, setInternalMode] = useState<PersonaMode>(mode);

  // Sync external mode prop
  useEffect(() => {
    setInternalMode(mode);
  }, [mode]);

  const activeMode = internalMode;
  const isActive = isSpeaking || isGenerating;

  // Dynamically control video playback speed & responsiveness during speaking state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (isActive) {
        // Slightly elevated playback rate and unmuted volume simulation if desired
        video.playbackRate = 1.1;
      } else {
        video.playbackRate = 1.0;
      }
      
      // Ensure video plays continuously across state transitions
      if (video.paused) {
        video.play().catch(() => {
          // Handled silently for autoplay policies
        });
      }
    } catch {
      // Browser autoplay safeguard
    }
  }, [isActive]);

  // Size specifications for avatar mode
  const sizeMap = {
    sm: 'w-24 h-24 sm:w-28 sm:h-28',
    md: 'w-44 h-44 sm:w-52 sm:h-52',
    lg: 'w-64 h-64 sm:w-72 sm:h-72',
    xl: 'w-80 h-80 sm:w-96 sm:h-96',
  };

  // 1. PURPOSE 1: AMBIENT BACKGROUND & LANDING PAGE COVER
  if (activeMode === 'background') {
    return (
      <div 
        className={`fixed inset-0 pointer-events-none z-0 overflow-hidden transition-all duration-1000 ease-in-out ${className}`}
        style={{ opacity: ambientOpacity }}
      >
        {/* The required HTML5 <video> tag with all necessary attributes */}
        <video
          ref={videoRef}
          src={videoUrl}
          poster={imageUrl}
          autoPlay
          loop
          muted
          playsInline
          onLoadedData={() => setIsVideoLoaded(true)}
          onError={() => setHasPlaybackError(true)}
          className={`w-full h-full object-cover transition-all duration-1000 ${
            isActive ? 'scale-105 brightness-110 contrast-105' : 'scale-100 brightness-95'
          }`}
        />

        {/* Ambient atmospheric Sci-Fi overlays */}
        <div className="absolute inset-0 bg-slate-950/60 mix-blend-multiply pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(6,182,212,0.15)_0%,_rgba(2,6,23,0.85)_75%)] pointer-events-none" />
        
        {/* Active Speaking Ambient Aura Pulse */}
        {isActive && (
          <div className="absolute inset-0 bg-cyan-500/10 mix-blend-screen animate-pulse pointer-events-none transition-opacity duration-700" />
        )}

        {/* Subtle holographic grid lines */}
        <div 
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(rgba(6, 182, 212, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(6, 182, 212, 0.15) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
      </div>
    );
  }

  // 2. PURPOSE 2 & 3: VIRTUAL PERSONALITY (IDLE & SPEAKING STATES)
  // Docked floating mini avatar mode
  if (activeMode === 'docked') {
    return (
      <div className={`relative inline-flex items-center gap-2.5 transition-all duration-500 ease-in-out ${className}`}>
        <div className="relative group cursor-pointer" onClick={() => onModeChange && onModeChange('avatar')}>
          {/* Animated soundwave ring when speaking */}
          {isActive && (
            <div className="absolute -inset-1 rounded-full bg-cyan-400/40 animate-ping pointer-events-none" />
          )}
          
          <div className={`relative w-10 h-10 rounded-full overflow-hidden border transition-all duration-500 shadow-md ${
            isActive 
              ? 'border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.7)] scale-105' 
              : 'border-cyan-800/80 shadow-[0_0_8px_rgba(6,182,212,0.2)]'
          }`}>
            <video
              ref={videoRef}
              src={videoUrl}
              poster={imageUrl}
              autoPlay
              loop
              muted
              playsInline
              className={`w-full h-full object-cover transition-all duration-500 ${
                isActive ? 'brightness-110 contrast-110' : 'brightness-90 opacity-90'
              }`}
            />
            {/* Subtle scanline overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(18,18,18,0)_50%,rgba(0,255,255,0.12)_50%)] bg-[size:100%_3px] pointer-events-none" />
          </div>

          <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-950 ${
            isSpeaking ? 'bg-cyan-400 animate-pulse' : isGenerating ? 'bg-amber-400 animate-ping' : 'bg-emerald-500'
          }`} />
        </div>

        <div className="hidden sm:flex flex-col text-left font-mono">
          <span className="text-[11px] font-bold text-cyan-300 leading-tight flex items-center gap-1.5">
            J.A.R.V.I.S.
            {isSpeaking && <span className="text-[9px] text-cyan-400 animate-pulse font-normal">[VOCALIZING]</span>}
            {isGenerating && <span className="text-[9px] text-amber-400 animate-pulse font-normal">[SYNTHESIZING]</span>}
          </span>
          <span className="text-[9px] text-cyan-600">
            {isSpeaking ? 'TRANSMITTING AUDIO' : isGenerating ? 'REASONING PIPELINE' : 'NEURAL CORE IDLE'}
          </span>
        </div>
      </div>
    );
  }

  // Centered or full Avatar Portal (Idle or Speaking state)
  return (
    <div className={`relative flex flex-col items-center justify-center select-none group transition-all duration-700 ease-in-out ${className}`}>
      {/* Outer Holographic Projection Halo */}
      <div 
        className={`absolute rounded-full transition-all duration-700 pointer-events-none ${
          isActive 
            ? 'inset-[-25%] bg-cyan-400/20 blur-[60px] animate-pulse' 
            : 'inset-[-15%] bg-cyan-500/10 blur-[40px]'
        }`} 
      />

      {/* Rotating Sci-Fi Gimbal Rings */}
      <div 
        className={`absolute w-[125%] h-[125%] rounded-full border border-cyan-500/30 border-t-transparent border-l-transparent pointer-events-none transition-all duration-700 ${
          isActive ? 'shadow-[0_0_20px_rgba(6,182,212,0.4)] animate-[spin_6s_linear_infinite]' : 'animate-[spin_18s_linear_infinite]'
        }`} 
      />
      <div 
        className={`absolute w-[112%] h-[112%] rounded-full border border-dashed border-cyan-400/40 pointer-events-none transition-all duration-700 ${
          isActive ? 'animate-[spin_4s_reverse_linear_infinite] border-cyan-300/60' : 'animate-[spin_24s_reverse_linear_infinite]'
        }`} 
      />

      {/* Multi-Ring Soundwave Equalizer when Speaking */}
      {isActive && (
        <div className="absolute inset-[-10%] rounded-full pointer-events-none overflow-visible">
          <div className="absolute inset-0 rounded-full border-2 border-cyan-400/60 animate-ping opacity-60" />
          <div className="absolute inset-2 rounded-full border border-cyan-300/40 animate-pulse" />
        </div>
      )}

      {/* Main Video Viewport Container */}
      <div className={`relative rounded-full overflow-hidden border-2 transition-all duration-700 ease-in-out shadow-2xl bg-black ${sizeMap[size]} ${
        isActive 
          ? 'border-cyan-300 shadow-[0_0_35px_rgba(6,182,212,0.6)] scale-105' 
          : 'border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.25)] hover:border-cyan-400/80'
      }`}>
        {/* Required HTML <video> Tag */}
        <video
          ref={videoRef}
          src={videoUrl}
          poster={imageUrl}
          autoPlay
          loop
          muted
          playsInline
          onLoadedData={() => setIsVideoLoaded(true)}
          onError={() => setHasPlaybackError(true)}
          className={`w-full h-full object-cover transition-all duration-700 ease-in-out ${
            isActive 
              ? 'scale-110 brightness-115 contrast-110' 
              : 'scale-100 brightness-95 opacity-90 group-hover:opacity-100 group-hover:scale-105'
          }`}
        />

        {/* Fallback Static Image Container if video fails to load */}
        {hasPlaybackError && (
          <img
            src={imageUrl}
            alt="Jarvis Holographic Persona"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* Holographic Scanline Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,18,18,0)_50%,rgba(0,255,255,0.1)_50%)] bg-[size:100%_4px] pointer-events-none mix-blend-overlay" />
        
        {/* Sweeping Vertical Scanning Light Beam */}
        <div className={`absolute inset-0 bg-gradient-to-b from-transparent via-cyan-400/20 to-transparent pointer-events-none ${
          isActive ? 'animate-[scanline_1.5s_linear_infinite]' : 'animate-[scanline_3s_linear_infinite]'
        }`} />

        {/* Bottom Atmospheric Vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent pointer-events-none" />

        {/* Dynamic State Overlay Indicator */}
        <div className="absolute bottom-2 inset-x-0 flex justify-center items-center pointer-events-none">
          <span className={`text-[9px] font-mono tracking-widest px-2 py-0.5 rounded-full border backdrop-blur-md uppercase transition-all duration-300 ${
            isSpeaking 
              ? 'bg-cyan-950/90 border-cyan-400 text-cyan-200 shadow-[0_0_10px_rgba(6,182,212,0.8)]' 
              : isGenerating 
                ? 'bg-amber-950/90 border-amber-400 text-amber-200 shadow-[0_0_10px_rgba(251,191,36,0.5)]' 
                : 'bg-slate-950/70 border-cyan-900/60 text-cyan-500'
          }`}>
            {statusText || (isSpeaking ? 'SPEAKING' : isGenerating ? 'REASONING' : 'IDLE')}
          </span>
        </div>
      </div>

      {/* Target Crosshairs / Face-tracking Reticle Markers */}
      <div className="absolute inset-0 pointer-events-none opacity-40 group-hover:opacity-80 transition-opacity">
        <svg className="w-full h-full" viewBox="0 0 100 100" fill="none" stroke="rgba(6,182,212,0.4)" strokeWidth="0.6">
          <circle cx="50" cy="50" r="48" strokeDasharray="3 3" />
          <line x1="50" y1="2" x2="50" y2="10" stroke="#22d3ee" />
          <line x1="50" y1="90" x2="50" y2="98" stroke="#22d3ee" />
          <line x1="2" y1="50" x2="10" y2="50" stroke="#22d3ee" />
          <line x1="90" y1="50" x2="98" y2="50" stroke="#22d3ee" />
        </svg>
      </div>

      {/* Interactive Quick Mode Controls (if enabled) */}
      {showControls && (
        <div className="mt-3 flex items-center gap-1.5 p-1 rounded-lg bg-slate-950/80 border border-cyan-900/60 backdrop-blur-md text-[10px] font-mono z-10">
          {(['avatar', 'docked', 'background'] as PersonaMode[]).map((m) => (
            <button
              key={m}
              onClick={() => {
                setInternalMode(m);
                onModeChange?.(m);
              }}
              className={`px-2 py-1 rounded uppercase tracking-wider transition-all ${
                activeMode === m 
                  ? 'bg-cyan-500 text-slate-950 font-bold' 
                  : 'text-cyan-600 hover:text-cyan-300'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default JarvisVisualPersona;
