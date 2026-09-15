-- =====================================================================
--  과학시간 허브 「오늘 수업」 표 — class_today
--  ▶ Supabase 프로젝트 hmzklbrksfdhzsgwzfyg(질문나무·도장판·진도 트래커가 쓰는 곳) → SQL Editor → Run (한 번)
--
--  교사의 진도 트래커가 달력 계획(반별·날짜별 차시)을 이 표에 내보내고,
--  학생은 허브에서 로그인하면 자기 반의 오늘 차시와 수업 페이지 링크를 바로 봅니다.
--  · 누구나 읽기(반 이름·차시 이름·링크뿐 — 학생 정보 없음)
--  · 쓰기는 로그인한 교사 자신의 줄만
-- =====================================================================

create table if not exists public.class_today (
  owner      uuid not null references auth.users(id) on delete cascade,
  board      text not null default '',          -- 진도표 id
  cls        text not null,                     -- '203'
  day        date not null,
  period     int  not null default 0,           -- 교시
  lesson     text not null default '',
  url        text not null default '',
  updated_at timestamptz not null default now(),
  primary key (owner, board, cls, day, period)
);
create index if not exists class_today_cls_day_idx on public.class_today (cls, day);

alter table public.class_today enable row level security;
drop policy if exists "오늘수업 누구나 읽기" on public.class_today;
drop policy if exists "오늘수업 내 것 쓰기"   on public.class_today;
drop policy if exists "오늘수업 내 것 고치기" on public.class_today;
drop policy if exists "오늘수업 내 것 지우기" on public.class_today;
create policy "오늘수업 누구나 읽기" on public.class_today for select using (true);
create policy "오늘수업 내 것 쓰기"   on public.class_today for insert to authenticated with check (auth.uid() = owner);
create policy "오늘수업 내 것 고치기" on public.class_today for update to authenticated using (auth.uid() = owner) with check (auth.uid() = owner);
create policy "오늘수업 내 것 지우기" on public.class_today for delete to authenticated using (auth.uid() = owner);

grant select on public.class_today to anon, authenticated;
grant insert, update, delete on public.class_today to authenticated;

-- 확인
select count(*) as "오늘수업 줄 수" from public.class_today;
