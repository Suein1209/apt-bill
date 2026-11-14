/**
 * 출력 — 납부 확인표 / 납부 금액표 (P-14 ~ P-17)
 * 화면에는 A4 가로 용지 모양으로 미리 보여 주고, "인쇄하기"를 누르면 운영체제 인쇄 창(미리보기·PDF 저장)이 열린다.
 */
import { useEffect, useMemo } from 'react';
import { ArrowLeft, Printer } from 'lucide-react';
import { BigButton } from '../../components/BigButton.tsx';
import { APP_TITLE } from '../../constants/authMessages.ts';
import { ORI_DISPLAY_NAME } from '../../constants/buildingUnits.ts';
import { formatNumber, formatYearMonth, todayISODate } from '../../domain/format.ts';
import { buildPaymentSheet, type SheetCell } from '../../domain/printSheet.ts';
import type { Unit, UnitBill, YearMonth } from '../../types/bill.ts';

export type SheetMode = 'check' | 'amount';

export const SHEET_TITLES: Readonly<Record<SheetMode, string>> = {
  check: '납부 확인표',
  amount: '납부 금액표',
};

const OFFICE_MARK = '관리실';
const VACANT_MARK = '공실';
const CHECK_MARK = '✔';

interface PaymentSheetViewProps {
  mode: SheetMode;
  yearMonth: YearMonth;
  units: readonly Unit[];
  bills: readonly UnitBill[];
  onClose: () => void;
}

/** 칸 위쪽 제목 — 호수, 1층은 상호를 아랫줄에 */
function CellHeading({ unit }: { unit: Unit }) {
  if (unit.id === 'SORI') return <>{ORI_DISPLAY_NAME}</>;
  if (unit.ho === null) return <>{unit.alias ?? unit.id}</>;
  return (
    <>
      {unit.ho}
      {unit.shopName && <span className="sheet-shop">{unit.shopName}</span>}
    </>
  );
}

/** 합계에 넣는 세대 — 관리실(자동 납부)·공실 제외 */
const counts = (bill: UnitBill | undefined): bill is UnitBill => bill !== undefined && bill.isTarget && !bill.autoPaid;

