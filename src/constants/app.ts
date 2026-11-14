/** 금액 올림 단위 — 세대 최종 합계를 10원 단위로 올림 (C-5) */
export const ROUNDING_UNIT_WON = 10;

/** 입력 가능한 금액 상한 (Design §7) */
export const MAX_AMOUNT_WON = 100_000_000;

/** localStorage 임시저장 스키마 버전 — 구조가 바뀌면 올려서 오래된 Draft를 폐기 */
export const DRAFT_SCHEMA_VERSION = 2;
