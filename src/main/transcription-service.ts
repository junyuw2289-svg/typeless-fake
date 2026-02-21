import OpenAI from 'openai';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import type { PolishProvider } from '../shared/types';

// All providers use OpenAI-compatible API — just different baseURL + model
const POLISH_PROVIDER_CONFIG: Record<PolishProvider, { baseURL: string; model: string }> = {
  openai: { baseURL: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  grok:   { baseURL: 'https://api.x.ai/v1',       model: 'grok-3-mini-fast' },
  groq:   { baseURL: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
};

export class TranscriptionService {
  private client: OpenAI | null = null; // For transcription (always OpenAI)
  private polishClient: OpenAI | null = null; // For polish (may be different provider)
  private polishModel: string = 'gpt-4o-mini';

  updateApiKey(apiKey: string): void {
    if (apiKey) {
      this.client = new OpenAI({ apiKey });
    } else {
      this.client = null;
    }
  }

  /**
   * Configure polish provider. Automatically picks the right API key:
   *   provider='openai' → reuses the OpenAI transcription client (apiKey)
   *   provider='grok'   → creates client with grokApiKey
   *   provider='groq'   → creates client with groqApiKey
   */
  updatePolishConfig(provider: PolishProvider, keys: { grokApiKey?: string; groqApiKey?: string }, modelOverride?: string): void {
    const config = POLISH_PROVIDER_CONFIG[provider];
    this.polishModel = config.model;

    if (provider === 'openai') {
      // Reuse the same OpenAI client used for transcription
      this.polishClient = null;
    } else {
      const apiKey = provider === 'grok' ? keys.grokApiKey : keys.groqApiKey;
      if (apiKey) {
        this.polishClient = new OpenAI({
          apiKey,
          baseURL: config.baseURL,
        });
      } else {
        console.warn(`[Polish] No API key for provider "${provider}", falling back to OpenAI`);
        this.polishClient = null;
        this.polishModel = POLISH_PROVIDER_CONFIG.openai.model;
      }
    }

    if (modelOverride) {
      this.polishModel = modelOverride;
    }
  }

  async transcribe(
    audioBuffer: Buffer,
    language?: string,
    enablePolish: boolean = true,
    stopInitiatedAt: number = Date.now(),
    dictionaryWords?: string[]
  ): Promise<string> {
    if (!this.client) {
      throw new Error('OpenAI API key not configured. Please set your API key in settings.');
    }

    const tempPath = path.join(app.getPath('temp'), `typeless-recording-${Date.now()}.webm`);

    try {
      fs.writeFileSync(tempPath, audioBuffer);

      const header = audioBuffer.subarray(0, 4);
      if (header[0] !== 0x1a || header[1] !== 0x45 || header[2] !== 0xdf || header[3] !== 0xa3) {
        console.warn('[Transcription] WARNING: File does not have valid WebM/EBML header!');
      }

      // Build prompt from dictionary words
      const prompt = dictionaryWords?.length ? dictionaryWords.join(', ') : undefined;

      // Step 1: Speech-to-text (gpt-4o-transcribe, fallback whisper-1)
      let transcription;
      let usedModel: string;
      const sttStart = Date.now();
      try {
        transcription = await this.client.audio.transcriptions.create({
          file: fs.createReadStream(tempPath),
          model: 'gpt-4o-transcribe',
          language: language || undefined,
          prompt,
        });
        usedModel = 'gpt-4o-transcribe';
      } catch (primaryError) {
        const errMsg = primaryError instanceof Error ? primaryError.message : String(primaryError);
        console.warn(`[Transcription] gpt-4o-transcribe failed: ${errMsg}, falling back to whisper-1`);
        transcription = await this.client.audio.transcriptions.create({
          file: fs.createReadStream(tempPath),
          model: 'whisper-1',
          language: language || undefined,
          prompt,
        });
        usedModel = 'whisper-1';
      }
      const sttMs = Date.now() - sttStart;

      const rawText = transcription.text;
      console.log(`[raw → ${sttMs}ms | ${usedModel}] ${rawText}`);

      // Step 2: Polish — only if enabled
      if (enablePolish) {
        const polishStart = Date.now();
        const polishedText = await this.polish(rawText, language);
        const polishMs = Date.now() - polishStart;
        console.log(`[polished → ${polishMs}ms | ${this.polishModel}] ${polishedText}`);
        return polishedText;
      }

      return rawText;
    } finally {
      try {
        fs.unlinkSync(tempPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Light polish of transcribed text
   * - Removes filler words
   * - Fixes obvious grammar issues
   * - Adds punctuation
   * - Minimal changes to preserve original speaking style
   */
  private async polish(rawText: string, language?: string): Promise<string> {
    const client = this.polishClient || this.client;
    if (!client) return rawText;

    try {
      const response = await client.chat.completions.create({
        model: this.polishModel,
        messages: [
          {
            role: 'system',
            content: this.getPolishPrompt(),
          },
          {
            role: 'user',
            content: rawText,
          },
        ],
        temperature: 0,
        max_tokens: 2000,
      });

      const result = response.choices[0].message.content?.trim();
      return result || rawText;
    } catch (error) {
      console.error('[Transcription] Polish failed:', error);
      // If polish fails, return raw text as fallback
      return rawText;
    }
  }

  /**
   * Generate polish prompt with minimal intervention principle
   */
  private getPolishPrompt(): string {
    return `You are a speech-to-text post-processor. Your ONLY job is to lightly clean up raw transcription output.

ALLOWED changes (do ALL of these):
- Remove pure filler sounds: 嗯, 啊, 呃, 额, um, uh, er, ah
- Add or fix punctuation: periods, commas, question marks, exclamation marks
- Remove stuttered word repetitions: "the the" → "the", "我我我" → "我"
- Fix obvious capitalization (start of sentences, proper nouns)

FORBIDDEN changes (do NONE of these):
- Do NOT rephrase, reword, or paraphrase any part of the text
- Do NOT restructure text into numbered lists, bullet points, or any formatted structure
- Do NOT remove or change transition words: 首先, 第一个是, 第二个是, 然后, 接下来, 所以, 因为, first, second, then, next, so, because, actually, basically
- Do NOT remove colloquial expressions or informal speech patterns
- Do NOT add words that were not spoken
- Do NOT merge or split sentences beyond adding punctuation
- Do NOT change any word choices, even if they seem redundant
- Do NOT translate between languages in ANY direction. This is critical:
  - Chinese→English: "功能" must NOT become "feature", "提交" must NOT become "submit"
  - English→Chinese: "feature" must NOT become "功能", "submit" must NOT become "提交"
  - Keep every word in whichever language it was originally spoken
- Do NOT add or remove spaces around English words embedded in Chinese text — preserve the original spacing exactly as transcribed
- Do NOT normalize or "clean up" mixed-language patterns — they are intentional code-switching

Examples:

Input: "嗯 首先第一个是 今天我我要去吃个面 然后呃第二个是明天要开会"
Output: "首先第一个是，今天我要去吃个面，然后第二个是明天要开会。"

Input: "um so basically the the thing is uh I need to finish this by Friday you know and then we can review it"
Output: "So basically, the thing is, I need to finish this by Friday, and then we can review it."

Input: "那个我想说的是呃这个project要用React啊然后backend用Python"
Output: "我想说的是，这个project要用React，然后backend用Python。"

Input: "嗯我想把这个feature呃给它polish一下然后deploy到production上面"
Output: "我想把这个feature给它polish一下，然后deploy到production上面。"

Input: "呃我觉得这个bug应该是在component里面啊就是那个state没有update好"
Output: "我觉得这个bug应该是在component里面，就是那个state没有update好。"

Input: "然后我需要跑一下test啊确保这个PR没有break什么东西"
Output: "然后我需要跑一下test，确保这个PR没有break什么东西。"

Input: "嗯actually我觉得我们可以用那个API啊就是之前discuss过的那个endpoint"
Output: "Actually我觉得我们可以用那个API，就是之前discuss过的那个endpoint。"

Return ONLY the cleaned text. No explanations, no commentary.`;
  }
}
