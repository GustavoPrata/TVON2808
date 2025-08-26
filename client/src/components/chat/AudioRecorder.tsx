import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Send, X, Pause, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AudioRecorderProps {
  onSend: (audioBlob: Blob, duration: number) => void;
  onCancel: () => void;
}

export function AudioRecorder({ onSend, onCancel }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const mimeTypeRef = useRef<string>('audio/webm');

  useEffect(() => {
    startRecording();
    return () => {
      stopRecording();
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Try different mime types for better compatibility
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/ogg;codecs=opus';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'audio/ogg';
          }
        }
      }
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mimeTypeRef.current = mimeType; // Store the mime type
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeTypeRef.current });
        setAudioBlob(audioBlob);
        
        // Clean up
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      startTimeRef.current = Date.now();
      
      // Start timer
      intervalRef.current = setInterval(() => {
        setRecordingTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 100);
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      onCancel();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
    }
  };

  const handleSend = () => {
    if (isRecording) {
      // Capture the current recording time before stopping
      const currentDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);
      
      // Stop recording first
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        // Add a one-time event listener for when recording stops
        mediaRecorderRef.current.addEventListener('stop', () => {
          // Wait a bit for the blob to be created
          setTimeout(() => {
            const audioBlob = new Blob(audioChunksRef.current, { type: mimeTypeRef.current });
            // Use the captured duration instead of recordingTime which might be 0
            onSend(audioBlob, currentDuration || 1); // Minimum 1 second
          }, 100);
        }, { once: true });
        
        // Stop the recording
        mediaRecorderRef.current.stop();
        setIsRecording(false);
        
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      }
    } else if (audioBlob) {
      // Recording already stopped, send the existing blob
      const finalDuration = recordingTime || Math.floor((Date.now() - startTimeRef.current) / 1000) || 1;
      onSend(audioBlob, finalDuration);
    }
  };

  const togglePlayback = () => {
    if (!audioRef.current || !audioBlob) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const waveformBars = Array.from({ length: 25 }, () => Math.random());

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 p-4 z-50">
      <div className="max-w-4xl mx-auto flex items-center gap-4">
        {/* Cancel button */}
        <button
          onClick={onCancel}
          className="p-3 rounded-full bg-red-500/20 hover:bg-red-500/30 transition-colors"
        >
          <X className="w-5 h-5 text-red-400" />
        </button>

        {/* Recording visualization */}
        <div className="flex-1 bg-gray-800 rounded-full p-3 flex items-center gap-3">
          {/* Mic indicator */}
          <div className={cn(
            "p-2 rounded-full transition-colors",
            isRecording && !isPaused ? "bg-red-500 animate-pulse" : "bg-gray-700"
          )}>
            {isRecording && !isPaused ? (
              <Mic className="w-4 h-4 text-white" />
            ) : (
              <MicOff className="w-4 h-4 text-gray-400" />
            )}
          </div>

          {/* Waveform or playback */}
          <div className="flex-1 flex items-center gap-1 h-8">
            {isRecording ? (
              // Live waveform
              waveformBars.map((height, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex-1 bg-green-500 rounded-full transition-all duration-200",
                    isPaused ? "opacity-50" : "opacity-100"
                  )}
                  style={{
                    height: `${isPaused ? height * 15 : (height * 20 + Math.sin(Date.now() / 200 + i) * 10)}px`
                  }}
                />
              ))
            ) : audioBlob ? (
              // Static waveform for recorded audio
              <>
                <button
                  onClick={togglePlayback}
                  className="p-1.5 rounded-full bg-green-600 hover:bg-green-700 transition-colors"
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 text-white" />
                  ) : (
                    <Play className="w-4 h-4 text-white ml-0.5" />
                  )}
                </button>
                <div className="flex-1 flex items-center gap-1">
                  {waveformBars.map((height, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-green-600/50 rounded-full"
                      style={{ height: `${height * 20}px` }}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </div>

          {/* Timer */}
          <span className="text-sm text-gray-300 font-mono">
            {formatTime(recordingTime)}
          </span>
        </div>

        {/* Control buttons */}
        {isRecording ? (
          <button
            onClick={isPaused ? resumeRecording : pauseRecording}
            className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors"
          >
            {isPaused ? (
              <Play className="w-5 h-5 text-white" />
            ) : (
              <Pause className="w-5 h-5 text-white" />
            )}
          </button>
        ) : null}

        {/* Send button */}
        <button
          onClick={handleSend}
          className="p-3 rounded-full bg-green-600 hover:bg-green-700 transition-colors"
        >
          <Send className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Hidden audio element for playback */}
      {audioBlob && (
        <audio
          ref={audioRef}
          src={URL.createObjectURL(audioBlob)}
          onEnded={() => setIsPlaying(false)}
        />
      )}
    </div>
  );
}