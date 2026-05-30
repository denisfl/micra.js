/**
 * src/core/bus.ts — Global event bus.
 *
 * Responsibilities:
 *   - Publish events (emit)
 *   - Subscribe and unsubscribe (on / off)
 *   - Provide unsubscribe tokens for component cleanup
 *
 * LLM NOTE: The bus is a module-level singleton.
 * Component instances subscribe via `instance.on()` which auto-registers
 * the unsub token in `instance.__micraSubs` for cleanup on destroy().
 */
import type { EmitArgs, EventPayload, UnsubFn } from '../types';
/**
 * Subscribe to a named event. Returns an unsubscribe function.
 * Payload is typed via the `MicraEvents` interface (augmentable).
 *
 * @example
 * const unsub = on('user:login', (user) => console.log(user))
 * unsub()  // stop listening
 */
export declare function on<K extends string>(event: K, handler: (payload: EventPayload<K>) => void): UnsubFn;
/**
 * Unsubscribe a specific handler from an event.
 */
export declare function off<K extends string>(event: K, handler: (payload: EventPayload<K>) => void): void;
/**
 * Publish an event to all subscribers. Errors are caught per-handler.
 * Payload is typed via the `MicraEvents` interface (augmentable).
 *
 * @example
 * emit('user:updated', { id: 1, name: 'Alice' })
 */
export declare function emit<K extends string>(event: K, ...args: EmitArgs<K>): void;
