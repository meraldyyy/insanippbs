create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'Administrator',
  role text not null default 'viewer' check (role in ('admin','teacher','parent','viewer')),
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.students (
  id uuid primary key default gen_random_uuid(), student_code text not null unique, full_name text not null,
  class_name text not null default 'Belum ditentukan', parent_name text, birth_place_date text, photo_url text,
  is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.cards (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references public.students(id) on delete cascade,
  uid text not null unique, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.devices (
  id uuid primary key default gen_random_uuid(), name text not null, location text not null, api_key_hash text not null,
  is_online boolean not null default false, last_seen_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.schedules (
  id uuid primary key default gen_random_uuid(), name text not null default 'Jadwal presensi santri',
  work_start time not null default '08:00', work_end time not null default '17:00',
  check_in_end time not null default '17:00', checkout_start time not null default '22:00', checkout_end time not null default '23:00',
  late_tolerance_minutes integer not null default 15 check (late_tolerance_minutes >= 0),
  work_days jsonb not null default '[1,2,3,4,5,6]'::jsonb, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.attendance (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references public.students(id) on delete cascade,
  attendance_date date not null, check_in_at timestamptz, check_out_at timestamptz, status text not null default 'present',
  device_id uuid references public.devices(id) on delete set null, note text, is_manual boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(student_id, attendance_date)
);
create index attendance_date_student_idx on public.attendance(attendance_date,student_id);
create table public.scan_logs (
  id uuid primary key default gen_random_uuid(), device_id uuid references public.devices(id) on delete set null,
  uid text not null, scanned_at timestamptz not null, result text not null,
  student_id uuid references public.students(id) on delete set null, message text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index scan_logs_scanned_at_idx on public.scan_logs(scanned_at);

create table public.academic_terms (id uuid primary key default gen_random_uuid(), name text not null unique, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.academic_subjects (id uuid primary key default gen_random_uuid(), name text not null unique, is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.attitude_aspects (id uuid primary key default gen_random_uuid(), name text not null unique, is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.academic_grades (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references public.students(id) on delete cascade,
  term_id uuid not null references public.academic_terms(id) on delete restrict,
  subject_id uuid not null references public.academic_subjects(id) on delete restrict,
  score numeric(5,2) not null, note text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(student_id,term_id,subject_id)
);
create index academic_grades_term_student_idx on public.academic_grades(term_id,student_id);
create table public.attitude_grades (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references public.students(id) on delete cascade,
  term_id uuid not null references public.academic_terms(id) on delete restrict,
  aspect_id uuid not null references public.attitude_aspects(id) on delete restrict,
  score numeric(5,2) not null, note text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(student_id,term_id,aspect_id)
);
create table public.subject_attendance (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references public.students(id) on delete cascade,
  subject_id uuid not null references public.academic_subjects(id) on delete cascade, attendance_date date not null,
  status text not null default 'present', note text, is_manual boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(student_id,subject_id,attendance_date)
);
create index subject_attendance_date_subject_idx on public.subject_attendance(attendance_date,subject_id);
create table public.prayer_schedules (
  id uuid primary key default gen_random_uuid(), prayer_key text not null unique, name text not null,
  opens_at time not null, closes_at time not null, is_active boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(opens_at < closes_at)
);
create table public.prayer_attendance (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references public.students(id) on delete cascade,
  prayer_key text not null, prayer_date date not null, checked_in_at timestamptz not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(student_id,prayer_key,prayer_date)
);
create index prayer_attendance_date_key_idx on public.prayer_attendance(prayer_date,prayer_key);
create table public.attendance_holidays (
  id uuid primary key default gen_random_uuid(), holiday_date date not null unique, name text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.student_accounts (
  user_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key(user_id,student_id), unique(user_id)
);

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end; $$;
do $$
declare t text;
begin
  foreach t in array array['profiles','students','cards','devices','schedules','attendance','scan_logs','academic_terms','academic_subjects','attitude_aspects','academic_grades','attitude_grades','subject_attendance','prayer_schedules','prayer_attendance','attendance_holidays','student_accounts']
  loop execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()',t||'_updated_at',t); end loop;
end $$;

create or replace function public.create_profile_for_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(user_id,full_name,role)
  values(new.id,coalesce(new.raw_user_meta_data->>'full_name',split_part(new.email,'@',1)),'viewer');
  return new;
end; $$;
create trigger on_auth_user_created_profile after insert on auth.users for each row execute function public.create_profile_for_new_user();

create or replace function public.current_app_role() returns text language sql stable security definer set search_path = '' as $$
  select role from public.profiles where user_id=(select auth.uid())
$$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_app_role()='admin',false)
$$;
create or replace function public.can_manage_academics() returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_app_role() in ('admin','teacher'),false)
$$;
create or replace function public.parent_has_student(target_student uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.student_accounts where user_id=(select auth.uid()) and student_id=target_student)
$$;

create or replace function public.register_student_with_card(p_student_code text,p_full_name text,p_class_name text,p_parent_name text,p_birth_place_date text,p_card_uid text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare student_id uuid; uid_value text;
begin
  if not public.is_admin() then raise exception 'Hanya admin yang dapat mendaftarkan santri.' using errcode='42501'; end if;
  uid_value:=upper(regexp_replace(coalesce(p_card_uid,''),'[^A-Fa-f0-9]','','g'));
  if length(uid_value)<4 or length(uid_value)>64 then raise exception 'UID RFID tidak valid.' using errcode='22023'; end if;
  insert into public.students(student_code,full_name,class_name,parent_name,birth_place_date)
  values(upper(trim(p_student_code)),trim(p_full_name),coalesce(nullif(trim(p_class_name),''),'Belum ditentukan'),nullif(trim(p_parent_name),''),nullif(trim(p_birth_place_date),'')) returning id into student_id;
  insert into public.cards(student_id,uid) values(student_id,uid_value);
  return student_id;
end; $$;
create or replace function public.update_admin_profile(p_full_name text,p_avatar_path text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Hanya admin yang dapat memperbarui profil.' using errcode='42501'; end if;
  if p_avatar_path is not null and p_avatar_path !~ ('^'||(select auth.uid())::text||'/profile-[0-9a-f-]+[.]webp$') then raise exception 'Path foto profil tidak valid.' using errcode='22023'; end if;
  update public.profiles set full_name=trim(p_full_name),avatar_path=p_avatar_path where user_id=(select auth.uid());
end; $$;
create or replace function public.save_prayer_schedules(p_schedules jsonb) returns setof public.prayer_schedules
language plpgsql security definer set search_path = '' as $$
declare row_value jsonb;
begin
  if not public.is_admin() then raise exception 'Hanya admin yang dapat mengubah jadwal.' using errcode='42501'; end if;
  if jsonb_typeof(p_schedules)<>'array' or jsonb_array_length(p_schedules)<>5 then raise exception 'Kirim semua lima jadwal salat.' using errcode='22023'; end if;
  if (select count(distinct x->>'prayer_key') from jsonb_array_elements(p_schedules) x)<>5 then raise exception 'Jadwal salat harus unik.' using errcode='22023'; end if;
  for row_value in select * from jsonb_array_elements(p_schedules) loop
    if row_value->>'prayer_key' not in ('subuh','zuhur','asar','magrib','isya') then raise exception 'Jadwal salat tidak valid.' using errcode='22023'; end if;
    if (row_value->>'opens_at')::time >= (row_value->>'closes_at')::time then raise exception 'Jam tutup harus setelah jam buka.' using errcode='22023'; end if;
    update public.prayer_schedules set opens_at=(row_value->>'opens_at')::time,closes_at=(row_value->>'closes_at')::time,is_active=(row_value->>'is_active')::boolean where prayer_key=row_value->>'prayer_key';
  end loop;
  if exists(select 1 from (select opens_at,lag(closes_at) over(order by opens_at) previous_close from public.prayer_schedules where is_active) q where previous_close>opens_at) then
    raise exception 'Jadwal salat tidak boleh bertumpuk.' using errcode='22023';
  end if;
  return query select * from public.prayer_schedules order by opens_at;
end; $$;
create or replace function public.process_rfid_scan(p_card_uid text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid_value text; c record; local_now timestamp; day_value date; time_value time;
  prayer record; sched public.schedules%rowtype; att public.attendance%rowtype;
  outcome text; message text; status_value text;
begin
  if not public.is_admin() then raise exception 'Hanya admin yang dapat menjalankan scan.' using errcode='42501'; end if;
  uid_value:=upper(regexp_replace(coalesce(p_card_uid,''),'[^A-Fa-f0-9]','','g'));
  if length(uid_value)<4 or length(uid_value)>64 then raise exception 'UID RFID tidak valid.' using errcode='22023'; end if;
  local_now:=now() at time zone 'Asia/Jakarta'; day_value:=local_now::date; time_value:=local_now::time;
  select cards.is_active card_active,students.id student_id,students.full_name,students.class_name,students.is_active student_active
  into c from public.cards join public.students on students.id=cards.student_id
  where upper(regexp_replace(cards.uid,'[^A-Fa-f0-9]','','g'))=uid_value limit 1;
  if not found then
    outcome:='unknown_card'; message:='Kartu RFID belum terdaftar.';
    insert into public.scan_logs(uid,scanned_at,result,message) values(uid_value,now(),outcome,message);
    return jsonb_build_object('scan_result',outcome,'display_message',message,'student_name',null,'class_name',null,'attendance_status',null);
  end if;
  if not c.card_active or not c.student_active then
    outcome:='inactive'; message:=case when not c.card_active then 'Kartu RFID tidak aktif.' else 'Data santri tidak aktif.' end;
  else
    select * into prayer from public.prayer_schedules where is_active and opens_at<=time_value and closes_at>time_value order by opens_at limit 1;
    if found then
      if exists(select 1 from public.prayer_attendance where student_id=c.student_id and prayer_key=prayer.prayer_key and prayer_date=day_value) then
        outcome:='prayer_duplicate'; message:='Absen sholat '||prayer.name||' hari ini sudah tercatat.';
      else
        insert into public.prayer_attendance(student_id,prayer_key,prayer_date,checked_in_at) values(c.student_id,prayer.prayer_key,day_value,now());
        outcome:='prayer_check_in'; message:='Absen sholat '||prayer.name||' berhasil.';
      end if;
    elsif exists(select 1 from public.attendance_holidays where holiday_date=day_value) then outcome:='holiday'; message:='Hari ini libur absensi.';
    else
      select * into sched from public.schedules where is_active order by created_at limit 1;
      if not found then raise exception 'Jadwal presensi aktif belum diatur.' using errcode='22023'; end if;
      if not sched.work_days @> to_jsonb(extract(dow from local_now)::integer) then outcome:='outside_window'; message:='Tidak ada jadwal absensi pada hari ini.';
      elsif time_value<sched.work_start then outcome:='outside_window'; message:='Absen masuk belum dibuka.';
      elsif time_value>=sched.checkout_end then outcome:='outside_window'; message:='Jendela absensi hari ini sudah ditutup.';
      elsif time_value>=sched.check_in_end and time_value<sched.checkout_start then outcome:='outside_window'; message:='Absen masuk sudah ditutup; absen pulang belum dibuka.';
      else
        select * into att from public.attendance where student_id=c.student_id and attendance_date=day_value for update;
        status_value:=case when time_value>sched.work_start+make_interval(mins=>sched.late_tolerance_minutes) then 'late' else 'present' end;
        if time_value>=sched.checkout_start then
          if not found then
            insert into public.attendance(student_id,attendance_date,check_in_at,check_out_at,status,is_manual) values(c.student_id,day_value,now(),now(),status_value,false);
            outcome:='check_in'; message:='Absen masuk dan pulang dicatat bersamaan.';
          elsif att.check_out_at is null then
            update public.attendance set check_out_at=now() where id=att.id; outcome:='check_out'; message:='Absen pulang berhasil.'; status_value:=att.status;
          else outcome:='duplicate'; message:='Absen masuk dan pulang sudah tercatat.'; status_value:=att.status;
          end if;
        elsif not found then
          insert into public.attendance(student_id,attendance_date,check_in_at,status,is_manual) values(c.student_id,day_value,now(),status_value,false);
          outcome:='check_in'; message:=case when status_value='late' then 'Absen masuk tercatat terlambat.' else 'Absen masuk berhasil.' end;
        else outcome:='duplicate'; message:='Absen masuk sudah tercatat.'; status_value:=att.status;
        end if;
      end if;
    end if;
  end if;
  insert into public.scan_logs(uid,scanned_at,result,student_id,message) values(uid_value,now(),outcome,c.student_id,message);
  return jsonb_build_object('scan_result',outcome,'display_message',message,'student_name',c.full_name,'class_name',c.class_name,'attendance_status',status_value);
end; $$;

alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.cards enable row level security;
alter table public.devices enable row level security;
alter table public.schedules enable row level security;
alter table public.attendance enable row level security;
alter table public.scan_logs enable row level security;
alter table public.academic_terms enable row level security;
alter table public.academic_subjects enable row level security;
alter table public.attitude_aspects enable row level security;
alter table public.academic_grades enable row level security;
alter table public.attitude_grades enable row level security;
alter table public.subject_attendance enable row level security;
alter table public.prayer_schedules enable row level security;
alter table public.prayer_attendance enable row level security;
alter table public.attendance_holidays enable row level security;
alter table public.student_accounts enable row level security;

create policy "profile read self or admin" on public.profiles for select to authenticated using(user_id=(select auth.uid()) or public.is_admin());
create policy "student admin manage" on public.students for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "student role read" on public.students for select to authenticated using(public.current_app_role() in ('admin','teacher','viewer') or (public.current_app_role()='parent' and public.parent_has_student(id)));
create policy "cards admin manage" on public.cards for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "cards role read" on public.cards for select to authenticated using(public.current_app_role() in ('admin','teacher','viewer') or (public.current_app_role()='parent' and public.parent_has_student(student_id)));

create policy "schedules admin manage" on public.schedules for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "schedules PPBS read" on public.schedules for select to authenticated using(public.current_app_role() in ('admin','teacher','parent','viewer'));
create policy "attendance admin manage" on public.attendance for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "attendance role read" on public.attendance for select to authenticated using(public.current_app_role() in ('admin','teacher','viewer') or (public.current_app_role()='parent' and public.parent_has_student(student_id)));
create policy "scan logs staff read" on public.scan_logs for select to authenticated using(public.current_app_role() in ('admin','teacher'));
create policy "devices staff read" on public.devices for select to authenticated using(public.current_app_role() in ('admin','teacher'));

create policy "terms admin manage" on public.academic_terms for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "terms PPBS read" on public.academic_terms for select to authenticated using(public.current_app_role() in ('admin','teacher','parent'));
create policy "subjects admin manage" on public.academic_subjects for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "subjects PPBS read" on public.academic_subjects for select to authenticated using(public.current_app_role() in ('admin','teacher','parent'));
create policy "aspects admin manage" on public.attitude_aspects for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "aspects PPBS read" on public.attitude_aspects for select to authenticated using(public.current_app_role() in ('admin','teacher','parent'));
create policy "grades staff manage" on public.academic_grades for all to authenticated using(public.can_manage_academics()) with check(public.can_manage_academics());
create policy "grades parent read" on public.academic_grades for select to authenticated using(public.current_app_role()='parent' and public.parent_has_student(student_id));
create policy "attitude staff manage" on public.attitude_grades for all to authenticated using(public.can_manage_academics()) with check(public.can_manage_academics());
create policy "attitude parent read" on public.attitude_grades for select to authenticated using(public.current_app_role()='parent' and public.parent_has_student(student_id));
create policy "subject attendance staff manage" on public.subject_attendance for all to authenticated using(public.can_manage_academics()) with check(public.can_manage_academics());
create policy "subject attendance parent read" on public.subject_attendance for select to authenticated using(public.current_app_role()='parent' and public.parent_has_student(student_id));

create policy "prayer schedules admin manage" on public.prayer_schedules for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "prayer schedules PPBS read" on public.prayer_schedules for select to authenticated using(public.current_app_role() in ('admin','teacher','parent','viewer'));
create policy "prayer attendance admin manage" on public.prayer_attendance for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "prayer attendance role read" on public.prayer_attendance for select to authenticated using(public.current_app_role() in ('admin','teacher','viewer') or (public.current_app_role()='parent' and public.parent_has_student(student_id)));
create policy "holidays admin manage" on public.attendance_holidays for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "holidays PPBS read" on public.attendance_holidays for select to authenticated using(public.current_app_role() in ('admin','teacher','parent','viewer'));

create policy "student links admin manage" on public.student_accounts for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "student links self read" on public.student_accounts for select to authenticated using(user_id=(select auth.uid()));

grant usage on schema public to anon,authenticated;
grant select,insert,update,delete on all tables in schema public to authenticated;
grant execute on function public.register_student_with_card(text,text,text,text,text,text) to authenticated;
grant execute on function public.update_admin_profile(text,text) to authenticated;
grant execute on function public.save_prayer_schedules(jsonb) to authenticated;
grant execute on function public.process_rfid_scan(text) to authenticated;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.can_manage_academics() to authenticated;
grant execute on function public.parent_has_student(uuid) to authenticated;

insert into public.schedules(name,work_start,work_end,check_in_end,checkout_start,checkout_end,late_tolerance_minutes,work_days)
values('Jadwal presensi santri','08:00','17:00','17:00','22:00','23:00',15,'[1,2,3,4,5,6]');
insert into public.prayer_schedules(prayer_key,name,opens_at,closes_at) values
('subuh','Subuh','04:00','05:00'),('zuhur','Zuhur','12:00','13:00'),('asar','Asar','15:00','16:00'),('magrib','Magrib','18:00','19:00'),('isya','Isya','19:00','20:00');
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
('student-photos','student-photos',false,5242880,array['image/webp']),
('admin-photos','admin-photos',false,5242880,array['image/webp'])
on conflict(id) do nothing;
create policy "admin read PPBS photos" on storage.objects for select to authenticated using(bucket_id in ('student-photos','admin-photos') and public.is_admin());
create policy "admin upload PPBS photos" on storage.objects for insert to authenticated
with check(public.is_admin() and (bucket_id='student-photos' or (bucket_id='admin-photos' and (storage.foldername(name))[1]=(select auth.uid())::text)));
create policy "admin update PPBS photos" on storage.objects for update to authenticated
using(public.is_admin() and (bucket_id='student-photos' or (bucket_id='admin-photos' and (storage.foldername(name))[1]=(select auth.uid())::text)))
with check(public.is_admin() and (bucket_id='student-photos' or (bucket_id='admin-photos' and (storage.foldername(name))[1]=(select auth.uid())::text)));
create policy "admin delete PPBS photos" on storage.objects for delete to authenticated
using(public.is_admin() and (bucket_id='student-photos' or (bucket_id='admin-photos' and (storage.foldername(name))[1]=(select auth.uid())::text)));

