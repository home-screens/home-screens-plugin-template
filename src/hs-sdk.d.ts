/**
 * Type declarations for the Home Screens plugin SDK.
 * These globals are provided by the host app at runtime.
 *
 * The host exposes window.__HS_SDK__ with UI components, data hooks,
 * caching, event emission, host settings, plugin-level settings, the
 * shared-state bus, i18n, auth status, and a server-side proxy.
 * Editor-only members (AccordionSection, useModuleConfig, setPluginSettings,
 * startAuth) are added in the editor layout and may be undefined on the
 * display page.
 *
 * `__HS_SDK__` itself is typed optional: a plugin bundle can execute before
 * the host's mount effect has populated it (tests, standalone bundle
 * previews), and members added after a plugin's `minAppVersion` may be
 * absent on an older host. Guard every access with `?.`.
 */

import type { FC, ReactNode } from 'react';

// ─── Supporting Types ────────────────────────────────────────────────────────

/** Host settings snapshot — read-only */
interface HostSettings {
  timezone: string;
  units: 'metric' | 'imperial';
  latitude: number | null;
  longitude: number | null;
  displayWidth: number;
  displayHeight: number;
  appVersion: string;
}

/** Plugin events emitted to the host */
type PluginEvent =
  | { type: 'navigate'; direction: 'next' | 'prev' | 'screen'; screenIndex?: number }
  | { type: 'refresh' }
  | { type: 'log'; level: 'info' | 'warn' | 'error'; message: string };

/** Server-side proxy options */
interface PluginFetchOptions {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  payload?: string;
  secretInjections?: {
    header?: Record<string, string>;
    query?: Record<string, string>;
  };
  cacheTtlMs?: number;
}

/** Health status for reportProviderHealth. `since` is the epoch ms of the
 *  CURRENT outage's first failure — report the same `since` on every
 *  consecutive failure, then report `{ ok: true }` exactly once on recovery
 *  (not repeatedly). No report at all means healthy. */
type ProviderHealthStatus = { ok: true } | { ok: false; message: string; since: number };

// ─── Component Props ─────────────────────────────────────────────────────────

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

interface SectionHeadingProps {
  children: ReactNode;
}

interface ModuleLoadingStateProps {
  loading?: boolean;
  error?: string;
  children: ReactNode;
}

/** AccordionSection component props (editor-only) */
interface AccordionSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

/** useModuleConfig return type (editor-only) */
interface ModuleConfigResult<T> {
  config: T;
  set: (updates: Partial<T>) => void;
}

// ─── Global Declarations ─────────────────────────────────────────────────────

