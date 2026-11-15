/**
 * 관리비 통지 내역 출력 (P-18 ~ P-20)
 *   1) 동 버튼을 누르면 그 동의 세대가 버튼 격자로 보인다. 누를 때마다 선택·취소, 맨 위 "전체 선택"은 "전체 취소"도 된다.
 *   2) 고른 세대를 A4 반쪽 크기 통지서로 미리 보고(한 장에 2세대), "인쇄하기"로 운영체제 인쇄 창을 연다.
 * 선택은 동을 옮겨 다녀도 유지된다. 관리실은 관리비를 내지 않으므로 목록에 없다 (H-26).
 */
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Printer } from 'lucide-react';
import { BigButton } from '../../components/BigButton.tsx';
import { APP_TITLE } from '../../constants/authMessages.ts';
import { DONG_COUNT } from '../../constants/buildingUnits.ts';
import { formatNumber, formatYearMonth, todayISODate } from '../../domain/format.ts';
import { buildNotice, type Notice } from '../../domain/notice.ts';
import { unitLabel } from '../../domain/unitLabel.ts';
import { unitsInDong } from '../../domain/units.ts';
import type { MonthDoc, Unit, UnitBill, UnitId } from '../../types/bill.ts';

export const NOTICE_TITLE = `${APP_TITLE} 관리비통지내역`;

/** 한 장(A4)에 들어가는 통지서 수 — 반쪽씩 (P-19) */
const NOTICES_PER_PAGE = 2;

interface NoticeScreenProps {
  month: MonthDoc;
  units: readonly Unit[];
  bills: readonly UnitBill[];
  targetCount: number;
  onClose: () => void;
}

export function NoticeScreen({ month, units, bills, targetCount, onClose }: NoticeScreenProps) {
  const [selected, setSelected] = useState<ReadonlySet<UnitId>>(new Set());
  const [previewing, setPreviewing] = useState(false);
  const billById = useMemo(() => new Map(bills.map((bill) => [bill.unitId, bill])), [bills]);
  /** 통지서를 받는 곳 — 관리실 제외, 건물 목록 순서 */
  const payers = useMemo(() => units.filter((unit) => billById.get(unit.id)?.exempt === false), [units, billById]);

  if (previewing) {
    const chosen = payers.filter((unit) => selected.has(unit.id));
    return <NoticePreview month={month} units={chosen} billById={billById} targetCount={targetCount} onBack={() => setPreviewing(false)} />;
  }
  return <NoticeSelect payers={payers} selected={selected} onChange={setSelected} onPreview={() => setPreviewing(true)} onClose={onClose} />;
}

/* ------------------------------------------------------------------ */
/* 1) 세대 고르기                                                        */
/* ------------------------------------------------------------------ */

interface NoticeSelectProps {
  payers: readonly Unit[];
  selected: ReadonlySet<UnitId>;
  onChange: (next: ReadonlySet<UnitId>) => void;
  onPreview: () => void;
  onClose: () => void;
}

