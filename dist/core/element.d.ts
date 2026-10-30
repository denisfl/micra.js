/**
 * src/core/element.ts — <micra-NAME> custom elements.
 *
 * define('dropdown', def) also registers <micra-dropdown>. The element mounts
 * itself when it connects and tears itself down when it leaves the document,
 * so markup inserted by any means — htmx, Turbo, innerHTML, a CMS block —
 * works without start() or autoCleanup().
 *
 * The element sets data-component on itself, so everything keyed on that
 * attribute (nested-component boundaries in scan, start(), destroy(), debug())
 * treats it exactly like <div data-component="dropdown">.
 */
export declare function registerElement(name: string): void;
