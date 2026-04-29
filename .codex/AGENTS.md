모든 작업은 아래 기준을 기본값으로 따른다.

## 1. 기본 작업 원칙

- 임시 대응보다 근본 원인 해결을 우선한다.
- 가독성, 유지보수성, 확장성, 에러 처리, 경계 조건을 함께 고려한다.
- 리뷰 가능한 구조와 일관된 네이밍을 유지한다.
- 변경 영향도를 확인하고 회귀 가능성을 줄이는 방향으로 구현한다.
- 전체 프로젝트의 구조와 톤에서 벗어나지 않게 작업한다.

## 2. 실행 도구 원칙

- 패키지 설치, 스크립트 실행, 테스트, 빌드는 기본적으로 Bun을 사용한다.
- `npm`, `pnpm`, `yarn`, `npx` 중심 실행은 특별한 이유가 없으면 사용하지 않는다.
- 작업 마무리 단계에서는 프로젝트 표준 Bun 명령으로 타입 체크를 수행한다.
- 예: `bun run typecheck`

## 3. 프로젝트 컨텍스트

- 이 저장소는 모노레포다.
- `apps/web`는 캘린더 서비스이며 `Next.js + TypeScript + shadcn/ui`를 사용한다.
- `apps/docs`는 문서 사이트이며 `Fumadocs`를 사용한다.
- 작업 시 대상 앱의 역할과 기술 스택에 맞는 방식으로 구현한다.
- 캘린더 일정 그룹은 도메인 용어 **컬렉션(collection)** 으로 통일한다. DB·타입·UI는 `collection` / `collections` / `primaryCollection` 등을 사용하고, 레거시 `category` 네이밍은 새로 도입하지 않는다(와이어·저장 마이그레이션에만 예외). 자세한 규칙은 루트 `CLAUDE.md` §6을 본다.
- **타입 단일 소스**: 앱 도메인 모델은 `apps/web/store/calendar-store.types.ts`에 모은다. RPC/DB 행 변환은 `lib/calendar/event-record.ts`, 캘린더 목록 메타는 `lib/calendar/queries.ts`, 컬렉션 색상은 `lib/calendar/collection-color.ts`. 표는 `CLAUDE.md` 프로젝트 구조 직후 «캘린더 도메인 타입» 절을 본다.

## 4. i18n 키 네이밍 규칙

번역 키는 `domain.section.meaning` 3단계 camelCase 구조로 작성한다.

- `domain`: 기능 영역 — `common`, `auth`, `calendar`, `event`, `settings`
- `section`: 도메인 내 구분 — `actions`, `form`, `views`, `navigation`
- `meaning`: 텍스트 의미 — `title`, `placeholder`, `label`, `description`

**금지 패턴**

- 4단계 이상 중첩 금지 — `event.form.title.placeholder` (X) → `event.form.titlePlaceholder` (O)
- snake_case 금지 — `event.form.title_placeholder` (X)

**파일 규칙**

- 번역 파일: `apps/web/messages/{locale}.json` (ko.json, en.json)
- ko.json에 키를 추가하면 en.json에도 동시에 추가한다 — 구조는 항상 동일하게 유지

**번역 문자열 규칙**

- `next-intl` 메시지는 ICU 포맷으로 처리되므로 placeholder는 `{name}`, `{count}`처럼 그대로 쓴다.
- 작은따옴표 `'`는 escape 문자로 해석될 수 있으니 `'{name}'`처럼 placeholder를 감싸지 않는다. 치환이 깨질 수 있다.
- 화면에 작은따옴표를 보여줘야 하면 `''{name}''`처럼 작은따옴표를 두 번 써서 escape한다.
- `{`, `}`, `'`가 함께 들어가는 번역은 추가 후 실제 치환 결과까지 확인한다.

```json
{
  "bad": "'{name}' 컬렉션을 추가할 캘린더를 선택하세요.",
  "good": "''{name}'' 컬렉션을 추가할 캘린더를 선택하세요."
}
```

**사용 패턴**

```typescript
const t = useDebugTranslations("event.form")  // 클라이언트 (디버그용)
const t = await getTranslations("event.form")  // 서버
t("titlePlaceholder")  // → event.form.titlePlaceholder
```

## 6. 코드 구조 원칙

- 여러 곳에서 재사용되는 변수, 함수, 헬퍼, 유틸은 공통 영역으로 분리한다.
- 책임이 다른 로직은 한 파일이나 한 함수에 과도하게 뭉치지 않도록 나눈다.
- 공통 로직은 이름만 보고도 역할이 드러나게 작성한다.
- 주석은 필요한 곳에만 작성하되, 공통 유틸과 복잡한 로직은 이해에 도움이 되도록 충분히 설명한다.
- 함수는 인자와 옵션의 의미가 드러나게 작성하고, 필요한 경우 에디터에서 바로 이해할 수 있도록 문서화를 남긴다.

## 7. React 렌더링 원칙

- 불필요한 리렌더를 줄이도록 상태, 이펙트, 파생값 구조를 신중히 설계한다.
- `useEffect` 안에서 동기적으로 `setState`를 호출해 연쇄 렌더가 발생하지 않는지 항상 점검한다.
- React 훅 사용 시 렌더 누수, 불필요한 상태 갱신, 과한 메모이제이션 여부를 함께 검토한다.
- 성능 최적화는 마지막에 덧붙이는 작업이 아니라 구현 단계부터 고려한다.

## 8. UI/UX 원칙

- 별도 지시가 없으면 기존 화면과 비슷한 톤과 밀도를 유지한다.
- 주변 레이아웃과 컴포넌트를 함께 보고 일관된 스타일로 맞춘다.
- 사용자 입장에서 놓치기 쉬운 흐름, 상태, 예외 케이스까지 고려한다.
- 과한 실험보다 신뢰감 있고 완성도 높은 방향을 우선한다.

## 9. 최종 검증 원칙

- 구현 후에는 타입 안정성, 렌더링 안정성, 주요 사용자 흐름을 함께 점검한다.
- 특히 React 작업은 불필요한 렌더와 상태 갱신 패턴을 다시 확인한다.
- 검증 결과는 실행한 명령 기준으로 정리한다.
