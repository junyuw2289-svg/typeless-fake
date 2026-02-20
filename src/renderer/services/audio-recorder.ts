export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private audioContext: AudioContext | null = null;

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 16000,
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
    });

    this.chunks = [];

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.chunks.push(e.data);
      }
    };

    this.mediaRecorder.start(100); // Collect data every 100ms
  }

  stop(): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        reject(new Error('No active recording'));
        return;
      }

      this.mediaRecorder.onstop = async () => {
        const blob = new Blob(this.chunks, { type: 'audio/webm' });
        const buffer = await blob.arrayBuffer();

        // Clean up
        this.stream?.getTracks().forEach((track) => track.stop());
        this.audioContext?.close();
        this.stream = null;
        this.analyser = null;
        this.audioContext = null;

        resolve(buffer);
      };

      this.mediaRecorder.stop();
    });
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }
}
