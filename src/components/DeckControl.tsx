import React, { useState } from 'react';
import { Play, Pause, RotateCcw, Flame, Link as LinkIcon, Music, Disc3, ShieldAlert, Sparkles, Volume2, VolumeX, Upload, Trash2, CheckCircle2, FileAudio, Zap } from 'lucide-react';
import { DeckState, DeckId, SampleTrack } from '../types';
import { formatTime, extractYouTubeId, SAMPLE_TRACKS, fetchYouTubeVideoMeta } from '../utils/youtube';
import { audioFX } from '../utils/audioEffects';
import { TurntableJogwheel } from './TurntableJogwheel';

interface DeckControlProps {
  deck: DeckState;
  onUpdateDeck: (deckId: DeckId, updates: Partial<DeckState>) => void;
  onScratch: (direction: 'forward' | 'backward', deltaSeconds?: number) => void;
  onSeek: (seconds: number, forcePlay?: boolean) => void;
  onTogglePlay: () => void;
  onSetHotCue: (index: number) => void;
  onJumpHotCue: (index: number) => void;
  onResetHotCue: (index: number) => void;
  onTriggerLoop: (lengthBeats: number) => void;
  onExitLoop: () => void;
  onLoadPresetTrack: (track: SampleTrack) => void;
  accentColor: 'cyan' | 'orange';
}

