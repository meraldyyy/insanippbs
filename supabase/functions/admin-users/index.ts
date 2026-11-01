import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type RequestBody = {
  action?: 'list' | 'create' | 'update' | 'delete';
  user_id?: string;
  email?: string;
  password?: string;
  full_name?: string;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method tidak diizinkan.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization');
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) return json({ error: 'Konfigurasi autentikasi server belum lengkap.' }, 500);

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: 'Sesi login tidak valid.' }, 401);

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: operator, error: operatorError } = await adminClient.from('profiles').select('role').eq('user_id', user.id).single();
  if (operatorError || operator?.role !== 'admin') return json({ error: 'Hanya administrator yang dapat mengelola akun admin.' }, 403);

  let body: RequestBody;
  try { body = await request.json() as RequestBody; } catch { return json({ error: 'Data permintaan tidak valid.' }, 400); }
  const action = body.action;
  if (!action) return json({ error: 'Aksi belum ditentukan.' }, 400);

  try {
    if (action === 'list') {
      const { data: profiles, error: profilesError } = await adminClient.from('profiles').select('user_id, full_name, role, created_at').eq('role', 'admin').order('full_name');
      if (profilesError) throw profilesError;
      const users: Record<string, unknown>[] = [];
      for (const profile of profiles ?? []) {
        const { data: authUser, error: authError } = await adminClient.auth.admin.getUserById(profile.user_id);
        if (authError || !authUser.user) continue;
        users.push({ ...profile, email: authUser.user.email ?? '', last_sign_in_at: authUser.user.last_sign_in_at ?? null });
      }
      return json({ users });
    }

    if (action === 'create') {
      if (!body.email || !body.password || !body.full_name?.trim()) return json({ error: 'Nama, email, dan password wajib diisi.' }, 400);
      if (body.password.length < 8) return json({ error: 'Password minimal 8 karakter.' }, 400);
      const { data: created, error: createError } = await adminClient.auth.admin.createUser({ email: body.email.trim().toLowerCase(), password: body.password, email_confirm: true, user_metadata: { full_name: body.full_name.trim() } });
      if (createError || !created.user) throw createError ?? new Error('Akun gagal dibuat.');
      const { error: profileError } = await adminClient.from('profiles').update({ full_name: body.full_name.trim(), role: 'admin' }).eq('user_id', created.user.id);
      if (profileError) { await adminClient.auth.admin.deleteUser(created.user.id); throw profileError; }
      return json({ user: { user_id: created.user.id, email: created.user.email, full_name: body.full_name.trim(), role: 'admin', created_at: created.user.created_at, last_sign_in_at: null } });
    }

    if (!body.user_id) return json({ error: 'ID akun belum ditentukan.' }, 400);
    if (action === 'delete') {
      if (body.user_id === user.id) return json({ error: 'Akun yang sedang digunakan tidak dapat dihapus.' }, 400);
      const { data: target, error: targetError } = await adminClient.from('profiles').select('role').eq('user_id', body.user_id).single();
      if (targetError || target?.role !== 'admin') return json({ error: 'Akun admin tidak ditemukan.' }, 404);
      const { count, error: countError } = await adminClient.from('profiles').select('user_id', { count: 'exact', head: true }).eq('role', 'admin');
      if (countError) throw countError;
      if ((count ?? 0) <= 1) return json({ error: 'Minimal harus ada satu akun admin.' }, 400);
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(body.user_id);
      if (deleteError) throw deleteError;
      return json({ ok: true });
    }

    if (action === 'update') {
      if (!body.email || !body.full_name?.trim()) return json({ error: 'Nama dan email wajib diisi.' }, 400);
      if (body.password && body.password.length < 8) return json({ error: 'Password minimal 8 karakter.' }, 400);
      const attributes = { email: body.email.trim().toLowerCase(), email_confirm: true, ...(body.password ? { password: body.password } : {}) };
      const { data: updated, error: updateError } = await adminClient.auth.admin.updateUserById(body.user_id, attributes);
      if (updateError || !updated.user) throw updateError ?? new Error('Akun gagal diperbarui.');
      const { error: profileError } = await adminClient.from('profiles').update({ full_name: body.full_name.trim(), role: 'admin' }).eq('user_id', body.user_id);
      if (profileError) throw profileError;
      return json({ user: { user_id: body.user_id, email: updated.user.email, full_name: body.full_name.trim(), role: 'admin', created_at: updated.user.created_at, last_sign_in_at: updated.user.last_sign_in_at ?? null } });
    }
    return json({ error: 'Aksi tidak dikenali.' }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Operasi akun admin gagal.' }, 400);
  }
});
