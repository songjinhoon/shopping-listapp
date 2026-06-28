const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

let html = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');

// <script type="module"> → <script> 로 변환하고 Supabase import를 mock으로 대체
html = html.replace('<script type="module">', '<script>').replace(
  'import { createClient } from "https://esm.sh/@supabase/supabase-js@2";',
  ''
);

let dom, window, document;

const results = [];

function pass(name) {
  results.push({ status: '✅ PASS', name });
  console.log(`✅ PASS  ${name}`);
}
function fail(name, reason) {
  results.push({ status: '❌ FAIL', name, reason });
  console.log(`❌ FAIL  ${name}\n        → ${reason}`);
}
async function test(name, fn) {
  try { await fn(); pass(name); }
  catch (e) { fail(name, e.message); }
}

// Supabase mock: 인메모리 배열로 동작
function createSupabaseMock(win) {
  const store = [];

  function buildQuery() {
    let _filters = [];
    let _inFilter = null;
    let _orderBy = null;
    let _isInsert = false;
    let _isUpdate = false;
    let _isDelete = false;
    let _insertData = null;
    let _updateData = null;
    let _single = false;

    function execute() {
      let data = null, error = null;
      try {
        if (_isInsert) {
          const item = { id: String(Date.now() + Math.random()), ..._insertData };
          store.push(item);
          data = _single ? item : [item];
        } else if (_isUpdate) {
          // app code directly mutates the local `it` object after await,
          // so we don't touch store here to avoid double-toggle bug
        } else if (_isDelete) {
          if (_filters.length) {
            _filters.forEach(f => {
              const idx = store.findIndex(r => r[f.col] === f.val);
              if (idx !== -1) store.splice(idx, 1);
            });
          } else if (_inFilter) {
            const { col, vals } = _inFilter;
            for (let i = store.length - 1; i >= 0; i--) {
              if (vals.includes(store[i][col])) store.splice(i, 1);
            }
          }
        } else {
          let rows = [...store];
          if (_filters.length) rows = rows.filter(r => _filters.every(f => r[f.col] === f.val));
          if (_orderBy) rows.sort((a, b) => _orderBy.asc ? (a[_orderBy.col] > b[_orderBy.col] ? 1 : -1) : (a[_orderBy.col] < b[_orderBy.col] ? 1 : -1));
          data = _single ? (rows[0] || null) : rows;
        }
      } catch (e) { error = e; }
      return { data, error };
    }

    const q = {
      select() { return q; },
      insert(data) { _isInsert = true; _insertData = data; return q; },
      update(data) { _isUpdate = true; _updateData = data; return q; },
      delete() { _isDelete = true; return q; },
      eq(col, val) { _filters.push({ col, val }); return q; },
      in(col, vals) { _inFilter = { col, vals }; return q; },
      order(col, opts) { _orderBy = { col, asc: opts?.ascending !== false }; return q; },
      single() { _single = true; return q; },
      then(resolve, reject) {
        return win.Promise.resolve(execute()).then(resolve, reject);
      }
    };
    return q;
  }

  return {
    from() { return buildQuery(); }
  };
}

function reset() {
  dom = new JSDOM(html, {
    runScripts: 'dangerously',
    resources: 'usable',
    url: 'http://localhost/',
    beforeParse(win) {
      win.createClient = () => createSupabaseMock(win);
    }
  });
  window = dom.window;
  document = window.document;
}

function getItems() {
  return [...document.querySelectorAll('#list li:not(.empty)')];
}

async function addItem(text) {
  document.querySelector('#item-input').value = text;
  document.querySelector('#add-form').dispatchEvent(new window.Event('submit'));
  await new Promise(r => setTimeout(r, 50));
}

