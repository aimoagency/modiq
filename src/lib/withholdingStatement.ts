// ── 원천징수 내역서 (Withholding Tax Statement) ─────────────────────
// 모델에게 발송/인쇄하는 원천징수 내역서 HTML 생성. 이메일 본문·미리보기·인쇄에 공용.
// 주민등록번호는 마스킹값(national_id_masked)만 사용 — 평문 미노출.
import { modelTaxType, foreignerRate } from "./utils";

const esc = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const won = (n: number) => Number(n || 0).toLocaleString("ko-KR");
const fmtD = (d?: string) => (d || "").replace(/-/g, ".");

export interface WhRow { date: string; desc: string; gross: number; withholding: number; payout: number; }
export interface WhStatementInput {
  agency: any;
  model: any;
  rows: WhRow[];
  range: { from?: string; to?: string };
  issueDate?: string;
}

// 모델 세무유형별 원천징수율 라벨
export const modelRateLabel = (model: any): string => {
  const t = modelTaxType(model);
  if (t === "foreigner") return `${foreignerRate(model)}%`;
  if (t === "company") return "—";
  return "3.3%";
};

// 소득자 식별번호 라벨: 등록된 종류(national_id_type) 기준
//  rrn=주민등록번호 / arc=외국인등록번호 / passport=여권번호
//  미등록 시 세무유형 기본값(외국인=여권번호 / 그 외=주민등록번호)
export const modelIdLabel = (model: any): string => {
  const t = model?.national_id_type;
  if (t === "rrn") return "주민등록번호";
  if (t === "arc") return "외국인등록번호";
  if (t === "passport") return "여권번호";
  return modelTaxType(model) === "foreigner" ? "여권번호" : "주민등록번호";
};

