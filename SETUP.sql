-- ══════════════════════════════════════════════════════════════════════════
--  진도 트래커 — Supabase 준비 (딱 한 번만 실행하면 됩니다)
--
--  실행하는 곳: Supabase → 프로젝트 hmzklbrksfdhzsgwzfyg (칭찬 도장판과 같은 곳)
--               → 왼쪽 메뉴 SQL Editor → New query → 아래 전체를 붙여넣고 Run
--
--  ※ 칭찬 도장판이 쓰는 표들과는 서로 아무 상관이 없습니다. 건드리지 않아요.
--  ※ 로그인은 도장판에서 쓰시던 교사 계정(이메일·비밀번호) 그대로입니다.
-- ══════════════════════════════════════════════════════════════════════════

-- ── 1. 표 만들기 ──────────────────────────────────────────────────────────
--  진도표 하나가 한 줄입니다. 반 목록·차시 목록·체크 기록을 통째로 담습니다.
create table if not exists public.progress_boards (
  id         text        not null,                       -- 진도표 고유 번호(앱이 만듦)
  owner      uuid        not null references auth.users(id) on delete cascade,
  name       text        not null default '진도표',
  sort       integer     not null default 0,             -- 탭 순서
  classes    jsonb       not null default '[]'::jsonb,   -- [{id,name}, ...]
  lessons    jsonb       not null default '[]'::jsonb,   -- [{id,name}, ...]
  done       jsonb       not null default '{}'::jsonb,   -- {"반id|차시id":"2026-08-18"}
  updated_at timestamptz not null default now(),
  primary key (owner, id)
);

create index if not exists progress_boards_owner_sort_idx
  on public.progress_boards (owner, sort);

-- ── 2. 잠금장치 켜기 (내 것만 보이게) ──────────────────────────────────────
alter table public.progress_boards enable row level security;

drop policy if exists "내 진도표 읽기"   on public.progress_boards;
drop policy if exists "내 진도표 만들기" on public.progress_boards;
drop policy if exists "내 진도표 고치기" on public.progress_boards;
drop policy if exists "내 진도표 지우기" on public.progress_boards;

create policy "내 진도표 읽기"
  on public.progress_boards for select
  using (auth.uid() = owner);

create policy "내 진도표 만들기"
  on public.progress_boards for insert
  with check (auth.uid() = owner);

create policy "내 진도표 고치기"
  on public.progress_boards for update
  using (auth.uid() = owner) with check (auth.uid() = owner);

create policy "내 진도표 지우기"
  on public.progress_boards for delete
  using (auth.uid() = owner);

-- ── 3. 고친 시각 자동 기록 ────────────────────────────────────────────────
create or replace function public.touch_progress_boards()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists progress_boards_touch on public.progress_boards;
create trigger progress_boards_touch
  before update on public.progress_boards
  for each row execute function public.touch_progress_boards();

-- ══════════════════════════════════════════════════════════════════════════
--  끝났습니다. 아래처럼 나오면 성공이에요:
--     Success. No rows returned
--
--  이제 https://scienceisjo.github.io/scienceclass/?t=1 에서
--  📊 진도 트래커 → ☁️ 로그인 을 누르면 어느 기기에서든 같은 표가 보입니다.
-- ══════════════════════════════════════════════════════════════════════════
