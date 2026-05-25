-- Change default display_name for new users from email prefix to handle value
create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _handle text;
begin
  _handle := 'user_' || substr(replace(new.id::text, '-', ''), 1, 10);

  insert into public.profiles (id, handle, display_name, avatar_url, preferred_language)
  values (
    new.id,
    _handle,
    coalesce(new.raw_user_meta_data ->> 'name', _handle),
    new.raw_user_meta_data ->> 'avatar_url',
    'ko'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
