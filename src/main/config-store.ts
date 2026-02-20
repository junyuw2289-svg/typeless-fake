import Store from 'electron-store';
import { DEFAULT_HOTKEY } from '../shared/constants';

interface StoreSchema {
  hotkey: string;
  apiKey: string;
  language: string;
  enablePolish: boolean;
}

const store = new Store<StoreSchema>({
  defaults: {
    hotkey: DEFAULT_HOTKEY,
    apiKey: '',
    language: '',
    enablePolish: true, // Enable AI polish by default
  },
});

if (store.get('language') === 'zh') {
  store.set('language', '');
}

export function getConfig(): StoreSchema {
  return {
    hotkey: store.get('hotkey'),
    apiKey: store.get('apiKey'),
    language: store.get('language'),
    enablePolish: store.get('enablePolish'),
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
