import React, { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../stores/app-store';
import { AudioRecorder } from '../services/audio-recorder';
import { soundEffects } from '../services/sound-effects';
import { WaveformAnimation } from './WaveformAnimation';

const audioRecorder = new AudioRecorder();

const MAX_RECORDING_MS = 60 * 1000;
const HARD_KILL_MS = 5 * 60 * 1000;

export const Overlay: React.FC = () => {
  const { status, setStatus, error, setError } = useAppStore();
  const analyserRef = useRef<AnalyserNode | null>(null);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hardKillTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCancellingRef = useRef<boolean>(false); // 🆕 取消标志

  const clearRecordingTimers = useCallback(() => {
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
    if (hardKillTimerRef.current) {
      clearTimeout(hardKillTimerRef.current);
      hardKillTimerRef.current = null;
    }
  }, []);

  const handleCancelRecording = useCallback(async () => {
    console.log('[Cancel] Cancelling recording...');
    isCancellingRef.current = true;
    clearRecordingTimers();

    try {
      if (audioRecorder.isRecording()) {
        console.log('[Cancel] Stopping audio recorder...');
        await audioRecorder.stop().catch(() => {
          console.log('[Cancel] Stop failed, but continuing...');
        });
      }
      analyserRef.current = null;
      soundEffects.error();
      setStatus('idle');

      // Notify main process so it can reset shortcut state & hide overlay
      window.electronAPI.cancelRecording();
      console.log('[Cancel] Recording cancelled successfully');
    } catch (err) {
      console.error('[Cancel] Failed to cancel recording:', err);
      setStatus('idle');
      window.electronAPI.cancelRecording();
    } finally {
      setTimeout(() => {
        isCancellingRef.current = false;
      }, 100);
    }
  }, [setStatus, clearRecordingTimers]);

  const handleStopRecording = useCallback(async () => {
    // 🆕 如果是取消操作，直接返回
    if (isCancellingRef.current) {
      console.log('[Stop] Skipping normal stop - recording was cancelled');
      return;
    }

    clearRecordingTimers();
    try {
      const buffer = await audioRecorder.stop();
      analyserRef.current = null;
      soundEffects.recordingStop();
      setStatus('transcribing');

      window.electronAPI.sendAudioData(buffer);
    } catch (err) {
      console.error('Failed to stop recording:', err);
      setError('Recording failed');
    }
  }, [setStatus, setError, clearRecordingTimers]);

  const handleStartRecording = useCallback(async () => {
    try {
      await audioRecorder.start();
      analyserRef.current = audioRecorder.getAnalyser();
      soundEffects.recordingStart();
      setStatus('recording');

      // Auto-stop after 1 minute
      autoStopTimerRef.current = setTimeout(() => {
        console.log('[Timer] Auto-stopping recording after 1 minute');
        handleStopRecording();
      }, MAX_RECORDING_MS);

      // Hard kill safety net after 5 minutes
      hardKillTimerRef.current = setTimeout(() => {
        console.log('[Timer] Hard kill recording after 5 minutes');
        if (audioRecorder.isRecording()) {
          audioRecorder.stop().catch(() => {});
        }
        analyserRef.current = null;
        soundEffects.error();
        setError('Recording killed: exceeded 5 min limit');
      }, HARD_KILL_MS);
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Failed to access microphone');
    }
  }, [setStatus, setError, handleStopRecording, clearRecordingTimers]);

  // 🆕 ESC 键监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      console.log('[Keydown]', e.key, 'status:', status);
      if (e.key === 'Escape' && status === 'recording') {
        console.log('[ESC] ESC pressed, cancelling recording');
        e.preventDefault();
        e.stopPropagation();
        handleCancelRecording();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, handleCancelRecording]);

  useEffect(() => {
    const disposers = [
      window.electronAPI.onRecordingStart(() => {
        handleStartRecording();
      }),
      window.electronAPI.onRecordingStop(() => {
        handleStopRecording();
      }),
      window.electronAPI.onRecordingCancel(() => {
        console.log('[Overlay] Cancel signal received from main (ESC)');
        handleCancelRecording();
      }),
      window.electronAPI.onStatusUpdate((newStatus) => {
        setStatus(newStatus);
      }),
      window.electronAPI.onTranscriptionResult((text) => {
        console.log('Transcription result:', text);
      }),
      window.electronAPI.onTranscriptionError((errorMsg) => {
        soundEffects.error();
        setError(errorMsg);
      }),
    ];

    return () => disposers.forEach((dispose) => dispose());
  }, [handleStartRecording, handleStopRecording, handleCancelRecording, setStatus, setError]);

  // Don't render anything when idle
  if (status === 'idle') {
    return <div className="overlay-container" />;
  }

  return (
    <div className="overlay-container">
      <div className="overlay-pill">
        {status === 'recording' && (
          <>
            <WaveformAnimation analyser={analyserRef.current} isActive={true} />
            <span className="overlay-text">Recording...</span>
            <button
              className="cancel-button"
              onClick={(e) => {
                console.log('[Click] Cancel button clicked');
                e.preventDefault();
                e.stopPropagation();
                handleCancelRecording();
              }}
              onMouseDown={(e) => {
                console.log('[MouseDown] Cancel button mouse down');
              }}
              title="Cancel (ESC)"
            >
              ✕
            </button>
          </>
        )}
        {status === 'transcribing' && (
          <>
            <div className="spinner" />
            <span className="overlay-text">Transcribing...</span>
          </>
        )}
        {status === 'done' && (
          <span className="overlay-text overlay-done">Done ✓</span>
        )}
        {status === 'error' && (
          <span className="overlay-text overlay-error">{error || 'Error'}</span>
        )}
      </div>
    </div>
  );
};
