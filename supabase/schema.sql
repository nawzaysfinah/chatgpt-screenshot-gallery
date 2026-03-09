create table if not exists public.conversations (
  slug text primary key,
  date date not null,
  title text not null,
  tags text[] default '{}'::text[],
  model text,
  topic text,
  image_url text not null,
  prompt_crop jsonb not null default '{"x":0.06,"y":0.58,"w":0.88,"h":0.22}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists conversations_set_updated_at on public.conversations;
create trigger conversations_set_updated_at
before update on public.conversations
for each row
execute function public.set_updated_at();

alter table public.conversations enable row level security;

drop policy if exists "Public can read conversations" on public.conversations;
create policy "Public can read conversations"
on public.conversations
for select
to anon, authenticated
using (true);

insert into storage.buckets (id, name, public)
values ('conversation-screenshots', 'conversation-screenshots', true)
on conflict (id) do nothing;

drop policy if exists "Public can view screenshots" on storage.objects;
create policy "Public can view screenshots"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'conversation-screenshots');

drop policy if exists "Service role manages screenshots" on storage.objects;
create policy "Service role manages screenshots"
on storage.objects
for all
to service_role
using (bucket_id = 'conversation-screenshots')
with check (bucket_id = 'conversation-screenshots');

