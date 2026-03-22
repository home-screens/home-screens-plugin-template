import React from 'react';
import type { PluginComponentProps } from './hs-plugin';

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
 */
export default function ExamplePlugin({ config, style }: PluginComponentProps) {
  // Read config values with sensible defaults
  const message = (config.message as string) || 'Hello from a plugin!';
  const showBorder = config.showBorder !== false;
  const borderColor = (config.borderColor as string) || '#3b82f6';
  const refreshIntervalMs = (config.refreshIntervalMs as number) || 60000;
  const notes = (config.notes as string) || '';

  // Local state example — a simple counter that ticks on the refresh interval
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), refreshIntervalMs);
    return () => clearInterval(id);
  }, [refreshIntervalMs]);

  // Plugins must apply the full module wrapper styling themselves.
  // Built-in modules get this from ModuleWrapper, but plugins receive
  // the raw style prop and are responsible for rendering it.
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        // Module wrapper styles — apply these on your root element
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
        // Plugin-specific styling
        border: showBorder ? `2px solid ${borderColor}40` : 'none',
      }}
    >
      <div style={{ fontSize: style.fontSize * 1.4, fontWeight: 600 }}>
        {message}
      </div>
      {notes && (
        <div style={{ fontSize: style.fontSize * 0.75, opacity: 0.5, textAlign: 'center' }}>
          {notes}
        </div>
      )}
      <div style={{ fontSize: style.fontSize * 0.8, opacity: 0.6 }}>
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
//         checked={config.showBorder !== false}
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
