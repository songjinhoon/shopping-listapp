const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');

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

function reset() {
  dom = new JSDOM(html, {
    runScripts: 'dangerously',
    resources: 'usable',
    url: 'http://localhost/',
  });
  window = dom.window;
  document = window.document;
}

function getItems() {
  return [...document.querySelectorAll('#list li:not(.empty)')];
}
function addItem(text) {
  document.querySelector('#item-input').value = text;
  document.querySelector('#add-form').dispatchEvent(new window.Event('submit'));
}

(async () => {
  console.log('\n🛒 쇼핑 리스트 앱 자동 테스트 (JSDOM)\n' + '='.repeat(50));

  console.log('\n[1] 초기 화면 점검');
  reset();

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

  console.log('\n[2] 아이템 추가 기능');
  reset();

  await test('아이템 추가 후 목록에 표시', () => {
    addItem('우유');
    const items = getItems();
    if (items.length !== 1) throw new Error(`항목 수: ${items.length}`);
    if (!items[0].textContent.includes('우유')) throw new Error('우유 없음');
  });

  await test('추가 후 입력창 초기화', () => {
    const val = document.querySelector('#item-input').value;
    if (val !== '') throw new Error(`입력창: "${val}"`);
  });

  await test('여러 아이템 추가 (계란, 빵)', () => {
    addItem('계란');
    addItem('빵');
    if (getItems().length !== 3) throw new Error(`항목 수: ${getItems().length}`);
  });

  await test('카운트 "3개"로 업데이트', () => {
    const t = document.querySelector('#count').textContent;
    if (!t.includes('3')) throw new Error(`카운트: "${t}"`);
  });

  await test('공백만 입력 시 추가 안 됨', () => {
    addItem('   ');
    if (getItems().length !== 3) throw new Error('공백 항목 추가됨');
  });

  console.log('\n[3] 체크(완료) 기능');

  await test('체크 클릭 시 li에 "done" 클래스 추가', () => {
    const checkbox = document.querySelector('#list .check');
    checkbox.dispatchEvent(new window.MouseEvent('click'));
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

  await test('다시 클릭 시 체크 해제 (done 제거)', () => {
    const checkbox = document.querySelector('#list .check');
    checkbox.dispatchEvent(new window.MouseEvent('click'));
    const li = document.querySelector('#list li');
    if (li.classList.contains('done')) throw new Error('done이 제거 안 됨');
  });

  await test('완료 후 남은 카운트 감소', () => {
    const checkboxes = document.querySelectorAll('#list .check');
    checkboxes[1].dispatchEvent(new window.MouseEvent('click'));
    const t = document.querySelector('#count').textContent;
    if (!t.includes('남은 항목 2')) throw new Error(`카운트: "${t}"`);
  });

  console.log('\n[4] 아이템 삭제 기능');

  await test('삭제 버튼 클릭 시 해당 항목 제거', () => {
    const before = getItems().length;
    document.querySelector('#list .delete-btn').dispatchEvent(new window.MouseEvent('click'));
    const after = getItems().length;
    if (after !== before - 1) throw new Error(`${before}개 → ${after}개`);
  });

  await test('삭제 후 카운트 감소', () => {
    const t = document.querySelector('#count').textContent;
    if (!t.includes('2')) throw new Error(`카운트: "${t}"`);
  });

  await test('모든 항목 삭제 시 빈 목록 안내 표시', () => {
    document.querySelectorAll('#list .delete-btn').forEach(btn => {
      btn.dispatchEvent(new window.MouseEvent('click'));
    });
    const text = document.querySelector('#list').textContent;
    if (!text.includes('아직 항목이 없습니다')) throw new Error('빈 목록 안내 없음');
  });

  console.log('\n[5] 완료 항목 비우기');
  reset();
  addItem('사과'); addItem('바나나'); addItem('딸기');

  await test('"완료 항목 비우기" — done 항목만 제거', () => {
    const checks = document.querySelectorAll('#list .check');
    checks[0].dispatchEvent(new window.MouseEvent('click'));
    checks[1].dispatchEvent(new window.MouseEvent('click'));

    document.querySelector('#clear-done').dispatchEvent(new window.MouseEvent('click'));

    const remaining = getItems();
    if (remaining.length !== 1) throw new Error(`남은 항목: ${remaining.length}개 (기대: 1개)`);
    if (!remaining[0].textContent.includes('딸기')) throw new Error('딸기가 없음');
    if (document.querySelectorAll('#list li.done').length !== 0) throw new Error('done 항목 남아있음');
  });

  console.log('\n[6] localStorage 영속성');
  reset();
  addItem('오렌지');

  await test('localStorage에 항목이 저장됨', () => {
    const raw = window.localStorage.getItem('shopping-list-items');
    if (!raw) throw new Error('localStorage 비어있음');
    const data = JSON.parse(raw);
    if (!data.some(i => i.text === '오렌지')) throw new Error('오렌지 없음');
  });

  await test('새 DOM 인스턴스(재시작)에서 데이터 복원', () => {
    const saved = window.localStorage.getItem('shopping-list-items');
    const dom2 = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/' });
    dom2.window.localStorage.setItem('shopping-list-items', saved);
    const script = dom2.window.document.querySelector('script');
    dom2.window.eval(script.textContent);
    const items = [...dom2.window.document.querySelectorAll('#list li:not(.empty)')];
    if (!items.some(li => li.textContent.includes('오렌지'))) throw new Error('복원 실패');
  });

  await test('완료 상태도 localStorage에 저장됨', () => {
    document.querySelector('#list .check').dispatchEvent(new window.MouseEvent('click'));
    const data = JSON.parse(window.localStorage.getItem('shopping-list-items'));
    if (!data.some(i => i.done)) throw new Error('done 상태 저장 안 됨');
  });

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