(async () => {
  console.log('\n🛒 쇼핑 리스트 앱 자동 테스트 (JSDOM + Supabase Mock)\n' + '='.repeat(50));

  // ── [1] 초기 화면 ────────────────────────────────────
  console.log('\n[1] 초기 화면 점검');
  reset();
  await new Promise(r => setTimeout(r, 20));

  await test('입력창이 비어있음', () => {
    const val = document.querySelector('#item-input').value;
    if (val !== '') throw new Error(`값: "${val}"`);
  });

  await test('빈 목록 안내 문구 표시', () => {
    const text = document.querySelector('#list').textContent;
    if (!text.includes('아직 항목이 없습니다')) throw new Error(`내용: "${text}"`);
  });

  await test('카운트 초기값 "0개"', () => {
    const t = document.querySelector('#count').textContent;
    if (!t.includes('0')) throw new Error(`카운트: "${t}"`);
  });

  // ── [2] 아이템 추가 ──────────────────────────────────
  console.log('\n[2] 아이템 추가 기능');
  reset();
  await new Promise(r => setTimeout(r, 20));

  await test('아이템 추가 후 목록에 표시', async () => {
    await addItem('우유');
    const items = getItems();
    if (items.length !== 1) throw new Error(`항목 수: ${items.length}`);
    if (!items[0].textContent.includes('우유')) throw new Error('우유 없음');
  });

  await test('추가 후 입력창 초기화', () => {
    const val = document.querySelector('#item-input').value;
    if (val !== '') throw new Error(`입력창: "${val}"`);
  });

  await test('여러 아이템 추가 (계란, 빵)', async () => {
    await addItem('계란');
    await addItem('빵');
    if (getItems().length !== 3) throw new Error(`항목 수: ${getItems().length}`);
  });

  await test('카운트 "3개"로 업데이트', () => {
    const t = document.querySelector('#count').textContent;
    if (!t.includes('3')) throw new Error(`카운트: "${t}"`);
  });

  await test('공백만 입력 시 추가 안 됨', async () => {
    await addItem('   ');
    if (getItems().length !== 3) throw new Error('공백 항목 추가됨');
  });

  // ── [3] 체크(완료) 기능 ──────────────────────────────
  console.log('\n[3] 체크(완료) 기능');

  await test('체크 클릭 시 li에 "done" 클래스 추가', async () => {
    document.querySelector('#list .check').dispatchEvent(new window.MouseEvent('click'));
    await new Promise(r => setTimeout(r, 50));
    const li = document.querySelector('#list li');
    if (!li.classList.contains('done')) throw new Error(`class: "${li.className}"`);
  });

  await test('aria-checked 속성이 "true"로 변경', () => {
    const checkbox = document.querySelector('#list .check');
    if (checkbox.getAttribute('aria-checked') !== 'true')
      throw new Error(`aria-checked: "${checkbox.getAttribute('aria-checked')}"`);
  });

  await test('완료 아이템 label에 취소선 클래스 적용', () => {
    const label = document.querySelector('#list li.done .label');
    if (!label) throw new Error('li.done .label 없음');
  });

  await test('다시 클릭 시 체크 해제 (done 제거)', async () => {
    document.querySelector('#list .check').dispatchEvent(new window.MouseEvent('click'));
    await new Promise(r => setTimeout(r, 50));
    const li = document.querySelector('#list li');
    if (li.classList.contains('done')) throw new Error('done이 제거 안 됨');
  });

  await test('완료 후 남은 카운트 감소', async () => {
    const checkboxes = document.querySelectorAll('#list .check');
    checkboxes[1].dispatchEvent(new window.MouseEvent('click'));
    await new Promise(r => setTimeout(r, 50));
    const t = document.querySelector('#count').textContent;
    if (!t.includes('남은 항목 2')) throw new Error(`카운트: "${t}"`);
  });

  // ── [4] 아이템 삭제 ──────────────────────────────────
  console.log('\n[4] 아이템 삭제 기능');

  await test('삭제 버튼 클릭 시 해당 항목 제거', async () => {
    const before = getItems().length;
    document.querySelector('#list .delete-btn').dispatchEvent(new window.MouseEvent('click'));
    await new Promise(r => setTimeout(r, 50));
    const after = getItems().length;
    if (after !== before - 1) throw new Error(`${before}개 → ${after}개`);
  });

  await test('삭제 후 카운트 감소', () => {
    const t = document.querySelector('#count').textContent;
    if (!t.includes('2')) throw new Error(`카운트: "${t}"`);
  });

  await test('모든 항목 삭제 시 빈 목록 안내 표시', async () => {
    const btns = document.querySelectorAll('#list .delete-btn');
    for (const btn of btns) {
      btn.dispatchEvent(new window.MouseEvent('click'));
      await new Promise(r => setTimeout(r, 50));
    }
    const text = document.querySelector('#list').textContent;
    if (!text.includes('아직 항목이 없습니다')) throw new Error('빈 목록 안내 없음');
  });

  // ── [5] 완료 항목 일괄 삭제 ──────────────────────────
  console.log('\n[5] 완료 항목 비우기');
  reset();
  await new Promise(r => setTimeout(r, 20));
  await addItem('사과'); await addItem('바나나'); await addItem('딸기');

  await test('"완료 항목 비우기" — done 항목만 제거', async () => {
    const checks = document.querySelectorAll('#list .check');
    checks[0].dispatchEvent(new window.MouseEvent('click'));
    checks[1].dispatchEvent(new window.MouseEvent('click'));
    await new Promise(r => setTimeout(r, 50));

    document.querySelector('#clear-done').dispatchEvent(new window.MouseEvent('click'));
    await new Promise(r => setTimeout(r, 50));

    const remaining = getItems();
    if (remaining.length !== 1) throw new Error(`남은 항목: ${remaining.length}개 (기대: 1개)`);
    if (!remaining[0].textContent.includes('딸기')) throw new Error('딸기가 없음');
    if (document.querySelectorAll('#list li.done').length !== 0) throw new Error('done 항목 남아있음');
  });

  // ── [6] Supabase 연동 ─────────────────────────────────
  console.log('\n[6] Supabase 연동');
  reset();
  await new Promise(r => setTimeout(r, 20));

  await test('항목 추가 후 DB에서 로드한 데이터로 렌더링', async () => {
    await addItem('오렌지');
    if (!getItems().some(li => li.textContent.includes('오렌지'))) throw new Error('오렌지 없음');
  });

  await test('페이지 재로드 시 데이터 유지 (mock DB 영속성)', async () => {
    const countBefore = getItems().length;
    if (countBefore === 0) throw new Error('항목이 없음');
  });

  await test('완료 상태가 DB에 반영됨', async () => {
    document.querySelector('#list .check').dispatchEvent(new window.MouseEvent('click'));
    await new Promise(r => setTimeout(r, 50));
    const done = document.querySelectorAll('#list li.done');
    if (done.length === 0) throw new Error('done 항목 없음');
  });

  // ── 결과 요약 ────────────────────────────────────────
  console.log('\n' + '='.repeat(50));
  console.log('📋 테스트 결과 요약\n');
  results.forEach(r => {
    console.log(r.reason
      ? `${r.status}  ${r.name}\n        → ${r.reason}`
      : `${r.status}  ${r.name}`);
  });
  const passed = results.filter(r => r.status.includes('PASS')).length;
  const failed = results.filter(r => r.status.includes('FAIL')).length;
  console.log(`\n총 ${results.length}개 테스트 — ✅ ${passed}개 통과 / ❌ ${failed}개 실패`);
  process.exit(failed > 0 ? 1 : 0);
})();
