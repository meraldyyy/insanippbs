import { supabase } from './supabase';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

type ApiError = { message: string; code?: string };
type QueryResult<Data> = PromiseLike<{ data: Data | null; error: ApiError | null }>;
type TableQuery<Row> = QueryResult<Row[]> & {
  select(columns?: string): TableQuery<Row>;
  insert(values: unknown): TableQuery<Row>;
  update(values: unknown): TableQuery<Row>;
  upsert(values: unknown, options?: { onConflict?: string }): TableQuery<Row>;
  delete(): TableQuery<Row>;
  eq(column: string, value: unknown): TableQuery<Row>;
  gte(column: string, value: unknown): TableQuery<Row>;
  lte(column: string, value: unknown): TableQuery<Row>;
  in(column: string, values: unknown[]): TableQuery<Row>;
  order(column: string, options?: { ascending?: boolean }): TableQuery<Row>;
  limit(count: number): TableQuery<Row>;
  range(from: number, to: number): TableQuery<Row>;
  single(): QueryResult<Row>;
  maybeSingle(): QueryResult<Row>;
};
type LoginData = {
  session: Session | null;
  otp_required?: boolean;
  challenge_id?: string;
  debug_code?: string;
};

export const api = {
  auth: {
    getSession: () => supabase.auth.getSession(),
    onAuthStateChange: (callback: (event: AuthChangeEvent, session: Session | null) => void) => supabase.auth.onAuthStateChange(callback),
    async signInWithPassword(credentials: { email: string; password: string }): Promise<{ data: LoginData; error: ApiError | null }> {
      const result = await supabase.auth.signInWithPassword(credentials);
      return { data: { session: result.data.session, otp_required: false }, error: result.error };
    },
    signOut: () => supabase.auth.signOut(),
    updateUser: (attributes: { email?: string; password?: string; data?: { full_name?: string } }) => supabase.auth.updateUser(attributes),
  },
  storage: supabase.storage,
  functions: {
    invoke<T = unknown>(functionName: string, body: Record<string, unknown>) {
      return supabase.functions.invoke<T>(functionName, { body });
    },
  },
  from<Row = Record<string, unknown>>(table: string) {
    return supabase.from(table) as unknown as TableQuery<Row>;
  },
  rpc(functionName: string, args: Record<string, unknown>) {
    return supabase.rpc(functionName as never, args as never);
  },
  setPlatform(platform: 'ppbs' | 'cim' | 'launcher' | 'console'): void {
    // This temporary build only serves PPBS.
    void platform;
  },
};
