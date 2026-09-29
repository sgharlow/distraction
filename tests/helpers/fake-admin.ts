/**
 * Minimal recording fake of the supabase-js query builder surface used by the
 * subscriber routes: from(t).select(cols).eq(..).maybeSingle() and
 * from(t).update(vals).eq(..)[.eq(..)] (awaited directly).
 * Every call is recorded so tests assert on WHAT was written and filtered.
 */
export interface RecordedCall {
  table: string;
  kind: 'select' | 'update';
  payload: unknown;
  filters: Array<[string, unknown]>;
}

export interface QueryResult {
  data?: unknown;
  error: { code?: string; message: string } | null;
}

export function createFakeAdmin() {
  const calls: RecordedCall[] = [];
  const results: { select: QueryResult; update: QueryResult } = {
    select: { data: null, error: null },
    update: { error: null },
  };

  function chain(table: string, kind: 'select' | 'update', payload: unknown) {
    const call: RecordedCall = { table, kind, payload, filters: [] };
    calls.push(call);
    const api = {
      eq(col: string, val: unknown) {
        call.filters.push([col, val]);
        return api;
      },
      maybeSingle: async () => results[kind],
      then<T>(onFulfilled: (r: QueryResult) => T, onRejected?: (e: unknown) => T) {
        return Promise.resolve(results[kind]).then(onFulfilled, onRejected);
      },
    };
    return api;
  }

  const client = {
    from: (table: string) => ({
      select: (cols: string) => chain(table, 'select', cols),
      update: (vals: Record<string, unknown>) => chain(table, 'update', vals),
    }),
  };

  return { client, calls, results };
}