export const buildWithholdingStatementHtml = (inp: WhStatementInput): string => {
  const { agency, model, rows, range } = inp;
  const issue = inp.issueDate || new Date().toISOString().slice(0, 10);
  const tot = rows.reduce((a, r) => ({ gross: a.gross + r.gross, withholding: a.withholding + r.withholding, payout: a.payout + r.payout }), { gross: 0, withholding: 0, payout: 0 });
  const t = modelTaxType(model);
  const typeKr = t === "foreigner" ? "외국인" : t === "company" ? "소속사(세금계산서)" : "프리랜서(사업·기타소득)";
  const periodStr = `${range.from ? fmtD(range.from) : "전체"} ~ ${range.to ? fmtD(range.to) : "현재"}`;

  const party = (label: string, value: string) => `
    <tr><td style="padding:5px 10px;color:#8a93a0;font-size:12px;width:96px;border:1px solid #e8eaed;background:#fafbfc">${label}</td>
        <td style="padding:5px 10px;color:#16181f;font-size:12px;border:1px solid #e8eaed">${value}</td></tr>`;

  const bodyRows = rows.length ? rows.map(r => `
    <tr>
      <td style="padding:6px 8px;border:1px solid #e8eaed;font-size:12px;text-align:center;white-space:nowrap">${esc(fmtD(r.date))}</td>
      <td style="padding:6px 8px;border:1px solid #e8eaed;font-size:12px">${esc(r.desc)}</td>
      <td style="padding:6px 8px;border:1px solid #e8eaed;font-size:12px;text-align:right">${won(r.gross)}</td>
      <td style="padding:6px 8px;border:1px solid #e8eaed;font-size:12px;text-align:right;color:#d11">${won(r.withholding)}</td>
      <td style="padding:6px 8px;border:1px solid #e8eaed;font-size:12px;text-align:right;font-weight:700">${won(r.payout)}</td>
    </tr>`).join("") : `<tr><td colspan="5" style="padding:14px;text-align:center;color:#8a93a0;border:1px solid #e8eaed;font-size:12px">해당 기간 지급 내역이 없습니다.</td></tr>`;

  return `
  <div style="font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;max-width:640px;margin:0 auto;background:#fff;color:#16181f;padding:24px;border:1px solid #e8eaed;border-radius:10px">
    <div style="text-align:center;border-bottom:2px solid #16181f;padding-bottom:12px;margin-bottom:16px">
      <div style="font-size:20px;font-weight:800;letter-spacing:4px">원천징수 내역서</div>
      <div style="font-size:11px;color:#8a93a0;margin-top:4px">Withholding Tax Statement · 귀속기간 ${esc(periodStr)}</div>
    </div>

    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">
      <div style="flex:1;min-width:240px">
        <div style="font-size:11px;font-weight:700;color:#8a93a0;margin-bottom:4px">■ 원천징수의무자 (지급자)</div>
        <table style="width:100%;border-collapse:collapse">
          ${party("상호", esc(agency?.name || "-"))}
          ${party("사업자등록번호", esc(agency?.biz_no || "-"))}
          ${party("대표자", esc(agency?.rep_name || "-"))}
          ${party("주소", esc(agency?.address || "-"))}
          ${party("연락처", esc(agency?.contact_phone || agency?.rep_phone || "-"))}
        </table>
      </div>
      <div style="flex:1;min-width:240px">
        <div style="font-size:11px;font-weight:700;color:#8a93a0;margin-bottom:4px">■ 소득자 (수령인)</div>
        <table style="width:100%;border-collapse:collapse">
          ${party("성명", esc(model?.name || "-"))}
          ${party("구분", esc(typeKr))}
          ${party(modelIdLabel(model), esc(model?.national_id_masked || "미등록"))}
          ${party("주소", esc(model?.address || "-"))}
          ${party("원천징수율", esc(modelRateLabel(model)))}
        </table>
      </div>
    </div>

    <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
      <thead>
        <tr style="background:#f1f3f5">
          <th style="padding:7px 8px;border:1px solid #e8eaed;font-size:12px;width:84px">지급일</th>
          <th style="padding:7px 8px;border:1px solid #e8eaed;font-size:12px;text-align:left">내용</th>
          <th style="padding:7px 8px;border:1px solid #e8eaed;font-size:12px;width:96px;text-align:right">지급액</th>
          <th style="padding:7px 8px;border:1px solid #e8eaed;font-size:12px;width:100px;text-align:right">원천징수세액</th>
          <th style="padding:7px 8px;border:1px solid #e8eaed;font-size:12px;width:96px;text-align:right">실지급액</th>
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
      <tfoot>
        <tr style="background:#fafbfc;font-weight:800">
          <td colspan="2" style="padding:7px 8px;border:1px solid #e8eaed;font-size:12px;text-align:center">합계 (${rows.length}건)</td>
          <td style="padding:7px 8px;border:1px solid #e8eaed;font-size:12px;text-align:right">${won(tot.gross)}</td>
          <td style="padding:7px 8px;border:1px solid #e8eaed;font-size:12px;text-align:right;color:#d11">${won(tot.withholding)}</td>
          <td style="padding:7px 8px;border:1px solid #e8eaed;font-size:12px;text-align:right">${won(tot.payout)}</td>
        </tr>
      </tfoot>
    </table>

    <p style="font-size:11px;color:#8a93a0;line-height:1.7;margin:0 0 16px">
      · 위 금액은 귀하에게 지급한 소득과 원천징수세액 내역입니다.<br>
      · 본 내역서는 지급내역 확인용이며, 정식 지급명세서는 국세청 홈택스를 통해 신고됩니다.<br>
      · 주민등록번호는 개인정보 보호를 위해 일부만 표시됩니다.
    </p>

    <div style="text-align:center;padding-top:14px;border-top:1px solid #e8eaed">
      <div style="font-size:12px;color:#16181f">발급일 ${esc(fmtD(issue))}</div>
      <div style="font-size:14px;font-weight:800;margin-top:6px">${esc(agency?.name || "")}</div>
      ${agency?.biz_no ? `<div style="font-size:11px;color:#8a93a0">사업자등록번호 ${esc(agency.biz_no)}</div>` : ""}
    </div>
  </div>`;
};

