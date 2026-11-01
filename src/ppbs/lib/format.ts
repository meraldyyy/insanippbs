import * as XLSX from 'xlsx';

const jakartaTimeZone = 'Asia/Jakarta';
const jakartaHourFormatter = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  hour12: false,
  timeZone: jakartaTimeZone,
});

export function parseTimestamp(value: string): Date {
  let normalized = value.replace(' ', 'T');
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(normalized)) {
    normalized += 'Z';
  }
  normalized = normalized.replace(/(\.\d{3})\d+(?=Z|[+-]\d{2}:\d{2}$)/, '$1');
  return new Date(normalized);
}

export function jakartaHour(value: string): number {
  return Number(jakartaHourFormatter.format(parseTimestamp(value)));
}

export function formatTime(value: string | null) {
  if (!value) return '--:--';
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: jakartaTimeZone,
  }).format(parseTimestamp(value));
}

export function formatDate(value: string) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : parseTimestamp(value);
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: jakartaTimeZone,
  }).format(date);
}

export function localDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: jakartaTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function attendanceStatusLabel(status: string) {
  const labels: Record<string, string> = {
    present: 'Hadir',
    late: 'Terlambat',
    absent: 'Belum hadir',
    excused: 'Izin',
    sick: 'Sakit',
  };
  return labels[status] ?? status;
}

export function downloadExcel(filename: string, headers: string[], rows: string[][]) {
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan');
  const excelFilename = `${filename.replace(/\.(csv|xlsx?|xls)$/i, '')}.xlsx`;
  XLSX.writeFile(workbook, excelFilename);
}

export type ReportWorkbookSheet = {
  name: string;
  rows: Array<Array<string | number | boolean | Date | null>>;
  headerRow: number;
  widths?: number[];
  percentageColumns?: number[];
};

const reportGreen = '1F5D45';
const reportLightGreen = 'E7F1EC';
const reportBorder = {
  top: { style: 'thin', color: { rgb: 'D7E2DC' } },
  bottom: { style: 'thin', color: { rgb: 'D7E2DC' } },
  left: { style: 'thin', color: { rgb: 'D7E2DC' } },
  right: { style: 'thin', color: { rgb: 'D7E2DC' } },
};

export function downloadReportWorkbook(filename: string, sheets: ReportWorkbookSheet[]) {
  const workbook = XLSX.utils.book_new();
  workbook.Props = {
    Title: filename.replace(/\.xlsx$/i, ''),
    Subject: 'Laporan INSANI-PPBS',
    Author: 'INSANI-PPBS',
    CreatedDate: new Date(),
  };

  for (const definition of sheets) {
    const worksheet = XLSX.utils.aoa_to_sheet(definition.rows);
    const headerIndex = definition.headerRow - 1;
    const header = definition.rows[headerIndex] ?? [];
    const lastColumn = Math.max(header.length - 1, 0);
    const lastRow = Math.max(definition.rows.length - 1, headerIndex);
    const range = XLSX.utils.encode_range({ s: { r: headerIndex, c: 0 }, e: { r: lastRow, c: lastColumn } });

    worksheet['!cols'] = (definition.widths ?? header.map((cell) => Math.min(Math.max(String(cell ?? '').length + 3, 12), 32)))
      .map((wch) => ({ wch }));
    worksheet['!freeze'] = { xSplit: 0, ySplit: headerIndex + 1 };
    worksheet['!autofilter'] = { ref: range };
    worksheet['!pageSetup'] = { orientation: 'landscape', fitToWidth: 1, fitToHeight: 0 };
    worksheet['!pageMargins'] = { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 };
    worksheet['!printOptions'] = { horizontalCentered: false, verticalCentered: false };

    for (let rowIndex = 0; rowIndex < definition.rows.length; rowIndex += 1) {
      for (let columnIndex = 0; columnIndex < (definition.rows[rowIndex]?.length ?? 0); columnIndex += 1) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })];
        if (!cell) continue;
        if (rowIndex >= headerIndex && definition.percentageColumns?.includes(columnIndex)) {
          cell.numFmt = '0.00%';
        }
        cell.s = {
          font: { name: 'Aptos', sz: rowIndex === 0 ? 16 : 10, bold: rowIndex === headerIndex || rowIndex === 0, color: rowIndex === headerIndex ? 'FFFFFF' : '1B2B24' },
          fill: { fgColor: { rgb: rowIndex === headerIndex ? reportGreen : rowIndex === 0 ? reportLightGreen : 'FFFFFF' } },
          border: rowIndex >= headerIndex ? reportBorder : undefined,
          alignment: { vertical: 'center', wrapText: true },
        };
      }
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, definition.name);
  }

  XLSX.writeFile(workbook, `${filename.replace(/\.(csv|xlsx?|xls)$/i, '')}.xlsx`);
}
