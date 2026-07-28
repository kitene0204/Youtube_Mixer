import React from 'react';
import { Keyboard, HelpCircle, Sparkles } from 'lucide-react';

interface KeyboardGuideProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const KeyboardGuide: React.FC<KeyboardGuideProps> = ({ isOpen, onToggle }) => {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-300 text-xs font-mono font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95"
      >
        <Keyboard className="w-4 h-4 text-cyan-400" />
        <span>키보드 단축키 안내</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 md:w-96 z-50 p-4 rounded-2xl bg-zinc-950/95 border border-zinc-700 shadow-2xl backdrop-blur-xl text-zinc-200 text-xs">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-zinc-800">
            <div className="flex items-center gap-2 font-mono font-bold text-cyan-400">
              <Sparkles className="w-4 h-4" />
              DJ 키보드 조작법
            </div>
            <button onClick={onToggle} className="text-zinc-500 hover:text-white">✕</button>
          </div>

          <div className="space-y-4">
            {/* Left Deck */}
            <div className="bg-cyan-950/30 p-2.5 rounded-xl border border-cyan-800/40">
              <div className="font-mono font-bold text-cyan-300 mb-2 flex items-center justify-between">
                <span>LEFT DECK (왼손 조작)</span>
                <span className="text-[10px] bg-cyan-900/60 px-1.5 py-0.5 rounded text-cyan-200">DECK A</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-1 bg-zinc-800 border border-zinc-600 rounded font-bold text-white shadow">A</kbd>
                  <span className="text-zinc-300">뒤로 스크래치</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-1 bg-zinc-800 border border-zinc-600 rounded font-bold text-white shadow">F</kbd>
                  <span className="text-zinc-300">앞으로 스크래치</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-1 bg-zinc-800 border border-zinc-600 rounded font-bold text-white shadow">E</kbd>
                  <span className="text-zinc-300">볼륨 업 (+5%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-1 bg-zinc-800 border border-zinc-600 rounded font-bold text-white shadow">D</kbd>
                  <span className="text-zinc-300">볼륨 다운 (-5%)</span>
                </div>
                <div className="col-span-2 pt-1 border-t border-cyan-900/60 flex items-center gap-2">
                  <span className="text-cyan-400 font-bold">HOT CUE 1,2,3 :</span>
                  <div className="flex gap-1">
                    <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-600 rounded font-bold text-amber-300 shadow">1</kbd>
                    <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-600 rounded font-bold text-amber-300 shadow">2</kbd>
                    <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-600 rounded font-bold text-amber-300 shadow">3</kbd>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Deck */}
            <div className="bg-orange-950/30 p-2.5 rounded-xl border border-orange-800/40">
              <div className="font-mono font-bold text-orange-300 mb-2 flex items-center justify-between">
                <span>RIGHT DECK (오른손 조작)</span>
                <span className="text-[10px] bg-orange-900/60 px-1.5 py-0.5 rounded text-orange-200">DECK B</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-1 bg-zinc-800 border border-zinc-600 rounded font-bold text-white shadow">←</kbd>
                  <span className="text-zinc-300">뒤로 스크래치</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-1 bg-zinc-800 border border-zinc-600 rounded font-bold text-white shadow">→</kbd>
                  <span className="text-zinc-300">앞으로 스크래치</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-1 bg-zinc-800 border border-zinc-600 rounded font-bold text-white shadow">↑</kbd>
                  <span className="text-zinc-300">볼륨 업 (+5%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-1 bg-zinc-800 border border-zinc-600 rounded font-bold text-white shadow">↓</kbd>
                  <span className="text-zinc-300">볼륨 다운 (-5%)</span>
                </div>
                <div className="col-span-2 pt-1 border-t border-orange-900/60 flex items-center gap-2">
                  <span className="text-orange-400 font-bold">HOT CUE 1,2,3 :</span>
                  <div className="flex gap-1 text-[10px]">
                    <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-600 rounded font-bold text-amber-300 shadow">Insert</kbd>
                    <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-600 rounded font-bold text-amber-300 shadow">Home</kbd>
                    <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-600 rounded font-bold text-amber-300 shadow">PgUp</kbd>
                  </div>
                </div>
              </div>
            </div>

            {/* Global & Crossfader Controls */}
            <div className="text-[11px] font-mono text-zinc-400 bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800 space-y-1.5">
              <div className="font-bold text-zinc-200 mb-1 flex items-center justify-between">
                <span>CROSSFADER (크로스페이더)</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-zinc-300">
                <div><kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-600 rounded font-bold text-cyan-400 shadow">Left Ctrl</kbd> : 왼쪽 연속 이동 (길게 누름)</div>
                <div><kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-600 rounded font-bold text-orange-400 shadow">Right Ctrl</kbd> : 오른쪽 연속 이동 (길게 누름)</div>
              </div>
              <div className="pt-1 border-t border-zinc-800 text-zinc-400">
                💡 <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-600 rounded font-bold text-zinc-200 shadow">Spacebar</kbd> : 크로스페이더 중앙(50:50) 리셋
              </div>
              <div>💡 마우스로 턴테이블 잡휠을 직접 돌려 스크래치 가능</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
