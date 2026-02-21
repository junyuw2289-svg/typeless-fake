import Store from 'electron-store';
import { DEFAULT_HOTKEY } from '../shared/constants';
import type { PolishProvider } from '../shared/types';

interface StoreSchema {
  hotkey: string;
  apiKey: string;
  language: string;
  enablePolish: boolean;
  polishProvider: PolishProvider;
  polishApiKey: string;
}

const store = new Store<StoreSchema>({
  defaults: {
    hotkey: DEFAULT_HOTKEY,
    apiKey: '',
    language: '',
    enablePolish: false, // Set to true to enable AI polish (adds ~0.5-1s latency)
    polishProvider: 'openai',
    polishApiKey: '',
  },
});

if (store.get('language') === 'zh') {
  store.set('language', '');
}

store.set('hotkey', DEFAULT_HOTKEY);
store.set('enablePolish', true);

export function getConfig(): StoreSchema {
  return {
    hotkey: store.get('hotkey'),
    apiKey: store.get('apiKey'),
    language: store.get('language'),
    enablePolish: store.get('enablePolish'),
    polishProvider: store.get('polishProvider'),
    polishApiKey: store.get('polishApiKey'),
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
