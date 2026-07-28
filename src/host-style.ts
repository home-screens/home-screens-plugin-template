// The host's module frame, implemented plugin-side.
//
// Why this file exists: the host does NOT wrap plugin modules in its
// `ModuleWrapper` the way it wraps built-in ones. A plugin renders its own
// root element, so every field of `ModuleStyle` — every slider in the
// editor's Style panel — only takes effect if the plugin implements it. A
// field you don't read is a control that silently does nothing for the user.
//
// Three of those fields are easy to get wrong, which is why this is a shared
// helper rather than an inline style object:
//
//   Border and shadow. `borderWidth` / `borderColor` / `shadowSize` were
//   added to the host after the first plugins shipped, so the obvious
//   hand-written root frame omits them.
//
//   Font family. The host stores a font *id* — `inter`, `dm-serif`,
//   `jetbrains` — not a CSS stack, and turns it into one when it renders a
//   built-in. Applying the field raw asks for a font family that doesn't
//   exist, so the module quietly falls back to the browser default while
//   every built-in beside it renders in the font the user picked.
//
//   Opacity under backdrop blur. Setting `opacity` on the element while
//   `backdrop-filter` is active makes the blur invisible: an opaque
//   background covers the blurred backdrop completely and Chrome renders
//   nothing. The host bakes the opacity into the background's alpha channel
//   instead; `hostFrameStyle` does the same.
//
// Use it for your root element and spread your own layout on top:
//
//   <div style={{ ...hostFrameStyle(style), display: 'flex', gap: '0.75em' }}>
//
// SIZING IS STILL YOURS. This file applies the host's font size to the root,
// which only reaches content authored in `em`/`rem` or derived from
// `style.fontSize`. Hard-coded pixel values ignore the Text size slider
// entirely — a module sized to fill a quarter of a 4K screen will still draw
// 12px labels. Author dimensions in `em` wherever you can.

import type { CSSProperties } from 'react';

/** The host's `ModuleStyle`, declared here rather than imported so this file
 *  is self-contained and can be copied between plugins verbatim. Structural
 *  typing means a plugin's own `ModuleStyle` satisfies it either way — and a
 *  plugin whose copy predates the last three fields still type-checks,
 *  because they're optional. */
export interface HostModuleStyle {
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

/** The host's default border color, matching its `ModuleWrapper`. */
const DEFAULT_BORDER_COLOR = 'rgba(255, 255, 255, 0.15)';

/** A usable number, or the fallback. A NaN that reaches a style object emits
 *  CSS the browser rejects, and it takes the whole declaration with it — a
 *  background or a shadow disappears rather than degrading. */
function finite(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Parse `#rgb`, `#rrggbb`, `rgb()`, or `rgba()` into an [r, g, b] triple.
 *  A trailing alpha (`#rgba`, `#rrggbbaa`, the fourth `rgba()` component) is
 *  accepted and ignored — `alphaOf` reads it separately. Null for anything
 *  else, so callers can fall back rather than emit a broken color string. */
export function parseColor(input: string): [number, number, number] | null {
  if (typeof input !== 'string') return null;
  const value = input.trim();

  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])[0-9a-f]?$/i.exec(value);
  if (short) {
    return [
      parseInt(short[1] + short[1], 16),
      parseInt(short[2] + short[2], 16),
      parseInt(short[3] + short[3], 16),
    ];
  }

  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})(?:[0-9a-f]{2})?$/i.exec(value);
  if (hex) {
    return [parseInt(hex[1], 16), parseInt(hex[2], 16), parseInt(hex[3], 16)];
  }

  const fn = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(value);
  if (fn) {
    const rgb: [number, number, number] = [
      Math.round(Number(fn[1])), Math.round(Number(fn[2])), Math.round(Number(fn[3])),
    ];
    if (rgb.every((c) => Number.isFinite(c) && c >= 0 && c <= 255)) return rgb;
  }

  return null;
}

