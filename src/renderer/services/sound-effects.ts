type OscillatorType = 'sine' | 'square' | 'sawtooth' | 'triangle';

interface ToneOptions {
  frequency: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  decay?: number;
}

class SoundEffects {
  private audioContext: AudioContext | null = null;

  private getContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new AudioContext();
    }
    return this.audioContext;
  }

  private playTone(options: ToneOptions): void {
    const ctx = this.getContext();
    const { frequency, duration, type = 'sine', gain = 0.3, decay = 0.1 } = options;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);

    gainNode.gain.setValueAtTime(gain, now);
    gainNode.gain.setValueAtTime(gain, now + duration - decay);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration);
  }

  /** Warm knock/bell sound when recording starts */
  recordingStart(): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Low warm tone
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(520, now);
    gain1.gain.setValueAtTime(0.35, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.25);

    // Harmonic overtone for richness
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(780, now);
    gain2.gain.setValueAtTime(0.12, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now);
    osc2.stop(now + 0.18);
  }

  /** Quick ascending two-tone when recording stops */
  recordingStop(): void {
    this.playTone({ frequency: 660, duration: 0.1, gain: 0.2 });
    setTimeout(() => {
      this.playTone({ frequency: 880, duration: 0.12, gain: 0.2 });
    }, 100);
  }

  /** Pleasant chime when transcription succeeds */
  transcriptionDone(): void {
    this.playTone({ frequency: 784, duration: 0.12, gain: 0.25 });
    setTimeout(() => {
      this.playTone({ frequency: 1047, duration: 0.18, gain: 0.2 });
    }, 120);
  }

  /** Low buzz for error */
  error(): void {
    this.playTone({ frequency: 280, duration: 0.25, type: 'square', gain: 0.15, decay: 0.05 });
  }
}

export const soundEffects = new SoundEffects();
