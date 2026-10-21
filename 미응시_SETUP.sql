-- ══════════════════════════════════════════════════════════════════════════
--  수행평가 미응시 관리 — Supabase 준비 (딱 한 번만 실행하면 됩니다)
--
--  실행하는 곳: Supabase → 프로젝트 hmzklbrksfdhzsgwzfyg (칭찬 도장판·진도 트래커와 같은 곳)
--               → 왼쪽 메뉴 SQL Editor → New query → 아래 전체를 붙여넣고 Run
--
--  ※ 다른 표(도장판·질문나무·진도표)는 건드리지 않습니다.
--  ※ 평가 하나가 한 줄입니다. 그 평가에 응시하지 못한 학생 목록을 통째로 담습니다.
--  ※ 로그인한 선생님 계정 것만 보이고 고칠 수 있습니다(학생 계정에서는 보이지 않음).
-- ══════════════════════════════════════════════════════════════════════════

-- ── 1. 표 만들기 ──────────────────────────────────────────────────────────
create table if not exists public.assess_absences (
  id         text        not null,                       -- 평가 고유 번호(앱이 만듦)
  owner      uuid        not null references auth.users(id) on delete cascade,
  name       text        not null default '수행평가',
  grade      integer     not null default 2,
  exam_date  text        not null default '',            -- 'YYYY-MM-DD' (비어 있어도 됨)
  note       text        not null default '',
  students   jsonb       not null default '[]'::jsonb,   -- [{k,cls,num,name,reason,status,redo,memo}, ...]
  sort       integer     not null default 0,
  updated_at timestamptz not null default now(),         -- 앱이 고친 시각(기기 사이 맞추기용)
  primary key (owner, id)
);

-- ── 2. 잠금장치 (내 것만) ─────────────────────────────────────────────────
alter table public.assess_absences enable row level security;

drop policy if exists "내 미응시 읽기"   on public.assess_absences;
drop policy if exists "내 미응시 만들기" on public.assess_absences;
drop policy if exists "내 미응시 고치기" on public.assess_absences;
drop policy if exists "내 미응시 지우기" on public.assess_absences;

create policy "내 미응시 읽기"   on public.assess_absences for select using (auth.uid() = owner);
create policy "내 미응시 만들기" on public.assess_absences for insert with check (auth.uid() = owner);
create policy "내 미응시 고치기" on public.assess_absences for update using (auth.uid() = owner) with check (auth.uid() = owner);
create policy "내 미응시 지우기" on public.assess_absences for delete using (auth.uid() = owner);

-- ── 3. 권한 (2026-10-30부터 새 표는 직접 열어 줘야 합니다) ──────────────────
revoke all on public.assess_absences from anon;
grant select, insert, update, delete on public.assess_absences to authenticated;
grant all on public.assess_absences to service_role;

-- ══════════════════════════════════════════════════════════════════════════
--  끝났습니다. 「Success. No rows returned」가 나오면 성공이에요.
--  이제 과학 시간 교사용 → 📋 수행평가 미응시 에서 ☁️ 로그인하면
--  학교 컴퓨터·휴대폰 어디서 열어도 같은 목록이 보입니다.
-- ══════════════════════════════════════════════════════════════════════════
