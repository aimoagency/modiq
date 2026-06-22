// ── 매출 거래명세서 (Client Transaction Statement) ──────────────────
// 고객사에게 발급하는 거래명세서. 공급자=당사 / 공급받는자=고객사.
// 공급가액 + 부가세 10% + 합계 + 입금현황(완납/부분/미수)을 표기.
// ⚠ 실제 세금계산서는 홈택스에서 별도 발행 — 본 문서는 거래내역(청구) 확인용.
const esc = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const won = (n: number) => Number(n || 0).toLocaleString("ko-KR");
const fmtD = (d?: string) => (d || "").replace(/-/g, ".");

export interface ClientStRow { date: string; desc: string; supply: number; vat: number; total: number; }
export interface ClientStInput {
  agency: any;     // 공급자(당사)
  customer: any;   // 공급받는자(고객사)
  project?: string;
  rows: ClientStRow[];
  paid: number;    // 입금완료액(VAT 포함)
  range: { from?: string; to?: string };
  issueDate?: string;
}

export const buildClientStatementHtml = (inp: ClientStInput): string => {
  const { agency, customer, project, rows, paid, range } = inp;
  const issue = inp.issueDate || new Date().toISOString().slice(0, 10);
  const tot = rows.reduce((a, r) => ({ supply: a.supply + r.supply, vat: a.vat + r.vat, total: a.total + r.total }), { supply: 0, vat: 0, total: 0 });
  const due = Math.max(0, tot.total - (paid || 0));
  const status = due <= 0 ? "완납" : (paid || 0) > 0 ? "부분입금" : "미수";
  const statusColor = status === "완납" ? "#1a8f4a" : status === "부분입금" ? "#c47f17" : "#d11";
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
      <div style="font-size:11px;color:#8a93a0;margin-top:4px">Transaction Statement · 거래기간 ${esc(periodStr)}${project ? ` · ${esc(project)}` : ""}</div>
    </div>

    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">
      <div style="flex:1;min-width:240px">
        <div style="font-size:11px;font-weight:700;color:#8a93a0;margin-bottom:4px">■ 공급자 (당사)</div>
        <table style="width:100%;border-collapse:collapse">
          ${party("상호", esc(agency?.name || "-"))}
          ${party("사업자등록번호", esc(agency?.biz_no || "-"))}
          ${party("대표자", esc(agency?.rep_name || "-"))}
          ${party("주소", esc(agency?.address || "-"))}
          ${party("연락처", esc(agency?.contact_phone || agency?.rep_phone || "-"))}
        </table>
      </div>
      <div style="flex:1;min-width:240px">
        <div style="font-size:11px;font-weight:700;color:#8a93a0;margin-bottom:4px">■ 공급받는자 (고객사)</div>
        <table style="width:100%;border-collapse:collapse">
          ${party("상호", esc(customer?.name || "-"))}
          ${party("사업자등록번호", esc(customer?.biz_no || "-"))}
          ${party("대표자", esc(customer?.rep_name || "-"))}
          ${party("주소", esc(customer?.address || "-"))}
          ${party("담당자", esc(customer?.manager_name || "-"))}
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

    <table style="width:100%;border-collapse:collapse;margin-bottom:14px">
      <tr>
        <td style="padding:7px 10px;border:1px solid #e8eaed;font-size:12px;color:#8a93a0;background:#fafbfc;width:33%">청구 합계 (VAT 포함)</td>
        <td style="padding:7px 10px;border:1px solid #e8eaed;font-size:13px;text-align:right;font-weight:700">${won(tot.total)} 원</td>
      </tr>
      <tr>
        <td style="padding:7px 10px;border:1px solid #e8eaed;font-size:12px;color:#8a93a0;background:#fafbfc">입금 완료</td>
        <td style="padding:7px 10px;border:1px solid #e8eaed;font-size:13px;text-align:right;color:#1a8f4a;font-weight:700">${won(paid || 0)} 원</td>
      </tr>
      <tr>
        <td style="padding:7px 10px;border:1px solid #e8eaed;font-size:12px;color:#8a93a0;background:#fafbfc">미수금 <span style="color:${statusColor};font-weight:700">(${status})</span></td>
        <td style="padding:7px 10px;border:1px solid #e8eaed;font-size:14px;text-align:right;color:${statusColor};font-weight:800">${won(due)} 원</td>
      </tr>
    </table>

    <p style="font-size:11px;color:#8a93a0;line-height:1.7;margin:0 0 16px">
      · 본 거래명세서는 거래내역(청구) 확인용이며, <b>정식 세금계산서는 당사가 국세청 홈택스를 통해 발행</b>합니다.<br>
      · 공급가액에 부가가치세 10%가 가산된 금액이 청구 합계입니다.
    </p>

    <div style="text-align:center;padding-top:14px;border-top:1px solid #e8eaed">
      <div style="font-size:12px;color:#16181f">발급일 ${esc(fmtD(issue))}</div>
      <div style="font-size:14px;font-weight:800;margin-top:6px">${esc(agency?.name || "")}</div>
      ${agency?.biz_no ? `<div style="font-size:11px;color:#8a93a0">사업자등록번호 ${esc(agency.biz_no)}</div>` : ""}
    </div>
  </div>`;
};
