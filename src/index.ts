import type { Api, Model } from '@earendil-works/pi-ai';
import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from '@earendil-works/pi-coding-agent';
import { ConfigLoader } from './config-loader.ts';
import { COMMAND_NAME, PI_VIM_KEY_EVENT_ID } from './constants.ts';
import { ModelSelectDialog } from './model-select-dialog.ts';
import type { DialogResult, LoadedConfig, ModelItem, ModelLists } from './types.ts';
import { ModelFormatter } from './utils/model-formatter.ts';

async function buildModelLists(ctx: ExtensionContext, config: LoadedConfig): Promise<ModelLists> {
  ctx.modelRegistry.refresh();

  const availableModels = ctx.modelRegistry.getAvailable();
  const providerFilterSet = new Set(config.providerFilter);
  const searchModels = config.providerFilter.length > 0 ? availableModels.filter(model => providerFilterSet.has(model.provider)) : availableModels;
  const sortedSearchModels = ModelFormatter.sortModels(searchModels, ctx.model).map(model => ModelFormatter.toModelItem(model));

  const favouriteItems: ModelItem[] = [];
  const favouriteWarnings: string[] = [];
  const seenFavouriteModels = new Set<string>();

  for (const favourite of config.favourite) {
    const model = ctx.modelRegistry.find(favourite.provider, favourite.modelId);
    const label = `${favourite.provider}/${favourite.modelId}`;

    if (!model) {
      favouriteWarnings.push(`${label} was not found`);
      continue;
    }

    if (!ctx.modelRegistry.hasConfiguredAuth(model)) {
      favouriteWarnings.push(`${label} has no configured auth`);
      continue;
    }

    const key = `${model.provider}\u0000${model.id}`;
    if (seenFavouriteModels.has(key)) {
      continue;
    }
    seenFavouriteModels.add(key);
    favouriteItems.push(ModelFormatter.toModelItem(model));
  }

  return { favouriteItems, favouriteWarnings, searchItems: sortedSearchModels };
}

function findExactModel(ctx: ExtensionContext, args: string): Model<Api> | undefined {
  const trimmed = args.trim();
  if (!trimmed) {
    return undefined;
  }

  const slashIndex = trimmed.indexOf('/');
  if (slashIndex > 0 && slashIndex < trimmed.length - 1) {
    const provider = trimmed.slice(0, slashIndex).trim();
    const modelId = trimmed.slice(slashIndex + 1).trim();
    return ctx.modelRegistry.find(provider, modelId);
  }

  const [provider, modelId] = trimmed.split(/\s+/, 2);
  if (provider && modelId) {
    return ctx.modelRegistry.find(provider, modelId);
  }

  return undefined;
}

async function applySelectedModel(pi: ExtensionAPI, ctx: ExtensionContext, model: Model<Api>): Promise<void> {
  const success = await pi.setModel(model);
  if (success) {
    ctx.ui.notify(`Model set to ${ModelFormatter.modelLabel(model)}`, 'info');
  } else {
    ctx.ui.notify(`No configured auth for ${ModelFormatter.modelLabel(model)}`, 'error');
  }
}

async function showModelSelector(pi: ExtensionAPI, args: string, ctx: ExtensionContext): Promise<void> {
  // `waitForIdle` only exists on command contexts. When invoked from the event
  // bus we get a plain ExtensionContext, so fall back to a best-effort guard.
  if ('waitForIdle' in ctx && typeof ctx.waitForIdle === 'function') {
    await (ctx as ExtensionCommandContext).waitForIdle();
  }
  ctx.modelRegistry.refresh();

  const exactModel = findExactModel(ctx, args);
  if (exactModel) {
    await applySelectedModel(pi, ctx, exactModel);
    return;
  }

  if (!ctx.hasUI) {
    ctx.ui.notify('The /select-model picker requires an interactive UI. Pass provider/modelId to select directly.', 'warning');
    return;
  }

  const config = ConfigLoader.loadConfig(ctx.cwd);
  const modelLists = await buildModelLists(ctx, config);

  const selected = await ctx.ui.custom<DialogResult>(
    (tui, theme, keybindings, done) =>
      new ModelSelectDialog(tui, theme, keybindings, {
        currentModel: ctx.model,
        favouriteItems: modelLists.favouriteItems,
        favouriteWarnings: modelLists.favouriteWarnings,
        hasFavouriteSection: config.hasFavouriteSection,
        searchItems: modelLists.searchItems,
        providerFilter: config.providerFilter,
        configWarnings: [...config.warnings, ...(ctx.modelRegistry.getError() ? [`models.json: ${ctx.modelRegistry.getError()}`] : [])],
        initialSearch: args.trim(),
        layout: config.layout,
        onDone: done,
      }),
    config.layout === 'overlay'
      ? {
          overlay: true,
          overlayOptions: {
            anchor: 'center',
            width: '85%',
            margin: 1,
          },
        }
      : undefined,
  );

  if (selected) {
    await applySelectedModel(pi, ctx, selected);
  }
}

export default function modelSelectExtension(pi: ExtensionAPI): void {
  // Keep a reference to the latest context so the event-bus handler (which gets
  // no context of its own) can open the modal too.
  let latestCtx: ExtensionContext | undefined;

  pi.on('session_start', async (_event, ctx) => {
    latestCtx = ctx;
  });

  pi.registerCommand(COMMAND_NAME, {
    description: 'Select/search models with favourites and provider filtering',
    handler: async (args, ctx) => {
      latestCtx = ctx;
      await showModelSelector(pi, args, ctx);
    },
  });

  // Cross-extension activation: another extension can open the modal via
  //   pi.events.emit(PI_VIM_KEY_EVENT_ID)
  pi.events.on(PI_VIM_KEY_EVENT_ID, () => {
    const ctx = latestCtx;
    if (!ctx) {
      return;
    }
    void showModelSelector(pi, '', ctx).catch(error => {
      ctx.ui.notify(`Failed to open model selector: ${error instanceof Error ? error.message : String(error)}`, 'error');
    });
  });
}
