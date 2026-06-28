# 🛒 쇼핑 리스트 앱

Supabase를 백엔드로 사용하는 바닐라 JS 쇼핑 리스트 앱입니다.

## 기술 스택

- **Frontend**: HTML, CSS, Vanilla JavaScript (ES Module)
- **Backend**: [Supabase](https://supabase.com) (PostgreSQL)
- **테스트**: JSDOM (unit), Playwright (E2E)

## 주요 기능

- 아이템 추가 / 삭제
- 아이템 완료 체크 / 해제
- 완료 항목 일괄 삭제
- 모든 데이터는 Supabase DB에 실시간 저장

## 데이터베이스 구조

```sql
CREATE TABLE shopping_items (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  text       TEXT        NOT NULL,
  done       BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 실행 방법

별도 빌드 없이 `index.html`을 로컬 서버로 열면 됩니다.

```bash
npx serve . -p 3000
```

브라우저에서 `http://localhost:3000` 접속

## 테스트

### Unit 테스트 (JSDOM + Supabase Mock)

Supabase를 인메모리 mock으로 대체하여 네트워크 없이 UI 로직을 검증합니다.

```bash
node shopping-test.spec.js
```

**테스트 항목 (총 20개)**
- [1] 초기 화면 점검
- [2] 아이템 추가 기능
- [3] 체크(완료) 기능
- [4] 아이템 삭제 기능
- [5] 완료 항목 비우기
- [6] Supabase 연동

### E2E 테스트 (Playwright)

실제 브라우저에서 Supabase와 연동하여 동작을 검증합니다.

```bash
# Playwright 설치 (최초 1회)
npx playwright install chrome

# 로컬 서버 실행 후 테스트
npx serve . -p 3000
```