// ── 거래명세서 (Transaction Statement) ─────────────────────────────
// 소속사(대대행) 모델용. 원천징수가 없고 소속 에이전시가 세금계산서를 발행하므로,
// 우리(공급받는자) 쪽에서 공급가액·부가세(10%)·합계를 정리한 거래명세서를 발급.
//  - 공급자        = 소속 에이전시 (model.agency_*) — 세금계산서 발행 주체
//  - 공급받는자    = 우리 에이전시 (agency.*)
export interface TxRow { date: string; desc: string; supply: number; vat: number; total: number; }
export interface TxStatementInput {
  agency: any;   // 공급받는자(우리 회사)
  model: any;    // 소속사 모델 — agency_name/agency_biz_no 등 소속 에이전시(공급자) 정보 포함
  rows: TxRow[];
  range: { from?: string; to?: string };
  issueDate?: string;
}

export const buildTransactionStatementHtml = (inp: TxStatementInput): string => {
  const { agency, model, rows, range } = inp;
  const issue = inp.issueDate || new Date().toISOString().slice(0, 10);
  const tot = rows.reduce((a, r) => ({ supply: a.supply + r.supply, vat: a.vat + r.vat, total: a.total + r.total }), { supply: 0, vat: 0, total: 0 });
  const periodStr = `${range.from ? fmtD(range.from) : "전체"} ~ ${range.to ? fmtD(range.to) : "현재"}`;

  const party = (label: string, value: string) => `
    <tr><td style="padding:5px 10px;color:#8a93a0;font-size:12px;width:96px;border:1px solid #e8eaed;background:#fafbfc">${label}</td>
        <td style="padding:5px 10px;color:#16181f;font-size:12px;border:1px solid #e8eaed">${value}</td></tr>`;

  const bodyRows = rows.length ? rows.map(r => `
    <tr>
      <td style="padding:6px 8px;border:1px solid #e8eaed;font-size:12px;text-align:center;white-space:nowrap">${esc(fmtD(r.date))}</td>
      <td style="padding:6px 8px;border:1px solid #e8eaed;font-size:12px">${esc(r.desc)}</td>
      <td style="padding:6px 8px;border:1px solid #e8eaed;font-size:12px;text-align:right">${won(r.supply)}</td>
      <td style="padding:6px 8px;border:1px solid #e8eaed;font-size:12px;text-align:right;color:#2563c9">${won(r.vat)}</td>
      <td style="padding:6px 8px;border:1px solid #e8eaed;font-size:12px;text-align:right;font-weight:700">${won(r.total)}</td>
    </tr>`).join("") : `<tr><td colspan="5" style="padding:14px;text-align:center;color:#8a93a0;border:1px solid #e8eaed;font-size:12px">해당 기간 거래 내역이 없습니다.</td></tr>`;

  return `
  <div style="font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;max-width:640px;margin:0 auto;background:#fff;color:#16181f;padding:24px;border:1px solid #e8eaed;border-radius:10px">
    <div style="text-align:center;border-bottom:2px solid #16181f;padding-bottom:12px;margin-bottom:16px">
      <div style="font-size:20px;font-weight:800;letter-spacing:6px">거 래 명 세 서</div>
      <div style="font-size:11px;color:#8a93a0;margin-top:4px">Transaction Statement · 거래기간 ${esc(periodStr)}</div>
    </div>

    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">
      <div style="flex:1;min-width:240px">
        <div style="font-size:11px;font-weight:700;color:#8a93a0;margin-bottom:4px">■ 공급자 (소속 에이전시 · 세금계산서 발행)</div>
        <table style="width:100%;border-collapse:collapse">
          ${party("상호", esc(model?.agency_name || "-"))}
          ${party("사업자등록번호", esc(model?.agency_biz_no || "-"))}
          ${party("담당자", esc(model?.agency_contact || "-"))}
          ${party("연락처", esc(model?.agency_phone || "-"))}
          ${party("대상 모델", esc(model?.name || "-"))}
        </table>
      </div>
      <div style="flex:1;min-width:240px">
        <div style="font-size:11px;font-weight:700;color:#8a93a0;margin-bottom:4px">■ 공급받는자 (당사)</div>
        <table style="width:100%;border-collapse:collapse">
          ${party("상호", esc(agency?.name || "-"))}
          ${party("사업자등록번호", esc(agency?.biz_no || "-"))}
          ${party("대표자", esc(agency?.rep_name || "-"))}
          ${party("주소", esc(agency?.address || "-"))}
          ${party("연락처", esc(agency?.contact_phone || agency?.rep_phone || "-"))}
        </table>
      </div>
    </div>

    <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
      <thead>
        <tr style="background:#f1f3f5">
          <th style="padding:7px 8px;border:1px solid #e8eaed;font-size:12px;width:84px">거래일자</th>
          <th style="padding:7px 8px;border:1px solid #e8eaed;font-size:12px;text-align:left">품목 / 내용</th>
          <th style="padding:7px 8px;border:1px solid #e8eaed;font-size:12px;width:96px;text-align:right">공급가액</th>
          <th style="padding:7px 8px;border:1px solid #e8eaed;font-size:12px;width:96px;text-align:right">세액(10%)</th>
          <th style="padding:7px 8px;border:1px solid #e8eaed;font-size:12px;width:100px;text-align:right">합계</th>
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
      <tfoot>
        <tr style="background:#fafbfc;font-weight:800">
          <td colspan="2" style="padding:7px 8px;border:1px solid #e8eaed;font-size:12px;text-align:center">합계 (${rows.length}건)</td>
          <td style="padding:7px 8px;border:1px solid #e8eaed;font-size:12px;text-align:right">${won(tot.supply)}</td>
          <td style="padding:7px 8px;border:1px solid #e8eaed;font-size:12px;text-align:right;color:#2563c9">${won(tot.vat)}</td>
          <td style="padding:7px 8px;border:1px solid #e8eaed;font-size:12px;text-align:right">${won(tot.total)}</td>
        </tr>
      </tfoot>
    </table>

    <p style="font-size:11px;color:#8a93a0;line-height:1.7;margin:0 0 16px">
      · 소속사(대대행) 모델은 원천징수 대상이 아니며, 공급가액에 부가가치세 10%가 가산됩니다.<br>
      · 본 거래명세서는 거래내역 확인용이며, <b>정식 세금계산서는 공급자(소속 에이전시)가 발행</b>합니다.<br>
      · 세금계산서 수취 후 부가세 신고 시 매입세액으로 공제됩니다.
    </p>

    <div style="text-align:center;padding-top:14px;border-top:1px solid #e8eaed">
      <div style="font-size:12px;color:#16181f">발급일 ${esc(fmtD(issue))}</div>
      <div style="font-size:14px;font-weight:800;margin-top:6px">${esc(agency?.name || "")}</div>
      ${agency?.biz_no ? `<div style="font-size:11px;color:#8a93a0">사업자등록번호 ${esc(agency.biz_no)}</div>` : ""}
    </div>
  </div>`;
};

// 인쇄(브라우저 인쇄 대화상자 → PDF로 저장). 별도 창에서 열어 인쇄.
export const printStatementHtml = (innerHtml: string, title = "원천징수 내역서") => {
  const w = window.open("", "_blank", "width=760,height=900");
  if (!w) { alert("팝업이 차단되었습니다. 팝업을 허용한 뒤 다시 시도하세요."); return; }
  w.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(title)}</title>
    <style>@page{margin:14mm} body{margin:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}</style>
    </head><body>${innerHtml}<script>window.onload=function(){setTimeout(function(){window.print();},250);};</script></body></html>`);
  w.document.close();
};
