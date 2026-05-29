import { type Api, type Model, modelsAreEqual } from '@earendil-works/pi-ai';
import type { ModelItem } from '../types.ts';

export class ModelFormatter {
  static formatTokenCount(count: number): string {
    if (count >= 1_000_000) {
      const millions = count / 1_000_000;
      return millions % 1 === 0 ? `${millions}M` : `${millions.toFixed(1)}M`;
    }
    if (count >= 1_000) {
      const thousands = count / 1_000;
      return thousands % 1 === 0 ? `${thousands}K` : `${thousands.toFixed(1)}K`;
    }
    return count.toString();
  }

  static modelLabel(model: Model<Api>): string {
    return `${model.provider}/${model.id}`;
  }

  static describeModel(model: Model<Api>): string {
    const capabilities: string[] = [];
    if (model.reasoning) {
      capabilities.push('thinking');
    }
    if (model.input.includes('image')) {
      capabilities.push('images');
    }

    const capabilityText = capabilities.length > 0 ? ` • ${capabilities.join(', ')}` : '';
    return `${model.name} • ctx ${ModelFormatter.formatTokenCount(model.contextWindow)} • max ${ModelFormatter.formatTokenCount(model.maxTokens)}${capabilityText}`;
  }

  static toModelItem(model: Model<Api>): ModelItem {
    return {
      model,
      description: ModelFormatter.describeModel(model),
      searchText: `${model.provider} ${model.id} ${model.provider}/${model.id} ${model.name}`,
    };
  }

  static sortModels(models: Model<Api>[], currentModel: Model<Api> | undefined): Model<Api>[] {
    return [...models].sort((a, b) => {
      const aIsCurrent = modelsAreEqual(a, currentModel);
      const bIsCurrent = modelsAreEqual(b, currentModel);
      if (aIsCurrent && !bIsCurrent) {
        return -1;
      }
      if (!aIsCurrent && bIsCurrent) {
        return 1;
      }

      const provider = a.provider.localeCompare(b.provider);
      if (provider !== 0) {
        return provider;
      }
      return a.id.localeCompare(b.id);
    });
  }
}
