/**
 * Micra.js — Lightweight reactive framework for small sites and simple SaaS.
 *
 * Public surface — re-exports only.
 *
 * Features:
 *   - JS expressions in directives  (data-if="count > 0")
 *   - Keyed list diffing             (data-each="items" data-key="id")
 *   - Auto-mount via data-component  (Micra.define + Micra.start)
 *   - Props from SSR data-attributes (this.prop('page'))
 *   - Built-in fetch helper          (this.fetch('/api/...'))
 *   - Global event bus               (Micra.on / Micra.emit)
 *   - DOM refs                       (data-ref="chart" → this.refs.chart)
 *   - Additive class toggling        (data-class="active:isActive")
 *   - @event shorthand               (@click="increment")
 *   - Lifecycle: onCreate, onDestroy
 *   - SSR-friendly: Micra.start() is safe to call multiple times
 *   - Directive cache: O(1) re-renders after first mount
 *
 * Size target: < 7 KB minified+gzipped
 *
 * @module Micra
 */
export type { StateRecord, UnsubFn, EventHandler, EventPayload, EmitArgs, MicraEvents, FetchOptions, ComponentMethods, ComponentBuiltins, ComponentInstance, ComponentDefinition, } from './types';
export type { MicraConfig } from './core/config';
export { FetchError } from './utils/fetch';
export { define, defineComponent, instances, registry, debug } from './core/registry';
export { mount } from './core/mount';
export { start } from './core/start';
export { destroy, autoCleanup } from './core/destroy';
export { on, off, emit } from './core/bus';
export { config } from './core/config';
