import type { Api, Model } from '@earendil-works/pi-ai';

export type ModelRef = {
  provider: string;
  modelId: string;
};

export type ModelSelectConfig = {
  favourite: ModelRef[];
  providerFilter: string[];
};

export type ConfigPaths = {
  global: string;
  project: string;
};

export type LoadedConfig = ModelSelectConfig & {
  warnings: string[];
  hasFavouriteSection: boolean;
};

export type ModelItem = {
  model: Model<Api>;
  description: string;
  searchText: string;
};

export type ModelLists = {
  favouriteItems: ModelItem[];
  favouriteWarnings: string[];
  searchItems: ModelItem[];
};

export type SelectionSection = 'favourites' | 'search';

export type DialogResult = Model<Api> | null;

export type DialogOptions = {
  currentModel: Model<Api> | undefined;
  favouriteItems: ModelItem[];
  favouriteWarnings: string[];
  hasFavouriteSection: boolean;
  searchItems: ModelItem[];
  providerFilter: string[];
  configWarnings: string[];
  initialSearch: string;
  onDone: (result: DialogResult) => void;
};