export const DeckControl: React.FC<DeckControlProps> = ({
  deck,
  onUpdateDeck,
  onScratch,
  onSeek,
  onTogglePlay,
  onSetHotCue,
  onJumpHotCue,
  onResetHotCue,
  onTriggerLoop,
  onExitLoop,
  onLoadPresetTrack,
  accentColor,
}) => {
  const [inputUrl, setInputUrl] = useState(deck.url || '');
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);
  const [scratchFileName, setScratchFileName] = useState<string | null>(
    audioFX.getCustomScratchFileName(deck.id)
  );
  const [isUploadingScratch, setIsUploadingScratch] = useState(false);

  const handleScratchFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploadingScratch(true);
      const fileName = await audioFX.loadCustomScratchSound(deck.id, file);
      setScratchFileName(fileName);
    } catch (err) {
      console.error('Failed to load scratch sound:', err);
      alert('오디오 파일 읽기 실패: MP3, WAV, OGG, M4A 형식의 음원을 사용해주세요.');
    } finally {
      setIsUploadingScratch(false);
    }
  };

  const handleRemoveScratchFile = () => {
    audioFX.removeCustomScratchSound(deck.id);
    setScratchFileName(null);
  };

  const handleTestScratch = () => {
    audioFX.playTestCustomScratch(deck.id);
  };

  const isLeft = deck.id === 'left';
  const themeClass = isLeft
    ? 'border-cyan-500/30 bg-zinc-950/80 shadow-[0_0_30px_rgba(6,182,212,0.1)]'
    : 'border-orange-500/30 bg-zinc-950/80 shadow-[0_0_30px_rgba(249,115,22,0.1)]';

  const badgeTheme = isLeft
    ? 'bg-cyan-950/60 text-cyan-400 border-cyan-800/60'
    : 'bg-orange-950/60 text-orange-400 border-orange-800/60';

  const playBtnColor = isLeft
    ? deck.isPlaying ? 'bg-cyan-500 text-black shadow-[0_0_20px_rgba(6,182,212,0.6)]' : 'bg-zinc-800 text-cyan-400 border-cyan-500/40 hover:bg-zinc-700'
    : deck.isPlaying ? 'bg-orange-500 text-black shadow-[0_0_20px_rgba(249,115,22,0.6)]' : 'bg-zinc-800 text-orange-400 border-orange-500/40 hover:bg-zinc-700';

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const videoId = extractYouTubeId(inputUrl);
    if (videoId) {
      // Set preliminary loading state so player initializes immediately
      onUpdateDeck(deck.id, {
        url: inputUrl,
        videoId,
        title: '곡 정보 검색 중...',
        artist: 'YouTube',
        thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      });

      // Fetch real video title & author via oEmbed API
      const meta = await fetchYouTubeVideoMeta(videoId);
      if (meta && meta.title) {
        onUpdateDeck(deck.id, {
          title: meta.title,
          artist: meta.author || 'YouTube Channel',
          thumbnail: meta.thumbnailUrl || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        });
      } else {
        onUpdateDeck(deck.id, {
          title: `YouTube Video (${videoId})`,
        });
      }
    }
  };

  const handlePitchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rate = parseFloat(e.target.value);
    onUpdateDeck(deck.id, { playbackRate: rate });
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseInt(e.target.value, 10);
    onUpdateDeck(deck.id, { volume: vol });
  };

  return (
    <div className={`relative flex flex-col p-4 rounded-2xl border ${themeClass} backdrop-blur-md transition-all duration-300 w-full`}>
      {/* Deck Header & Key Shortcut HUD */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-800/80">
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-0.5 rounded-md text-xs font-mono font-bold border ${badgeTheme}`}>
            DECK {isLeft ? 'A (LEFT)' : 'B (RIGHT)'}
          </span>
          <span className="text-xs text-zinc-400 font-mono hidden sm:inline">
            {isLeft ? 'A/F 스크래치 • E/D 볼륨' : '←/→ 스크래치 • ↑/↓ 볼륨'}
          </span>
        </div>

        {/* BPM & Mode Status */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <div className="bg-zinc-900 border border-zinc-800 px-2 py-1 rounded text-zinc-300 flex items-center gap-1">
            <span className="text-zinc-500">BPM</span>
            <span className="font-bold text-white">{(deck.bpm * deck.playbackRate).toFixed(1)}</span>
          </div>
          <button
            onClick={() => onUpdateDeck(deck.id, { vinylMode: !deck.vinylMode })}
            className={`px-2 py-1 rounded border text-[11px] font-bold transition-colors ${
              deck.vinylMode
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                : 'bg-zinc-900 text-zinc-500 border-zinc-800'
            }`}
            title="Vinyl Scratch Mode Toggle"
          >
            {deck.vinylMode ? 'VINYL ON' : 'CDJ MODE'}
          </button>
        </div>
      </div>

      {/* YouTube URL Loader Bar */}
      <div className="relative mb-4">
        <form onSubmit={handleUrlSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="유튜브 링크를 붙여넣으세요 (e.g. https://youtu.be/...)"
              className="w-full bg-zinc-900/90 border border-zinc-800 focus:border-zinc-600 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-600 font-mono"
            />
            <LinkIcon className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg border border-zinc-700 transition-colors flex items-center gap-1"
          >
            불러오기
          </button>
          <button
            type="button"
            onClick={() => setShowPresetDropdown(!showPresetDropdown)}
            className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs rounded-lg border border-zinc-800 transition-colors flex items-center gap-1"
            title="샘플 트랙 목록"
          >
            <Sparkles className="w-3.5 h-3.5 text-yellow-500" />
            <span className="hidden sm:inline">샘플곡</span>
          </button>
        </form>

        {/* Preset Sample Selector Modal / Dropdown */}
        {showPresetDropdown && (
          <div className="absolute top-full left-0 right-0 mt-2 z-30 bg-zinc-900/95 border border-zinc-700 rounded-xl p-2 shadow-2xl backdrop-blur-lg">
            <div className="text-[11px] font-mono text-zinc-400 mb-1.5 px-2 font-bold flex justify-between items-center">
              <span>추천 DJ 샘플 트랙 선택:</span>
              <button onClick={() => setShowPresetDropdown(false)} className="text-zinc-500 hover:text-zinc-300">✕</button>
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
              {SAMPLE_TRACKS.map((track) => (
                <button
                  key={track.id}
                  onClick={() => {
                    onLoadPresetTrack(track);
                    setInputUrl(track.youtubeUrl);
                    setShowPresetDropdown(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors flex items-center justify-between text-xs group"
                >
                  <div className="flex items-center gap-2 truncate">
                    <Disc3 className="w-3.5 h-3.5 text-zinc-500 group-hover:text-cyan-400 shrink-0" />
                    <span className="text-zinc-200 font-medium truncate">{track.title}</span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500 shrink-0 ml-2 bg-zinc-950 px-1.5 py-0.5 rounded">
                    {track.bpm} BPM
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Track Title Banner */}
      <div className="mb-3 px-3 py-2 bg-zinc-900/60 rounded-lg border border-zinc-800/80 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <Music className={`w-4 h-4 ${isLeft ? 'text-cyan-400' : 'text-orange-400'} shrink-0`} />
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-zinc-100 truncate leading-tight">
              {deck.title || '트랙을 선택해주세요'}
            </span>
            {deck.artist && (
              <span className="text-[10px] text-zinc-400 truncate leading-tight font-mono">
                {deck.artist}
              </span>
            )}
          </div>
        </div>
        <div className="font-mono text-[11px] text-zinc-400 shrink-0">
          {formatTime(deck.currentTime)} / {formatTime(deck.duration)}
        </div>
      </div>

      {/* Central Jogwheel & Pitch Controls */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center mb-4">
        {/* Pitch / Tempo Slider Column */}
        <div className="md:col-span-2 flex md:flex-col items-center justify-center bg-zinc-900/50 p-2 rounded-xl border border-zinc-800/60 gap-2">
          <div className="text-[10px] font-mono text-zinc-400 font-bold uppercase">PITCH</div>
          <input
            type="range"
            min="0.80"
            max="1.20"
            step="0.005"
            value={deck.playbackRate}
            onChange={handlePitchChange}
            className="w-full md:w-28 md:-rotate-90 md:my-8 accent-cyan-400 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
          />
          <div className="font-mono text-[11px] font-bold text-zinc-300">
            {((deck.playbackRate - 1) * 100).toFixed(1)}%
          </div>
          <button
            onClick={() => onUpdateDeck(deck.id, { playbackRate: 1.0 })}
            className="text-[10px] font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-700"
            title="Reset Tempo"
          >
            RESET
          </button>
        </div>

        {/* Jogwheel Platter */}
        <div className="md:col-span-10 flex justify-center">
          <TurntableJogwheel
            deckId={deck.id}
            isPlaying={deck.isPlaying}
            thumbnail={deck.thumbnail}
            playbackRate={deck.playbackRate}
            isScratching={deck.isScratching}
            scratchDirection={deck.scratchDirection}
            onScratch={(dir, secs) => onScratch(dir, secs)}
            accentColor={accentColor}
          />
        </div>
      </div>

      {/* Progress / Seek Waveform Scrubber */}
      <div className="mb-4">
        <input
          type="range"
          min="0"
          max={deck.duration || 100}
          value={deck.currentTime}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          className="w-full h-2 rounded-lg bg-zinc-800 accent-cyan-400 cursor-pointer"
        />
      </div>

      {/* Transport Controls (Cue / Play) & Volume Slider */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        {/* Play & Cue Pioneer Buttons */}
        <div className="flex items-center gap-2">
          {/* Cue Button */}
          <button
            onClick={() => {
              const cueTime = deck.hotCues[0]?.active ? deck.hotCues[0].time : 0;
              onSeek(cueTime, true);
              audioFX.playCueClick();
            }}
            className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-400 font-mono font-extrabold border border-amber-500/30 flex items-center justify-center gap-1.5 text-xs shadow-md active:scale-95 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            CUE
          </button>

          {/* Play / Pause Main Pioneer Button */}
          <button
            onClick={onTogglePlay}
            className={`flex-1 py-2.5 rounded-xl font-mono font-extrabold border flex items-center justify-center gap-1.5 text-xs shadow-md active:scale-95 transition-all ${playBtnColor}`}
          >
            {deck.isPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-current" />
                PAUSE
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                PLAY
              </>
            )}
          </button>
        </div>

        {/* Deck Volume Slider */}
        <div className="bg-zinc-900/80 p-2 rounded-xl border border-zinc-800 flex items-center gap-2">
          <button
            onClick={() => onUpdateDeck(deck.id, { muted: !deck.muted })}
            className="text-zinc-400 hover:text-white"
          >
            {deck.muted || deck.volume === 0 ? (
              <VolumeX className="w-4 h-4 text-red-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-zinc-300" />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="100"
            value={deck.muted ? 0 : deck.volume}
            onChange={handleVolumeChange}
            className="w-full h-1.5 bg-zinc-800 rounded-lg accent-cyan-400 cursor-pointer"
          />
          <span className="font-mono text-xs font-bold text-zinc-300 w-8 text-right">
            {deck.muted ? '0%' : `${deck.volume}%`}
          </span>
          <span className="text-[10px] font-mono bg-zinc-950 text-zinc-400 px-1 rounded border border-zinc-800">
            {isLeft ? 'E/D' : '↑/↓'}
          </span>
        </div>
      </div>

      {/* Hot Cues & Loop Section */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800/60">
        {/* Hot Cues */}
        <div className="bg-zinc-900/40 p-2 rounded-lg border border-zinc-800/60">
          <div className="text-[10px] font-mono text-zinc-400 font-bold mb-1.5 flex items-center justify-between">
            <span>HOT CUES</span>
            <span className="text-zinc-500">CLICK TO JUMP</span>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {[0, 1, 2].map((idx) => {
              const cue = deck.hotCues[idx];
              return (
                <div key={idx} className="flex flex-col gap-1">
                  <button
                    onClick={() => (cue?.active ? onJumpHotCue(idx) : onSetHotCue(idx))}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      onSetHotCue(idx);
                    }}
                    className={`py-1 px-1 rounded text-[10px] font-mono font-bold border transition-all ${
                      cue?.active
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                        : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-zinc-300'
                    }`}
                  >
                    CUE {idx + 1}
                    {cue?.active && (
                      <span className="block text-[8px] text-amber-400/80 truncate">
                        {formatTime(cue.time)}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onResetHotCue(idx);
                    }}
                    disabled={!cue?.active}
                    className={`py-0.5 rounded text-[8px] font-mono font-bold border flex items-center justify-center gap-0.5 transition-all ${
                      cue?.active
                        ? 'bg-red-950/60 hover:bg-red-900 text-red-300 border-red-700/60 cursor-pointer active:scale-95'
                        : 'bg-zinc-900/40 text-zinc-600 border-zinc-800/40 cursor-not-allowed opacity-40'
                    }`}
                    title={`CUE ${idx + 1} 리셋`}
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>리셋</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Auto Loops */}
        <div className="bg-zinc-900/40 p-2 rounded-lg border border-zinc-800/60">
          <div className="text-[10px] font-mono text-zinc-400 font-bold mb-1.5 flex items-center justify-between">
            <span>BEAT LOOP</span>
            {deck.loop.active && (
              <button
                onClick={onExitLoop}
                className="text-[9px] text-red-400 font-bold hover:underline"
              >
                EXIT
              </button>
            )}
          </div>
          <div className="grid grid-cols-4 gap-1">
            {[1, 2, 4, 8].map((beats) => (
              <button
                key={beats}
                onClick={() => onTriggerLoop(beats)}
                className={`py-1 rounded text-[10px] font-mono font-bold border transition-all ${
                  deck.loop.active && deck.loop.lengthBeats === beats
                    ? 'bg-cyan-500/30 text-cyan-300 border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.3)] animate-pulse'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                }`}
              >
                {beats}B
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Scratch Audio File Attachment Panel */}
      <div className="mt-3 bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-800/80 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-zinc-300">
            <Zap className={`w-3.5 h-3.5 ${isLeft ? 'text-cyan-400' : 'text-orange-400'}`} />
            <span>스크래치 음원 첨부 ({isLeft ? 'DECK A' : 'DECK B'})</span>
          </div>
          {scratchFileName ? (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              첨부 음원 사용 중
            </span>
          ) : (
            <span className="text-[10px] font-mono text-zinc-500">
              기본 신시사이저 음원
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {scratchFileName ? (
            <div className="flex-1 flex items-center justify-between bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-800 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <FileAudio className={`w-4 h-4 shrink-0 ${isLeft ? 'text-cyan-400' : 'text-orange-400'}`} />
                <span className="text-xs text-zinc-200 font-mono truncate">{scratchFileName}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <button
                  type="button"
                  onClick={handleTestScratch}
                  className="px-2 py-1 text-[10px] font-mono font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded border border-zinc-700 flex items-center gap-1 active:scale-95 transition-transform"
                  title="테스트 스크래치 소리 들어보기"
                >
                  <Volume2 className="w-3 h-3" />
                  테스트
                </button>
                <button
                  type="button"
                  onClick={handleRemoveScratchFile}
                  className="p-1 text-zinc-400 hover:text-red-400 rounded hover:bg-zinc-800 transition-colors"
                  title="기본 스크래치 음원으로 초기화"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <label className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-dashed cursor-pointer transition-all ${
              isLeft
                ? 'border-cyan-500/40 hover:border-cyan-400 bg-cyan-950/20 hover:bg-cyan-950/40 text-cyan-300'
                : 'border-orange-500/40 hover:border-orange-400 bg-orange-950/20 hover:bg-orange-950/40 text-orange-300'
            }`}>
              <Upload className="w-4 h-4 shrink-0" />
              <span className="text-xs font-mono font-bold truncate">
                {isUploadingScratch ? '음원 처리 중...' : '스크래치용 오디오 파일 선택 (.mp3, .wav)'}
              </span>
              <input
                type="file"
                accept="audio/*"
                onChange={handleScratchFileUpload}
                disabled={isUploadingScratch}
                className="hidden"
              />
            </label>
          )}
        </div>
      </div>
    </div>
  );
};
