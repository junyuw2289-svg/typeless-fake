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
    enablePolish: boolean = true
  ): Promise<string> {
    if (!this.client) {
      throw new Error('OpenAI API key not configured. Please set your API key in settings.');
    }

    const tempPath = path.join(app.getPath('temp'), `typeless-recording-${Date.now()}.webm`);

    try {
      fs.writeFileSync(tempPath, audioBuffer);

      // Step 1: Speech-to-text transcription
      const transcription = await this.client.audio.transcriptions.create({
        file: fs.createReadStream(tempPath),
        model: 'gpt-4o-transcribe',
        language: language || undefined,
      });

      const rawText = transcription.text;
      console.log('[Transcription] Raw text:', rawText);

      // Step 2: Light polish (minimal intervention) - only if enabled
      if (enablePolish) {
        const polishedText = await this.polish(rawText, language);
        console.log('[Transcription] Polished text:', polishedText);
        return polishedText;
      }

      return rawText;
    } finally {
      // Clean up temp file
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
        temperature: 0.2, // Low temperature for consistency and minimal changes
        max_tokens: 1000,
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

    return `You are a minimal transcription editor. Your job is to LIGHTLY clean up spoken text while preserving the speaker's original words and style.

⚠️ CRITICAL PRINCIPLE: Make the MINIMUM changes necessary. Keep the speaker's exact words whenever possible.

Core Tasks (in order of priority):

1. Remove ONLY obvious filler words:
${languageHints.fillerWords}

2. Remove ONLY stuttered repetitions:
   - "the the table" → "the table"
   - "I I think" → "I think"
   - Keep intentional repetition for emphasis

3. Handle clear self-corrections:
   - When speaker explicitly changes their mind, keep ONLY the final version
   - Example: "I want to go to the... actually let's meet at the cafe" → "Let's meet at the cafe"
   - If unclear, keep the original

4. Add basic punctuation:
   - Periods at sentence ends
   - Commas for natural pauses
   - Question marks for questions
   - Capitalize sentence starts

5. Fix ONLY obvious grammar mistakes:
   - Subject-verb agreement
   - Missing articles (a, an, the) where clearly needed
   - Do NOT rephrase or restructure sentences

⛔ STRICT RULES - DO NOT:
- Change the speaker's word choices
- Rephrase or restructure sentences
- Add information not in the original speech
- Make it sound "more professional" or "more formal"
- Change slang, colloquialisms, or informal language
- Alter technical terms, names, or domain vocabulary
- Format as lists unless speaker clearly indicates a list structure

✅ GOAL: The output should sound like the speaker's own words, just cleaner.

Output ONLY the cleaned text. No explanations, no comments, no markdown formatting.`;
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
