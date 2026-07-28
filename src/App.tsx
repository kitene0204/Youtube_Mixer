import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Headphones, Disc, Sliders, Play, Pause, Volume2, Sparkles, RefreshCw, HelpCircle } from 'lucide-react';
import { DeckState, DeckId, CrossfaderCurve, SampleTrack } from './types';
import { YTPlayer } from './types/youtube';
import { extractYouTubeId, calculateCrossfaderGains, SAMPLE_TRACKS, fetchYouTubeVideoMeta } from './utils/youtube';
import { audioFX } from './utils/audioEffects';
import { DeckControl } from './components/DeckControl';
import { MixerCenter } from './components/MixerCenter';
import { KeyboardGuide } from './components/KeyboardGuide';

const initialDeckState = (id: DeckId, defaultTrack: SampleTrack): DeckState => ({
  id,
  url: defaultTrack.youtubeUrl,
  videoId: defaultTrack.youtubeId,
  title: defaultTrack.title,
  artist: defaultTrack.artist,
  thumbnail: `https://img.youtube.com/vi/${defaultTrack.youtubeId}/hqdefault.jpg`,
  isPlaying: false,
  volume: 80,
  muted: false,
  playbackRate: 1.0,
  currentTime: 0,
  duration: 0,
  bpm: defaultTrack.bpm,
  isScratching: false,
  scratchDirection: null,
  hotCues: [
    { id: 1, time: 0, active: false, color: '#f59e0b' },
    { id: 2, time: 0, active: false, color: '#06b6d4' },
    { id: 3, time: 0, active: false, color: '#ec4899' },
  ],
  loop: {
    active: false,
    lengthBeats: 4,
    startTime: null,
    endTime: null,
  },
  vinylMode: true,
  slipMode: false,
  filterValue: 0,
  eqLow: 0,
  eqMid: 0,
  eqHigh: 0,
  gain: 80,
});

