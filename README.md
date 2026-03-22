# Home Screens Plugin Template

Starter template for building plugins for [Home Screens](https://github.com/home-screens/home-screens), a smart display system that runs on Raspberry Pi.

Plugins are IIFE bundles loaded at runtime. The host app provides React and ReactDOM as globals, so your bundle stays small and fast.

## Quick Start

```bash
# 1. Clone or use this template
git clone https://github.com/home-screens/home-screens-plugin-template.git my-plugin
cd my-plugin

# 2. Install dependencies
npm install

# 3. Edit manifest.json — set your plugin id, name, category, icon, etc.
# 4. Write your component in src/index.tsx
# 5. Build the IIFE bundle
npm run build
```

This produces `dist/bundle.js` — the single file the host app loads at runtime.

## Testing Locally

Copy your plugin into the Home Screens data directory and register it:

```bash
# From the Home Screens project root
mkdir -p data/plugins/my-plugin/dist
cp /path/to/my-plugin/manifest.json data/plugins/my-plugin/
cp /path/to/my-plugin/dist/bundle.js data/plugins/my-plugin/dist/
```

Then add an entry to `data/plugins/installed.json` (create it if it doesn't exist):

```json
{
  "schemaVersion": 1,
  "plugins": [
    {
      "id": "my-plugin",
      "version": "1.0.0",
      "installedAt": "2026-01-01T00:00:00Z",
      "enabled": true,
      "moduleType": "my-plugin"
    }
  ]
}
```

Then open the editor at `/editor`. Your plugin will appear in the module palette under the category you specified in the manifest.

For development, use `npm run dev` to rebuild on every change, then refresh the display.

## Project Structure

```
my-plugin/
  manifest.json       Plugin metadata, config schema, defaults
  src/
    index.tsx          Your display component (default export)
    hs-sdk.d.ts        Type stubs for host globals
    hs-plugin.d.ts     Type definitions for plugin props
  vite.config.ts       IIFE build configuration
  dist/
    bundle.js          Built output (git-ignored)
```

## Manifest Reference

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique plugin identifier. Use kebab-case (e.g. `weather-radar`). |
| `name` | `string` | Human-readable display name shown in the editor palette. |
| `version` | `string` | Semver version of your plugin. |
| `description` | `string` | Short description shown in the plugin store and palette tooltip. |
| `author` | `string` | Your GitHub username or name. |
| `license` | `string` | SPDX license identifier. |
| `minAppVersion` | `string` | Minimum Home Screens version required (e.g. `0.16.0`). |
| `moduleType` | `string` | Module type registered with the host. Must match `id`. |
| `category` | `string` | One of the allowed categories (see below). |
| `icon` | `string` | Lucide icon name for the palette (see available icons below). |
| `defaultConfig` | `object` | Default values for every config key your component reads. |
| `defaultSize` | `{ w, h }` | Default width and height in pixels on the 1080x1920 canvas. |
| `configSchema` | `object` | JSON Schema describing your config fields with UI hints. |
| `exports` | `object` | Map of named exports. `{ "component": "default" }` is required. |
| `dataRequirements` | `string[]` | Data the host should inject: `"location"`, `"weather"`, `"calendar"`. |
| `prefetchUrl` | `string \| null` | Optional API URL the host fetches and passes as `prefetchData`. |
| `permissions` | `string[]` | Capability declarations: `"network"`, `"secrets"`, `"events"`, `"storage"`. |
| `configMigrations` | `object` | Maps `fromVersion` to `{ renames, defaults }` for config schema changes. |

### Categories

Plugins must declare exactly one of these categories:

- `Time & Date`
- `Weather & Environment`
- `News & Finance`
- `Knowledge & Fun`
- `Personal`
- `Media & Display`
- `Travel`

### Config Schema UI Widgets

The `configSchema` follows JSON Schema with additional `ui:*` hints that the host's config panel renderer understands:

| Widget | Description |
|---|---|
| `ui:widget: "text"` | Single-line text input |
| `ui:widget: "number"` | Numeric input |
| `ui:widget: "toggle"` | Boolean toggle switch |
| `ui:widget: "slider"` | Range slider (use with `minimum`, `maximum`, `ui:step`) |
| `ui:widget: "color"` | Color picker |
| `ui:widget: "select"` | Dropdown (use with `enum` and `enumLabels`) |

## Component Props

Your default export receives these props from the host:

```typescript
interface PluginComponentProps {
  /** Merged config: manifest defaults + user overrides */
  config: Record<string, unknown>;

  /** Theme styling from the module's style settings */
  style: {
    fontSize: number;
    fontFamily: string;
    color: string;
    backgroundColor: string;
    borderRadius: number;
    padding: number;
    opacity: number;
  };

  /** IANA timezone from global settings (e.g. "America/New_York") */
  timezone?: string;

  /** Injected when dataRequirements includes "location" */
  latitude?: number;
  longitude?: number;

  /** Injected when dataRequirements includes "weather" */
  hourly?: unknown[];
  forecast?: unknown[];
  minutely?: unknown;
  alerts?: unknown;
  units?: string;
  locationMissing?: boolean;

  /** Injected when dataRequirements includes "calendar" */
  events?: unknown[];
}
```

Always read config values with fallback defaults in case the config object is incomplete:

```typescript
const message = (config.message as string) || 'Default message';
const count = (config.count as number) ?? 5;
```

## Custom Config Section

For config UI that goes beyond what the schema-driven renderer supports, export a named `ConfigSection` component:

```typescript
// src/index.tsx
import type { PluginConfigSectionProps } from './hs-plugin';

export function ConfigSection({ config, onChange }: PluginConfigSectionProps) {
  const sdk = window.__HS_SDK__;

  return (
    <div>
      <label>Custom Setting</label>
      <input
        className={sdk.INPUT_CLASS}
        value={(config.customField as string) || ''}
        onChange={(e) => onChange({ customField: e.target.value })}
      />
    </div>
  );
}
```

Then update your manifest exports:

```json
{
  "exports": {
    "component": "default",
    "configSection": "ConfigSection"
  }
}
```

The `onChange` callback accepts a partial config object that gets merged with the existing config.

Use `window.__HS_SDK__.INPUT_CLASS` and `NESTED_INPUT_CLASS` for inputs so they match the host app's styling.

## Development

The Plugin Store has a **Developer** tab for loading plugins directly from a local dev server, which is faster than copying files manually.

### Dev Mode Loading

1. Start your plugin's dev server:
   ```bash
   npm run dev
   ```

2. In the Home Screens editor, open the Plugin Store and go to the **Developer** tab.

3. Enter your dev server URL (e.g. `http://localhost:5173`) and click **Load**.

The plugin will:
- Load immediately from your dev server
- Auto-reload every 2 seconds when the bundle changes (via ETag/Content-Length polling)
- Show a **Dev** badge in the editor palette
- Be stored in `localStorage` only — it won't persist across browsers or affect other users

### Source Maps

Source maps are enabled by default in this template's `vite.config.ts` (`sourcemap: true`). When loading via dev mode, browser DevTools will pick up the source maps automatically for debugging.

## Permissions

Plugins can declare which capabilities they use. These are **transparency declarations** — they are shown to users during install but not enforced at runtime.

Add a `permissions` array to your `manifest.json`:

```json
{
  "permissions": ["network", "secrets"]
}
```

| Permission | Meaning |
|---|---|
| `network` | Makes HTTP requests via the server-side proxy (`pluginFetch`) |
| `secrets` | Stores API keys or credentials |
| `events` | Emits host events (navigate, refresh, etc.) |
| `storage` | Uses localStorage for persistent state |

Permissions are shown in the install confirmation dialog. Plugins submitted to the registry must honestly declare all capabilities they use — undeclared capabilities will be flagged during review.

## Config Migration

When you release a new version with config schema changes, existing module instances keep their old config. The host handles this automatically:

### Automatic Deep-Merge

On version change, the host deep-merges each module's existing config with your new `defaultConfig`. New fields get default values; existing fields are preserved. This handles the most common case (adding new config fields) with zero effort.

### Explicit Migrations

For breaking changes (renames, removed fields), add a `configMigrations` field to your manifest:

```json
{
  "configMigrations": {
    "1.0.0": {
      "renames": { "oldFieldName": "newFieldName" },
      "defaults": { "newRequiredField": 42 }
    }
  }
}
```

Each key is a `fromVersion` — when upgrading from that version, the renames and defaults are applied before the deep-merge. This lets you handle field renames and explicit default values for fields that shouldn't use `defaultConfig` values.

## Building

```bash
# One-time build
npm run build

# Watch mode for development
npm run dev
```

The build produces a single `dist/bundle.js` file as an IIFE that assigns exports to `window.__HS_PLUGIN__`. React and ReactDOM are external (provided by the host), so your bundle only contains your code.

## Publishing

1. Create a GitHub repository for your plugin.
2. Tag a release with a semver version (e.g. `v1.0.0`).
3. Create a release tarball and attach it to the GitHub release.
4. Submit a PR to the [home-screens-plugins](https://github.com/home-screens/home-screens-plugins) registry to list your plugin in the plugin store.

### Creating the Release Tarball

The tarball **must** contain a single top-level directory wrapping `manifest.json` and `dist/`. The install flow extracts with `tar --strip-components=1`, so files at the root of the archive will be lost.

```bash
# Build first
npm run build

# Create a staging directory with the required structure
mkdir -p /tmp/my-plugin-pkg/my-plugin/dist
cp manifest.json /tmp/my-plugin-pkg/my-plugin/
cp dist/bundle.js /tmp/my-plugin-pkg/my-plugin/dist/
cp dist/bundle.js.map /tmp/my-plugin-pkg/my-plugin/dist/  # optional

# Create the tarball
tar -czf plugin.tar.gz -C /tmp/my-plugin-pkg my-plugin

# Compute the SHA-256 hash (needed for the registry entry)
shasum -a 256 plugin.tar.gz    # macOS
sha256sum plugin.tar.gz        # Linux
```

The resulting archive should look like this:

```
my-plugin/
  manifest.json
  dist/
    bundle.js
    bundle.js.map
```

Attach `plugin.tar.gz` to your GitHub release, then use the download URL and SHA-256 hash in your registry PR.

## Available Icons

These Lucide icon names are supported by the host app's icon resolver. Use one of these in your manifest's `icon` field:

`Clock` `CalendarDays` `CloudSun` `Hourglass` `Laugh` `Type` `ImageIcon` `Quote` `ListTodo` `StickyNote` `HandMetal` `Newspaper` `TrendingUp` `Bitcoin` `BookOpen` `History` `Moon` `Sunrise` `Image` `QrCode` `BarChart3` `Car` `Trophy` `Wind` `ListChecks` `CloudRain` `CalendarRange` `Trash2` `Medal` `Sparkles` `Calendar` `Globe` `UtensilsCrossed` `Flag` `ClipboardList` `Puzzle` `Radar` `Music` `Tv` `Radio` `Gauge` `Thermometer` `Droplets` `Zap` `Bell` `MapPin` `Navigation` `Wifi` `Heart` `Star` `Camera` `Video` `Mic` `Volume2` `Headphones` `Monitor`

## Tips and Constraints

- **Do not bundle React.** The host provides `window.React` and `window.ReactDOM`. The Vite config already marks them as external.
- **Keep bundles small.** Plugins load at runtime on a Raspberry Pi. Avoid heavy dependencies.
- **Use inline styles or CSS-in-JS.** Plugins cannot inject stylesheets into the host. The `style` prop gives you theme values to stay consistent.
- **Fill the container.** Your component is rendered inside a positioned box matching `defaultSize`. Use `width: 100%` and `height: 100%`.
- **No server-side code.** Plugins run entirely in the browser. If you need external data, use `prefetchUrl` in the manifest to have the host proxy-fetch it for you.
- **Respect the refresh interval.** If your plugin polls or animates, use `refreshIntervalMs` from config so users can control resource usage.
- **Test at 1080x1920.** The display is portrait. Make sure your component looks good at the default size and scales reasonably when resized.
- **The `moduleType` in your manifest must match the `id`.** The host uses this to register and look up your component.

## License

MIT
