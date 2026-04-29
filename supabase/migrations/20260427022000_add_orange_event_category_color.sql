create or replace function public.is_valid_event_category_color (target text) returns boolean language sql immutable
set
    search_path = '' as $$
  select coalesce(target = any (array[
    'blue',
    'green',
    'sky',
    'purple',
    'red',
    'orange',
    'yellow',
    'gray',
    'olive',
    'pink',
    'mauve'
  ]), false);
$$;

create or replace function public.random_event_category_color () returns text language sql volatile
set
    search_path = '' as $$
  select (
    array[
      'blue',
      'green',
      'sky',
      'purple',
      'red',
      'orange',
      'yellow',
      'gray',
      'olive',
      'pink',
      'mauve'
    ]
  )[1 + floor(random() * 11)::int];
$$;
