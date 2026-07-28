/**
 * Type declarations for Home Screens plugin component props.
 * These are the props injected by the host into your display component,
 * plus the prop/return contracts for optional exports (configSection,
 * stateProvider, deriveProvidedKeys, searchStateKeys).
 */

/** Style properties applied to every module — matches the host's ModuleStyle.
 *  Keep this in sync with `ModuleStyle` in the host's src/types/config.ts: a
 *  field missing here is a style control your plugin silently ignores, which
 *  is exactly how borderWidth / borderColor / shadowSize went unimplemented
 *  across every plugin that shipped before them. The three are optional
 *  because hosts older than them omit the values.
 *
 *  Rather than reading these fields by hand, use `hostFrameStyle` from
 *  ./host-style — it applies all of them the way the host applies them to
 *  built-in modules, including the opacity/backdrop-blur interaction that is
 *  easy to get wrong. */
export interface ModuleStyle {
  fontSize: number;
  fontFamily: string;
  textColor: string;
  backgroundColor: string;
  borderRadius: number;
  padding: number;
  opacity: number;
  backdropBlur: number;
  borderWidth?: number;
  borderColor?: string;
  shadowSize?: number;
}

/** Base props every plugin display component receives */
export interface PluginComponentProps {
  config: Record<string, unknown>;
  style: ModuleStyle;
  timezone?: string;
  // Injected if dataRequirements includes "location":
  latitude?: number;
  longitude?: number;
  // Injected if dataRequirements includes "weather":
  hourly?: unknown[];
  forecast?: unknown[];
  minutely?: unknown;
  alerts?: unknown;
  units?: string;
  locationMissing?: boolean;
  // Injected if dataRequirements includes "calendar":
  events?: unknown[];
}

/** Props for custom config section components (optional named export) */
export interface PluginConfigSectionProps {
  config: Record<string, unknown>;
  onChange: (updates: Record<string, unknown>) => void;
  moduleId: string;
  screenId: string;
}

/** Declared plugin capabilities. Most are transparency-only (shown to users
 *  at install, not enforced): `'network'`, `'secrets'`, `'events'`,
 *  `'storage'`, `'oauth'`. `'localNetwork'` is the one exception — it's
 *  RUNTIME-ENFORCED: without it, the server-side proxy rejects URLs that
 *  resolve to a private/LAN address (RFC1918, mDNS, link-local); with it,
 *  the relaxed check still blocks loopback and cloud-metadata IPs. Declare
 *  it if your plugin talks to something on the user's LAN (e.g. a local
 *  Home Assistant instance). */
export type PluginPermission =
  | 'network'
  | 'secrets'
  | 'events'
  | 'storage'
  | 'localNetwork'
  | 'oauth';

// ─── Shared State ────────────────────────────────────────────────────────────

/** One key this plugin can publish, advertised statically via the manifest's
 *  `providesState` array so the editor's key picker can offer it before any
 *  value has ever been published. */
export interface ProvidedStateKey {
  key: string;
  label: string;
  sampleValues?: string[];
}

/** Optional named export (conventional, like `ConfigSection` — NOT declared
 *  in manifest.exports): the config-driven variant of `providesState` for
 *  plugins whose key list depends on module config (e.g. a per-instance
 *  entity list) rather than being static. Called with a module instance's
 *  `config`. */
export type DeriveProvidedKeys = (config: Record<string, unknown>) => ProvidedStateKey[];

/** Props the host passes to a `stateProvider` component (declared via
 *  `manifest.exports.stateProvider`). The host mounts exactly one instance
 *  per plugin — alive across screen rotation — instead of requiring a
 *  visible or `backgroundProvider: true` module instance.
 *
 *  Contract:
 *  - Publish every key in `demandedKeys` you can resolve via `publishState`;
 *    keys you cannot resolve should simply never be published (the
 *    consumer-side `whenUnknown` gate handles that).
 *  - CLEAR ON SHRINK: when a key drops out of `demandedKeys` between renders,
 *    `clearState` it, so conditions elsewhere fall back to their
 *    `whenUnknown` behavior instead of holding a stale value forever.
 *  - IDLE WHEN EMPTY: stay mounted but open no connections and poll nothing
 *    while `demandedKeys` is empty. A provider that polls unconditionally
 *    from its mount effect hits its upstream on every install, even ones
 *    with zero conditions configured.
 *  - `settings` is plugin-level only (manifest `settingsSchema` values) —
 *    never per-module config. Plugins whose keys can only be resolved from
 *    per-module config should keep using `backgroundProvider` instances plus
 *    `deriveProvidedKeys` instead of `stateProvider`. */
export interface StateProviderProps {
  /** Deduped, sorted, referentially stable across renders when unchanged.
   *  Unprefixed — the part after `plugin:<id>:`, matching what you pass to
   *  `publishState`. May be empty. */
  demandedKeys: string[];
  /** Plugin-level settings (manifest `settingsSchema` values). */
  settings: Record<string, unknown>;
}

/** One selectable raw value for an enum-like state key. `label` carries the
 *  friendly vocabulary ("Alert"); `value` is the raw string conditions must
 *  store ("on"). The editor renders "Alert (on)" and stores "on". */
export interface StateKeyValueOption {
  value: string;
  label?: string;
}

/** A state key described by `searchStateKeys`, rich enough for the editor's
 *  condition builder to offer selection instead of transcription. */
export interface StateKeyDescriptor {
  /** FULL bus key, prefixed (`plugin:<id>:<rest>`). */
  key: string;
  /** Friendly name, e.g. "Back Door Sensor". */
  label: string;
  /** Grouping header inside this plugin's results: an area or domain. */
  group?: string;
  valueType: 'enum' | 'numeric' | 'string';
  /** For `enum`: the selectable raw values (with optional friendly labels). */
  valueOptions?: StateKeyValueOption[];
  /** For `numeric`: unit hint, e.g. "°F". */
  unit?: string;
  /** Live raw value if cheaply known — a hint only, never stored. */
  currentValue?: string;
}

/** Optional named export (conventional, like `deriveProvidedKeys` — NOT
 *  declared in manifest.exports): search everything this plugin can publish,
 *  in friendly terms, for the editor's condition-builder combobox.
 *  Editor-only, never called on the display path.
 *
 *  IMPORTANT — full-key resolution is part of the contract: the host also
 *  calls this with a complete prefixed bus key (`plugin:<id>:<rest>`) as the
 *  query, to resolve an already-saved condition back to its descriptor. Match
 *  against the bus key itself, not just friendly labels — a label-only fuzzy
 *  matcher silently loses the enum value select and unit hint on every saved
 *  condition.
 *
 *  Must tolerate an empty query (return the most useful `limit` results).
 *  Throwing, hanging, or returning garbage degrades gracefully to the static
 *  suggestions dropdown — safe, but wasteful, so serve from a short-TTL
 *  cache since a keystroke burst still fans out queries. */
export type SearchStateKeys = (
  query: string,
  opts: { limit: number; settings: Record<string, unknown> },
) => Promise<StateKeyDescriptor[]>;
