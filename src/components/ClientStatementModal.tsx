import { useMemo, useState } from "react";
import { C, inp, btnS } from "../theme";
import Modal from "./Modal";
import { periodRange, fmtDate, bookingTotal, clientCharge, vatAmount, clientBalanceVat, REVENUE_STATUSES } from "../lib/utils";
import { BOOKING_TYPES } from "../constants";
import { exportAoaXlsx } from "../lib/xlsx";
import { sendEmail } from "../lib/email";
import { buildClientStatementHtml, type ClientStRow } from "../lib/clientStatement";
import { printStatementHtml } from "../lib/withholdingStatement";

const won = (n: number) => Number(n || 0).toLocaleString("ko-KR");

// 고객 입금액(VAT 포함): 완납이면 청구액 전체, 아니면 계약금/잔금 입금분 합산
const bookingPaid = (b: any): number => {
  const charge = clientCharge(b);
  if (b.is_paid) return charge;
  let p = 0;
  if (b.deposit_paid) p += (b.deposit_amt || 0);
  if (b.balance_paid) p += clientBalanceVat(b);
  return Math.min(p, charge);
};

export default function ClientStatementModal({ bookings, customers, models, agency, isMobile = false, onClose }: {
  bookings: any[]; customers: any[]; models: any[]; agency?: any; isMobile?: boolean; onClose: () => void;
}) {
  const [preset, setPreset] = useState("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [custF, setCustF] = useState("ALL");
  const [dueOnly, setDueOnly] = useState(false);
  const [mode, setMode] = useState<"project" | "customer">("project"); // 발급 단위: 프로젝트별 / 고객사 월합산
  const [openKey, setOpenKey] = useState<string | null>(null);

  const range = preset === "custom" ? { from: from || undefined, to: to || undefined } : periodRange(preset);

  // 프로젝트 단위로 묶기(프로젝트명 없으면 단건). 매출 인정 필터(RevenueView와 동일) 사용.
  const groups = useMemo(() => {
    const billable = bookings.filter((b) => {
      if (!REVENUE_STATUSES.includes(b.status)) return false;
      if (!BOOKING_TYPES[b.booking_type || "SHOOT"]?.hasContract) return false;
      if (bookingTotal(b) <= 0) return false;
      const d = b.shoot_date || "";
      if (range.from && d < range.from) return false;
      if (range.to && d > range.to) return false;
      if (custF !== "ALL" && b.customer_id !== custF) return false;
      return true;
    });
    const byCustomer = mode === "customer";
    const map = new Map<string, any>();
    for (const b of billable) {
      const proj = (b.project_name || "").trim();
      const key = byCustomer ? `C:${b.customer_id}` : (proj ? `P:${b.customer_id}__${proj}` : `S:${b.id}`);
      if (!map.has(key)) {
        const c = customers.find((x) => x.id === b.customer_id);
        map.set(key, { key, customer: c, customerId: b.customer_id, project: byCustomer ? "" : proj, items: [] as any[] });
      }
      map.get(key).items.push(b);
    }
    return [...map.values()].map((g) => {
      const items = g.items.sort((a: any, b: any) => (a.shoot_date || "").localeCompare(b.shoot_date || ""));
      const supply = items.reduce((s: number, b: any) => s + bookingTotal(b), 0);
      const vat = items.reduce((s: number, b: any) => s + vatAmount(b), 0);
      const charge = items.reduce((s: number, b: any) => s + clientCharge(b), 0);
      const paid = items.reduce((s: number, b: any) => s + bookingPaid(b), 0);
      const due = Math.max(0, charge - paid);
      const lastDate = items.reduce((d: string, b: any) => ((b.shoot_date || "") > d ? (b.shoot_date || "") : d), "");
      const status = due <= 0 ? "완납" : paid > 0 ? "부분입금" : "미수";
      const projCount = new Set(items.map((b: any) => (b.project_name || "").trim()).filter(Boolean)).size;
      const projLabel = byCustomer ? `월 합산 · ${items.length}건${projCount ? ` / ${projCount}개 PJ` : ""}` : (g.project || "(단건)");
      return { ...g, items, supply, vat, charge, paid, due, lastDate, status, projLabel };
    }).filter((g) => !dueOnly || g.due > 0)
      .sort((a, b) => (b.lastDate || "").localeCompare(a.lastDate || ""));
  }, [bookings, customers, range.from, range.to, custF, dueOnly, mode]);

  const tot = useMemo(() => groups.reduce((a, g) => ({ charge: a.charge + g.charge, paid: a.paid + g.paid, due: a.due + g.due }), { charge: 0, paid: 0, due: 0 }), [groups]);

  const openGroup = openKey ? groups.find((g) => g.key === openKey) : null;
  const docHtml = useMemo(() => {
    if (!openGroup) return "";
    const rows: ClientStRow[] = openGroup.items.map((b: any) => ({
      date: b.shoot_date || "",
      desc: [models.find((m: any) => m.id === b.model_id)?.name, openGroup.project || b.project_name || "촬영"].filter(Boolean).join(" · "),
      supply: bookingTotal(b), vat: vatAmount(b), total: clientCharge(b),
    }));
    return buildClientStatementHtml({ agency, customer: openGroup.customer, project: openGroup.project || (mode === "customer" ? "월 합산" : ""), rows, paid: openGroup.paid, range });
  }, [openGroup, agency, models, range.from, range.to, mode]);

  const sendDoc = async () => {
    if (!openGroup) return;
    const c = openGroup.customer;
    const email = c?.tax_email || c?.email || "";
    if (!email) { alert("고객사 이메일이 없습니다.\n고객사 정보에 '계산서 발송 이메일' 또는 이메일을 먼저 입력하세요."); return; }
    if (!confirm(`${c?.name || "고객사"} (${email})에게\n거래명세서를 발송할까요?`)) return;
    const r = await sendEmail({
      to: email,
      subject: `[${agency?.name || "거래명세서"}] 거래명세서${openGroup.project ? ` · ${openGroup.project}` : ""} · ${(range.from || "전체").replace(/-/g, ".")}~${(range.to || "현재").replace(/-/g, ".")}`,
      html: docHtml, fromName: agency?.name || undefined, replyTo: agency?.owner_email || undefined,
    });
    if (r.ok) { alert("발송되었습니다."); setOpenKey(null); }
    else if (r.skipped) alert("메일 발송이 아직 연결되지 않았습니다. (email-send 함수 배포 필요)");
    else alert("발송 실패: " + (r.error || ""));
  };

  const download = async () => {
    const head = ["고객사", "프로젝트", "건수", "공급가액", "부가세(10%)", "청구합계(VAT)", "입금액", "미수금", "상태"];
    const body = groups.map((g) => [g.customer?.name || "?", g.projLabel, g.items.length, g.supply, g.vat, g.charge, g.paid, g.due, g.status]);
    const totalRow = ["합계", "", groups.reduce((s, g) => s + g.items.length, 0), "", "", tot.charge, tot.paid, tot.due, ""];
    const label = (range.from || "전체") + "_" + (range.to || "현재");
    await exportAoaXlsx([head, ...body, totalRow], `거래명세서_청구목록_${label}.xlsx`, "거래명세서", [16, 18, 6, 13, 12, 14, 13, 13, 9]);
  };

  const stColor = (s: string) => (s === "완납" ? C.green : s === "부분입금" ? C.orange : C.red);
  const hasEmail = !!(openGroup?.customer?.tax_email || openGroup?.customer?.email);

  const th: any = { padding: "7px 8px", borderBottom: `1px solid ${C.border}`, color: C.muted, textAlign: "left", whiteSpace: "nowrap", fontWeight: 700, position: "sticky", top: 0, background: C.card2 };
  const td: any = { padding: "6px 8px", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap", color: C.text };
  const numTd: any = { ...td, textAlign: "right" };

  return (
    <Modal onClose={onClose} maxW={1000}>
      <h3 style={{ margin: "0 0 12px", paddingRight: 44, color: C.text }}>📑 거래명세서 / 청구 <span style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>({groups.length}건)</span></h3>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
        {/* 발급 단위: 프로젝트별 / 고객사 월합산(한 장) */}
        <span style={{ display: "inline-flex", border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
          {([["project", "프로젝트별"], ["customer", "고객사 월합산"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setMode(k)} style={{ padding: "6px 12px", border: "none", background: mode === k ? C.blue + "22" : "transparent", color: mode === k ? C.blue : C.muted, fontSize: 12, fontWeight: mode === k ? 700 : 500, cursor: "pointer" }}>{l}</button>
          ))}
        </span>
        <button onClick={() => setDueOnly((v) => !v)} style={{ ...btnS(dueOnly ? C.red : C.muted) }}>{dueOnly ? "● 미수만 보는 중" : "○ 미수만 보기"}</button>
        <button onClick={download} disabled={groups.length === 0} style={{ ...btnS(C.green, groups.length === 0) }}>⬇ 엑셀 다운로드</button>
      </div>

      {/* 기간·고객사 필터 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {([["month","이번 달"],["lastmonth","지난 달"],["3m","3개월"],["6m","6개월"],["1y","12개월"],["custom","기간 설정"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setPreset(k)} style={{ padding: "5px 12px", borderRadius: 20, border: `1px solid ${preset === k ? C.blue : C.border}`, background: preset === k ? C.blue + "22" : "transparent", color: preset === k ? C.blue : C.muted, fontSize: 12, fontWeight: preset === k ? 700 : 500, cursor: "pointer" }}>{l}</button>
        ))}
        {preset === "custom" && (
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ ...inp, marginBottom: 0, padding: "4px 7px", fontSize: 12, width: "auto" }} />
            <span style={{ color: C.muted }}>~</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ ...inp, marginBottom: 0, padding: "4px 7px", fontSize: 12, width: "auto" }} />
          </span>
        )}
        <select value={custF} onChange={(e) => setCustF(e.target.value)} style={{ ...inp, marginBottom: 0, width: "auto", padding: "5px 10px", fontSize: 12, marginLeft: "auto" }}>
          <option value="ALL">고객사 전체</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* 합계 카드 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8, marginBottom: 12 }}>
        {([["총 청구액(VAT)", tot.charge, C.text], ["입금 완료", tot.paid, C.green], ["미수금", tot.due, C.red]] as [string, number, string][]).map(([l, v, col]) => (
          <div key={l} style={{ background: C.card2, borderRadius: 8, padding: "8px 10px" }}>
            <p style={{ margin: 0, fontSize: 10, color: C.muted }}>{l}</p>
            <p style={{ margin: "3px 0 0", fontSize: 14, fontWeight: 800, color: col }}>{won(v)}</p>
          </div>
        ))}
      </div>

      {/* 청구 리스트(프로젝트 단위) */}
      <div style={{ overflowX: "auto", maxHeight: "50vh", overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 8 }}>
        <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: 720, width: "100%" }}>
          <thead>
            <tr>{["고객사", "프로젝트", "건수", "공급가", "청구(VAT)", "미수금", "상태", "발급"].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {groups.length === 0 ? (
              <tr><td colSpan={8} style={{ ...td, textAlign: "center", color: C.muted, padding: 20 }}>해당 기간 청구 내역이 없습니다.</td></tr>
            ) : groups.map((g) => (
              <tr key={g.key}>
                <td style={td}>{g.customer?.name || "?"}</td>
                <td style={{ ...td, color: C.textSub }}>{g.projLabel}</td>
                <td style={{ ...td, textAlign: "center" }}>{g.items.length}</td>
                <td style={numTd}>{won(g.supply)}</td>
                <td style={numTd}>{won(g.charge)}</td>
                <td style={{ ...numTd, color: g.due > 0 ? C.red : C.muted }}>{won(g.due)}</td>
                <td style={td}><span style={{ fontSize: 11, fontWeight: 700, color: stColor(g.status), background: stColor(g.status) + "1a", padding: "2px 7px", borderRadius: 6 }}>{g.status}</span></td>
                <td style={td}><button onClick={() => setOpenKey(g.key)} style={{ ...btnS(C.blue), padding: "5px 10px", fontSize: 11, whiteSpace: "nowrap" }}>🧾 명세서 발급</button></td>
              </tr>
            ))}
          </tbody>
          {groups.length > 0 && (
            <tfoot>
              <tr style={{ position: "sticky", bottom: 0, background: C.card2 }}>
                <td style={{ ...td, fontWeight: 800 }} colSpan={3}>합계 {groups.length}건</td>
                <td style={td}></td>
                <td style={{ ...numTd, fontWeight: 800 }}>{won(tot.charge)}</td>
                <td style={{ ...numTd, fontWeight: 800, color: C.red }}>{won(tot.due)}</td>
                <td style={td} colSpan={2}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p style={{ fontSize: 11, color: C.muted, margin: "10px 0 0" }}>{mode === "customer" ? "고객사별로 이 기간 전체 거래를 한 장에 합산해 발급합니다." : "프로젝트 단위로 묶어 거래명세서를 발급합니다(프로젝트명이 없으면 단건)."} 실제 세금계산서는 홈택스에서 별도 발행하세요.</p>

      {/* 거래명세서 미리보기 · 발송 */}
      {openGroup && (
        <Modal onClose={() => setOpenKey(null)} maxW={720}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8, flexWrap: "wrap", paddingRight: 44 }}>
            <h3 style={{ margin: 0, color: C.text, fontSize: 15 }}>🧾 거래명세서 발급 <span style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>· {openGroup.customer?.name || "?"}{openGroup.project ? ` / ${openGroup.project}` : (mode === "customer" ? " / 월 합산" : "")}</span></h3>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => printStatementHtml(docHtml, "거래명세서")} style={{ ...btnS(C.blue) }}>🖨 인쇄 / PDF 저장</button>
              <button onClick={sendDoc} disabled={!hasEmail} style={{ ...btnS(C.green, !hasEmail) }}>📧 이메일 발송</button>
            </div>
          </div>
          {!hasEmail && <p style={{ fontSize: 11, color: C.orange, margin: "0 0 8px" }}>⚠ 고객사 이메일 미등록 — 이메일 발송 불가(인쇄·PDF 저장은 가능).</p>}
          <div style={{ maxHeight: "66vh", overflowY: "auto", borderRadius: 8 }} dangerouslySetInnerHTML={{ __html: docHtml }} />
        </Modal>
      )}
    </Modal>
  );
}
