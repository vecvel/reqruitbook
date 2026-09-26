'use client';

/**
 * React bindings: one provider, one hook, one component.
 *
 * Kept deliberately small. A portal's own components decide how something
 * looks; all this layer decides is whether it is worth showing at all.
 */
import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';

import { AccessEvaluator, EMPTY_ACCESS, type AccessSnapshot, type PermissionKey } from './access';
import type { ApiClient } from './client';

const AccessContext = createContext<AccessEvaluator>(new AccessEvaluator(EMPTY_ACCESS));
const ClientContext = createContext<ApiClient | null>(null);

export function AccessProvider({
  snapshot,
  children,
}: {
  snapshot: AccessSnapshot | null;
  children: ReactNode;
}) {
  // Memoized on the snapshot's *content*, not its identity. A server component
  // re-render hands down a structurally identical but newly allocated object on
  // every navigation; memoizing on identity would rebuild the evaluator each
  // time and re-render every consumer beneath it.
  const key = JSON.stringify(snapshot ?? EMPTY_ACCESS);
  const access = useMemo(() => new AccessEvaluator(snapshot), [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return <AccessContext.Provider value={access}>{children}</AccessContext.Provider>;
}

export function ApiProvider({ client, children }: { client: ApiClient; children: ReactNode }) {
  return <ClientContext.Provider value={client}>{children}</ClientContext.Provider>;
}

export function useAccess(): AccessEvaluator {
  return useContext(AccessContext);
}

export function useApi(): ApiClient {
  const client = useContext(ClientContext);
  if (!client) {
    throw new Error('useApi must be used inside an <ApiProvider>');
  }
  return client;
}

/**
 * Renders children only when the actor holds the permission.
 *
 * `fallback` exists for the cases where silence is worse than a message — a
 * disabled control with an explanation beats a page that looks broken.
 */
export function Can({
  permission,
  permissions,
  mode = 'any',
  fallback = null,
  children,
}: {
  permission?: PermissionKey;
  permissions?: PermissionKey[];
  mode?: 'any' | 'all';
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const access = useAccess();
  const required = permission ? [permission] : (permissions ?? []);

  return <>{access.check(required, mode) ? children : fallback}</>;
}
