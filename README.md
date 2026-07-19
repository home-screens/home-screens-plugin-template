# Home Screens Plugin Template

Starter template for building plugins for [Home Screens](https://homescreens.dev) — the open-source smart display system for Raspberry Pi. ([Source code on GitHub](https://github.com/home-screens/home-screens))

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

## Project Structure

```
my-plugin/
  manifest.json       Plugin metadata, config schema, defaults
  src/
    index.tsx          Your display component (default export)
    hs-sdk.d.ts        Type stubs for host globals (full SDK surface)
    hs-plugin.d.ts     Type definitions for plugin props & optional export contracts
  vite.config.ts       IIFE build configuration (classic JSX transform)
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
| `minAppVersion` | `string` | Minimum Home Screens version required (e.g. `0.20.0`). |
| `moduleType` | `string` | Module type registered with the host. Must match `id`. |
| `category` | `string` | One of the built-in categories or a custom string (see below). |
| `icon` | `string` | Lucide icon name for the palette (see available icons below). |
| `defaultConfig` | `object` | Default values for every config key your component reads. |
| `defaultSize` | `{ w, h }` | Default width and height in pixels on the 1080x1920 canvas. |
| `defaultStyle` | `object` | Optional partial style overrides (e.g. `{ "padding": 0 }`). Merged with the default module style. |
| `configSchema` | `object` | JSON Schema describing your config fields with UI hints. |
| `settingsSchema` | `object` | JSON Schema (same shape as `configSchema`) for plugin-level settings — one value shared by every instance, edited in the plugin manager instead of a module's property panel. See [Shared State](#shared-state). |
| `exports` | `object` | Map of named exports. `{ "component": "default" }` is required. Optionally add `"configSection": "ConfigSection"` and/or `"stateProvider": "StateProvider"`. |
| `dataRequirements` | `string[]` | Data the host should inject: `"location"`, `"weather"`, `"calendar"`. |
| `prefetchUrl` | `string \| null` | Optional API URL the host prefetches for the plugin. |
| `permissions` | `string[]` | Capability declarations: `"network"`, `"secrets"`, `"events"`, `"storage"`, `"oauth"` are transparency-only (shown to users, not enforced). `"localNetwork"` is the exception — it's runtime-enforced, see the table below. |
| `secrets` | `array` | API key declarations for the server-side proxy (see Secrets section). |
| `allowedDomains` | `string[]` | Upstream domains the proxy is allowed to reach (e.g. `["api.example.com"]`). |
| `configMigrations` | `object` | Maps version keys to `{ renames, defaults }` for config schema changes. |
| `providesState` | `array` | Static list of `{ key, label, sampleValues? }` shared-state keys this plugin can publish, so the editor's condition picker can offer them before anything is published. See [Shared State](#shared-state). |
| `auth` | `object` | Declares a server-side auth adapter (OAuth2 or Garmin SSO) the host runs on your behalf. See [Auth Adapters](#auth-adapters). |
| `translations` | `object` | Maps BCP-47 locale tags to dictionary file paths (e.g. `{ "de-DE": "translations/de-DE.json" }`), relative to the plugin root. See [Internationalization](#internationalization). |

Bump `minAppVersion` to the host version that introduced whatever new export or field you start using (e.g. `stateProvider` needs a host new enough to mount it). At **install time** there's no feature-detection fallback — older hosts reject the tarball outright rather than partially supporting it. That's separate from **runtime**: guard every optional `__HS_SDK__` member with `?.` regardless (see [SDK Reference](#sdk-reference)) — the bundle can execute before the host has finished populating the global, in tests, and in standalone bundle previews, independent of which host version is actually running.

### Categories

Plugins should use one of the built-in categories, but custom category strings are also accepted:

- `Time & Date`
- `Weather & Environment`
- `News & Finance`
- `Knowledge & Fun`
- `Personal`
- `Media & Display`
- `Travel`

Custom categories appear after built-in categories in the palette, sorted alphabetically.

### Config Schema

The `configSchema` follows JSON Schema with additional `ui:*` hints for the auto-generated config panel:

#### Widgets

| Widget | Description |
|---|---|
| `ui:widget: "text"` | Single-line text input |
| `ui:widget: "textarea"` | Multi-line text input |
| `ui:widget: "number"` | Numeric input |
| `ui:widget: "toggle"` | Boolean toggle switch |
| `ui:widget: "slider"` | Range slider (use with `minimum`, `maximum`, `ui:step`) |
| `ui:widget: "color"` | Color picker |
| `ui:widget: "select"` | Dropdown (use with `enum` and `enumLabels`) |
| `ui:widget: "multiselect"` | Checkbox group (use with `enum` and `enumLabels`) |
| `ui:widget: "time"` | HH:MM time picker |

#### Advanced Features

| Property | Description |
|---|---|
| `ui:group` | Visual section grouping. Fields with the same `ui:group` string are grouped under a heading. |
| `ui:showWhen` | Conditional visibility. `{ "field": "showBorder", "equals": true }` shows the field only when `showBorder` is `true`. |
| `ui:placeholder` | Placeholder text for input fields. |
| `description` | Help text rendered below the control. |
| `type: "array"` | Renders a list editor with add/remove buttons. Use `items` to define the schema for each element. |
| `type: "object"` | Renders nested properties in an indented section. Use `properties` to define sub-fields. |

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
    textColor: string;        // NOTE: "textColor", not "color"
    backgroundColor: string;
    borderRadius: number;
    padding: number;
    opacity: number;
    backdropBlur: number;
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

### Applying Module Styles

**Important:** Built-in modules are wrapped in `ModuleWrapper` which applies background, blur, radius, and padding. Plugins receive the raw `style` prop and must apply these themselves on the root element:

```typescript
<div style={{
  width: '100%', height: '100%', overflow: 'hidden',
  fontFamily: style.fontFamily,
  fontSize: style.fontSize,
  color: style.textColor,
  backgroundColor: style.backgroundColor,
  borderRadius: style.borderRadius,
  padding: style.padding,
  opacity: style.opacity,
  backdropFilter: `blur(${style.backdropBlur ?? 0}px)`,
  WebkitBackdropFilter: `blur(${style.backdropBlur ?? 0}px)`,
  boxSizing: 'border-box',
}}>
  {/* your content */}
</div>
```

## SDK Reference

The host exposes `window.__HS_SDK__` with UI components, hooks, and utilities. Full type declarations are in `src/hs-sdk.d.ts`.

**Guard every call with `?.`.** `__HS_SDK__` itself, and every member added after the plugin template's initial release, is typed optional. This isn't only about older hosts — a plugin bundle can execute before the host's mount effect has populated the global (tests, standalone bundle previews). The UI components and `pluginFetch`/`displayCache`/`getHostSettings`/`emit` below have always been part of the SDK, so existing template code accesses them directly; treat everything under I18n, Shared State, and Auth Status as needing `?.` at the call site.

### UI Components

Available in both display and editor contexts:

| Component | Props | Description |
|---|---|---|
| `Slider` | `label, value, min, max, step?, onChange` | Numeric range slider |
| `Toggle` | `label, checked, onChange` | Boolean toggle switch |
| `ColorPicker` | `label, value, onChange` | Color picker |
| `SectionHeading` | `children` | Visual section header |
| `ModuleLoadingState` | `loading?, error?, children` | Loading/error state wrapper |

### Editor-Only Components

These are `undefined` on the display page — check before using:

| Component | Props | Description |
|---|---|---|
| `AccordionSection` | `title, defaultOpen?, children` | Collapsible config section |
| `useModuleConfig` | `(moduleId, screenId) => { config, set }` | Typed config read/write hook |

### Data Fetching

```typescript
// Simple polling hook (client-side fetch)
const { useFetchData } = window.__HS_SDK__;
const [data, error] = useFetchData<MyType>('/api/some-url', 60000);

// Server-side proxy with secret injection
const { pluginFetch } = window.__HS_SDK__;
const res = await pluginFetch('my-plugin', {
  url: 'https://api.example.com/data',
  secretInjections: { header: { 'Authorization': 'Bearer {{api_key}}' } },
  cacheTtlMs: 60000,
});
```

### Host Settings

```typescript
const settings = window.__HS_SDK__.getHostSettings();
// { timezone, units, latitude, longitude, displayWidth, displayHeight, appVersion }
```

### Events

One-way communication from plugin to host:

```typescript
const { emit } = window.__HS_SDK__;
emit({ type: 'navigate', direction: 'next' });
emit({ type: 'refresh' });
emit({ type: 'log', level: 'warn', message: 'Something happened' });
```

### Display Cache

In-memory cache for data persistence between renders and screen transitions:

```typescript
const { displayCache } = window.__HS_SDK__;
displayCache.set('my-key', myData);
const cached = displayCache.get('my-key');
```

### Internationalization

The host ships 7 locales. To render translated strings, declare a `translations` map in your manifest (BCP-47 tag → dictionary file path, relative to the plugin root):

```jsonc
"translations": {
  "en-US": "translations/en-US.json",
  "de-DE": "translations/de-DE.json"
}
```

Then look strings up by dotted key, prefixed with `plugin:<your-id>`:

```typescript
const locale = window.__HS_SDK__?.locale ?? 'en-US';
const label = window.__HS_SDK__?.translate?.('plugin:my-plugin.refreshLabel', { count: 3 }) ?? 'Refresh';
```

`translate` returns the raw key on any miss, so a missing translation shows up rather than silently rendering empty. Wrap it in a small local helper that supplies an English fallback when the SDK member is absent — that's the pattern used by both the Home Assistant and Strava reference plugins (`src/i18n.ts`).

`formatDate(date, pattern)` and `formatNumber(n, opts?)` are also available for locale-aware formatting, honoring the host's `formattingLocale` override.

### Auth Status

For plugins with a manifest `auth` adapter (see [Auth Adapters](#auth-adapters)), check connection status to conditionally render UI:

```typescript
const status = await window.__HS_SDK__?.getAuthStatus?.('my-plugin');
if (!status?.connected) {
  // render "Connect your account to see this" instead of live data
}
```

`getAuthStatus` works in both display and editor contexts and never triggers the flow itself — the connect button lives in the host's Connection panel, or your `ConfigSection` can embed its own via the editor-only `startAuth('my-plugin')`.

## Secrets & Server-Side Proxy

For plugins that need external API access with authentication:

### Declaring Secrets

Add a `secrets` array and `allowedDomains` to your manifest:

```json
{
  "secrets": [
    {
      "key": "api_key",
      "label": "API Key",
      "description": "Your API key from the service dashboard",
      "required": true,
      "placeholder": "sk-..."
    }
  ],
  "allowedDomains": ["api.example.com"],
  "permissions": ["network", "secrets"]
}
```

Users configure secrets in the editor's property panel. The values are stored server-side and never sent to the client.

**Advanced: custom secrets UI.** If your `ConfigSection` wants to collect a secret inline (e.g. next to a "Connect" button) instead of sending users to the auto-rendered panel, fetch the host's plugin-secrets endpoint directly — there's no `__HS_SDK__` wrapper for this yet:

```typescript
// GET returns which keys are configured, never the values themselves
const res = await fetch(`/api/plugins/secrets/${encodeURIComponent('my-plugin')}`);
const { keys } = await res.json(); // { api_key: true }

// PUT writes one key
await fetch(`/api/plugins/secrets/${encodeURIComponent('my-plugin')}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ key: 'api_key', value: userInput }),
});
```

### Using the Proxy

```typescript
const res = await window.__HS_SDK__.pluginFetch('my-plugin', {
  url: 'https://api.example.com/data',
  method: 'GET',
  secretInjections: {
    header: { 'Authorization': 'Bearer {{api_key}}' },  // {{key}} resolved server-side
  },
  cacheTtlMs: 60000,  // server-side cache TTL (0-3600000ms)
});
const data = await res.json();
```

**Proxy constraints:**
- Upstream URL must match a domain in `allowedDomains` (supports wildcards: `*.example.com`)
- Rate limited: 60 requests/minute per plugin
- Max response size: 5MB
- Supported methods: GET, POST, PUT, PATCH
- Secret `{{key}}` placeholders are resolved server-side — never exposed to the client

## Auth Adapters

For APIs that need more than a static key — a full OAuth2 flow, or a proprietary SSO login — declare a manifest `auth` adapter and the host runs the entire flow: authorization, token exchange, refresh, and injecting the token into your `pluginFetch` requests. Your plugin code never sees the token and never talks to the auth provider directly.

Two adapter shapes:

```jsonc
// Declarative OAuth2 (authorization_code, device_code, or client_credentials)
"auth": {
  "type": "oauth2",
  "flow": "authorization_code",
  "authorizationUrl": "https://example.com/oauth/authorize",
  "tokenUrl": "https://example.com/oauth/token",
  "scopes": ["read"],
  "pkce": true,
  "tokenPlacement": "header",
  "tokenTargetDomains": ["api.example.com"],
  "secrets": { "clientId": "client_id", "clientSecret": "client_secret" }
},
"permissions": ["network", "oauth"]
```

```jsonc
// Named proprietary adapter — no URLs or scopes, the host implements the flow
"auth": { "type": "garmin" },
"permissions": ["network", "oauth"]
```

`clientId`/`clientSecret` (OAuth2) still go through the regular `secrets` array — `auth.secrets` just names which declared secret keys hold them. The proxy transparently refreshes an expired token and retries once before returning a structured `auth_expired` error. See [Auth Status](#auth-status) for reading connection state from your component, and `startAuth`/the Connection panel for how users actually connect.

## Custom Config Section

For config UI beyond what the schema renderer supports, export a named component:

```typescript
import type { PluginConfigSectionProps } from './hs-plugin';

export function ConfigSection({ config, onChange }: PluginConfigSectionProps) {
  const { Slider, Toggle, INPUT_CLASS } = window.__HS_SDK__;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Toggle
        label="Show Border"
        checked={config.showBorder !== false}
        onChange={(v) => onChange({ showBorder: v })}
      />
      <Slider
        label="Refresh (seconds)"
        value={((config.refreshIntervalMs as number) || 60000) / 1000}
        min={5} max={300} step={5}
        onChange={(v) => onChange({ refreshIntervalMs: v * 1000 })}
      />
    </div>
  );
}
```

Update manifest exports: `{ "component": "default", "configSection": "ConfigSection" }`

When a custom `configSection` is exported, the host uses it **instead of** the auto-generated schema UI.

## Shared State

Plugins can publish named values onto a per-tab shared-state bus. Any module — built-in or plugin — can then gate its visibility on that value, or a Text module can render it inline with a `{plugin:my-plugin:key}` token. Two ways to publish, from simplest to most capable:

### Publishing from a visible module

Call `publishState`/`clearState` from your regular component (or from a `backgroundProvider: true` instance the user places for exactly this purpose):

```typescript
window.__HS_SDK__?.publishState?.('my-plugin', 'door_open', 'true');
// Read back elsewhere as: plugin:my-plugin:door_open
// (the host force-prefixes with your plugin id, lowercased)

window.__HS_SDK__?.clearState?.('my-plugin', 'door_open'); // e.g. on unmount, or when no longer known
```

Advertise which keys you can publish so the editor's condition picker can offer them before anything has actually been published yet:

```jsonc
// manifest.json — static keys
"providesState": [
  { "key": "door_open", "label": "Front Door", "sampleValues": ["true", "false"] }
]
```

```typescript
// src/index.tsx — config-driven keys (conventional export, not manifest-declared)
import type { ProvidedStateKey } from './hs-plugin';

export function deriveProvidedKeys(config: Record<string, unknown>): ProvidedStateKey[] {
  const entities = (config.entities as string[]) ?? [];
  return entities.map((id) => ({ key: id, label: id }));
}
```

### Publishing with `stateProvider` (no module instance required)

For plugins that would otherwise need a dedicated hidden `backgroundProvider` module, export a headless `stateProvider` component instead. The host mounts exactly one instance per plugin — alive across screen rotation — and feeds it only the keys something on the display actually references:

```jsonc
// manifest.json
"exports": { "component": "default", "stateProvider": "StateProvider" }
```

See the commented `StateProvider` example at the bottom of `src/index.tsx` and the full contract in `src/hs-plugin.d.ts` (`StateProviderProps`). Two rules matter more than the rest:

- **Clear on shrink** — when a key drops out of `demandedKeys`, `clearState` it, or conditions elsewhere keep reading its last value forever.
- **Idle when empty** — don't poll or open a connection while `demandedKeys` is empty. The provider stays mounted even with nothing demanded; only the work should pause.

`stateProvider` only receives plugin-level `settings` (see below), never per-module config. If your keys depend on each module instance's own config (e.g. a per-instance entity list), keep using `backgroundProvider` + `deriveProvidedKeys` instead.

### Plugin-level settings

A `stateProvider` has no module instance to read config from, so give it a manifest `settingsSchema` (same shape as `configSchema`) — the plugin manager renders it once per plugin, not once per module:

```jsonc
"settingsSchema": {
  "type": "object",
  "properties": {
    "apiUrl": { "type": "string", "title": "API URL", "ui:widget": "text" }
  }
}
```

```typescript
const settings = window.__HS_SDK__?.getPluginSettings?.('my-plugin') ?? {};

// Editor-only: let a module's ConfigSection save plugin-wide settings inline
// (e.g. a "Connect" button) instead of sending users to the plugin manager.
// Merge semantics — only the keys you pass change.
await window.__HS_SDK__?.setPluginSettings?.('my-plugin', { apiUrl: 'https://...' });
```

### Friendly condition search (`searchStateKeys`)

Without this, the editor's condition picker only lists keys from `providesState`/`deriveProvidedKeys`. Export `searchStateKeys` (conventional named export, like `deriveProvidedKeys` — not manifest-declared) to power a live search over everything your plugin can actually publish, in friendly terms:

```typescript
import type { SearchStateKeys } from './hs-plugin';

export const searchStateKeys: SearchStateKeys = async (query, { limit, settings }) => {
  const results = await lookupEntities(query, settings); // your own logic
  return results.slice(0, limit).map((e) => ({
    key: `plugin:my-plugin:${e.id}`,
    label: e.friendlyName,
    group: e.area,
    valueType: 'enum',
    valueOptions: [{ value: 'on', label: 'Open' }, { value: 'off', label: 'Closed' }],
  }));
};
```

Two easy-to-miss requirements: it must also resolve a **complete prefixed bus key** passed as the query (the host uses this to redisplay an already-saved condition, so match on `key` itself, not just `label`), and it must tolerate an empty query string by returning the most useful `limit` results. Throwing or timing out just degrades to the plain static picker, so cache results (short TTL) rather than hitting your upstream on every keystroke.

### Reporting provider health

```typescript
window.__HS_SDK__?.reportProviderHealth?.('my-plugin', { ok: false, message: 'API unreachable since 12:04', since: Date.now() });
window.__HS_SDK__?.reportProviderHealth?.('my-plugin', { ok: true }); // report once on recovery, not repeatedly
```

Surfaces in the editor's shared-state inspector so users see *why* gated modules went hidden instead of guessing.

The bus key charset (`[a-z0-9_:.-]`) allows `:`, so a plugin with hierarchical data (e.g. a sensor's sub-attributes) can adopt its own `<id>:<sub-key>` suffix convention on top of `publishState` — this is a plugin-side pattern, not a host feature, so design it however suits your data.

## Development

### Dev Mode Loading

1. Start your plugin's dev server:
   ```bash
   npm run dev
   ```
   This builds the bundle, starts a file watcher for rebuilds, and serves the plugin directory on `http://localhost:5173` with CORS headers.

2. In the Home Screens editor, open the Plugin Store and go to the **Developer** tab.

3. Enter `http://localhost:5173` and click **Load**.

The plugin will:
- Load immediately from your dev server
- Auto-reload every 2 seconds when the bundle changes (via ETag polling)
- Register the manifest server-side so `pluginFetch` works during development
- Show a **Dev** badge in the editor palette
- Be stored in `localStorage` only — won't persist across browsers

### Source Maps

Source maps are enabled by default (`sourcemap: true` in `vite.config.ts`). Browser DevTools will pick them up automatically.

## Config Migration

When you release a new version with config schema changes, existing module instances keep their old config.

### Automatic Deep-Merge

On version change, the host deep-merges each module's existing config with your new `defaultConfig`. New fields get default values; existing fields are preserved.

### Explicit Migrations

For breaking changes (renames, removed fields), add `configMigrations`:

```json
{
  "version": "2.0.0",
  "configMigrations": {
    "1.0.0": {
      "renames": { "oldFieldName": "newFieldName" },
      "defaults": { "newRequiredField": 42 }
    }
  }
}
```

Each key is a version — migrations are applied for versions strictly between the old installed version and the new manifest version. Renames and defaults are applied before the deep-merge.

**Important:** The migration key must be **less than** `manifest.version` for it to run.

## Permissions

Plugins declare which capabilities they use. Most are shown to users during install but not enforced at runtime:

| Permission | Meaning | Enforced? |
|---|---|---|
| `network` | Makes HTTP requests via the server-side proxy (`pluginFetch`) | No — transparency only |
| `secrets` | Stores API keys or credentials | No — transparency only |
| `events` | Emits host events (navigate, refresh, etc.) | No — transparency only |
| `storage` | Uses localStorage for persistent state | No — transparency only |
| `oauth` | Uses a manifest `auth` adapter (see [Auth Adapters](#auth-adapters)) | No — transparency only |
| `localNetwork` | Proxy target is expected to be on the user's LAN (e.g. a local Home Assistant instance) | **Yes** — without it, `pluginFetch` rejects URLs resolving to a private/LAN address (RFC1918, mDNS, link-local); with it, the relaxed check still blocks loopback and cloud-metadata IPs |

Plugins submitted to the registry must honestly declare all capabilities — undeclared capabilities will be flagged during review.

## Building

```bash
npm run build    # One-time production build
npm run dev      # Watch + serve for development (localhost:5173)
```

The build uses the **classic JSX transform** (`React.createElement`) because the host provides `window.React` which does not include `jsx`/`jsxs` from `react/jsx-runtime`. Do not change the `esbuild.jsx` setting in `vite.config.ts`.

## Publishing

1. Create a GitHub repository for your plugin.
2. Tag a release with a semver version (e.g. `v1.0.0`).
3. Create a release tarball and attach it to the GitHub release.
4. Submit a PR to the [home-screens-plugins](https://github.com/home-screens/home-screens-plugins) registry.

### Creating the Release Tarball

The tarball **must** contain a single top-level directory wrapping `manifest.json` and `dist/`. The install flow extracts with `tar --strip-components=1`, so files at the root of the archive will be lost.

```bash
npm run build

mkdir -p /tmp/my-plugin-pkg/my-plugin/dist
cp manifest.json /tmp/my-plugin-pkg/my-plugin/
cp dist/bundle.js /tmp/my-plugin-pkg/my-plugin/dist/
cp dist/bundle.js.map /tmp/my-plugin-pkg/my-plugin/dist/  # optional

tar -czf plugin.tar.gz -C /tmp/my-plugin-pkg my-plugin

# Compute the SHA-256 hash (needed for the registry entry)
shasum -a 256 plugin.tar.gz    # macOS
sha256sum plugin.tar.gz        # Linux
```

## Available Icons

These Lucide icon names are supported by the host app's icon resolver. Use one of these in your manifest's `icon` field:

`Clock` `CalendarDays` `CloudSun` `Hourglass` `Laugh` `Type` `ImageIcon` `Quote` `ListTodo` `StickyNote` `HandMetal` `Newspaper` `TrendingUp` `Bitcoin` `BookOpen` `History` `Moon` `Sunrise` `Image` `QrCode` `BarChart3` `Car` `Trophy` `Wind` `ListChecks` `CloudRain` `CalendarRange` `Trash2` `Medal` `Sparkles` `Calendar` `Globe` `UtensilsCrossed` `Flag` `ClipboardList` `Puzzle` `Radar` `Music` `Tv` `Radio` `Gauge` `Thermometer` `Droplets` `Zap` `Bell` `MapPin` `Navigation` `Wifi` `Heart` `Star` `Camera` `Video` `Mic` `Volume2` `Headphones` `Monitor`

Unknown icon names fall back to `Puzzle`.

## Tips and Constraints

- **Do not bundle React.** The host provides `window.React` and `window.ReactDOM`. The Vite config marks them as external.
- **Use the classic JSX transform.** The Vite config uses `React.createElement`, not `jsx`/`jsxs`. Do not change this.
- **Apply module wrapper styles.** Plugins must apply `backgroundColor`, `backdropFilter`, `borderRadius`, `padding`, and `opacity` from the `style` prop on their root element. See the example in `src/index.tsx`.
- **Use `style.textColor`, not `style.color`.** The host's `ModuleStyle` uses `textColor`.
- **Keep bundles small.** Plugins load at runtime on a Raspberry Pi. Avoid heavy dependencies.
- **Use inline styles.** Plugins cannot inject stylesheets. The `style` prop gives you theme values.
- **Fill the container.** Your component renders inside a positioned box matching `defaultSize`. Use `width: 100%` and `height: 100%`.
- **Use `pluginFetch` for external APIs.** The server-side proxy handles CORS, secrets, and caching. Declare `allowedDomains` and `permissions: ["network"]`.
- **Respect the refresh interval.** If your plugin polls, use a config field so users can control resource usage.
- **Test at 1080x1920.** The display is portrait.
- **The `moduleType` must match the `id`.** The host uses this to register and look up your component.

## License

MIT