function NoticeSelect({ payers, selected, onChange, onPreview, onClose }: NoticeSelectProps) {
  const [dong, setDong] = useState<number | null>(null);
  const dongs = Array.from({ length: DONG_COUNT }, (_, index) => index + 1);
  const inDong = dong === null ? [] : unitsInDong(payers, dong);
  const allChosen = inDong.length > 0 && inDong.every((unit) => selected.has(unit.id));

  const toggle = (ids: readonly UnitId[], on: boolean) => {
    const next = new Set(selected);
    ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
    onChange(next);
  };

  return (
    <div className="min-h-screen bg-page">
      <header className="flex flex-wrap items-center gap-4 app-bar px-6 py-4">
        <BigButton variant="secondary" icon={<ArrowLeft className="h-6 w-6" aria-hidden="true" />} onClick={onClose}>
          홈으로
        </BigButton>
        <h1 className="text-3xl font-bold">관리비 통지 내역</h1>
        <span className="ml-auto text-xl">
          선택 <strong className="tabular-nums">{selected.size}</strong>세대
        </span>
        <BigButton icon={<Printer className="h-6 w-6" aria-hidden="true" />} disabled={selected.size === 0} onClick={onPreview}>
          미리보기
        </BigButton>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-6">
        <p className="text-lg text-slate-700">동을 누르면 세대가 보입니다. 세대를 누를 때마다 선택·취소되고, 다른 동으로 옮겨도 선택은 남아 있습니다.</p>

        <div className="grid grid-cols-3 gap-3 sm:grid-cols-9" role="group" aria-label="동 고르기">
          {dongs.map((item) => {
            const count = unitsInDong(payers, item).filter((unit) => selected.has(unit.id)).length;
            const active = item === dong;
            return (
              <button
                key={item}
                type="button"
                aria-pressed={active}
                onClick={() => setDong(item)}
                className={`flex flex-col items-center rounded-[14px] border-2 px-2 py-3 shadow-card focus:outline-none focus:ring-4 focus:ring-blue-400 ${
                  active ? 'border-brand bg-brand text-white' : 'border-line bg-white hover:border-slate-400'
                }`}
              >
                <span className="text-2xl font-extrabold">{item}동</span>
                <span className={`text-base ${count > 0 ? 'font-bold' : active ? 'text-blue-100' : 'text-slate-600'}`}>{count > 0 ? `✓ ${count}세대` : '선택 없음'}</span>
              </button>
            );
          })}
        </div>

        {dong !== null && (
          <section aria-labelledby="notice-dong-title" className="space-y-4 card p-5">
            <div className="flex flex-wrap items-center gap-4">
              <h2 id="notice-dong-title" className="text-2xl font-bold">
                {dong}동 세대
              </h2>
              <BigButton
                variant={allChosen ? 'secondary' : 'primary'}
                className="ml-auto"
                onClick={() =>
                  toggle(
                    inDong.map((unit) => unit.id),
                    !allChosen,
                  )
                }
              >
                {allChosen ? '전체 취소' : '전체 선택'}
              </BigButton>
            </div>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {inDong.map((unit) => {
                const on = selected.has(unit.id);
                return (
                  <button
                    key={unit.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle([unit.id], !on)}
                    className={`flex min-h-16 items-center justify-center gap-1 rounded-[14px] border-2 px-2 py-3 text-xl font-bold focus:outline-none focus:ring-4 focus:ring-blue-400 ${
                      on ? 'border-brand bg-brand-soft text-brand' : 'border-slate-300 bg-white text-slate-800 hover:border-slate-400'
                    }`}
                  >
                    {on && <Check className="h-6 w-6 shrink-0" aria-hidden="true" />}
                    <span className="text-center leading-tight">{unitLabel(unit)}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2) 미리보기·인쇄 — A4 세로 한 장에 반쪽 통지서 2개                       */
/* ------------------------------------------------------------------ */

interface NoticePreviewProps {
  month: MonthDoc;
  units: readonly Unit[];
  billById: ReadonlyMap<UnitId, UnitBill>;
  targetCount: number;
  onBack: () => void;
}

function NoticePreview({ month, units, billById, targetCount, onBack }: NoticePreviewProps) {
  const notices = units.flatMap((unit) => {
    const bill = billById.get(unit.id);
    return bill ? [{ unit, notice: buildNotice(unit, bill, month, targetCount) }] : [];
  });
  const pages = Array.from({ length: Math.ceil(notices.length / NOTICES_PER_PAGE) }, (_, index) =>
    notices.slice(index * NOTICES_PER_PAGE, (index + 1) * NOTICES_PER_PAGE),
  );

  // PDF로 저장할 때 파일 이름이 되도록 문서 제목을 바꿔 둔다
  useEffect(() => {
    const previous = document.title;
    document.title = `${month.yearMonth} 관리비통지내역`;
    return () => {
      document.title = previous;
    };
  }, [month.yearMonth]);

  return (
    <div className="min-h-screen bg-slate-300 print:bg-white">
      <header className="no-print flex flex-wrap items-center gap-4 app-bar px-6 py-4">
        <BigButton variant="secondary" icon={<ArrowLeft className="h-6 w-6" aria-hidden="true" />} onClick={onBack}>
          세대 다시 고르기
        </BigButton>
        <h1 className="text-2xl font-bold">
          관리비 통지 내역 미리보기 · {notices.length}세대 · {pages.length}장
        </h1>
        <BigButton className="ml-auto" icon={<Printer className="h-6 w-6" aria-hidden="true" />} onClick={() => window.print()}>
          인쇄하기
        </BigButton>
        <p className="w-full text-lg text-slate-700">
          A4 세로 한 장에 두 세대씩 인쇄됩니다. 가운데 점선을 따라 자르면 됩니다. 인쇄 창에서 "PDF로 저장"도 고를 수 있습니다.
        </p>
      </header>

      <div className="overflow-auto p-6 print:overflow-visible print:p-0">
        {pages.map((page, index) => (
          <article key={index} className="notice-page">
            {page.map(({ unit, notice }) => (
              <NoticeSheet key={unit.id} month={month} unit={unit} notice={notice} />
            ))}
          </article>
        ))}
      </div>
    </div>
  );
}

/** 통지서 한 장 (A4 반쪽) */
function NoticeSheet({ month, unit, notice }: { month: MonthDoc; unit: Unit; notice: Notice }) {
  return (
    <section className="notice">
      <h2 className="notice-title">{NOTICE_TITLE}</h2>
      <div className="notice-meta">
        <strong className="notice-unit">{unitLabel(unit, { withDong: true })}</strong>
        <span>{formatYearMonth(month.yearMonth)}분</span>
      </div>
      <table className="notice-table">
        <thead>
          <tr>
            <th scope="col">항목</th>
            <th scope="col" className="notice-amount">
              금액
            </th>
          </tr>
        </thead>
        <tbody>
          {notice.lines.map((line, index) => (
            <tr key={index} className={`notice-${line.kind}`}>
              <th scope="row">
                {line.label}
                {line.note && <span className="notice-note">{line.note}</span>}
              </th>
              <td className="notice-amount">{formatNumber(line.amount)}원</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="notice-total">
            <th scope="row">관리비 합계</th>
            <td className="notice-amount">{formatNumber(notice.total)}원</td>
          </tr>
        </tfoot>
      </table>
      <p className="notice-footer">출력일 {todayISODate()}</p>
    </section>
  );
}