/** The alpha channel of a color string, or 1 when it carries none.
 *
 *  Handles every form the host's color picker can hand us: `#rgba`,
 *  `#rrggbbaa`, and `rgba()` with the alpha given as a number or a
 *  percentage, comma- or slash-separated. */
export function alphaOf(input: string): number {
  if (typeof input !== 'string') return 1;
  const value = input.trim();

  const shortHex = /^#[0-9a-f]{3}([0-9a-f])$/i.exec(value);
  if (shortHex) return parseInt(shortHex[1] + shortHex[1], 16) / 255;

  const hex = /^#[0-9a-f]{6}([0-9a-f]{2})$/i.exec(value);
  if (hex) return parseInt(hex[1], 16) / 255;

  // Four components exactly — a three-component rgb() carries no alpha, and
  // a looser pattern would read its blue channel as one.
  const fn = /^rgba?\(\s*[\d.%]+[\s,]+[\d.%]+[\s,]+[\d.%]+[\s,/]+([\d.]+)(%?)\s*\)$/i
    .exec(value);
  if (fn) {
    const n = Number(fn[1]);
    if (!Number.isFinite(n)) return 1;
    return Math.min(1, Math.max(0, fn[2] ? n / 100 : n));
  }

  return 1;
}

/** One probe per distinct string — the host re-renders the module on every
 *  tick and the answer never changes. */
const resolved = new Map<string, string | null>();

/** A canvas 2D context, created once and never attached to the document.
 *  Undefined until the first call, null where there is no canvas at all. */
let colorProbe: CanvasRenderingContext2D | null | undefined;

function probeContext(): CanvasRenderingContext2D | null {
  if (colorProbe !== undefined) return colorProbe;
  colorProbe = null;
  if (typeof document !== 'undefined') {
    try {
      colorProbe = document.createElement('canvas').getContext('2d');
    } catch {
      colorProbe = null;
    }
  }
  return colorProbe;
}

/** The same color normalized to `#rrggbb` or `rgba(r, g, b, a)`, or null if
 *  it isn't a color at all.
 *
 *  The host's color picker accepts anything the browser calls valid and
 *  stores the string verbatim, so `black`, `hsl(0 0% 10%)`, `#000000cc`, and
 *  `rgb(0 0 0 / 50%)` all reach plugin code. Only the browser knows what
 *  `rebeccapurple` is, so we ask it — through a detached canvas rather than
 *  an element in the document. Assigning `fillStyle` parses the color and
 *  reading it back gives a normalized form, with no DOM mutation and no
 *  style recalculation, which matters because `hostFrameStyle` runs during
 *  render. Outside a browser there is nothing to ask and the caller falls
 *  back. */
export function resolveColor(input: string): string | null {
  // A style object can arrive incomplete from an older host or a preview
  // harness; the type says string, the runtime doesn't have to agree.
  if (typeof input !== 'string' || input === '') return null;

  const cached = resolved.get(input);
  if (cached !== undefined) return cached;

  let out: string | null = null;
  const ctx = probeContext();
  if (ctx) {
    // An invalid value leaves `fillStyle` at its previous value, so probe
    // twice against different sentinels: only a string the canvas actually
    // parsed comes back the same both times.
    ctx.fillStyle = '#000000';
    ctx.fillStyle = input;
    const first = ctx.fillStyle;
    ctx.fillStyle = '#ffffff';
    ctx.fillStyle = input;
    const second = ctx.fillStyle;
    if (typeof first === 'string' && first === second && parseColor(first)) out = first;
  } else if (parseColor(input)) {
    // No canvas (a unit test, a server render): the simple forms are still
    // readable as they stand.
    out = input.trim();
  }

  resolved.set(input, out);
  return out;
}

/** Bake an alpha into a color so a blurred module can carry its opacity in
 *  the background rather than on the element. Null when the color can't be
 *  read at all, so the caller can fall back to element opacity — a slightly
 *  weaker blur beats an opacity setting that does nothing. */
