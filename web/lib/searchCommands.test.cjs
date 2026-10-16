// searchCommands.test.cjs — unit tests for the Cmd+K global search overlay
// Covers search behavior from Issues #623 and #387
// Runs with: node --test ./lib/searchCommands.test.cjs

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  BASE_COMMANDS,
  isSearchShortcut,
  isDismissShortcut,
  scoreCommand,
  filterCommands,
  buildCommandRegistry,
  moveHighlight,
} = require('./searchCommands');

// ── Shortcut detection ──────────────────────────────────────────────────────

test('isSearchShortcut: matches Ctrl+K and Cmd+K', () => {
  assert.equal(isSearchShortcut({ key: 'k', ctrlKey: true }), true);
  assert.equal(isSearchShortcut({ key: 'k', metaKey: true }), true);
});

test('isSearchShortcut: is case insensitive (Shift+Cmd+K still opens)', () => {
  assert.equal(isSearchShortcut({ key: 'K', metaKey: true, shiftKey: true }), true);
});

test('isSearchShortcut: ignores a bare k and other modifier combos', () => {
  assert.equal(isSearchShortcut({ key: 'k' }), false);
  assert.equal(isSearchShortcut({ key: 'k', altKey: true, metaKey: true }), false);
  assert.equal(isSearchShortcut({ key: 'j', ctrlKey: true }), false);
});

test('isSearchShortcut: tolerates missing or malformed events', () => {
  assert.equal(isSearchShortcut(null), false);
  assert.equal(isSearchShortcut(undefined), false);
  assert.equal(isSearchShortcut({}), false);
});

test('isDismissShortcut: matches Escape only', () => {
  assert.equal(isDismissShortcut({ key: 'Escape' }), true);
  assert.equal(isDismissShortcut({ key: 'Enter' }), false);
  assert.equal(isDismissShortcut(null), false);
});

// ── Registry ────────────────────────────────────────────────────────────────

test('buildCommandRegistry: includes the base navigation commands', () => {
  const registry = buildCommandRegistry();
  assert.equal(registry.length, BASE_COMMANDS.length);
  assert.ok(registry.some((c) => c.href === '/settings'));
});

test('buildCommandRegistry: appends contract functions as selectable commands', () => {
  const registry = buildCommandRegistry({ functions: [{ name: 'transfer' }, { name: 'mint' }] });
  const transfer = registry.find((c) => c.id === 'fn-transfer');
  assert.ok(transfer);
  assert.equal(transfer.action, 'select-function');
  assert.deepEqual(transfer.payload, { name: 'transfer' });
});

test('buildCommandRegistry: every command has a unique id', () => {
  const ids = buildCommandRegistry({ functions: [{ name: 'transfer' }] }).map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
});

// ── Scoring & filtering ─────────────────────────────────────────────────────

const COMMANDS = [
  { id: 'a', title: 'Settings', subtitle: 'Custom RPC endpoints', group: 'Preferences', keywords: ['rpc', 'indexer'] },
  { id: 'b', title: 'Invocation history', subtitle: 'Previous runs', group: 'Navigation', keywords: ['past'] },
  { id: 'c', title: 'Transactions', subtitle: 'Recent on-chain activity', group: 'Navigation', keywords: ['tx'] },
];

test('scoreCommand: an exact title beats a prefix which beats a substring', () => {
  const exact = scoreCommand(COMMANDS[0], 'settings');
  const prefix = scoreCommand(COMMANDS[0], 'sett');
  const subtitleHit = scoreCommand(COMMANDS[0], 'endpoints');
  assert.ok(exact > prefix);
  assert.ok(prefix > subtitleHit);
});

test('scoreCommand: returns 0 when nothing matches', () => {
  assert.equal(scoreCommand(COMMANDS[0], 'zzzzzz'), 0);
});

test('filterCommands: an empty query returns everything in registry order', () => {
  assert.deepEqual(
    filterCommands(COMMANDS, '').map((c) => c.id),
    ['a', 'b', 'c'],
  );
  assert.deepEqual(filterCommands(COMMANDS, '   ').length, 3);
});

