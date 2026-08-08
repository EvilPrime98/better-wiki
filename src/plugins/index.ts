import type { Wiki } from '../types';
import { dcFandomPlugin } from './dc-fandom';
import { marvelFandomPlugin } from './marvel-fandom';

/**
 * Registry of built-in plugins, keyed by plugin name. Each entry provides the wiki's
 * base URL and a factory that extends a base {@link Wiki} client with plugin-specific methods.
 */
export const PLUGINS = {
  'dc-fandom': {
    url: 'https://dc.fandom.com',
    factory: dcFandomPlugin,
  },
  'marvel-fandom': {
    url: 'https://marvel.fandom.com',
    factory: marvelFandomPlugin,
  },
} as const satisfies Record<string, { url: string; factory: (client: Wiki) => object }>;

/** Name of a registered plugin, as passed via `wiki({ plugin: ... })`. */
export type PluginName = keyof typeof PLUGINS;

/** The additional methods a plugin `K` adds to the base {@link Wiki} client. */
export type PluginReturn<K extends PluginName> = ReturnType<(typeof PLUGINS)[K]['factory']>;
