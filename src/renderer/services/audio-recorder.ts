export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private audioContext: AudioContext | null = null;

  async start(): Promise<void> {
    // Clean up any leftover recorder from a previous session
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try { this.mediaRecorder.stop(); } catch { /* already stopped */ }
    }
    this.releaseResources();

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: { ideal: 48000 },
        autoGainControl: true,
        // Let the ASR model handle noise reduction for better detail
        noiseSuppression: false,
        echoCancellation: true,
        channelCount: 1,
        sampleSize: 16,
        latency: 0,
      },
    });

    // Set up audio analyser for waveform visualization
    this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaStreamSource(this.stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    source.connect(this.analyser);

    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType: 'audio/webm;codecs=opus',
      audioBitsPerSecond: 128000,
    });

    this.chunks = [];

    // Scope the handler to this specific recorder instance so that
    // a stale recorder can never contaminate a future chunks array.
    const recorder = this.mediaRecorder;
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0 && this.mediaRecorder === recorder) {
        this.chunks.push(e.data);
      }
    };

    this.mediaRecorder.start(50);  // 将缓冲窗口减少 50%
  }

  stop(): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const stopT0 = Date.now();
      const recorder = this.mediaRecorder;
      const chunks = this.chunks;

      if (!recorder || recorder.state === 'inactive') {
        reject(new Error('No active recording'));
        return;
      }

      recorder.onstop = async () => {
        const blobStart = Date.now();
        console.log(`[Timing][AudioRecorder] recorder.onstop fired: +${blobStart - stopT0}ms`);
        console.log(`[AudioRecorder] Stopped. Total chunks: ${chunks.length}`);
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const buffer = await blob.arrayBuffer();
        console.log(`[Timing][AudioRecorder] Blob→ArrayBuffer: +${Date.now() - blobStart}ms`);
        console.log(`[AudioRecorder] Final buffer size: ${buffer.byteLength} bytes`);

        this.releaseResources();
        console.log(`[Timing][AudioRecorder] Total stop(): ${Date.now() - stopT0}ms`);
        resolve(buffer);
      };

      console.log(`[Timing][AudioRecorder] Starting flush sequence...`);
      if (recorder.state === 'recording') {
        recorder.requestData();

        setTimeout(() => {
          if (recorder.state === 'recording') {
            recorder.requestData();
            console.log(`[Timing][AudioRecorder] Second requestData(): +${Date.now() - stopT0}ms`);
          }
        }, 100);
      }

      setTimeout(() => {
        if (recorder.state !== 'inactive') {
          console.log(`[Timing][AudioRecorder] Calling recorder.stop(): +${Date.now() - stopT0}ms`);
          recorder.stop();
        }
      }, 250);
    });
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  private releaseResources(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.audioContext?.close().catch(() => {});
    this.stream = null;
    this.analyser = null;
    this.audioContext = null;
    this.mediaRecorder = null;
    this.chunks = [];
  }
}