export default function App() {
  // Left Deck & Right Deck State
  const [leftDeck, setLeftDeck] = useState<DeckState>(() => initialDeckState('left', SAMPLE_TRACKS[0]));
  const [rightDeck, setRightDeck] = useState<DeckState>(() => initialDeckState('right', SAMPLE_TRACKS[1]));

  // Refs for current deck states to avoid stale closures in event listeners
  const leftDeckRef = useRef(leftDeck);
  leftDeckRef.current = leftDeck;
  const rightDeckRef = useRef(rightDeck);
  rightDeckRef.current = rightDeck;

  // Mixer State
  const [crossfaderPos, setCrossfaderPos] = useState<number>(0.5); // 0 (Left) to 1 (Right)
  const [crossfaderCurve, setCrossfaderCurve] = useState<CrossfaderCurve>('smooth');
  const [masterVolume, setMasterVolume] = useState<number>(85);
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);

  // YouTube Players Refs
  const playerLeftRef = useRef<YTPlayer | null>(null);
  const playerRightRef = useRef<YTPlayer | null>(null);
  const [isYTApiReady, setIsYTApiReady] = useState(false);

  // Scratch keypress hold state
  const pressedKeysRef = useRef<{ [key: string]: boolean }>({});

  // Initialize YouTube IFrame API
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setIsYTApiReady(true);
      return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      setIsYTApiReady(true);
    };
  }, []);

  // Fetch YouTube Metadata for Left Deck when videoId changes
  useEffect(() => {
    if (!leftDeck.videoId) return;
    let isMounted = true;
    fetchYouTubeVideoMeta(leftDeck.videoId).then((meta) => {
      if (isMounted && meta && meta.title) {
        setLeftDeck((prev) => {
          if (
            !prev.title ||
            prev.title.startsWith('YouTube Track') ||
            prev.title === '곡 정보 검색 중...' ||
            prev.title.startsWith('YouTube Video')
          ) {
            return {
              ...prev,
              title: meta.title,
              artist: meta.author || prev.artist,
              thumbnail: meta.thumbnailUrl || prev.thumbnail,
            };
          }
          return prev;
        });
      }
    });
    return () => {
      isMounted = false;
    };
  }, [leftDeck.videoId]);

  // Fetch YouTube Metadata for Right Deck when videoId changes
  useEffect(() => {
    if (!rightDeck.videoId) return;
    let isMounted = true;
    fetchYouTubeVideoMeta(rightDeck.videoId).then((meta) => {
      if (isMounted && meta && meta.title) {
        setRightDeck((prev) => {
          if (
            !prev.title ||
            prev.title.startsWith('YouTube Track') ||
            prev.title === '곡 정보 검색 중...' ||
            prev.title.startsWith('YouTube Video')
          ) {
            return {
              ...prev,
              title: meta.title,
              artist: meta.author || prev.artist,
              thumbnail: meta.thumbnailUrl || prev.thumbnail,
            };
          }
          return prev;
        });
      }
    });
    return () => {
      isMounted = false;
    };
  }, [rightDeck.videoId]);

  // Instantiate Left YouTube Player
  useEffect(() => {
    if (!isYTApiReady || !leftDeck.videoId) return;

    if (playerLeftRef.current) {
      playerLeftRef.current.destroy();
      playerLeftRef.current = null;
    }

    try {
      playerLeftRef.current = new window.YT.Player('yt-player-left', {
        height: '100%',
        width: '100%',
        videoId: leftDeck.videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          enablejsapi: 1,
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onReady: (e) => {
            let videoTitle = '';
            let videoAuthor = '';
            if (e.target && typeof e.target.getVideoData === 'function') {
              const data = e.target.getVideoData();
              if (data && data.title) {
                videoTitle = data.title;
                videoAuthor = data.author;
              }
            }

            setLeftDeck((prev) => ({
              ...prev,
              duration: e.target.getDuration() || prev.duration,
              ...(videoTitle &&
              (!prev.title ||
                prev.title.startsWith('YouTube Track') ||
                prev.title === '곡 정보 검색 중...' ||
                prev.title.startsWith('YouTube Video'))
                ? { title: videoTitle, artist: videoAuthor || prev.artist }
                : {}),
            }));
          },
          onStateChange: (e) => {
            if (e.data === window.YT.PlayerState.PLAYING) {
              setLeftDeck((prev) => ({ ...prev, isPlaying: true }));
            } else if (e.data === window.YT.PlayerState.PAUSED || e.data === window.YT.PlayerState.ENDED) {
              setLeftDeck((prev) => ({ ...prev, isPlaying: false }));
            }
          },
        },
      });
    } catch {
      // player create catch
    }
  }, [isYTApiReady, leftDeck.videoId]);

  // Instantiate Right YouTube Player
  useEffect(() => {
    if (!isYTApiReady || !rightDeck.videoId) return;

    if (playerRightRef.current) {
      playerRightRef.current.destroy();
      playerRightRef.current = null;
    }

    try {
      playerRightRef.current = new window.YT.Player('yt-player-right', {
        height: '100%',
        width: '100%',
        videoId: rightDeck.videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          enablejsapi: 1,
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onReady: (e) => {
            let videoTitle = '';
            let videoAuthor = '';
            if (e.target && typeof e.target.getVideoData === 'function') {
              const data = e.target.getVideoData();
              if (data && data.title) {
                videoTitle = data.title;
                videoAuthor = data.author;
              }
            }

            setRightDeck((prev) => ({
              ...prev,
              duration: e.target.getDuration() || prev.duration,
              ...(videoTitle &&
              (!prev.title ||
                prev.title.startsWith('YouTube Track') ||
                prev.title === '곡 정보 검색 중...' ||
                prev.title.startsWith('YouTube Video'))
                ? { title: videoTitle, artist: videoAuthor || prev.artist }
                : {}),
            }));
          },
          onStateChange: (e) => {
            if (e.data === window.YT.PlayerState.PLAYING) {
              setRightDeck((prev) => ({ ...prev, isPlaying: true }));
            } else if (e.data === window.YT.PlayerState.PAUSED || e.data === window.YT.PlayerState.ENDED) {
              setRightDeck((prev) => ({ ...prev, isPlaying: false }));
            }
          },
        },
      });
    } catch {
      // player create catch
    }
  }, [isYTApiReady, rightDeck.videoId]);

  // Helper to compute effective output volume considering all Mixer controls (TRIM, EQ, FILTER, Crossfader, Master)
  const computeDeckEffectiveVolume = (
    deck: DeckState,
    crossfaderGain: number,
    masterVol: number
  ): number => {
    if (deck.muted) return 0;

    // 1. Gain Trim (0 to 100, nominal 80 = 1.0x)
    const trimGain = deck.gain / 80;

    // 2. 3-Band EQ (-12 dB to +12 dB)
    const normLow = Math.max(0, (deck.eqLow + 12) / 12);
    const normMid = Math.max(0, (deck.eqMid + 12) / 12);
    const normHigh = Math.max(0, (deck.eqHigh + 12) / 12);
    const eqMultiplier = 0.45 * normLow + 0.40 * normMid + 0.15 * normHigh;

    // 3. Sound Color Filter LPF / HPF (-100 to +100)
    let filterMultiplier = 1.0;
    if (deck.filterValue < 0) {
      const factor = Math.abs(deck.filterValue) / 100;
      filterMultiplier = Math.pow(1.0 - factor, 1.2);
    } else if (deck.filterValue > 0) {
      const factor = deck.filterValue / 100;
      filterMultiplier = Math.pow(1.0 - factor, 1.2);
    }

    // 4. Base Deck Volume (0-100) & Master Volume (0-100)
    const baseVol = deck.volume / 100;
    const master = masterVol / 100;

    const total = baseVol * trimGain * eqMultiplier * filterMultiplier * crossfaderGain * master * 100;
    return Math.min(100, Math.max(0, total));
  };

  // Sync Audio Volumes with Crossfader, TRIM, EQ & FILTER
  useEffect(() => {
    const { leftGain, rightGain } = calculateCrossfaderGains(crossfaderPos, crossfaderCurve);

    // Left Deck Effective Volume
    const effLeftVol = computeDeckEffectiveVolume(leftDeck, leftGain, masterVolume);
    if (playerLeftRef.current && typeof playerLeftRef.current.setVolume === 'function') {
      playerLeftRef.current.setVolume(effLeftVol);
    }

    // Right Deck Effective Volume
    const effRightVol = computeDeckEffectiveVolume(rightDeck, rightGain, masterVolume);
    if (playerRightRef.current && typeof playerRightRef.current.setVolume === 'function') {
      playerRightRef.current.setVolume(effRightVol);
    }
  }, [
    leftDeck.volume,
    leftDeck.muted,
    leftDeck.gain,
    leftDeck.eqLow,
    leftDeck.eqMid,
    leftDeck.eqHigh,
    leftDeck.filterValue,
    rightDeck.volume,
    rightDeck.muted,
    rightDeck.gain,
    rightDeck.eqLow,
    rightDeck.eqMid,
    rightDeck.eqHigh,
    rightDeck.filterValue,
    crossfaderPos,
    crossfaderCurve,
    masterVolume,
  ]);

  // Playback Rate Sync
  useEffect(() => {
    if (playerLeftRef.current && typeof playerLeftRef.current.setPlaybackRate === 'function') {
      playerLeftRef.current.setPlaybackRate(leftDeck.playbackRate);
    }
  }, [leftDeck.playbackRate]);

  useEffect(() => {
    if (playerRightRef.current && typeof playerRightRef.current.setPlaybackRate === 'function') {
      playerRightRef.current.setPlaybackRate(rightDeck.playbackRate);
    }
  }, [rightDeck.playbackRate]);

  // Periodic State & Time Sync Loop (100ms)
  useEffect(() => {
    const interval = setInterval(() => {
      // Left Deck Time Update
      if (playerLeftRef.current && typeof playerLeftRef.current.getCurrentTime === 'function') {
        const time = playerLeftRef.current.getCurrentTime() || 0;
        const dur = playerLeftRef.current.getDuration() || leftDeck.duration;

        // Auto Loop Boundary Check
        if (leftDeck.loop.active && leftDeck.loop.startTime !== null && leftDeck.loop.endTime !== null) {
          if (time >= leftDeck.loop.endTime) {
            playerLeftRef.current.seekTo(leftDeck.loop.startTime, true);
          }
        }

        setLeftDeck((prev) => ({ ...prev, currentTime: time, duration: dur }));
      }

      // Right Deck Time Update
      if (playerRightRef.current && typeof playerRightRef.current.getCurrentTime === 'function') {
        const time = playerRightRef.current.getCurrentTime() || 0;
        const dur = playerRightRef.current.getDuration() || rightDeck.duration;

        // Auto Loop Boundary Check
        if (rightDeck.loop.active && rightDeck.loop.startTime !== null && rightDeck.loop.endTime !== null) {
          if (time >= rightDeck.loop.endTime) {
            playerRightRef.current.seekTo(rightDeck.loop.startTime, true);
          }
        }

        setRightDeck((prev) => ({ ...prev, currentTime: time, duration: dur }));
      }
    }, 150);

    return () => clearInterval(interval);
  }, [leftDeck.duration, leftDeck.loop, rightDeck.duration, rightDeck.loop]);

  // Scratch Action Handler
  const handleScratch = useCallback((deckId: DeckId, direction: 'forward' | 'backward', customDeltaSecs?: number) => {
    const isLeft = deckId === 'left';
    const player = isLeft ? playerLeftRef.current : playerRightRef.current;
    const setDeck = isLeft ? setLeftDeck : setRightDeck;

    if (!player || typeof player.getCurrentTime !== 'function') return;

    const currentTime = player.getCurrentTime() || 0;
    const delta = customDeltaSecs !== undefined
      ? (direction === 'forward' ? customDeltaSecs : -customDeltaSecs)
      : (direction === 'forward' ? 1.0 : -1.0);

    const newTime = Math.max(0, currentTime + delta);
    player.seekTo(newTime, true);

    // Audio synthesizer feedback
    audioFX.playScratchSound(deckId, direction, 1.2);

    // UI visual indicator state
    setDeck((prev) => ({
      ...prev,
      isScratching: true,
      scratchDirection: direction,
      currentTime: newTime,
    }));

    // Reset scratch state after short buffer
    setTimeout(() => {
      setDeck((prev) => ({
        ...prev,
        isScratching: false,
        scratchDirection: null,
      }));
    }, 180);
  }, []);

  // Refs for continuous Crossfader movement intervals
  const ctrlLeftIntervalRef = useRef<number | null>(null);
  const ctrlRightIntervalRef = useRef<number | null>(null);

  // Keyboard Event Listener for Scratching, Volume, and Continuous Crossfader Movement
  useEffect(() => {
    const stopCtrlIntervals = () => {
      if (ctrlLeftIntervalRef.current !== null) {
        clearInterval(ctrlLeftIntervalRef.current);
        ctrlLeftIntervalRef.current = null;
      }
      if (ctrlRightIntervalRef.current !== null) {
        clearInterval(ctrlRightIntervalRef.current);
        ctrlRightIntervalRef.current = null;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing inside input elements
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      const isLeftCtrl = e.code === 'ControlLeft' || (e.key === 'Control' && (e.location === 1 || e.location === 0));
      const isRightCtrl = e.code === 'ControlRight' || (e.key === 'Control' && e.location === 2);

      // CONTINUOUS CROSSFADER KEYBOARD CONTROLS
      if (isLeftCtrl) {
        e.preventDefault();
        if (ctrlLeftIntervalRef.current === null) {
          if (ctrlRightIntervalRef.current !== null) {
            clearInterval(ctrlRightIntervalRef.current);
            ctrlRightIntervalRef.current = null;
          }
          setCrossfaderPos((prev) => Math.max(0, Math.round((prev - 0.02) * 1000) / 1000));
          ctrlLeftIntervalRef.current = window.setInterval(() => {
            setCrossfaderPos((prev) => Math.max(0, Math.round((prev - 0.015) * 1000) / 1000));
          }, 20);
        }
        return;
      }

      if (isRightCtrl) {
        e.preventDefault();
        if (ctrlRightIntervalRef.current === null) {
          if (ctrlLeftIntervalRef.current !== null) {
            clearInterval(ctrlLeftIntervalRef.current);
            ctrlLeftIntervalRef.current = null;
          }
          setCrossfaderPos((prev) => Math.min(1, Math.round((prev + 0.02) * 1000) / 1000));
          ctrlRightIntervalRef.current = window.setInterval(() => {
            setCrossfaderPos((prev) => Math.min(1, Math.round((prev + 0.015) * 1000) / 1000));
          }, 20);
        }
        return;
      }

      const key = e.key.toLowerCase();
      const codeKey = e.code || key;
      if (pressedKeysRef.current[key] || pressedKeysRef.current[codeKey]) return; // prevent duplicate keydown spam
      pressedKeysRef.current[key] = true;
      pressedKeysRef.current[codeKey] = true;

      // LEFT DECK KEYBOARD CONTROLS (A / F Scratch, E / D Volume, 1 / 2 / 3 Hot Cues)
      if (key === 'a') {
        e.preventDefault();
        handleScratch('left', 'backward');
      } else if (key === 'f') {
        e.preventDefault();
        handleScratch('left', 'forward');
      } else if (key === 'e') {
        e.preventDefault();
        setLeftDeck((prev) => ({ ...prev, volume: Math.min(100, prev.volume + 5) }));
      } else if (key === 'd') {
        e.preventDefault();
        setLeftDeck((prev) => ({ ...prev, volume: Math.max(0, prev.volume - 5) }));
      } else if (e.code === 'Digit1' || e.code === 'Numpad1' || key === '1') {
        e.preventDefault();
        const deck = leftDeckRef.current;
        if (deck.hotCues[0]?.active) handleJumpHotCue('left', 0);
        else handleSetHotCue('left', 0);
      } else if (e.code === 'Digit2' || e.code === 'Numpad2' || key === '2') {
        e.preventDefault();
        const deck = leftDeckRef.current;
        if (deck.hotCues[1]?.active) handleJumpHotCue('left', 1);
        else handleSetHotCue('left', 1);
      } else if (e.code === 'Digit3' || e.code === 'Numpad3' || key === '3') {
        e.preventDefault();
        const deck = leftDeckRef.current;
        if (deck.hotCues[2]?.active) handleJumpHotCue('left', 2);
        else handleSetHotCue('left', 2);
      }

      // RIGHT DECK KEYBOARD CONTROLS (← / → Scratch, ↑ / ↓ Volume, Insert / Home / PageUp Hot Cues)
      else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleScratch('right', 'backward');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleScratch('right', 'forward');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setRightDeck((prev) => ({ ...prev, volume: Math.min(100, prev.volume + 5) }));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setRightDeck((prev) => ({ ...prev, volume: Math.max(0, prev.volume - 5) }));
      } else if (e.code === 'Insert' || key === 'insert') {
        e.preventDefault();
        const deck = rightDeckRef.current;
        if (deck.hotCues[0]?.active) handleJumpHotCue('right', 0);
        else handleSetHotCue('right', 0);
      } else if (e.code === 'Home' || key === 'home') {
        e.preventDefault();
        const deck = rightDeckRef.current;
        if (deck.hotCues[1]?.active) handleJumpHotCue('right', 1);
        else handleSetHotCue('right', 1);
      } else if (e.code === 'PageUp' || key === 'pageup') {
        e.preventDefault();
        const deck = rightDeckRef.current;
        if (deck.hotCues[2]?.active) handleJumpHotCue('right', 2);
        else handleSetHotCue('right', 2);
      }

      // Global Spacebar -> Reset Crossfader to 50:50 Center
      else if (e.code === 'Space') {
        e.preventDefault();
        setCrossfaderPos(0.5);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const isLeftCtrl = e.code === 'ControlLeft' || (e.key === 'Control' && (e.location === 1 || e.location === 0));
      const isRightCtrl = e.code === 'ControlRight' || (e.key === 'Control' && e.location === 2);

      if (isLeftCtrl && ctrlLeftIntervalRef.current !== null) {
        clearInterval(ctrlLeftIntervalRef.current);
        ctrlLeftIntervalRef.current = null;
      }
      if (isRightCtrl && ctrlRightIntervalRef.current !== null) {
        clearInterval(ctrlRightIntervalRef.current);
        ctrlRightIntervalRef.current = null;
      }

      const key = e.key.toLowerCase();
      pressedKeysRef.current[key] = false;
      if (e.code) pressedKeysRef.current[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', stopCtrlIntervals);
    return () => {
      stopCtrlIntervals();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', stopCtrlIntervals);
    };
  }, [handleScratch]);

  // Toggle Play / Pause
  const handleTogglePlay = (deckId: DeckId) => {
    const isLeft = deckId === 'left';
    const player = isLeft ? playerLeftRef.current : playerRightRef.current;
    const deck = isLeft ? leftDeck : rightDeck;

    if (!player) return;

    if (deck.isPlaying) {
      player.pauseVideo();
    } else {
      player.playVideo();
    }
  };

  // Seek to specific time
  const handleSeek = (deckId: DeckId, seconds: number, forcePlay: boolean = false) => {
    const isLeft = deckId === 'left';
    const player = isLeft ? playerLeftRef.current : playerRightRef.current;
    const setDeck = isLeft ? setLeftDeck : setRightDeck;

    if (player && typeof player.seekTo === 'function') {
      player.seekTo(seconds, true);
      if (forcePlay && typeof player.playVideo === 'function') {
        player.playVideo();
      }
    }
    setDeck((prev) => ({
      ...prev,
      currentTime: seconds,
      ...(forcePlay ? { isPlaying: true } : {}),
    }));
  };

  // Hot Cue Handler
  const handleSetHotCue = (deckId: DeckId, index: number) => {
    const isLeft = deckId === 'left';
    const player = isLeft ? playerLeftRef.current : playerRightRef.current;
    const deck = isLeft ? leftDeckRef.current : rightDeckRef.current;
    const setDeck = isLeft ? setLeftDeck : setRightDeck;

    const exactTime = (player && typeof player.getCurrentTime === 'function')
      ? (player.getCurrentTime() || 0)
      : deck.currentTime;

    setDeck((prev) => {
      const newCues = [...prev.hotCues];
      newCues[index] = {
        ...newCues[index],
        time: exactTime,
        active: true,
      };
      return { ...prev, hotCues: newCues };
    });
    audioFX.playCueClick();
  };

  const handleJumpHotCue = (deckId: DeckId, index: number) => {
    const isLeft = deckId === 'left';
    const deck = isLeft ? leftDeckRef.current : rightDeckRef.current;
    const cue = deck.hotCues[index];
    if (cue && cue.active) {
      handleSeek(deckId, cue.time, true);
      audioFX.playCueClick();
    }
  };

  const handleResetHotCue = (deckId: DeckId, index: number) => {
    const isLeft = deckId === 'left';
    const setDeck = isLeft ? setLeftDeck : setRightDeck;

    setDeck((prev) => {
      const newCues = [...prev.hotCues];
      newCues[index] = {
        id: index + 1,
        time: 0,
        active: false,
      };
      return { ...prev, hotCues: newCues };
    });
    audioFX.playCueClick();
  };

  // Loop Handler
  const handleTriggerLoop = (deckId: DeckId, lengthBeats: number) => {
    const deck = deckId === 'left' ? leftDeck : rightDeck;
    const setDeck = deckId === 'left' ? setLeftDeck : setRightDeck;

    const secondsPerBeat = 60 / deck.bpm;
    const loopDurationSecs = secondsPerBeat * lengthBeats;
    const startTime = deck.currentTime;
    const endTime = startTime + loopDurationSecs;

    setDeck({
      ...deck,
      loop: {
        active: true,
        lengthBeats,
        startTime,
        endTime,
      },
    });
  };

  const handleExitLoop = (deckId: DeckId) => {
    const setDeck = deckId === 'left' ? setLeftDeck : setRightDeck;
    setDeck((prev) => ({
      ...prev,
      loop: { active: false, lengthBeats: 4, startTime: null, endTime: null },
    }));
  };

  // Load Preset Sample Track
  const handleLoadPreset = (deckId: DeckId, track: SampleTrack) => {
    const setDeck = deckId === 'left' ? setLeftDeck : setRightDeck;
    setDeck((prev) => ({
      ...prev,
      url: track.youtubeUrl,
      videoId: track.youtubeId,
      title: track.title,
      artist: track.artist,
      thumbnail: `https://img.youtube.com/vi/${track.youtubeId}/hqdefault.jpg`,
      bpm: track.bpm,
      isPlaying: false,
      currentTime: 0,
    }));
  };

  // Update EQ / Gain / Filter
  const handleUpdateDeckEq = (
    deckId: DeckId,
    param: 'eqLow' | 'eqMid' | 'eqHigh' | 'gain' | 'filterValue',
    val: number
  ) => {
    const setDeck = deckId === 'left' ? setLeftDeck : setRightDeck;
    setDeck((prev) => ({ ...prev, [param]: val }));
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
      {/* Hidden YouTube IFrames (Keeps audio engine running cleanly) */}
      <div className="fixed -top-[9999px] -left-[9999px] opacity-0 pointer-events-none">
        <div id="yt-player-left" />
        <div id="yt-player-right" />
      </div>

      {/* Top Navigation Header */}
      <header className="border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md sticky top-0 z-40 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 via-amber-500 to-orange-500 p-0.5 shadow-[0_0_20px_rgba(6,182,212,0.3)]">
              <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center">
                <Headphones className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-mono font-extrabold tracking-wider bg-gradient-to-r from-cyan-400 via-amber-300 to-orange-400 bg-clip-text text-transparent">
                YOUTUBE DJ MIXER
              </h1>
              <p className="text-[11px] font-mono text-zinc-400 hidden sm:block">
                Pioneer CDJ & DJM Web Console • Real-Time Keyboard Scratching
              </p>
            </div>
          </div>

          {/* Quick HUD Keyboard Guide */}
          <div className="flex items-center gap-2">
            <KeyboardGuide isOpen={isGuideOpen} onToggle={() => setIsGuideOpen(!isGuideOpen)} />
          </div>
        </div>
      </header>

      {/* Main Console Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 flex flex-col justify-center gap-6">
        {/* DJ Station Grid Layout: Left Deck | Mixer Center | Right Deck */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT DECK (CDJ Deck A) */}
          <div className="lg:col-span-4">
            <DeckControl
              deck={leftDeck}
              onUpdateDeck={(id, updates) => setLeftDeck((prev) => ({ ...prev, ...updates }))}
              onScratch={(dir, secs) => handleScratch('left', dir, secs)}
              onSeek={(secs, forcePlay) => handleSeek('left', secs, forcePlay)}
              onTogglePlay={() => handleTogglePlay('left')}
              onSetHotCue={(idx) => handleSetHotCue('left', idx)}
              onJumpHotCue={(idx) => handleJumpHotCue('left', idx)}
              onResetHotCue={(idx) => handleResetHotCue('left', idx)}
              onTriggerLoop={(beats) => handleTriggerLoop('left', beats)}
              onExitLoop={() => handleExitLoop('left')}
              onLoadPresetTrack={(track) => handleLoadPreset('left', track)}
              accentColor="cyan"
            />
          </div>

          {/* CENTER DJM MIXER */}
          <div className="lg:col-span-4">
            <MixerCenter
              leftDeck={leftDeck}
              rightDeck={rightDeck}
              crossfaderPos={crossfaderPos}
              crossfaderCurve={crossfaderCurve}
              masterVolume={masterVolume}
              onCrossfaderChange={setCrossfaderPos}
              onCurveChange={setCrossfaderCurve}
              onMasterVolumeChange={setMasterVolume}
              onUpdateDeckEq={handleUpdateDeckEq}
            />
          </div>

          {/* RIGHT DECK (CDJ Deck B) */}
          <div className="lg:col-span-4">
            <DeckControl
              deck={rightDeck}
              onUpdateDeck={(id, updates) => setRightDeck((prev) => ({ ...prev, ...updates }))}
              onScratch={(dir, secs) => handleScratch('right', dir, secs)}
              onSeek={(secs, forcePlay) => handleSeek('right', secs, forcePlay)}
              onTogglePlay={() => handleTogglePlay('right')}
              onSetHotCue={(idx) => handleSetHotCue('right', idx)}
              onJumpHotCue={(idx) => handleJumpHotCue('right', idx)}
              onResetHotCue={(idx) => handleResetHotCue('right', idx)}
              onTriggerLoop={(beats) => handleTriggerLoop('right', beats)}
              onExitLoop={() => handleExitLoop('right')}
              onLoadPresetTrack={(track) => handleLoadPreset('right', track)}
              accentColor="orange"
            />
          </div>
        </div>
      </main>

      {/* Footer Banner */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-3 text-center text-[11px] font-mono text-zinc-500">
        <p>💡 Tip: 유투브 주소를 복사해 양쪽 데크에 넣거나, '샘플곡' 버튼을 눌러 바로 믹싱해보세요.</p>
      </footer>
    </div>
  );
}
