import OpenAI from 'openai';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

export class TranscriptionService {
  private client: OpenAI | null = null;

  updateApiKey(apiKey: string): void {
    if (apiKey) {
      this.client = new OpenAI({ apiKey });
    } else {
      this.client = null;
    }
  }

  async transcribe(
    audioBuffer: Buffer,
    language?: string,
    enablePolish: boolean = true,
    stopInitiatedAt: number = Date.now()
  ): Promise<string> {
    if (!this.client) {
      throw new Error('OpenAI API key not configured. Please set your API key in settings.');
    }

    const t = (label: string) => {
      const elapsed = Date.now() - stopInitiatedAt;
      console.log(`[Timing][Transcription] ${label}: +${elapsed}ms from stop`);
      return Date.now();
    };

    const tempPath = path.join(app.getPath('temp'), `typeless-recording-${Date.now()}.webm`);

    try {
      const writeStart = Date.now();
      fs.writeFileSync(tempPath, audioBuffer);
      t(`Temp file written (${audioBuffer.byteLength} bytes, took ${Date.now() - writeStart}ms)`);

      const fileStats = fs.statSync(tempPath);
      const header = audioBuffer.subarray(0, 4);
      console.log(
        `[Transcription] Temp file: ${tempPath}, size: ${fileStats.size}, header: [${Array.from(header).map(b => '0x' + b.toString(16).padStart(2, '0')).join(', ')}]`
      );

      if (header[0] !== 0x1a || header[1] !== 0x45 || header[2] !== 0xdf || header[3] !== 0xa3) {
        console.warn('[Transcription] WARNING: File does not have valid WebM/EBML header!');
      }

      // Step 1: Speech-to-text transcription (try gpt-4o-transcribe, fallback to whisper-1)
      let transcription;
      let usedModel: string;
      try {
        t('>>> gpt-4o-transcribe API call start');
        const gptStart = Date.now();
        transcription = await this.client.audio.transcriptions.create({
          file: fs.createReadStream(tempPath),
          model: 'gpt-4o-transcribe',
          language: language || undefined,
        });
        usedModel = 'gpt-4o-transcribe';
        t(`<<< gpt-4o-transcribe API call done (took ${Date.now() - gptStart}ms)`);
      } catch (primaryError) {
        const errMsg = primaryError instanceof Error ? primaryError.message : String(primaryError);
        console.warn(`[Transcription] gpt-4o-transcribe failed: ${errMsg}, falling back to whisper-1`);
        t(`gpt-4o-transcribe FAILED, falling back to whisper-1`);

        const whisperStart = Date.now();
        t('>>> whisper-1 API call start');
        transcription = await this.client.audio.transcriptions.create({
          file: fs.createReadStream(tempPath),
          model: 'whisper-1',
          language: language || undefined,
        });
        usedModel = 'whisper-1';
        t(`<<< whisper-1 API call done (took ${Date.now() - whisperStart}ms)`);
      }

      const rawText = transcription.text;
      console.log(`[Transcription] Raw text (model=${usedModel}):`, rawText);

      // Step 2: Light polish (minimal intervention) - only if enabled
      if (enablePolish) {
        const polishStart = Date.now();
        t('>>> gpt-4o-mini polish API call start');
        const polishedText = await this.polish(rawText, language);
        t(`<<< gpt-4o-mini polish API call done (took ${Date.now() - polishStart}ms)`);
        console.log('[Transcription] Polished text:', polishedText);
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
    if (!this.client) {
      return rawText;
    }

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: this.getPolishPrompt(language),
          },
          {
            role: 'user',
            content: rawText,
          },
        ],
        temperature: 0.2,
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
  private getPolishPrompt(language?: string): string {
    const languageHints = this.getLanguageSpecificHints(language);

    return `You are a transcription editor. Clean up spoken text and present it clearly, preserving the speaker's original words and meaning.

## Part 1: Cleanup (always apply)

1. Remove filler words:
${languageHints.fillerWords}

2. Remove stuttered repetitions ("the the" → "the"), keep intentional emphasis.

3. Self-corrections: when the speaker changes their mind, keep ONLY the final version. If unclear, keep original.

4. Punctuation: add periods, commas, question marks. Capitalize sentence starts.

5. Fix ONLY obvious grammar (subject-verb agreement, missing articles). Do NOT rephrase.

6. Preserve mixed-language content exactly — never translate code-switching (e.g. "这个 feature" stays as-is).

## Part 2: Formatting (adapt based on content)

Detect the structure of the speech and format accordingly:

**Short / single-topic** (1-3 sentences, one idea):
→ Output as clean plain text. No lists, no headers.

**Multi-topic / multi-point** (speaker covers several distinct points, ideas, or action items):
→ Structure the output for readability:
  - Start with a brief summary line if the speaker provides one (end with colon or period).
  - Use numbered items (1. 2. 3.) for each distinct topic or point.
  - Give each numbered item a short descriptive title on the same line as the number.
  - Detail text goes on the NEXT line, indented by 3 spaces. NO blank line between title and detail.
  - If a single item contains sub-points, use (a) (b) (c) with a short label and colon, each on its own line, indented by 3 spaces.
  - Between numbered items: exactly ONE blank line. No more.
  - Between sub-items within the same numbered item: NO blank lines.

Line spacing example:
1. Title here
   Detail or explanation text.
   (a) Sub-point one.
   (b) Sub-point two.

2. Another title
   Detail text here.

**Detection signals for multi-point speech:**
- Explicit markers: "第一/第二", "首先/其次/另外", "first/second", "one thing... another thing..."
- Topic shifts: speaker moves from one subject to a clearly different one
- Listing patterns: "还有", "除此之外", "also", "in addition"

## Strict Rules

- Preserve the speaker's original word choices and tone
- Do NOT add information not present in the speech
- Do NOT make it sound more formal or professional
- Do NOT translate between languages
- Output ONLY the formatted text — no explanations, no comments, no markdown syntax (no **, no #, no \`\`\`)
- Use plain text formatting only (numbers, letters, indentation, line breaks)`;
  }

  /**
   * Get language-specific filler words and hints
   */
  private getLanguageSpecificHints(language?: string): { fillerWords: string } {
    if (language === 'zh' || language === 'zh-CN' || language === 'zh-TW') {
      return {
        fillerWords: `   - Chinese: 嗯, 啊, 那个, 就是, 然后, 这个, 呃, 嗯嗯
   - Keep: 然后 when used as "then/next" (not as filler)`,
      };
    }

    if (language === 'en' || language === 'en-US' || language === 'en-GB') {
      return {
        fillerWords: `   - English: um, uh, you know, like (when used as filler), actually (when redundant), basically, literally, I mean
   - Keep: "like" when used for comparison, "actually" when adding real information`,
      };
    }

    // Default: both English and Chinese
    return {
      fillerWords: `   - English: um, uh, you know, like (filler only), actually (redundant), basically, literally, I mean
   - Chinese: 嗯, 啊, 那个, 就是, 然后 (filler), 这个, 呃
   - Keep meaningful uses of these words`,
    };
  }
}
