/**
 * Injection tokens.
 *
 * Kept in their own module because a token declared alongside its provider makes
 * every consumer import the provider's file, and that is how a repository ends
 * up transitively importing the event bus.
 */
export const PG_POOL = Symbol('PG_POOL');
export const EVENT_BUS = Symbol('EVENT_BUS');
export const SUPPORT_CONFIG = Symbol('SUPPORT_CONFIG');
export const STORAGE_PRESIGNER = Symbol('STORAGE_PRESIGNER');
export const HEALTH_REGISTRY = Symbol('HEALTH_REGISTRY');
