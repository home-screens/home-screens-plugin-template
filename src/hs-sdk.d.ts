/**
 * Type declarations for the Home Screens plugin SDK.
 * These globals are provided by the host app at runtime.
 */

declare global {
  interface Window {
    /** Provided by the host — do not bundle React */
    React: typeof import('react');
    /** Provided by the host — do not bundle ReactDOM */
    ReactDOM: typeof import('react-dom');
    /** Shared SDK from the host app */
    __HS_SDK__: {
      /** CSS class for standard inputs in config panels */
      INPUT_CLASS: string;
      /** CSS class for nested/secondary inputs in config panels */
      NESTED_INPUT_CLASS: string;
    };
    /** Plugin export target — set by the IIFE wrapper, read by the host loader */
    __HS_PLUGIN__: Record<string, unknown>;
  }
}

export {};