export function colorWithAlpha(color: string, alpha: number): string | null {
  if (!Number.isFinite(alpha)) return null;
  if (alpha >= 1) return color;
  const resolvedColor = resolveColor(color);
  const rgb = resolvedColor ? parseColor(resolvedColor) : null;
  if (!resolvedColor || !rgb) return null;
  // A background that is already translucent keeps its own alpha, scaled, so
  // a default like rgba(0, 0, 0, 0.35) doesn't jump to opaque.
  const base = alphaOf(resolvedColor);
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${base * Math.max(0, alpha)})`;
}

/** The host's module shadow, matched to what its `buildModuleShadow` gives
 *  every built-in: a hairline top highlight, a cast shadow, and a faint
 *  ambient ring. Reimplemented rather than imported — plugins can't reach
 *  into host modules. */
export function moduleShadow(size: number): string | undefined {
  if (!Number.isFinite(size) || size <= 0) return undefined;
  const offset = Math.round(size / 2);
  const ambient = Math.round(size / 2);
  return 'inset 0 1px 0 rgba(255, 255, 255, 0.12), '
    + `0 ${offset}px ${size}px rgba(0, 0, 0, 0.8), `
    + `0 0 ${ambient}px rgba(255, 255, 255, 0.04)`;
}

/** The host's font registry, id to CSS stack, mirroring its
 *  `src/lib/font-registry.ts`. `ModuleStyle.fontFamily` holds one of these
 *  ids, not a stack, and the host resolves it when it renders a built-in.
 *
 *  The `var(--font-*)` custom properties are published on `<body>` by the
 *  host, so they resolve for anything rendered inside it. Every stack keeps a
 *  non-variable fallback, so a bundle previewed outside the host still lands
 *  on something reasonable. A font the host adds later falls through to the
 *  raw value, which renders in the browser default until this map catches up. */
const FONT_STACKS = new Map<string, string>([
  ['inter', 'var(--font-inter), system-ui, sans-serif'],
  ['roboto', 'var(--font-roboto), system-ui, sans-serif'],
  ['poppins', 'var(--font-poppins), system-ui, sans-serif'],
  ['system-ui', 'system-ui, -apple-system, "Segoe UI", sans-serif'],
  ['playfair', 'var(--font-playfair), Georgia, serif'],
  ['lora', 'var(--font-lora), Georgia, serif'],
  ['dm-serif', 'var(--font-dm-serif), Georgia, serif'],
  ['georgia', 'Georgia, "Times New Roman", serif'],
  ['jetbrains', 'var(--font-jetbrains), ui-monospace, monospace'],
  ['mono', 'ui-monospace, "SF Mono", Menlo, monospace'],
  ['bebas', 'var(--font-bebas), Impact, sans-serif'],
  ['caveat', 'var(--font-caveat), cursive'],
  ['pacifico', 'var(--font-pacifico), cursive'],
]);

/** Raw stacks that hosts predating the registry stored in `fontFamily`,
 *  mapped to the id that supersedes them. Same upgrade the host performs, so
 *  a display whose config was written years ago picks up the self-hosted
 *  font rather than the system one. */
const LEGACY_FONT_IDS = new Map<string, string>([
  ['Inter, system-ui, sans-serif', 'inter'],
  ['Georgia, serif', 'georgia'],
  ['monospace', 'mono'],
  ['system-ui, sans-serif', 'system-ui'],
]);

/** A stored `fontFamily` turned into a CSS font-family stack. Anything that
 *  isn't a known id is passed through — a plugin may legitimately store its
 *  own stack, and so did the host before the registry existed. */
export function resolveFontStack(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const direct = FONT_STACKS.get(trimmed);
  if (direct) return direct;

  const legacy = LEGACY_FONT_IDS.get(trimmed);
  if (legacy) return FONT_STACKS.get(legacy) ?? trimmed;

  return trimmed;
}

/** The font size a plugin's pixel dimensions are authored against, when it
 *  doesn't say otherwise. Matches the host's own `DEFAULT_MODULE_STYLE`. */
export const DEFAULT_BASE_FONT_SIZE = 16;

export interface HostFrameOptions {
  /** Draw no surface of our own — no background, border, shadow, or blur —
   *  while still taking type and color from the host. For modules that float
   *  their own tiles over the screen instead of filling a card. */
  chromeless?: boolean;
  /** The font size this plugin's pixel dimensions were authored against —
   *  its manifest `defaultStyle.fontSize`. Sets the `--u` scale variable (see
   *  `scalePx`). Defaults to the host's own default. */
  baseFontSize?: number;
}

/** Scale an authored pixel dimension by the host's Text size.
 *
 *  The host's Text size reaches the root as a font size, so `em` values
 *  follow it and pixel values do not. `em` isn't always usable though: it
 *  resolves against the element's OWN font size, so two elements with
 *  different type but a shared width (a table cell and its column header)
 *  would end up different widths. `--u` is published once on the root by
 *  `hostFrameStyle`, so every `calc(Npx * var(--u))` lands on the same
 *  number wherever it sits — and it works inside plain constant style
 *  objects, which a React hook cannot.
 *
 *  Falls back to 1 so styles still resolve outside a host frame. */
export function scalePx(n: number): string {
  return `calc(${n}px * var(--u, 1))`;
}

/** Every `ModuleStyle` field, applied the way the host applies it to
 *  built-in modules. Spread onto your root element, then add your layout. */
export function hostFrameStyle(
  style: HostModuleStyle,
  options: HostFrameOptions = {},
): CSSProperties {
  const chromeless = options.chromeless ?? false;
  const base = finite(options.baseFontSize, DEFAULT_BASE_FONT_SIZE) || DEFAULT_BASE_FONT_SIZE;
  // Guard the zero/NaN case: a bad font size would otherwise multiply every
  // scaled dimension by zero and render the module as a sliver. The rest of
  // the numeric fields get the same treatment, because a NaN reaching a
  // style object doesn't degrade — it drops the declaration outright.
  const fontSize = Number.isFinite(style.fontSize) && style.fontSize > 0
    ? style.fontSize
    : base;
  const opacity = Math.min(1, Math.max(0, finite(style.opacity, 1)));
  const blur = chromeless ? 0 : Math.max(0, finite(style.backdropBlur, 0));
  const hasBlur = blur > 0;
  const borderWidth = chromeless ? 0 : Math.max(0, finite(style.borderWidth, 0));
  const shadowSize = chromeless ? 0 : Math.max(0, finite(style.shadowSize, 0));
  // See the header note: with blur on, the opacity has to live in the
  // background's alpha or the blur renders invisible.
  const bakedBackground = hasBlur
    ? colorWithAlpha(style.backgroundColor, opacity)
    : null;

  return {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    boxSizing: 'border-box',
    // Published for `scalePx`, so pixel dimensions can follow the Text size
    // slider the same way `em` type does.
    ['--u' as string]: fontSize / base,
    fontFamily: resolveFontStack(style.fontFamily),
    fontSize,
    color: style.textColor,
    backgroundColor: chromeless
      ? 'transparent'
      : bakedBackground ?? style.backgroundColor,
    opacity: bakedBackground ? undefined : opacity,
    borderRadius: finite(style.borderRadius, 0),
    padding: finite(style.padding, 0),
    border: borderWidth > 0
      ? `${borderWidth}px solid ${style.borderColor ?? DEFAULT_BORDER_COLOR}`
      : undefined,
    boxShadow: moduleShadow(shadowSize),
    backdropFilter: hasBlur ? `blur(${blur}px)` : undefined,
    WebkitBackdropFilter: hasBlur ? `blur(${blur}px)` : undefined,
  };
}
