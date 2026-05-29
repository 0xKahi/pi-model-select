# pi-model-select

Pi extension that adds `/select-model`: a popup model picker with favourites plus provider-filtered fuzzy search.

## Install

Install globally (writes to `~/.pi/agent/settings.json`):

```bash
pi install npm:@0xkahi/pi-model-select
```

Or install into the current project only (writes to `.pi/settings.json`, shareable with your team):

```bash
pi install npm:@0xkahi/pi-model-select -l
```

Pin a specific version:

```bash
pi install npm:@0xkahi/pi-model-select@1.0.0
```

Install directly from GitHub instead of npm:

```bash
pi install git:github.com/0xKahi/pi-model-select
pi install git:github.com/0xKahi/pi-model-select@v1.0.0   # pinned
```

### Try without installing

Use `-e` / `--extension` to load for a single run without modifying settings:

```bash
pi -e .                          # from inside this repo
```

### Manage

```bash
pi list                                       # show installed packages
pi update npm:@0xkahi/pi-model-select         # update this package
pi remove npm:@0xkahi/pi-model-select         # uninstall
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
