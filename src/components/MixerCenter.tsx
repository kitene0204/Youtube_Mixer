import React, { useState } from 'react';
import { Volume2, Sliders, Zap, Radio, Sparkles, Upload, Trash2, CheckCircle2, Music } from 'lucide-react';
import { DeckState, CrossfaderCurve } from '../types';
import { audioFX } from '../utils/audioEffects';

interface MixerCenterProps {
  leftDeck: DeckState;
  rightDeck: DeckState;
  crossfaderPos: number; // 0 (Left) to 1 (Right)
  crossfaderCurve: CrossfaderCurve;
  masterVolume: number;
  onCrossfaderChange: (pos: number) => void;
  onCurveChange: (curve: CrossfaderCurve) => void;
  onMasterVolumeChange: (vol: number) => void;
  onUpdateDeckEq: (deckId: 'left' | 'right', param: 'eqLow' | 'eqMid' | 'eqHigh' | 'gain' | 'filterValue', val: number) => void;
}

export const MixerCenter: React.FC<MixerCenterProps> = ({
  leftDeck,
  rightDeck,
  crossfaderPos,
  crossfaderCurve,
  masterVolume,
  onCrossfaderChange,
  onCurveChange,
  onMasterVolumeChange,
  onUpdateDeckEq,
}) => {
  const [airhornFileName, setAirhornFileName] = useState<string | null>(
    audioFX.getCustomEffectFileName('airhorn')
  );
  const [brakeFileName, setBrakeFileName] = useState<string | null>(
    audioFX.getCustomEffectFileName('brake')
  );
  const [isUploading, setIsUploading] = useState<'airhorn' | 'brake' | null>(null);

  const handleEffectUpload = async (
    effectType: 'airhorn' | 'brake',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploading(effectType);
      const fileName = await audioFX.loadCustomEffect(effectType, file);
      if (effectType === 'airhorn') setAirhornFileName(fileName);
      else setBrakeFileName(fileName);
    } catch (err) {
      console.error(`Failed to load custom ${effectType} effect:`, err);
      alert('오디오 파일 읽기 실패: MP3, WAV, OGG, M4A 형식의 음원을 사용해주세요.');
    } finally {
      setIsUploading(null);
    }
  };

  const handleRemoveEffect = (effectType: 'airhorn' | 'brake') => {
    audioFX.removeCustomEffect(effectType);
    if (effectType === 'airhorn') setAirhornFileName(null);
    else setBrakeFileName(null);
  };

  // Render Pioneer Horizontal Fader Slider (Crossfader Style)
  const renderSlider = (
    label: string,
    value: number, // e.g., -12 to +12, -100 to +100, or 0 to 100
    min: number,
    max: number,
    onChange: (val: number) => void,
    accentColor: string = 'cyan',
    defaultValue: number = 0
  ) => {
    // Format display string
    let displayVal = `${value > 0 ? '+' : ''}${value.toFixed(0)}`;
    if (label.includes('FILTER')) {
      if (value < 0) displayVal = `LPF ${Math.abs(value)}`;
      else if (value > 0) displayVal = `HPF ${value}`;
      else displayVal = 'OFF';
    } else if (label === 'TRIM') {
      displayVal = `${value}%`;
    }

    const isCyan = accentColor.includes('cyan');
    const isOrange = accentColor.includes('orange');

    const textColorClass = isCyan
      ? 'text-cyan-400'
      : isOrange
      ? 'text-orange-400'
      : 'text-yellow-400';

    const accentClass = isCyan
      ? 'accent-cyan-400'
      : isOrange
      ? 'accent-orange-400'
      : 'accent-yellow-400';

    const borderGlowClass = isCyan
      ? 'hover:border-cyan-500/50'
      : isOrange
      ? 'hover:border-orange-500/50'
      : 'hover:border-yellow-500/50';

    const defaultPct = ((defaultValue - min) / (max - min)) * 100;

    return (
      <div
        className={`w-full flex flex-col gap-1 p-2 rounded-xl bg-zinc-950/80 border border-zinc-800/90 ${borderGlowClass} transition-all shadow-md group`}
        onWheel={(e) => {
          e.preventDefault();
          const step = label === 'TRIM' || label.includes('FILTER') ? 2 : 1;
          const delta = e.deltaY < 0 ? step : -step;
          onChange(Math.min(max, Math.max(min, value + delta)));
        }}
        title={`${label}: ${displayVal}\n- 좌우 슬라이더 및 마우스 휠 조작\n- 더블클릭시 기본값(${defaultValue}) 리셋`}
      >
        <div className="flex items-center justify-between text-[11px] font-mono px-0.5">
          <span className="font-bold text-zinc-300 tracking-wider flex items-center gap-1">
            {label}
          </span>
          <button
            type="button"
            onClick={() => onChange(defaultValue)}
            className={`font-mono font-bold ${textColorClass} hover:underline cursor-pointer text-xs`}
            title="기본값 리셋"
          >
            {displayVal}
          </button>
        </div>

        {/* Horizontal Crossfader Style Track */}
        <div
          className="relative w-full h-5 flex items-center"
          onDoubleClick={() => onChange(defaultValue)}
        >
          {/* Default Notch Center Line */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3.5 bg-zinc-600/80 rounded-full z-0 pointer-events-none"
            style={{ left: `calc(${defaultPct}% - 1px)` }}
          />

          {/* Slider Input */}
          <input
            type="range"
            min={min}
            max={max}
            step={1}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className={`w-full h-2.5 rounded bg-zinc-900 border border-zinc-800/80 ${accentClass} cursor-pointer shadow-inner z-10 transition-all`}
          />
        </div>
      </div>
    );
  };

  // Helper to compute effective output volume level for VU meter
  const getEffectiveDeckLevel = (deck: DeckState): number => {
    if (deck.muted) return 0;
    const trimGain = deck.gain / 80;
    const normLow = Math.max(0, (deck.eqLow + 12) / 12);
    const normMid = Math.max(0, (deck.eqMid + 12) / 12);
    const normHigh = Math.max(0, (deck.eqHigh + 12) / 12);
    const eqMultiplier = (0.45 * normLow) + (0.40 * normMid) + (0.15 * normHigh);

    let filterMultiplier = 1.0;
    if (deck.filterValue < 0) {
      filterMultiplier = Math.pow(1.0 - Math.abs(deck.filterValue) / 100, 1.2);
    } else if (deck.filterValue > 0) {
      filterMultiplier = Math.pow(1.0 - deck.filterValue / 100, 1.2);
    }

    return Math.min(100, Math.max(0, deck.volume * trimGain * eqMultiplier * filterMultiplier));
  };

  // Render Channel VU Meter LEDs
  const renderVUMeter = (isPlaying: boolean, level: number) => {
    const ledCount = 8;
    const activeLeds = isPlaying ? Math.ceil((level / 100) * ledCount) : 0;

    return (
      <div className="flex flex-col gap-1 py-1 px-1.5 bg-zinc-950 rounded-lg border border-zinc-800">
        {Array.from({ length: ledCount }).map((_, i) => {
          const revIndex = ledCount - 1 - i;
          const isActive = revIndex < activeLeds;
          let color = 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]';
          if (revIndex >= 6) color = 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]';
          else if (revIndex >= 4) color = 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.7)]';

          return (
            <div
              key={i}
              className={`w-2.5 h-1.5 rounded-xs transition-opacity duration-75 ${
                isActive ? color : 'bg-zinc-800/60'
              }`}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 shadow-2xl backdrop-blur-xl w-full">
      {/* Mixer Header */}
      <div className="flex flex-col gap-2 pb-3 mb-3 border-b border-zinc-800/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span className="font-mono text-xs font-bold tracking-wider text-zinc-200">
              PIONEER DJM MIXER
            </span>
          </div>

          {/* Pioneer DJ Sampler Sound FX Pads */}
          <div className="flex items-center gap-2">
            {/* AIRHORN PAD WITH UPLOAD */}
            <div className="flex items-center rounded-lg bg-red-950/80 border border-red-700/60 p-0.5 shadow-md">
              <button
                type="button"
                onClick={() => audioFX.playAirhorn()}
                className="px-2.5 py-1 text-[11px] font-mono font-bold text-red-300 hover:bg-red-900/80 rounded flex items-center gap-1 active:scale-95 transition-all"
                title="AIRHORN 효과음 재생"
              >
                <Radio className="w-3.5 h-3.5 text-red-400" />
                AIRHORN
              </button>
              <label
                className="p-1 text-red-400 hover:text-white hover:bg-red-800/60 rounded cursor-pointer transition-colors"
                title="AIRHORN 커스텀 오디오 파일 업로드 (.mp3, .wav)"
              >
                <Upload className="w-3.5 h-3.5" />
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => handleEffectUpload('airhorn', e)}
                  disabled={isUploading === 'airhorn'}
                  className="hidden"
                />
              </label>
              {airhornFileName && (
                <button
                  type="button"
                  onClick={() => handleRemoveEffect('airhorn')}
                  className="p-1 text-red-400 hover:text-white hover:bg-red-800/80 rounded transition-colors"
                  title="기본 AIRHORN 음원으로 초기화"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* BRAKE PAD WITH UPLOAD */}
            <div className="flex items-center rounded-lg bg-amber-950/80 border border-amber-700/60 p-0.5 shadow-md">
              <button
                type="button"
                onClick={() => audioFX.playVinylBrake()}
                className="px-2.5 py-1 text-[11px] font-mono font-bold text-amber-300 hover:bg-amber-900/80 rounded flex items-center gap-1 active:scale-95 transition-all"
                title="BRAKE 효과음 재생"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                BRAKE
              </button>
              <label
                className="p-1 text-amber-400 hover:text-white hover:bg-amber-800/60 rounded cursor-pointer transition-colors"
                title="BRAKE 커스텀 오디오 파일 업로드 (.mp3, .wav)"
              >
                <Upload className="w-3.5 h-3.5" />
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => handleEffectUpload('brake', e)}
                  disabled={isUploading === 'brake'}
                  className="hidden"
                />
              </label>
              {brakeFileName && (
                <button
                  type="button"
                  onClick={() => handleRemoveEffect('brake')}
                  className="p-1 text-amber-400 hover:text-white hover:bg-amber-800/80 rounded transition-colors"
                  title="기본 BRAKE 음원으로 초기화"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Custom Effects Filenames Status Strip if attached */}
        {(airhornFileName || brakeFileName) && (
          <div className="flex items-center justify-end gap-3 text-[10px] font-mono text-zinc-400 bg-zinc-900/60 px-2.5 py-1 rounded-md border border-zinc-800/60">
            {airhornFileName && (
              <span className="flex items-center gap-1 text-red-400 truncate max-w-[180px]">
                <CheckCircle2 className="w-3 h-3 text-red-400 shrink-0" />
                AIRHORN: {airhornFileName}
              </span>
            )}
            {brakeFileName && (
              <span className="flex items-center gap-1 text-amber-400 truncate max-w-[180px]">
                <CheckCircle2 className="w-3 h-3 text-amber-400 shrink-0" />
                BRAKE: {brakeFileName}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 2 Channel Strip Control Board */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Left Channel (Deck A) Strip */}
        <div className="bg-zinc-900/40 p-3 rounded-xl border border-cyan-500/20 flex flex-col items-center gap-3">
          <div className="text-[11px] font-mono font-bold text-cyan-400">CH 1 (LEFT)</div>

          {/* Gain Trim */}
          {renderSlider(
            'TRIM',
            leftDeck.gain,
            0,
            100,
            (v) => onUpdateDeckEq('left', 'gain', v),
            'cyan',
            80
          )}

          {/* 3 Band EQ */}
          <div className="flex flex-col gap-2 w-full pt-1 border-t border-zinc-800">
            {renderSlider('HI', leftDeck.eqHigh, -12, 12, (v) => onUpdateDeckEq('left', 'eqHigh', v), 'cyan', 0)}
            {renderSlider('MID', leftDeck.eqMid, -12, 12, (v) => onUpdateDeckEq('left', 'eqMid', v), 'cyan', 0)}
            {renderSlider('LOW', leftDeck.eqLow, -12, 12, (v) => onUpdateDeckEq('left', 'eqLow', v), 'cyan', 0)}
          </div>

          {/* Sound Color Filter FX */}
          <div className="pt-1 border-t border-zinc-800 w-full">
            {renderSlider(
              'FILTER (LPF/HPF)',
              leftDeck.filterValue,
              -100,
              100,
              (v) => onUpdateDeckEq('left', 'filterValue', v),
              'yellow',
              0
            )}
          </div>
        </div>

        {/* Right Channel (Deck B) Strip */}
        <div className="bg-zinc-900/40 p-3 rounded-xl border border-orange-500/20 flex flex-col items-center gap-2.5">
          <div className="text-[11px] font-mono font-bold text-orange-400">CH 2 (RIGHT)</div>

          {/* Gain Trim */}
          {renderSlider(
            'TRIM',
            rightDeck.gain,
            0,
            100,
            (v) => onUpdateDeckEq('right', 'gain', v),
            'orange',
            80
          )}

          {/* 3 Band EQ */}
          <div className="flex flex-col gap-2 w-full pt-1 border-t border-zinc-800">
            {renderSlider('HI', rightDeck.eqHigh, -12, 12, (v) => onUpdateDeckEq('right', 'eqHigh', v), 'orange', 0)}
            {renderSlider('MID', rightDeck.eqMid, -12, 12, (v) => onUpdateDeckEq('right', 'eqMid', v), 'orange', 0)}
            {renderSlider('LOW', rightDeck.eqLow, -12, 12, (v) => onUpdateDeckEq('right', 'eqLow', v), 'orange', 0)}
          </div>

          {/* Sound Color Filter FX */}
          <div className="pt-1 border-t border-zinc-800 w-full">
            {renderSlider(
              'FILTER (LPF/HPF)',
              rightDeck.filterValue,
              -100,
              100,
              (v) => onUpdateDeckEq('right', 'filterValue', v),
              'yellow',
              0
            )}
          </div>
        </div>
      </div>

      {/* Master Volume & Center Level Meters */}
      <div className="bg-zinc-900/60 p-3 rounded-xl border border-zinc-800 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {renderVUMeter(leftDeck.isPlaying, getEffectiveDeckLevel(leftDeck))}
          <span className="text-[10px] font-mono text-zinc-500 rotate-90">VU</span>
          {renderVUMeter(rightDeck.isPlaying, getEffectiveDeckLevel(rightDeck))}
        </div>

        <div className="flex items-center gap-2 font-mono">
          <Volume2 className="w-4 h-4 text-zinc-400" />
          <span className="text-xs text-zinc-300 font-bold">MASTER</span>
          <input
            type="range"
            min="0"
            max="100"
            value={masterVolume}
            onChange={(e) => onMasterVolumeChange(parseInt(e.target.value, 10))}
            className="w-24 h-1.5 bg-zinc-800 rounded-lg accent-cyan-400 cursor-pointer"
          />
          <span className="text-xs text-cyan-400 font-bold w-8">{masterVolume}%</span>
        </div>
      </div>

      {/* Master Crossfader Section */}
      <div className="bg-zinc-900/80 p-3.5 rounded-xl border border-zinc-800 flex flex-col items-center gap-2">
        <div className="w-full flex items-center justify-between text-[11px] font-mono font-bold">
          <span className="text-cyan-400">CH 1 (LEFT)</span>
          <div className="flex items-center gap-1">
            <span className="text-zinc-500">CURVE:</span>
            {(['smooth', 'linear', 'sharp'] as CrossfaderCurve[]).map((c) => (
              <button
                key={c}
                onClick={() => onCurveChange(c)}
                className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold border transition-colors ${
                  crossfaderCurve === c
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60'
                    : 'bg-zinc-900 text-zinc-500 border-zinc-800'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <span className="text-orange-400">CH 2 (RIGHT)</span>
        </div>

        {/* Crossfader Track & Slider */}
        <div className="relative w-full py-2 flex items-center">
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={crossfaderPos}
            onChange={(e) => onCrossfaderChange(parseFloat(e.target.value))}
            className="w-full h-3 rounded-lg bg-zinc-950 border border-zinc-800 accent-amber-500 cursor-pointer shadow-inner"
          />
        </div>

        <div className="w-full flex justify-between text-[9px] font-mono text-zinc-500">
          <span>▲ 100% LEFT</span>
          <button
            onClick={() => onCrossfaderChange(0.5)}
            className="hover:text-zinc-300 underline"
          >
            RESET CENTER (50:50)
          </button>
          <span>100% RIGHT ▲</span>
        </div>
      </div>
    </div>
  );
};
