import React from 'react';
import type { PluginComponentProps } from './hs-plugin';
import { hostFrameStyle } from './host-style';

/**
 * Example Home Screens plugin component.
 *
 * Prop contract — the host injects these props:
 *
 *   config   — merged result of manifest.defaultConfig + user overrides
 *   style    — theme-level styling (fontSize, fontFamily, textColor, etc.)
 *   timezone — IANA timezone string from the display's global settings
 *   latitude / longitude — injected when dataRequirements includes "location"
 *
 * IMPORTANT: React and ReactDOM are provided as globals by the host app.
 * The Vite config marks them as external so they are NOT bundled.
 *
 * IMPORTANT: Use style.textColor (not style.color) for text color.
 * The host's ModuleStyle uses "textColor" — built-in modules get this
 * mapped by ModuleWrapper, but plugins receive the raw prop.
 *
 * IMPORTANT: size your content in `em`, not pixels. The host's Text size
 * slider (8–72) reaches your module as `style.fontSize` on the root element,
 * so `em` values follow it and pixel values do not. A module whose labels are
 * `fontSize: 12` looks identical at every slider position, which reads to the
 * user as a broken control.
 */
export default function ExamplePlugin({ config, style }: PluginComponentProps) {
  // Read config values with sensible defaults
  const message = (config.message as string) || 'Hello from a plugin!';
  // Off by default on purpose — see the note where it's applied below.
  const showBorder = config.showBorder === true;
  const borderColor = (config.borderColor as string) || '#3b82f6';
  const refreshIntervalMs = (config.refreshIntervalMs as number) || 60000;
  const notes = (config.notes as string) || '';

  // Local state example — a simple counter that ticks on the refresh interval
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), refreshIntervalMs);
    return () => clearInterval(id);
  }, [refreshIntervalMs]);

  // Plugins must apply the full module wrapper styling themselves — the host
  // wraps built-in modules in ModuleWrapper but hands plugins the raw style
  // prop. `hostFrameStyle` applies every ModuleStyle field the way the host
  // does; spread your own layout on top of it.
  return (
    <div
      style={{
        ...hostFrameStyle(style),
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        // `em` so the gap tracks the host's Text size along with the type.
        gap: '0.85em',
        // Plugin-specific styling, layered over the host frame.
        //
        // Note what this costs: `border` is the same property `hostFrameStyle`
        // sets from style.borderWidth / style.borderColor, so switching this
        // on takes the editor's Border width slider out of the picture. That
        // is why it defaults to OFF — a plugin whose own defaults disable a
        // style control reads to the user as a broken control. If you want
        // both, draw your border on an inner element instead of the root.
        ...(showBorder ? { border: `2px solid ${borderColor}40` } : {}),
      }}
    >
      <div style={{ fontSize: '1.4em', fontWeight: 600 }}>
        {message}
      </div>
      {notes && (
        <div style={{ fontSize: '0.75em', opacity: 0.5, textAlign: 'center' }}>
          {notes}
        </div>
      )}
      <div style={{ fontSize: '0.8em', opacity: 0.6 }}>
        Refreshes every {refreshIntervalMs / 1000}s &middot; tick #{tick}
      </div>
    </div>
  );
}

// ─── Example: Custom Config Section ──────────────────────────────────────────
//
// Uncomment and add to manifest exports to use a custom config UI instead of
// the auto-generated schema renderer:
//
//   "exports": { "component": "default", "configSection": "ConfigSection" }
//
// import type { PluginConfigSectionProps } from './hs-plugin';
//
// export function ConfigSection({ config, onChange }: PluginConfigSectionProps) {
//   const { Slider, Toggle, INPUT_CLASS } = window.__HS_SDK__;
//   return (
//     <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
//       <label>
//         <span style={{ fontSize: 12, color: '#a3a3a3' }}>Message</span>
//         <input
//           className={INPUT_CLASS}
//           value={(config.message as string) || ''}
//           onChange={(e) => onChange({ message: e.target.value })}
//         />
//       </label>
//       <Toggle
//         label="Show Border"
//         checked={config.showBorder === true}
//         onChange={(v) => onChange({ showBorder: v })}
//       />
//       <Slider
//         label="Refresh (seconds)"
//         value={((config.refreshIntervalMs as number) || 60000) / 1000}
//         min={5} max={300} step={5}
//         onChange={(v) => onChange({ refreshIntervalMs: v * 1000 })}
//       />
//     </div>
//   );
// }

// ─── Example: Data Fetching via pluginFetch ──────────────────────────────────
//
// For plugins that need external API data through the server-side proxy:
//
// const PLUGIN_ID = 'my-plugin';
//
// function useMyData(refreshMs: number) {
//   const [data, setData] = React.useState(null);
//   const [error, setError] = React.useState<string | null>(null);
//
//   React.useEffect(() => {
//     let cancelled = false;
//     async function fetchData() {
//       try {
//         const res = await window.__HS_SDK__.pluginFetch(PLUGIN_ID, {
//           url: 'https://api.example.com/data',
//           secretInjections: {
//             header: { 'Authorization': 'Bearer {{api_key}}' },
//           },
//           cacheTtlMs: 60000,
//         });
//         if (!cancelled && res.ok) {
//           setData(await res.json());
//           setError(null);
//         }
//       } catch {
//         if (!cancelled) setError('Failed to fetch');
//       }
//     }
//     fetchData();
//     const id = setInterval(fetchData, refreshMs);
//     return () => { cancelled = true; clearInterval(id); };
//   }, [refreshMs]);
//
//   return [data, error] as const;
// }

// ─── Example: Shared-State Provider ──────────────────────────────────────────
//
// Publishes state onto the shared-state bus so native modules and other
// plugins can gate visibility / render Text-module tokens on it, with no
// visible or backgroundProvider module instance required. Add to manifest
// exports to use it:
//
//   "exports": { "component": "default", "stateProvider": "StateProvider" }
//
// import type { StateProviderProps } from './hs-plugin';
//
// const PLUGIN_ID = 'my-plugin';
//
// export function StateProvider({ demandedKeys, settings }: StateProviderProps) {
//   const previousKeysRef = React.useRef<string[]>([]);
//
//   React.useEffect(() => {
//     // IDLE WHEN EMPTY: do not poll or open a connection until something
//     // actually references one of this plugin's keys.
//     if (demandedKeys.length === 0) return;
//
//     let cancelled = false;
//     async function poll() {
//       for (const key of demandedKeys) {
//         const value = await resolveValue(key, settings); // your own lookup
//         if (!cancelled && value != null) window.__HS_SDK__?.publishState?.(PLUGIN_ID, key, String(value));
//       }
//     }
//     poll();
//     const id = setInterval(poll, 30000);
//     return () => { cancelled = true; clearInterval(id); };
//   }, [demandedKeys, settings]);
//
//   // CLEAR ON SHRINK: a key that stops being demanded (the user deleted or
//   // re-pointed the condition/token referencing it) must be cleared, or
//   // conditions elsewhere keep reading its last value forever.
//   React.useEffect(() => {
//     const removed = previousKeysRef.current.filter((k) => !demandedKeys.includes(k));
//     removed.forEach((key) => window.__HS_SDK__?.clearState?.(PLUGIN_ID, key));
//     previousKeysRef.current = demandedKeys;
//   }, [demandedKeys]);
//
//   return null;
// }
