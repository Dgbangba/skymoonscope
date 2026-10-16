import type { ContractFunction } from './sorobantypes';

export interface SearchCommand {
  id: string;
  title: string;
  subtitle?: string;
  group: string;
  /** Route to navigate to when selected. */
  href?: string;
  /** Non-navigation action identifier handled by the overlay. */
  action?: string;
  payload?: Record<string, unknown>;
  keywords?: string[];
}

/** One of the three public display categories for grouped search results. */
export type SearchCategory = 'pages' | 'functions' | 'settings';

/** A category bucket returned by `groupResultsByCategory`. */
export interface SearchResultGroup {
  category: SearchCategory;
  /** Human-readable heading, e.g. "Pages", "Functions", "Settings". */
  label: string;
  commands: SearchCommand[];
}

export declare const BASE_COMMANDS: SearchCommand[];

/** True when the event is Cmd+K / Ctrl+K. */
export declare function isSearchShortcut(event: KeyboardEvent | null | undefined): boolean;

/** True when the event is Escape. */
export declare function isDismissShortcut(event: KeyboardEvent | null | undefined): boolean;

export declare function scoreCommand(command: SearchCommand, query: string): number;

export declare function filterCommands(
  commands: SearchCommand[],
  query: string,
  options?: { limit?: number },
): SearchCommand[];

export declare function buildCommandRegistry(context?: {
  functions?: ContractFunction[];
  extra?: SearchCommand[];
}): SearchCommand[];

export declare function moveHighlight(current: number, delta: number, length: number): number;

/**
 * Map an internal `group` string to a `SearchCategory`.
 * Unknown groups fall back to `'pages'`.
 */
export declare function categoryForGroup(group: string): SearchCategory;

/**
 * Group a flat ordered results array into display categories.
 * Empty categories are omitted. Categories always appear in the order:
 * pages → functions → settings.
 */
export declare function groupResultsByCategory(results: SearchCommand[]): SearchResultGroup[];
