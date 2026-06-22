import type { Wiki } from '../types';
import { dcFandomPlugin } from './dc-fandom';

export const PLUGINS = {
  'dc-fandom': {
    url: 'https://dc.fandom.com',
    factory: dcFandomPlugin,
  },
} as const satisfies Record<string, { url: string; factory: (client: Wiki) => object }>;

export type PluginName = keyof typeof PLUGINS;
export type PluginReturn<K extends PluginName> = ReturnType<(typeof PLUGINS)[K]['factory']>;
