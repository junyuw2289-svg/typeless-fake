import React, { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../stores/app-store';
import { AudioRecorder } from '../services/audio-recorder';
import { soundEffects } from '../services/sound-effects';
import { WaveformAnimation } from './WaveformAnimation';

const audioRecorder = new AudioRecorder();

const MAX_RECORDING_MS = 10 * 60 * 1000;
const HARD_KILL_MS = 15 * 60 * 1000;

export const Overlay: React.FC = () => {
  const { status, setStatus, error, setError } = useAppStore();
  const analyserRef = useRef<AnalyserNode | null>(null);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hardKillTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCancellingRef = useRef<boolean>(false);
  const isStoppingRef = useRef<boolean>(false);

  // Store handlers in refs so we can access latest version without re-registering listeners
  // Initialize without values - the update effect will set them after handlers are defined
  const handleStartRecordingRef = useRef<typeof handleStartRecording>();
  const handleStopRecordingRef = useRef<typeof handleStopRecording>();
  const handleCancelRecordingRef = useRef<typeof handleCancelRecording>();
  const setStatusRef = useRef<typeof setStatus>();
  const setErrorRef = useRef<typeof setError>();

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
    if (isCancellingRef.current) {
      console.log('[Stop] Skipping normal stop - recording was cancelled');
      return;
    }

    if (isStoppingRef.current) {
      console.log('[Stop] Already stopping - ignoring duplicate call');
      return;
    }
    isStoppingRef.current = true;

    const stopInitiatedAt = Date.now();
    console.log(`[Timing] Stop initiated at ${stopInitiatedAt}`);

    clearRecordingTimers();
    try {
      const buffer = await audioRecorder.stop();
      const flushDone = Date.now();
      console.log(`[Timing] Audio flush + stop completed: ${flushDone - stopInitiatedAt}ms`);

      analyserRef.current = null;
      soundEffects.recordingStop();
      setStatus('transcribing');

      console.log(`[Timing] Sending audio data to main process (${buffer.byteLength} bytes)...`);
      window.electronAPI.sendAudioData(buffer, stopInitiatedAt);
      console.log(`[Timing] IPC send call returned: ${Date.now() - stopInitiatedAt}ms from stop`);
    } catch (err) {
      console.error('Failed to stop recording:', err);
      setError('Recording failed');
    } finally {
      isStoppingRef.current = false;
    }
  }, [setStatus, setError, clearRecordingTimers]);

  const handleStartRecording = useCallback(async () => {
    isStoppingRef.current = false;
    try {
      await audioRecorder.start();
      analyserRef.current = audioRecorder.getAnalyser();
      soundEffects.recordingStart();
      setStatus('recording');

      autoStopTimerRef.current = setTimeout(() => {
        console.log('[Timer] Auto-stopping recording after 10 minutes');
        handleStopRecording();
      }, MAX_RECORDING_MS);

      hardKillTimerRef.current = setTimeout(() => {
        console.log('[Timer] Hard kill recording after 15 minutes');
        if (audioRecorder.isRecording()) {
          audioRecorder.stop().catch(() => {});
        }
        analyserRef.current = null;
        soundEffects.error();
        setError('Recording killed: exceeded 15 min limit');
      }, HARD_KILL_MS);
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Failed to access microphone');
    }
  }, [setStatus, setError, handleStopRecording, clearRecordingTimers]);

  // Update refs when handlers change (so listeners always call the latest version)
  useEffect(() => {
    handleStartRecordingRef.current = handleStartRecording;
    handleStopRecordingRef.current = handleStopRecording;
    handleCancelRecordingRef.current = handleCancelRecording;
    setStatusRef.current = setStatus;
    setErrorRef.current = setError;
  }, [handleStartRecording, handleStopRecording, handleCancelRecording, setStatus, setError]);

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

  // Register IPC listeners ONCE on mount (using refs to access latest handlers)
  useEffect(() => {
    const disposers = [
      window.electronAPI.onRecordingStart(() => {
        handleStartRecordingRef.current?.();
      }),
      window.electronAPI.onRecordingStop(() => {
        handleStopRecordingRef.current?.();
      }),
      window.electronAPI.onRecordingCancel(() => {
        console.log('[Overlay] Cancel signal received from main (ESC)');
        handleCancelRecordingRef.current?.();
      }),
      window.electronAPI.onStatusUpdate((newStatus) => {
        setStatusRef.current?.(newStatus);
      }),
      window.electronAPI.onTranscriptionResult((text) => {
        console.log('Transcription result:', text);
      }),
      window.electronAPI.onTranscriptionError((errorMsg) => {
        soundEffects.error();
        setErrorRef.current?.(errorMsg);
      }),
    ];

    return () => disposers.forEach((dispose) => dispose());
  }, []); // Empty deps - register once only

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
