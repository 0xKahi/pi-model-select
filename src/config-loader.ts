import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getAgentDir } from '@earendil-works/pi-coding-agent';
import { EXTENSION_ID } from './constants.ts';
import type { ConfigPaths, Layout, LoadedConfig, ModelRef } from './types.ts';
import { parseJsonc } from './utils/jsonc.ts';

type ScopeName = 'global' | 'project';

type ScopeConfig = {
  favourite: ModelRef[];
  providerFilter: string[];
  providerFilterPresent: boolean;
  layout: Layout;
  layoutPresent: boolean;
  warnings: string[];
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

export class ConfigLoader {
  static extensionConfigPaths(cwd: string): ConfigPaths {
    return {
      global: join(getAgentDir(), 'extensions', EXTENSION_ID, 'config.json'),
      project: join(cwd, '.pi', 'extensions', EXTENSION_ID, 'config.json'),
    };
  }

  static loadConfig(cwd: string): LoadedConfig {
    const paths = ConfigLoader.extensionConfigPaths(cwd);
    const globalConfig = ConfigLoader.readScopeConfig(paths.global, 'global');
    const projectConfig = ConfigLoader.readScopeConfig(paths.project, 'project');
    const providerFilter = projectConfig.providerFilterPresent ? projectConfig.providerFilter : globalConfig.providerFilter;
    const layout = projectConfig.layoutPresent ? projectConfig.layout : globalConfig.layout;
    const favourite = ConfigLoader.dedupeModelRefs([...globalConfig.favourite, ...projectConfig.favourite]);

    return {
      favourite,
      providerFilter,
      layout,
      warnings: [...globalConfig.warnings, ...projectConfig.warnings],
      hasFavouriteSection: favourite.length > 0,
    };
  }

  private static emptyScopeConfig(warnings: string[] = []): ScopeConfig {
    return {
      favourite: [],
      providerFilter: [],
      providerFilterPresent: false,
      layout: 'inline',
      layoutPresent: false,
      warnings,
    };
  }

  private static parseLayout(raw: Record<string, unknown>, sourceLabel: string, warnings: string[]): { present: boolean; value: Layout } {
    if (!('layout' in raw)) {
      return { present: false, value: 'inline' };
    }

    const value = raw.layout;
    if (value !== 'inline' && value !== 'overlay') {
      warnings.push(`${sourceLabel}: expected "layout" to be "inline" or "overlay"`);
      return { present: false, value: 'inline' };
    }

    return { present: true, value };
  }

  private static collectFavouriteValues(raw: Record<string, unknown>): unknown[] {
    const values: unknown[] = [];
    for (const key of ['favourite', 'favourites', 'favorite', 'favorites']) {
      if (key in raw) {
        values.push(raw[key]);
      }
    }
    return values;
  }

  private static parseFavouriteArray(value: unknown, sourceLabel: string, warnings: string[]): ModelRef[] {
    if (value === undefined) {
      return [];
    }

    if (!Array.isArray(value)) {
      warnings.push(`${sourceLabel}: expected "favourite" to be an array`);
      return [];
    }

    const refs: ModelRef[] = [];
    for (const [index, item] of value.entries()) {
      const record = asRecord(item);
      if (!record) {
        warnings.push(`${sourceLabel}: favourite[${index}] must be an object`);
        continue;
      }

      const provider = typeof record.provider === 'string' ? record.provider.trim() : '';
      const modelIdValue = record.modelId ?? record.model;
      const modelId = typeof modelIdValue === 'string' ? modelIdValue.trim() : '';

      if (!provider || !modelId) {
        warnings.push(`${sourceLabel}: favourite[${index}] needs string "provider" and "modelId"`);
        continue;
      }

      refs.push({ provider, modelId });
    }

    return refs;
  }

  private static parseProviderFilter(raw: Record<string, unknown>, sourceLabel: string, warnings: string[]): { present: boolean; value: string[] } {
    if (!('provider_filter' in raw)) {
      return { present: false, value: [] };
    }

    const value = raw.provider_filter;
    if (!Array.isArray(value)) {
      warnings.push(`${sourceLabel}: expected "provider_filter" to be an array of provider names`);
      return { present: false, value: [] };
    }

    const providers: string[] = [];
    for (const [index, item] of value.entries()) {
      if (typeof item !== 'string' || item.trim() === '') {
        warnings.push(`${sourceLabel}: provider_filter[${index}] must be a non-empty string`);
        continue;
      }
      providers.push(item.trim());
    }

    return { present: true, value: ConfigLoader.dedupeStrings(providers) };
  }

  private static dedupeStrings(values: string[]): string[] {
    const seen = new Set<string>();
    const output: string[] = [];
    for (const value of values) {
      if (seen.has(value)) {
        continue;
      }
      seen.add(value);
      output.push(value);
    }
    return output;
  }

  private static dedupeModelRefs(refs: ModelRef[]): ModelRef[] {
    const seen = new Set<string>();
    const output: ModelRef[] = [];
    for (const ref of refs) {
      const key = `${ref.provider}\u0000${ref.modelId}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      output.push(ref);
    }
    return output;
  }

  private static readScopeConfig(path: string, scope: ScopeName): ScopeConfig {
    const warnings: string[] = [];
    const sourceLabel = `${scope} config (${path})`;

    if (!existsSync(path)) {
      return ConfigLoader.emptyScopeConfig();
    }

    try {
      const parsed = parseJsonc(readFileSync(path, 'utf8'));
      const raw = asRecord(parsed);
      if (!raw) {
        warnings.push(`${sourceLabel}: root value must be an object`);
        return ConfigLoader.emptyScopeConfig(warnings);
      }

      const favourite = ConfigLoader.collectFavouriteValues(raw).flatMap(value => ConfigLoader.parseFavouriteArray(value, sourceLabel, warnings));
      const providerFilter = ConfigLoader.parseProviderFilter(raw, sourceLabel, warnings);
      const layout = ConfigLoader.parseLayout(raw, sourceLabel, warnings);

      return {
        favourite,
        providerFilter: providerFilter.value,
        providerFilterPresent: providerFilter.present,
        layout: layout.value,
        layoutPresent: layout.present,
        warnings,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`${sourceLabel}: ${message}`);
      return ConfigLoader.emptyScopeConfig(warnings);
    }
  }
}
