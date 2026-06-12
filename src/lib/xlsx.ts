// SheetJS 런타임 로드 (CDN, 번들 미포함) + 공용 내보내기 헬퍼
let xlsxPromise: Promise<any> | null = null;
export function loadXLSX(): Promise<any> {
  if ((window as any).XLSX) return Promise.resolve((window as any).XLSX);
  if (!xlsxPromise) {
    xlsxPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      s.onload = () => resolve((window as any).XLSX);
      s.onerror = () => reject(new Error("엑셀 라이브러리 로드 실패"));
      document.head.appendChild(s);
    });
  }
  return xlsxPromise;
}

// 행렬(aoa: 첫 행=헤더)을 xlsx로 저장. colWidths(글자수) 선택.
export async function exportAoaXlsx(aoa: any[][], filename: string, sheetName = "Sheet1", colWidths?: number[]) {
  const XLSX = await loadXLSX();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  if (colWidths) (ws["!cols"] = colWidths.map((w) => ({ wch: w })));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}