export function PaymentSheetView({ mode, yearMonth, units, bills, onClose }: PaymentSheetViewProps) {
  const sheet = useMemo(() => buildPaymentSheet(units), [units]);
  const billById = useMemo(() => new Map(bills.map((bill) => [bill.unitId, bill])), [bills]);
  const title = `${formatYearMonth(yearMonth)} ${APP_TITLE} 관리비 ${SHEET_TITLES[mode]}`;

  // PDF로 저장할 때 파일 이름이 되도록 문서 제목을 바꿔 둔다
  useEffect(() => {
    const previous = document.title;
    document.title = `${yearMonth} ${SHEET_TITLES[mode]}`;
    return () => {
      document.title = previous;
    };
  }, [mode, yearMonth]);

  const billOf = (cell: SheetCell) => billById.get(cell.unit.id);

  const cellText = (cell: SheetCell): string => {
    const bill = billOf(cell);
    if (!bill) return '';
    if (bill.autoPaid) return OFFICE_MARK;
    if (!bill.isTarget && bill.paid === 0) return VACANT_MARK;
    if (mode === 'check') return bill.isConfirmed ? CHECK_MARK : '';
    return bill.paid > 0 ? formatNumber(bill.paid) : '';
  };

  /** 합계 글자 — 금액표는 낸 돈, 확인표는 "확인 수 / 세대 수" */
  const totalText = (cells: readonly SheetCell[]): string => {
    const list = cells.map(billOf);
    if (mode === 'amount') {
      const paid = list.reduce((total, bill) => total + (bill && !bill.autoPaid ? bill.paid : 0), 0);
      return paid > 0 ? formatNumber(paid) : '';
    }
    const targets = list.filter(counts);
    return `${targets.filter((bill) => bill.isConfirmed).length} / ${targets.length}`;
  };

  const allCells = sheet.floors.flatMap((floor) => floor.cells);
  const unpaidCount = allCells.map(billOf).filter(counts).filter((bill) => !bill.isConfirmed).length;

  return (
    <div className="min-h-screen bg-slate-300 print:bg-white">
      <header className="no-print flex flex-wrap items-center gap-4 border-b-2 border-slate-400 bg-white px-6 py-4">
        <BigButton variant="secondary" icon={<ArrowLeft className="h-6 w-6" aria-hidden="true" />} onClick={onClose}>
          홈으로
        </BigButton>
        <h1 className="text-2xl font-bold">{SHEET_TITLES[mode]} 미리보기</h1>
        <BigButton className="ml-auto" icon={<Printer className="h-6 w-6" aria-hidden="true" />} onClick={() => window.print()}>
          인쇄하기
        </BigButton>
        <p className="w-full text-lg text-slate-700">
          "인쇄하기"를 누르면 인쇄 창이 열립니다. 그 창에서 미리보기를 확인하고, 프린터를 고르거나 "PDF로 저장"을 고를 수 있습니다. 용지는 A4 가로입니다.
        </p>
      </header>

      <div className="overflow-auto p-6 print:overflow-visible print:p-0">
        <article className="print-page">
          <h2 className="sheet-title">{title}</h2>
          <table className="sheet">
            <colgroup>
              {Array.from({ length: sheet.totalColumns }, (_, index) => (
                <col key={index} />
              ))}
              <col className="sheet-total-col" />
            </colgroup>
            <thead>
              <tr>
                {sheet.columns.map((column) => (
                  <th key={column.dong} colSpan={column.span} className="sheet-dong">
                    {column.dong}동
                  </th>
                ))}
                <th className="sheet-dong">합계</th>
              </tr>
            </thead>
            <tbody>
              {sheet.floors.map((floor) => (
                <FloorRows key={floor.floor} cells={floor.cells} cellText={cellText} total={totalText(floor.cells)} mode={mode} />
              ))}
            </tbody>
            <tfoot>
              <tr>
                {sheet.columns.map((column) => (
                  <td key={column.dong} colSpan={column.span} className="sheet-sum">
                    {totalText(allCells.filter((cell) => cell.dong === column.dong))}
                  </td>
                ))}
                <td className="sheet-sum sheet-grand">{totalText(allCells)}</td>
              </tr>
            </tfoot>
          </table>
          <footer className="sheet-footer">
            <span>출력일 {todayISODate()}</span>
            <span>
              {formatYearMonth(yearMonth)} · 미납 {unpaidCount}세대
              {mode === 'check' ? ` · ${CHECK_MARK} 납부 확인` : ''}
            </span>
          </footer>
        </article>
      </div>
    </div>
  );
}

interface FloorRowsProps {
  cells: readonly SheetCell[];
  cellText: (cell: SheetCell) => string;
  total: string;
  mode: SheetMode;
}

/** 한 층 = 호수 줄 + 값 줄, 오른쪽 끝에 그 층 합계 */
function FloorRows({ cells, cellText, total, mode }: FloorRowsProps) {
  return (
    <>
      <tr>
        {cells.map((cell) => (
          <th key={cell.unit.id} colSpan={cell.span} className="sheet-ho">
            <CellHeading unit={cell.unit} />
          </th>
        ))}
        <td rowSpan={2} className="sheet-sum">
          {total}
        </td>
      </tr>
      <tr>
        {cells.map((cell) => {
          const text = cellText(cell);
          const muted = text === OFFICE_MARK || text === VACANT_MARK;
          return (
            <td key={cell.unit.id} colSpan={cell.span} className={`sheet-value ${muted ? 'sheet-muted' : ''} ${mode === 'check' && text === CHECK_MARK ? 'sheet-check' : ''}`}>
              {text}
            </td>
          );
        })}
      </tr>
    </>
  );
}
