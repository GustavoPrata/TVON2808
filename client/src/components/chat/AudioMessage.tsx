import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Mic, Check, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AudioMessageProps {
  audioUrl: string;
  duration?: number;
  isFromMe: boolean;
  timestamp?: Date;
  status?: {
    sent?: boolean;
    delivered?: boolean;
    read?: boolean;
  };
}

export function AudioMessage({ audioUrl, duration = 0, isFromMe, timestamp, status }: AudioMessageProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [actualDuration, setActualDuration] = useState(duration);
  const [playbackRate, setPlaybackRate] = useState(1);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [waveformBars] = useState(Array(30).fill(0).map(() => Math.random() * 0.7 + 0.3));

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setActualDuration(audio.duration);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const togglePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) {
      return '0:00';
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = (actualDuration > 0 && isFinite(actualDuration)) ? (currentTime / actualDuration) : 0;

  const cyclePlaybackRate = () => {
    const rates = [1, 1.5, 2];
    const currentIndex = rates.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % rates.length;
    setPlaybackRate(rates[nextIndex]);
  };

  return (
    <div className={cn(
      "relative group",
      isFromMe ? "ml-auto" : "mr-auto"
    )}>
      <div className={cn(
        "flex items-center gap-3 p-3 rounded-2xl min-w-[280px] max-w-[320px]",
        isFromMe 
          ? "bg-gradient-to-r from-green-800 to-green-700 rounded-br-sm" 
          : "bg-gray-800 rounded-bl-sm"
      )}>
        <audio ref={audioRef} src={audioUrl} />
        
        {/* Avatar/Play Button */}
        <button
          onClick={togglePlayPause}
          className={cn(
            "relative w-12 h-12 rounded-full flex items-center justify-center transition-all",
            isFromMe 
              ? "bg-green-900 hover:bg-green-950" 
              : "bg-gray-700 hover:bg-gray-600"
          )}
        >
          {isPlaying ? (
            <Pause className="w-6 h-6 text-white" />
          ) : (
            <Play className="w-6 h-6 text-white ml-0.5" />
          )}
        </button>

        <div className="flex-1 overflow-hidden">
          {/* Waveform */}
          <div className="flex items-center gap-0.5 h-8 mb-1">
            {waveformBars.map((height, index) => {
              const barProgress = progress * waveformBars.length;
              const isActive = index < barProgress;
              
              return (
                <div
                  key={index}
                  className={cn(
                    "w-1 rounded-full transition-all duration-100",
                    isActive 
                      ? "bg-white" 
                      : "bg-white/30"
                  )}
                  style={{
                    height: `${height * 100}%`,
                  }}
                />
              );
            })}
          </div>
          
          {/* Time and Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mic className="w-3 h-3 text-white/70" />
              <span className="text-xs text-white/90">
                {isPlaying || currentTime > 0 
                  ? formatTime(currentTime) 
                  : formatTime(actualDuration)}
              </span>
            </div>

            {/* Playback Rate Button */}
            <button
              onClick={cyclePlaybackRate}
              className={cn(
                "px-2 py-0.5 rounded text-xs font-medium transition-colors",
                isFromMe 
                  ? "bg-green-900 hover:bg-green-950 text-white" 
                  : "bg-gray-700 hover:bg-gray-600 text-white"
              )}
            >
              {playbackRate}x
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}