drop function if exists public.record_bill_payment(uuid, bigint, timestamptz, text, text, text);

drop table if exists public.billing_payments;
drop table if exists public.billing_bills;
drop table if exists public.billing_categories;
drop table if exists public.student_point_records;
drop table if exists public.point_categories;
