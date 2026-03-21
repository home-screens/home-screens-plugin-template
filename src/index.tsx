import React from 'react';
import type { PluginComponentProps } from './hs-plugin';

/**
 * Example Home Screens plugin component.
 *
 * Prop contract — the host injects these props:
 *
 *   config   — merged result of manifest.defaultConfig + user overrides
 *   style    — theme-level styling (fontSize, fontFamily, color, etc.)
 *   timezone — IANA timezone string from the display's global settings
 *   latitude / longitude — injected when dataRequirements includes "location"
 *
 * IMPORTANT: React and ReactDOM are provided as globals by the host app.
 * The Vite config marks them as external so they are NOT bundled.
 */
export default function ExamplePlugin({ config, style }: PluginComponentProps) {
  // Read config values with sensible defaults
  const message = (config.message as string) || 'Hello from a plugin!';
  const showBorder = config.showBorder !== false;
  const refreshIntervalMs = (config.refreshIntervalMs as number) || 60000;

  // Local state example — a simple counter that ticks on the refresh interval
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), refreshIntervalMs);
    return () => clearInterval(id);
  }, [refreshIntervalMs]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        fontFamily: style.fontFamily,
        color: style.color,
        backgroundColor: style.backgroundColor,
        borderRadius: style.borderRadius,
        padding: style.padding,
        opacity: style.opacity,
        border: showBorder ? `2px solid ${style.color}40` : 'none',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ fontSize: style.fontSize * 1.4, fontWeight: 600 }}>
        {message}
      </div>
      <div style={{ fontSize: style.fontSize * 0.8, opacity: 0.6 }}>
        Refreshes every {refreshIntervalMs / 1000}s &middot; tick #{tick}
      </div>
    </div>
  );
}
