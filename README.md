# SATU INSANI - PPBS

Aplikasi web untuk pengelolaan presensi, data santri, akademik, dan administrasi Pondok Pesantren berbasis React, TypeScript, Vite, dan Supabase.

## Persiapan lokal

- Node.js 22 atau lebih baru
- Project Supabase

```bash
npm ci
cp .env.example .env.local
```

Isi `.env.local` dengan URL project Supabase dan publishable key:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

Jalankan aplikasi:

```bash
npm run dev
```

## Validasi

```bash
npm run lint
npm run build
```

Build produksi tersedia di folder `dist/`. Deploy frontend ke hosting statis yang mendukung single-page application, dan atur kedua variabel `VITE_SUPABASE_*` di environment build hosting tersebut.

## Supabase

Migration database ada di `supabase/migrations/`, dan Edge Function pengelolaan akun admin ada di `supabase/functions/admin-users/`. Terapkan migration dan deploy function ke project Supabase yang sesuai sebelum menggunakan aplikasi.

`VITE_SUPABASE_PUBLISHABLE_KEY` digunakan di browser dan bukan pengganti kebijakan keamanan database. Terapkan Row Level Security sesuai migration. Jangan pernah memasukkan `SUPABASE_SERVICE_ROLE_KEY` atau secret server ke variabel `VITE_*`, repository, maupun frontend.

## GitHub

GitHub Actions menjalankan lint dan production build pada setiap push dan pull request. File environment lokal dan metadata Supabase CLI dikecualikan dari Git.
