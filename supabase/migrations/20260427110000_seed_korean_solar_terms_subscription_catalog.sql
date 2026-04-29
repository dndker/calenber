-- 코드(provider)에서 동적으로 일정을 만들며, 카탈로그 행은 검색·설치(FK)용 메타입니다.

insert into public.calendar_subscription_catalogs (
  slug,
  name,
  description,
  source_type,
  visibility,
  verified,
  category_color,
  config,
  created_by,
  owner_user_id
)
values (
  'subscription.kr.solar-terms',
  '대한민국 절기',
  '대한민국 24절기 일정을 추가합니다.',
  'system_holiday',
  'public',
  true,
  'gray',
  jsonb_build_object(
    'locale', 'ko-KR',
    'timezone', 'Asia/Seoul',
    'provider', 'korean_solar_terms_v1'
  ),
  null,
  null
)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  verified = excluded.verified,
  category_color = excluded.category_color,
  config = excluded.config,
  is_active = true;
