/* 강의 화면 자동 수업 기록 (2026-11-08) — 칠판 강의 화면이 이 파일을 불러 쓴다.
   <script src="https://scienceisjo.github.io/scienceclass/lesson-log.js" defer></script>
   · 수업 시간(종 시간표의 교시 10분 전 ~ 끝) 에 교사 기기에서 열리면 lesson_log 에 「강의 주소·제목」 한 줄을 남긴다.
     과학 시간 메인이 시간표로 「그 시각 = 몇 반」을 계산해 학생 화면의 「오늘 수업」에 띄운다.
   · 교사 로그인: 과학 시간 진도 트래커(sc_prog_session) 또는 칭찬 도장판·질문나무 교사 로그인(supabase 기본 키). 둘 다 없으면 아무것도 안 한다.
   · 하지 않는 때: 학생 모드(?s=1)·나눔본(/share/)·로컬 파일·주말·수업 시간 밖 · 같은 교시에 같은 강의는 한 번만.
   · 학생 계정으로 열려도 서버(RLS)가 거절하므로 기록되지 않는다. */
(function () {
  'use strict';
  try {
    if (location.hostname !== 'scienceisjo.github.io') return;
    if (/\/share\//.test(location.pathname)) return;
    if (new URLSearchParams(location.search).get('s') === '1') return;
  } catch (e) { return; }
  var URL0 = 'https://hmzklbrksfdhzsgwzfyg.supabase.co', KEY = 'sb_publishable_OFVhbjVPbJiMWXVz2nKQuw_m6RmVVZE';
  // 해누리중 종 시간표 (공지 시스템 school.js 와 같음 — 컴시간 일과시간, 7교시는 화·목만)
  var BELL = [['08:50', '09:35'], ['09:45', '10:30'], ['10:40', '11:25'], ['11:35', '12:20'], ['13:20', '14:05'], ['14:15', '15:00'], ['15:10', '15:55']];
  var min = function (hm) { var a = hm.split(':'); return +a[0] * 60 + +a[1]; };
  var now = new Date(), wd = now.getDay(), m = now.getHours() * 60 + now.getMinutes(), per = 0;
  if (wd === 0 || wd === 6) return;
  for (var i = 0; i < BELL.length; i++) if (m >= min(BELL[i][0]) - 10 && m <= min(BELL[i][1])) { per = i + 1; break; }
  if (!per) return;
  var ymd = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();
  var once = 'lessonlog:' + location.pathname + ':' + ymd + ':' + per;
  try { if (localStorage.getItem(once)) return; } catch (e) {}

  // 교사 세션 찾기 — 진도 트래커 형식 {access_token, refresh_token, expires_at} · supabase-js 형식(같은 칸 + user)
  var KEYS = ['sc_prog_session', 'sb-hmzklbrksfdhzsgwzfyg-auth-token'];
  function read(k) { try { var j = JSON.parse(localStorage.getItem(k)); return j && j.refresh_token ? j : null; } catch (e) { return null; } }
  function token(k) {
    var s = read(k); if (!s) return Promise.resolve(null);
    if ((s.expires_at || 0) - 60 > Date.now() / 1000) return Promise.resolve(s.access_token);
    return fetch(URL0 + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: s.refresh_token }) }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j || !j.access_token) return null;
      // 돌려받은 새 토큰을 같은 자리에 같은 모양으로 저장(옛 refresh_token 은 더는 안 통하므로)
      s.access_token = j.access_token; s.refresh_token = j.refresh_token;
      s.expires_at = j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 3600);
      if ('expires_in' in s) s.expires_in = j.expires_in || 3600;
      try { localStorage.setItem(k, JSON.stringify(s)); } catch (e) {}
      return s.access_token;
    }).catch(function () { return null; });
  }
  function send(tok) {
    return fetch(URL0 + '/rest/v1/lesson_log', { method: 'POST',
      headers: { apikey: KEY, Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ path: location.pathname.slice(0, 200), title: (document.title || '').slice(0, 200) }) }).then(function (r) { return r.ok; });
  }
  function go(idx) {
    if (idx >= KEYS.length) return;
    token(KEYS[idx]).then(function (t) {
      if (!t) return go(idx + 1);
      return send(t).then(function (ok) {
        if (ok) { try { localStorage.setItem(once, '1'); } catch (e) {} }
        else go(idx + 1);   // 이 계정이 교사가 아니면(학생 로그인 등) 다음 세션으로
      });
    }).catch(function () {});
  }
  // 화면이 실제로 쓰일 때만: 열고 20초 넘게 머물면 기록(잠깐 열어 본 것은 빼기)
  setTimeout(function () {
    if (!document.hidden) return go(0);
    document.addEventListener('visibilitychange', function f() { if (!document.hidden) { document.removeEventListener('visibilitychange', f); go(0); } });
  }, 20000);
})();
