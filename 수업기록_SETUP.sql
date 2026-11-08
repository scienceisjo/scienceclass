-- ══════════════════════════════════════════════════════════════════════════
--  강의 화면 자동 수업 기록 — Supabase 준비 (딱 한 번만 실행하면 됩니다)
--
--  실행하는 곳: Supabase → 프로젝트 hmzklbrksfdhzsgwzfyg (칭찬 도장판·진도 트래커와 같은 곳)
--               → 왼쪽 메뉴 SQL Editor → New query → 아래 전체를 붙여넣고 Run
--
--  하는 일: 선생님이 수업 시간에 칠판 강의 화면을 열면 「언제 · 무슨 강의」 한 줄이 남는다.
--           과학 시간 메인이 시간표로 「그 시각 = 몇 반 몇 교시」를 계산해 학생 화면의 「오늘 수업」에 띄운다.
--  · 쓰기: 교사 계정만(public.is_teacher() — 혼자 탐구 SETUP 에서 만든 함수). 학생 계정은 못 씀.
--  · 읽기: 누구나(학생 화면이 로그인 없이도 읽어야 함). 학생 정보는 들어가지 않는다 — 시각·강의 주소·제목뿐.
--  · 시각은 서버 시계로만 적힌다(기기 시계가 틀려도 상관없음).
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists public.lesson_log (
  id     bigint generated always as identity primary key,
  owner  uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  at     timestamptz not null default now(),
  path   text        not null check (char_length(path)  <= 200),   -- '/electricity/04-ohm-lecture.html'
  title  text        not null default '' check (char_length(title) <= 200)
);
create index if not exists lesson_log_at_idx on public.lesson_log (at desc);

-- 시각은 언제나 서버 시계로
create or replace function public.lesson_log_stamp()
returns trigger language plpgsql as $$
begin
  new.at := now();
  new.owner := auth.uid();
  return new;
end $$;
drop trigger if exists lesson_log_stamp on public.lesson_log;
create trigger lesson_log_stamp before insert on public.lesson_log
  for each row execute function public.lesson_log_stamp();

alter table public.lesson_log enable row level security;
drop policy if exists "수업기록 누구나 읽기"   on public.lesson_log;
drop policy if exists "수업기록 교사만 쓰기"   on public.lesson_log;
drop policy if exists "수업기록 내 것 지우기" on public.lesson_log;
create policy "수업기록 누구나 읽기"   on public.lesson_log for select using (true);
create policy "수업기록 교사만 쓰기"   on public.lesson_log for insert to authenticated with check (owner = auth.uid() and public.is_teacher());
create policy "수업기록 내 것 지우기" on public.lesson_log for delete to authenticated using (owner = auth.uid());

-- 권한 (2026-10-30부터 새 표는 직접 열어 줘야 합니다)
revoke all on public.lesson_log from anon, authenticated;
grant select on public.lesson_log to anon, authenticated;
grant insert, delete on public.lesson_log to authenticated;
grant all on public.lesson_log to service_role;

select count(*) as "수업기록 줄 수" from public.lesson_log;
-- ══════════════════════════════════════════════════════════════════════════
--  끝. 「수업기록 줄 수 0」이 나오면 성공이에요.
--  교실 컴퓨터에서 과학 시간 교사용(진도 트래커 로그인) 또는 칭찬 도장판 교사 로그인이
--  한 번 되어 있으면, 그 뒤로는 강의 화면만 열어도 저절로 기록됩니다.
-- ══════════════════════════════════════════════════════════════════════════
