import { modelsAreEqual } from '@earendil-works/pi-ai';
import type { KeybindingsManager, Theme } from '@earendil-works/pi-coding-agent';
import { type Component, type Focusable, fuzzyFilter, Input, type TUI, truncateToWidth, visibleWidth } from '@earendil-works/pi-tui';
import { MAX_CONFIG_WARNING_LINES, MAX_VISIBLE_MODELS } from './constants.ts';
import type { DialogOptions, ModelItem, SelectionSection } from './types.ts';
import { ModelFormatter } from './utils/model-formatter.ts';

function isPrintableInput(data: string): boolean {
  if (data.length === 0) {
    return false;
  }
  return [...data].every(char => {
    const code = char.charCodeAt(0);
    return code >= 32 && code !== 0x7f && (code < 0x80 || code > 0x9f);
  });
}

export class ModelSelectDialog implements Component, Focusable {
  private readonly searchInput = new Input();
  private activeSection: SelectionSection;
  private selectedFavouriteIndex = 0;
  private selectedSearchIndex = 0;
  private filteredSearchItems: ModelItem[];
  private _focused = false;

  constructor(
    private readonly tui: TUI,
    private readonly theme: Theme,
    private readonly keybindings: KeybindingsManager,
    private readonly options: DialogOptions,
  ) {
    this.activeSection = options.initialSearch || !options.hasFavouriteSection ? 'search' : 'favourites';
    this.searchInput.setValue(options.initialSearch);
    this.searchInput.onSubmit = () => this.selectCurrentSearchItem();
    this.searchInput.onEscape = () => this.options.onDone(null);
    this.filteredSearchItems = this.filterSearchItems(options.initialSearch);
    this.syncFocus();
  }

  get focused(): boolean {
    return this._focused;
  }

  set focused(value: boolean) {
    this._focused = value;
    this.syncFocus();
  }

  invalidate(): void {
    this.searchInput.invalidate();
  }

  handleInput(data: string): void {
    if (this.keybindings.matches(data, 'tui.input.tab')) {
      this.switchSection();
      this.tui.requestRender();
      return;
    }

    if (this.keybindings.matches(data, 'tui.select.cancel')) {
      this.options.onDone(null);
      return;
    }

    if (this.keybindings.matches(data, 'tui.select.up')) {
      this.moveSelection(-1);
      this.tui.requestRender();
      return;
    }

    if (this.keybindings.matches(data, 'tui.select.down')) {
      this.moveSelection(1);
      this.tui.requestRender();
      return;
    }

    if (this.keybindings.matches(data, 'tui.select.pageUp')) {
      this.moveSelection(-MAX_VISIBLE_MODELS);
      this.tui.requestRender();
      return;
    }

    if (this.keybindings.matches(data, 'tui.select.pageDown')) {
      this.moveSelection(MAX_VISIBLE_MODELS);
      this.tui.requestRender();
      return;
    }

    if (this.keybindings.matches(data, 'tui.select.confirm')) {
      this.selectCurrentItem();
      return;
    }

    if (this.activeSection !== 'search' && isPrintableInput(data)) {
      this.activeSection = 'search';
      this.syncFocus();
    }

    if (this.activeSection === 'search') {
      this.searchInput.handleInput(data);
      this.filteredSearchItems = this.filterSearchItems(this.searchInput.getValue());
      this.selectedSearchIndex = Math.min(this.selectedSearchIndex, Math.max(0, this.filteredSearchItems.length - 1));
      this.tui.requestRender();
    }
  }