declare global {
  interface Window {
    /** Provided by the host — do not bundle React */
    React: typeof import('react');
    /** Provided by the host — do not bundle ReactDOM */
    ReactDOM: typeof import('react-dom');

    /** Shared SDK from the host app. Optional — see the file header for why
     *  every access should be guarded with `?.`. */
    __HS_SDK__?: {
      // ── CSS Classes ──
      /** Standard input styling for config panels */
      INPUT_CLASS: string;
      /** Nested/secondary input styling for config panels */
      NESTED_INPUT_CLASS: string;

      // ── UI Components ──
      /** Numeric range slider with label */
      Slider: FC<SliderProps>;
      /** Color picker with label */
      ColorPicker: FC<ColorPickerProps>;
      /** Boolean toggle switch with label */
      Toggle: FC<ToggleProps>;
      /** Section heading for grouping config fields */
      SectionHeading: FC<SectionHeadingProps>;
      /** Loading/error state wrapper for plugin content */
      ModuleLoadingState: FC<ModuleLoadingStateProps>;

      // ── Data Fetching ──
      /** React hook: polls a URL at an interval, returns [data | null, error | null] */
      useFetchData: <T>(url: string | null, refreshMs: number) => [T | null, string | null];

      // ── Display Cache ──
      /** In-memory cache for data between renders and screen transitions */
      displayCache: {
        get: (key: string) => unknown;
        set: (key: string, value: unknown) => void;
        prefetch: (keys: string[]) => Promise<void>;
      };

      // ── Host Settings ──
      /** Read-only snapshot of global display settings */
      getHostSettings: () => HostSettings;

      // ── Plugin-Level Settings ──
      /** Read-only snapshot of this plugin's settings (manifest `settingsSchema`
       *  values saved in the plugin manager). Also passed as the `settings` prop
       *  to a `stateProvider` component — this is the read path for module
       *  instances that want to fall back to a plugin-wide value. Absent on
       *  hosts older than the settings feature — guard with `?.`. */
      getPluginSettings?: (pluginId: string) => Record<string, unknown>;

      // ── Event Emitter ──
      /** Emit events to the host (navigate, refresh, log) */
      emit: (event: PluginEvent) => void;

      // ── Shared State ──
      /** Publish a value onto the shared-state bus, for conditional module
       *  visibility and Text-module tokens. The key is force-prefixed with
       *  this plugin's namespace (`plugin:<id>:<key>`, id lowercased) — read
       *  it back (in conditions, tokens, or your own code) with that full
       *  prefix, not the bare key you passed in. Absent on hosts older than
       *  the shared-state bus — guard with `?.`. */
      publishState?: (pluginId: string, key: string, value: string) => void;
      /** Clear a previously published key so conditions on it evaluate as
       *  unknown again (subject to a short tombstone grace window). Keys are
       *  also cleared automatically when the plugin is unregistered/reloaded.
       *  Guard with `?.`, same as `publishState`. */
      clearState?: (pluginId: string, key: string) => void;
      /** Report upstream connectivity health so the editor's shared-state
       *  inspector can explain "service unreachable" instead of a silent
       *  hide. Guard with `?.` — absent on hosts older than provider-health
       *  reporting. */
      reportProviderHealth?: (pluginId: string, status: ProviderHealthStatus) => void;

      // ── I18n ──
      /** Active BCP-47 locale tag (e.g. "de-DE"). Absent on hosts older than
       *  plugin i18n — fall back to your own default. */
      locale?: string;
      /** Look up a translation by dotted key: the first segment before `.`
       *  selects the namespace, `plugin:<id>` resolves against this plugin's
       *  manifest `translations` dictionary. Returns the raw key on any miss,
       *  so a missing translation is visible rather than silently empty.
       *  `vars` interpolates `{name}` placeholders; `vars.count` selects a
       *  CLDR plural form. Guard with `?.` — wrap in a local helper that
       *  supplies an English fallback when absent. */
      translate?: (key: string, vars?: Record<string, string | number>) => string;
      /** Locale-aware date formatting honoring the host's `formattingLocale`. */
      formatDate?: (date: Date | number, pattern: string) => string;
      /** Locale-aware number formatting (e.g. "72,5" for de-DE). */
      formatNumber?: (n: number, opts?: Intl.NumberFormatOptions) => string;

      // ── Auth Status ──
      /** Connection status for a plugin's declared `auth` adapter (OAuth2 or
       *  the Garmin SSO adapter) — use to show connection-dependent UI like
       *  "Connect your account to see this." Read-only; available in both
       *  display and editor contexts. Guard with `?.`. */
      getAuthStatus?: (pluginId: string) => Promise<{ connected: boolean; expiresAt?: number }>;

      // ── Server-Side Proxy ──
      /** Fetch external APIs through the server-side proxy with optional secret injection */
      pluginFetch: (pluginId: string, options: PluginFetchOptions) => Promise<Response>;

      // ── Editor-Only (may be undefined on display page) ──
      /** Accordion section wrapper for grouping config fields */
      AccordionSection?: FC<AccordionSectionProps>;
      /** Convenience hook for typed config access in custom ConfigSection components */
      useModuleConfig?: <T = Record<string, unknown>>(
        moduleId: string,
        screenId: string,
      ) => ModuleConfigResult<T>;
      /** Editor-only settings writer — lets a ConfigSection save plugin-level
       *  settings inline (e.g. a "Connect" row) instead of sending users to
       *  the plugin manager. Merge semantics: only the keys you pass change. */
      setPluginSettings?: (
        pluginId: string,
        updates: Record<string, unknown>,
      ) => Promise<{ ok: boolean; error?: string }>;
      /** Editor-only: dispatches to the host's Connection panel to start this
       *  plugin's declared `auth` flow, so a ConfigSection can embed its own
       *  "Connect" button instead of pointing users at the plugin manager. */
      startAuth?: (pluginId: string) => void;
    };

    /** Plugin export target — set by the IIFE wrapper, read by the host loader */
    __HS_PLUGIN__: Record<string, unknown>;
  }
}

export {};
