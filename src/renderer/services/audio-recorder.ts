export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private audioContext: AudioContext | null = null;

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        // 🎯 Trick 1: 提高采样率到 48kHz (标准专业音频采样率)
        // Whisper 和现代 ASR 模型支持更高采样率，能捕获更多细节
        sampleRate: { ideal: 48000 },

        // 🎯 Trick 2: 启用自动增益控制，保持音量一致性
        autoGainControl: true,

        // 🎯 Trick 3: 关闭浏览器降噪，改用 AI 模型的降噪
        // 浏览器降噪会损失细节，专业 ASR 模型自带更好的噪声处理
        noiseSuppression: false,

        // 🎯 Trick 4: 保留回声消除（对视频通话场景有用）
        echoCancellation: true,

        // 🎯 Trick 5: 单声道足够，减少数据量
        channelCount: 1,

        // 🎯 Trick 6: 设置音频位深度
        sampleSize: 16,

        // 🎯 Trick 7: 低延迟设置，减少缓冲延迟
        latency: 0,
      },
    });

    // Set up audio analyser for waveform visualization
    this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaStreamSource(this.stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    source.connect(this.analyser);

    // 🎯 Trick 8: 使用更高的音频比特率 (128kbps)
    // Opus 默认可能只用 32-64kbps，提高到 128kbps 保留更多细节
    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType: 'audio/webm;codecs=opus',
      audioBitsPerSecond: 128000, // 128 kbps
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
        console.log(`[AudioRecorder] Stopped. Total chunks: ${this.chunks.length}`);
        const blob = new Blob(this.chunks, { type: 'audio/webm' });
        const buffer = await blob.arrayBuffer();
        console.log(`[AudioRecorder] Final buffer size: ${buffer.byteLength} bytes`);

        this.stream?.getTracks().forEach((track) => track.stop());
        this.audioContext?.close();
        this.stream = null;
        this.analyser = null;
        this.audioContext = null;

        resolve(buffer);
      };

      // Force flush any buffered data before stopping
      if (this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.requestData();
      }

      // Small delay to let the final dataavailable event fire,
      // then stop to trigger onstop with all data collected
      setTimeout(() => {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        }
      }, 150);
    });
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }
}