  render(width: number): string[] {
    const safeWidth = Math.max(3, width);
    const inner = safeWidth - 2;
    const lines: string[] = [];

    lines.push(this.line(this.renderTitle(), inner));
    lines.push(this.line(this.renderTabs(), inner));

    for (const warning of this.options.configWarnings.slice(0, MAX_CONFIG_WARNING_LINES)) {
      lines.push(this.line(this.theme.fg('warning', `⚠ ${warning}`), inner));
    }
    if (this.options.configWarnings.length > MAX_CONFIG_WARNING_LINES) {
      lines.push(
        this.line(this.theme.fg('warning', `⚠ ${this.options.configWarnings.length - MAX_CONFIG_WARNING_LINES} more config warning(s)`), inner),
      );
    }

    lines.push('');

    if (this.activeSection === 'favourites') {
      lines.push(...this.renderFavourites(inner));
    } else {
      lines.push(...this.renderSearch(inner));
    }

    lines.push('');
    lines.push(this.line(this.renderHelp(), inner));

    const borderColor = (str: string) => this.theme.fg('accent', str);
    const horizontal = '─'.repeat(inner);
    const top = borderColor(`╭${horizontal}╮`);
    const bottom = borderColor(`╰${horizontal}╯`);
    const side = borderColor('│');

    const wrapped = lines.map(line => `${side}${this.padLine(line, inner)}${side}`);
    return [top, ...wrapped, bottom];
  }

  private padLine(text: string, innerWidth: number): string {
    const truncated = truncateToWidth(text.replace(/[\r\n]+/g, ' '), innerWidth, '');
    const padding = Math.max(0, innerWidth - visibleWidth(truncated));
    return truncated + ' '.repeat(padding);
  }

  private switchSection(): void {
    if (!this.options.hasFavouriteSection) {
      this.activeSection = 'search';
      this.syncFocus();
      return;
    }

    this.activeSection = this.activeSection === 'favourites' ? 'search' : 'favourites';
    this.syncFocus();
  }

  private syncFocus(): void {
    this.searchInput.focused = this._focused && this.activeSection === 'search';
  }

  private moveSelection(delta: number): void {
    if (this.activeSection === 'favourites') {
      this.selectedFavouriteIndex = this.wrapIndex(this.selectedFavouriteIndex + delta, this.options.favouriteItems.length);
      return;
    }

    this.selectedSearchIndex = this.wrapIndex(this.selectedSearchIndex + delta, this.filteredSearchItems.length);
  }

  private wrapIndex(index: number, length: number): number {
    if (length <= 0) {
      return 0;
    }
    return ((index % length) + length) % length;
  }

  private selectCurrentItem(): void {
    if (this.activeSection === 'favourites') {
      const item = this.options.favouriteItems[this.selectedFavouriteIndex];
      if (item) {
        this.options.onDone(item.model);
      }
      return;
    }

    this.selectCurrentSearchItem();
  }

  private selectCurrentSearchItem(): void {
    const item = this.filteredSearchItems[this.selectedSearchIndex];
    if (item) {
      this.options.onDone(item.model);
    }
  }

  private filterSearchItems(query: string): ModelItem[] {
    const trimmed = query.trim();
    if (!trimmed) {
      return this.options.searchItems;
    }
    return fuzzyFilter(this.options.searchItems, trimmed, item => item.searchText);
  }

  private renderTitle(): string {
    const current = this.options.currentModel ? ModelFormatter.modelLabel(this.options.currentModel) : 'none';
    return `${this.theme.fg('accent', this.theme.bold('Select Model'))} ${this.theme.fg('muted', `current: ${current}`)}`;
  }

  private renderTabs(): string {
    const tabs: string[] = [];
    if (this.options.hasFavouriteSection) {
      tabs.push(this.renderTab('favourites', `Favourites ${this.options.favouriteItems.length}`));
    }
    tabs.push(this.renderTab('search', `Search ${this.options.searchItems.length}`));
    return tabs.join(this.theme.fg('muted', '  '));
  }

  private renderTab(section: SelectionSection, label: string): string {
    const text = `[${label}]`;
    if (this.activeSection === section) {
      return this.theme.fg('accent', this.theme.bold(text));
    }
    return this.theme.fg('muted', text);
  }

