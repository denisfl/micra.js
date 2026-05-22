/**
 * src/core/mount.ts — Mount a component definition onto a DOM element.
 *
 * Responsibilities:
 *   - Create and initialize an InternalInstance
 *   - Set up reactive state + batch scheduler
 *   - Wire render(), destroy(), prop(), fetch(), on(), emit()
 *   - Run initial render + call onCreate() in a microtask
 *
 * LLM NOTE: This is the core of the Micra runtime.
 * mount() is called by both the public Micra.mount() API and by start()
 * (which scans the DOM for [data-component] elements).
 */
import type { ComponentDefinition, ComponentInstance, StateRecord } from '../types';
/**
 * Mount a component definition onto a DOM element.
 * Returns the component instance, or null if the root element is not found.
 *
 * Already-mounted elements return the existing instance.
 *
 * @example
 * const instance = Micra.mount('#counter', {
 *   state: { count: 0 },
 *   inc() { this.state.count++ },
 * })
 */
export declare function mount<S extends StateRecord>(selector: string | HTMLElement, definition: ComponentDefinition<S>): ComponentInstance<S> | null;
