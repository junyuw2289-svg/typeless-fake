import Store from 'electron-store';
import { DEFAULT_HOTKEY } from '../shared/constants';
import type { PolishProvider } from '../shared/types';

interface StoreSchema {
  hotkey: string;
  apiKey: string;
  language: string;
  enablePolish: boolean;
  polishProvider: PolishProvider;
  grokApiKey: string;
  groqApiKey: string;
  polishModel: string;
}

const store = new Store<StoreSchema>({
  defaults: {
    hotkey: DEFAULT_HOTKEY,
    apiKey: '',
    language: '',
    enablePolish: false,
    polishProvider: 'openai',
    grokApiKey: '',
    groqApiKey: '',
    // ========== Groq Model Selection ==========
    // Available Groq models (all use the same groqApiKey):
    //   'llama-3.3-70b-versatile'                    — ~450ms, best for mixed CN/EN (default)
    //   'qwen/qwen3-32b'                             — ~300ms, best for Chinese-dominant text
    //   'openai/gpt-oss-20b'                         — ~200ms, fastest, English-dominant
    //   'llama-3.1-8b-instant'                       — ~250ms, cheapest ($0.05/M), basic multilingual
    //   'meta-llama/llama-4-scout-17b-16e-instruct'  — ~320ms, preview, English only (no Chinese)
    polishModel: 'llama-3.3-70b-versatile',
  },
});

if (store.get('language') === 'zh') {
  store.set('language', '');
}

store.set('hotkey', DEFAULT_HOTKEY);
store.set('enablePolish', true);

// ========== Polish Provider Toggle ==========
// Switch this one line to change polish provider:
//   'openai'  → uses apiKey (GPT-4o-mini)
//   'grok'    → uses grokApiKey (grok-3-mini-fast)
//   'groq'    → uses groqApiKey (llama-3.3-70b)
store.set('polishProvider', 'groq');

export function getConfig(): StoreSchema {
  return {
    hotkey: store.get('hotkey'),
    apiKey: store.get('apiKey'),
    language: store.get('language'),
    enablePolish: store.get('enablePolish'),
    polishProvider: store.get('polishProvider'),
    grokApiKey: store.get('grokApiKey'),
    groqApiKey: store.get('groqApiKey'),
    polishModel: store.get('polishModel'),
  };
}

export function setConfig(partial: Partial<StoreSchema>): void {
  for (const [key, value] of Object.entries(partial)) {
    store.set(key as keyof StoreSchema, value as any);
  }
}

export function getApiKey(): string {
  return store.get('apiKey');
}

export function setApiKey(key: string): void {
  store.set('apiKey', key);
}

export default store;