  private renderFavourites(width: number): string[] {
    const lines: string[] = [];

    if (this.options.favouriteItems.length === 0) {
      lines.push(this.line(this.theme.fg('muted', '  No configured favourites are available.'), width));
    } else {
      lines.push(...this.renderModelList(this.options.favouriteItems, this.selectedFavouriteIndex, width));
      const selected = this.options.favouriteItems[this.selectedFavouriteIndex];
      if (selected) {
        lines.push('');
        lines.push(this.line(this.theme.fg('muted', `  ${selected.description}`), width));
      }
    }

    for (const warning of this.options.favouriteWarnings.slice(0, MAX_CONFIG_WARNING_LINES)) {
      lines.push(this.line(this.theme.fg('warning', `  ⚠ ${warning}`), width));
    }
    if (this.options.favouriteWarnings.length > MAX_CONFIG_WARNING_LINES) {
      lines.push(
        this.line(
          this.theme.fg('warning', `  ⚠ ${this.options.favouriteWarnings.length - MAX_CONFIG_WARNING_LINES} more favourite warning(s)`),
          width,
        ),
      );
    }

    return lines;
  }

  private renderSearch(width: number): string[] {
    const lines: string[] = [];
    const providerText =
      this.options.providerFilter.length === 0 ? 'all authorized providers' : `providers: ${this.options.providerFilter.join(', ')}`;

    lines.push(this.line(this.theme.fg('muted', `Provider filter: ${providerText}`), width));
    lines.push(this.line(this.theme.fg('muted', 'Search query:'), width));
    lines.push(...this.searchInput.render(width));
    lines.push('');

    if (this.filteredSearchItems.length === 0) {
      lines.push(this.line(this.theme.fg('muted', '  No matching models'), width));
      return lines;
    }

    lines.push(...this.renderModelList(this.filteredSearchItems, this.selectedSearchIndex, width));
    const selected = this.filteredSearchItems[this.selectedSearchIndex];
    if (selected) {
      lines.push('');
      lines.push(this.line(this.theme.fg('muted', `  ${selected.description}`), width));
    }

    return lines;
  }

  private renderModelList(items: ModelItem[], selectedIndex: number, width: number): string[] {
    const lines: string[] = [];
    const startIndex = Math.max(0, Math.min(selectedIndex - Math.floor(MAX_VISIBLE_MODELS / 2), items.length - MAX_VISIBLE_MODELS));
    const endIndex = Math.min(startIndex + MAX_VISIBLE_MODELS, items.length);

    for (let index = startIndex; index < endIndex; index++) {
      const item = items[index];
      if (!item) {
        continue;
      }
      lines.push(this.renderModelItem(item, index === selectedIndex, width));
    }

    if (startIndex > 0 || endIndex < items.length) {
      lines.push(this.line(this.theme.fg('dim', `  (${selectedIndex + 1}/${items.length})`), width));
    }

    return lines;
  }

  private renderModelItem(item: ModelItem, isSelected: boolean, width: number): string {
    const currentMark = modelsAreEqual(item.model, this.options.currentModel) ? this.theme.fg('success', ' ✓') : '';
    const providerBadge = this.theme.fg('muted', `[${item.model.provider}]`);
    const prefix = isSelected ? this.theme.fg('accent', '→ ') : '  ';
    const modelText = isSelected ? this.theme.fg('accent', item.model.id) : item.model.id;
    return this.line(`${prefix}${modelText} ${providerBadge}${currentMark}`, width);
  }

  private renderHelp(): string {
    const tabHint = this.options.hasFavouriteSection ? 'tab switch sections • ' : '';
    return this.theme.fg('dim', `${tabHint}↑↓ navigate • enter select • esc cancel`);
  }

  private line(text: string, width: number): string {
    return truncateToWidth(text.replace(/[\r\n]+/g, ' '), Math.max(1, width), '');
  }
}