test('filterCommands: matching is case insensitive', () => {
  assert.deepEqual(
    filterCommands(COMMANDS, 'SETTINGS').map((c) => c.id),
    ['a'],
  );
});

test('filterCommands: matches on keywords as well as titles', () => {
  assert.deepEqual(
    filterCommands(COMMANDS, 'rpc').map((c) => c.id),
    ['a'],
  );
});

test('filterCommands: matches a word start inside a multi-word title', () => {
  assert.deepEqual(
    filterCommands(COMMANDS, 'history').map((c) => c.id),
    ['b'],
  );
});

test('filterCommands: fuzzy matching tolerates a substituted character in a title', () => {
  assert.deepEqual(
    filterCommands(COMMANDS, 'settungs').map((c) => c.id),
    ['a'],
  );
});

test('filterCommands: fuzzy matching handles adjacent transpositions in title words', () => {
  assert.deepEqual(
    filterCommands(COMMANDS, 'histroy').map((c) => c.id),
    ['b'],
  );
});

test('filterCommands: fuzzy matching also applies to keywords', () => {
  assert.deepEqual(
    filterCommands(COMMANDS, 'indexre').map((c) => c.id),
    ['a'],
  );
});

test('filterCommands: direct matches rank above fuzzy matches', () => {
  const commands = [
    { id: 'fuzzy', title: 'Settungs', subtitle: '', group: 'Test', keywords: [] },
    { id: 'direct', title: 'Settings', subtitle: '', group: 'Test', keywords: [] },
  ];

  assert.deepEqual(
    filterCommands(commands, 'settings').map((c) => c.id),
    ['direct', 'fuzzy'],
  );
});

test('filterCommands: ranks the strongest match first', () => {
  const results = filterCommands(COMMANDS, 'tran');
  assert.equal(results[0].id, 'c');
});

test('filterCommands: returns an empty list when nothing matches', () => {
  assert.deepEqual(filterCommands(COMMANDS, 'quantum'), []);
});

test('filterCommands: honours the result limit', () => {
  assert.equal(filterCommands(COMMANDS, '', { limit: 2 }).length, 2);
});

test('filterCommands: tolerates a non-array registry', () => {
  assert.deepEqual(filterCommands(null, 'x'), []);
  assert.deepEqual(filterCommands(undefined, ''), []);
});

// ── Keyboard navigation ─────────────────────────────────────────────────────

test('moveHighlight: steps forward and wraps at the end', () => {
  assert.equal(moveHighlight(0, 1, 3), 1);
  assert.equal(moveHighlight(2, 1, 3), 0);
});

test('moveHighlight: steps backward and wraps at the start', () => {
  assert.equal(moveHighlight(1, -1, 3), 0);
  assert.equal(moveHighlight(0, -1, 3), 2);
});

test('moveHighlight: stays at 0 for an empty result list', () => {
  assert.equal(moveHighlight(0, 1, 0), 0);
  assert.equal(moveHighlight(3, -1, 0), 0);
});

// ── Search result grouping ──────────────────────────────────────────────────

const { categoryForGroup, groupResultsByCategory } = require('./searchCommands');

// categoryForGroup ────────────────────────────────────────────────────────────

test('categoryForGroup: Navigation maps to pages', () => {
  assert.equal(categoryForGroup('Navigation'), 'pages');
});

test('categoryForGroup: Preferences maps to settings', () => {
  assert.equal(categoryForGroup('Preferences'), 'settings');
});

test('categoryForGroup: Contract functions maps to functions', () => {
  assert.equal(categoryForGroup('Contract functions'), 'functions');
});

test('categoryForGroup: unknown group falls back to pages', () => {
  assert.equal(categoryForGroup('Something Else'), 'pages');
  assert.equal(categoryForGroup(''), 'pages');
});

// groupResultsByCategory ──────────────────────────────────────────────────────

