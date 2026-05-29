# pi-model-select

Pi extension that adds `/select-model`: a popup model picker with favourites plus provider-filtered fuzzy search.

## Install / run locally

```bash
pi -e /path/to/pi-model-select
# or, from this repo
pi -e .
```

The package manifest exposes `./src/index.ts` as a Pi extension.

## Command

```text
/select-model
```

- `Tab` switches between **Favourites** and **Search**.
- `↑/↓` navigates, `Enter` selects, `Esc` cancels.
- Selecting a model calls Pi's model setter, matching `/model` behavior.
- Optional direct form: `/select-model provider/modelId`.

## Config files

| Scope   | Path |
| --- | --- |
| Global | `~/.pi/agent/extensions/pi-model-select/config.json` (respects `PI_CODING_AGENT_DIR`) |
| Project | `<cwd>/.pi/extensions/pi-model-select/config.json` |

The extension accepts JSON with comments and trailing commas.

Project config overrides global `provider_filter` when the key is present. Favourites are combined from global then project and de-duplicated.

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/0xKahi/pi-model-select/main/config.schema.json",
  "favourite": [
    {
      "provider": "openai-codex",
      "modelId": "gpt-5.5"
    },
    {
      "provider": "anthropic",
      "modelId": "claude-opus-4-7"
    },
    {
      "provider": "opencode-go",
      "modelId": "kimi-k2.6"
    }
  ],
  // Empty array means no filter: all authorized providers are shown.
  "provider_filter": ["openai-codex", "anthropic", "opencode-go", "openrouter"]
}
```