const GROUPED_COMMANDS = [
  { id: 'nav-explorer', title: 'Explorer', group: 'Navigation', href: '/?tab=explorer' },
  { id: 'nav-history',  title: 'History',  group: 'Navigation', href: '/?tab=history' },
  { id: 'fn-transfer',  title: 'transfer', group: 'Contract functions', action: 'select-function' },
  { id: 'nav-settings', title: 'Settings', group: 'Preferences', href: '/settings' },
];

test('groupResultsByCategory: returns one bucket per present category', () => {
  const groups = groupResultsByCategory(GROUPED_COMMANDS);
  const cats = groups.map((g) => g.category);
  assert.deepEqual(cats, ['pages', 'functions', 'settings']);
});

test('groupResultsByCategory: pages bucket contains Navigation items', () => {
  const groups = groupResultsByCategory(GROUPED_COMMANDS);
  const pages = groups.find((g) => g.category === 'pages');
  assert.ok(pages);
  assert.equal(pages.commands.length, 2);
  assert.ok(pages.commands.some((c) => c.id === 'nav-explorer'));
  assert.ok(pages.commands.some((c) => c.id === 'nav-history'));
});

test('groupResultsByCategory: functions bucket contains contract function items', () => {
  const groups = groupResultsByCategory(GROUPED_COMMANDS);
  const fns = groups.find((g) => g.category === 'functions');
  assert.ok(fns);
  assert.equal(fns.commands.length, 1);
  assert.equal(fns.commands[0].id, 'fn-transfer');
});

test('groupResultsByCategory: settings bucket contains Preferences items', () => {
  const groups = groupResultsByCategory(GROUPED_COMMANDS);
  const settings = groups.find((g) => g.category === 'settings');
  assert.ok(settings);
  assert.equal(settings.commands.length, 1);
  assert.equal(settings.commands[0].id, 'nav-settings');
});

test('groupResultsByCategory: each bucket has a human-readable label', () => {
  const groups = groupResultsByCategory(GROUPED_COMMANDS);
  for (const group of groups) {
    assert.ok(typeof group.label === 'string' && group.label.length > 0,
      `category "${group.category}" should have a non-empty label`);
  }
  assert.equal(groups.find((g) => g.category === 'pages').label, 'Pages');
  assert.equal(groups.find((g) => g.category === 'functions').label, 'Functions');
  assert.equal(groups.find((g) => g.category === 'settings').label, 'Settings');
});

test('groupResultsByCategory: category order is always pages → functions → settings', () => {
  // Provide items in reverse order to confirm output order is fixed.
  const reversed = [...GROUPED_COMMANDS].reverse();
  const cats = groupResultsByCategory(reversed).map((g) => g.category);
  assert.deepEqual(cats, ['pages', 'functions', 'settings']);
});

test('groupResultsByCategory: omits empty categories', () => {
  const onlyFunctions = [
    { id: 'fn-mint', title: 'mint', group: 'Contract functions', action: 'select-function' },
  ];
  const groups = groupResultsByCategory(onlyFunctions);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].category, 'functions');
});

test('groupResultsByCategory: returns empty array for empty input', () => {
  assert.deepEqual(groupResultsByCategory([]), []);
});

test('groupResultsByCategory: tolerates non-array input', () => {
  assert.deepEqual(groupResultsByCategory(null), []);
  assert.deepEqual(groupResultsByCategory(undefined), []);
});

test('groupResultsByCategory: preserves within-category registry order', () => {
  const groups = groupResultsByCategory(GROUPED_COMMANDS);
  const pages = groups.find((g) => g.category === 'pages');
  assert.equal(pages.commands[0].id, 'nav-explorer');
  assert.equal(pages.commands[1].id, 'nav-history');
});

test('groupResultsByCategory: works with full buildCommandRegistry output', () => {
  const registry = buildCommandRegistry({ functions: [{ name: 'transfer' }, { name: 'mint' }] });
  const groups = groupResultsByCategory(registry);
  const cats = groups.map((g) => g.category);
  // All three categories should be present since registry has nav + functions + settings.
  assert.ok(cats.includes('pages'));
  assert.ok(cats.includes('functions'));
  assert.ok(cats.includes('settings'));
});
