import { useState, useMemo } from "react";
import { C, inp, btnS } from "../theme";
import Modal from "./Modal";
import { exportAoaXlsx } from "../lib/xlsx";
import { periodRange, fmtDate } from "../lib/utils";
import {
  supplyTotal, vatAmount, clientCharge, clientBalanceVat,
  modelGross, modelWithholding, modelPayout, agencyMargin, modelTaxType, bookingSession,
} from "../lib/utils";

const taxLabel = (m: any) => modelTaxType(m) === "foreigner" ? "외국인" : modelTaxType(m) === "company" ? "소속사" : "프리랜서";
const won = (n: number) => Number(n || 0).toLocaleString("ko-KR");

export default function SettlementStatementModal({
  bookings, models, customers, onClose, isMobile = false,
}: {
  bookings: any[]; models: any[]; customers: any[]; onClose: () => void; isMobile?: boolean;
}) {
  const [preset, setPreset] = useState("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [modelF, setModelF] = useState("ALL");

  const range = preset === "custom" ? { from: from || undefined, to: to || undefined } : periodRange(preset);

  const rows = useMemo(() => {
    return bookings
      .filter((b) => {
        const d = b.shoot_date || "";
        if (range.from && d < range.from) return false;
        if (range.to && d > range.to) return false;
        if (modelF !== "ALL" && b.model_id !== modelF) return false;
        if (b.status === "CANCELLED") return false;
        return true;
      })
      .sort((a, b) => (a.shoot_date || "").localeCompare(b.shoot_date || ""))
      .map((b) => {
        const m = models.find((x) => x.id === b.model_id);
        const c = customers.find((x) => x.id === b.customer_id);
        const gross = modelGross(b, m);
        const payout = modelPayout(b, m);
        return {
          date: b.shoot_date || "", id: b.id,
          model: m?.name || "?", customer: c?.name || "?", project: b.project_name || "",
          tax: taxLabel(m), session: bookingSession(b) === "half" ? "Half" : "Day",
          supply: supplyTotal(b), vat: vatAmount(b), charge: clientCharge(b),
          deposit: b.deposit_amt || 0, depositDate: b.deposit_paid_date || "", depositPaid: !!b.deposit_paid,
          balance: clientBalanceVat(b), balanceDate: b.balance_paid_date || "", balancePaid: !!b.balance_paid,
          gross, adjust: payout - gross, withholding: modelWithholding(b, m), payout,
          modelPaidDate: b.model_paid_date || "", modelPaid: !!b.model_paid,
          invoiceDate: b.tax_invoice_date || "", invoiceIssued: !!b.tax_invoice_issued,
          margin: agencyMargin(b, m),
        };
      });
  }, [bookings, models, customers, range.from, range.to, modelF]);

  const tot = useMemo(() => rows.reduce((a, r) => ({
    supply: a.supply + r.supply, vat: a.vat + r.vat, charge: a.charge + r.charge,
    deposit: a.deposit + r.deposit, balance: a.balance + r.balance,
    gross: a.gross + r.gross, withholding: a.withholding + r.withholding, payout: a.payout + r.payout, margin: a.margin + r.margin,
  }), { supply: 0, vat: 0, charge: 0, deposit: 0, balance: 0, gross: 0, withholding: 0, payout: 0, margin: 0 }), [rows]);

  const stTxt = (paid: boolean) => paid ? "완료" : "미처리";

  const download = async () => {
    const head = ["촬영일","계약ID","모델","고객사","프로젝트","세무유형","구분","공급가","부가세(10%)","고객청구(VAT포함)",
      "계약금","계약금입금일","계약금상태","잔금","잔금입금일","잔금상태",
      "모델정산기준액","가감(원천/부가세)","모델실지급","모델지급일","모델지급상태","계산서발행일","계산서상태","에이전시마진"];
    const body = rows.map((r) => [
      r.date, r.id, r.model, r.customer, r.project, r.tax, r.session, r.supply, r.vat, r.charge,
      r.deposit, r.depositDate, r.depositPaid ? "입금" : "미입금", r.balance, r.balanceDate, r.balancePaid ? "입금" : "미입금",
      r.gross, r.adjust, r.payout, r.modelPaidDate, r.modelPaid ? "지급" : "미지급", r.invoiceDate, r.invoiceIssued ? "발행" : "미발행", r.margin,
    ]);
    const totalRow = ["합계","","","","","","", tot.supply, tot.vat, tot.charge, tot.deposit,"","", tot.balance,"","", tot.gross, (tot.payout-tot.gross), tot.payout,"","","","", tot.margin];
    const aoa = [head, ...body, totalRow];
    const widths = [11,16,8,12,12,8,6,11,10,13,10,11,9,11,11,9,13,12,11,11,11,11,9,12];
    const label = (range.from || "전체") + "_" + (range.to || "현재");
    await exportAoaXlsx(aoa, `정산내역서_${label}.xlsx`, "정산내역서", widths);
  };

  const th: any = { padding: "7px 8px", borderBottom: `1px solid ${C.border}`, color: C.muted, textAlign: "left", whiteSpace: "nowrap", fontWeight: 700, position: "sticky", top: 0, background: C.card2 };
  const td: any = { padding: "6px 8px", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap", color: C.text };
  const numTd: any = { ...td, textAlign: "right" };

  return (
    <Modal onClose={onClose} maxW={1100}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ margin: 0, color: C.text }}>📑 정산 내역서 <span style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>({rows.length}건)</span></h3>
        <button onClick={download} disabled={rows.length === 0} style={{ ...btnS(C.green, rows.length === 0) }}>⬇ 엑셀 다운로드</button>
      </div>

      {/* 기간·모델 필터 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {([["month","이번 달"],["lastmonth","지난 달"],["3m","3개월"],["6m","6개월"],["1y","12개월"],["custom","기간 설정"]] as const).map(([k,l]) => (
          <button key={k} onClick={() => setPreset(k)} style={{ padding: "5px 12px", borderRadius: 20, border: `1px solid ${preset===k?C.blue:C.border}`, background: preset===k?C.blue+"22":"transparent", color: preset===k?C.blue:C.muted, fontSize: 12, fontWeight: preset===k?700:500, cursor: "pointer" }}>{l}</button>
        ))}
        {preset === "custom" && (
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ ...inp, marginBottom: 0, padding: "4px 7px", fontSize: 12, width: "auto" }} />
            <span style={{ color: C.muted }}>~</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ ...inp, marginBottom: 0, padding: "4px 7px", fontSize: 12, width: "auto" }} />
          </span>
        )}
        <select value={modelF} onChange={(e) => setModelF(e.target.value)} style={{ ...inp, marginBottom: 0, width: "auto", padding: "5px 10px", fontSize: 12, marginLeft: "auto" }}>
          <option value="ALL">모델 전체</option>
          {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      {/* 합계 요약 */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5,1fr)", gap: 8, marginBottom: 12 }}>
        {[["고객 청구(VAT)", tot.charge, C.text], ["미입금 잔금", rows.filter(r=>!r.balancePaid).reduce((s,r)=>s+r.balance,0), C.orange], ["모델 실지급", tot.payout, "#c9a96e"], ["원천징수계", tot.withholding, C.red], ["에이전시 마진", tot.margin, C.green]].map(([l, v, col]) => (
          <div key={String(l)} style={{ background: C.card2, borderRadius: 8, padding: "8px 10px" }}>
            <p style={{ margin: 0, fontSize: 10, color: C.muted }}>{l as string}</p>
            <p style={{ margin: "3px 0 0", fontSize: 13, fontWeight: 800, color: col as string }}>{won(v as number)}</p>
          </div>
        ))}
      </div>

      {/* 표 (화면: 핵심 컬럼 / 엑셀: 전체) */}
      <div style={{ overflowX: "auto", maxHeight: "50vh", overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 8 }}>
        <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: 920 }}>
          <thead>
            <tr>
              {["촬영일","모델","고객사","프로젝트","세무","구분","공급가","청구(VAT)","계약금","잔금","모델실지급","지급","계산서"].map((h) => <th key={h} style={th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={13} style={{ ...td, textAlign: "center", color: C.muted, padding: 20 }}>해당 기간 내역이 없습니다.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id}>
                <td style={td}>{fmtDate(r.date)}</td>
                <td style={td}>{r.model}</td>
                <td style={td}>{r.customer}</td>
                <td style={{ ...td, color: C.textSub }}>{r.project || "-"}</td>
                <td style={td}><span style={{ fontSize: 11, color: r.tax==="외국인"?C.yellow:r.tax==="소속사"?C.purple:C.blue }}>{r.tax}</span></td>
                <td style={td}><span style={{ fontSize: 11, color: r.session==="Half"?C.purple:C.blue }}>{r.session}</span></td>
                <td style={numTd}>{won(r.supply)}</td>
                <td style={numTd}>{won(r.charge)}</td>
                <td style={numTd}>{won(r.deposit)} <span style={{ fontSize: 10, color: r.depositPaid?C.green:C.muted }}>{r.depositPaid?"✓":"·"}</span></td>
                <td style={numTd}>{won(r.balance)} <span style={{ fontSize: 10, color: r.balancePaid?C.green:C.orange }}>{r.balancePaid?"✓":"미"}</span></td>
                <td style={{ ...numTd, color: "#c9a96e", fontWeight: 700 }}>{won(r.payout)}</td>
                <td style={td}><span style={{ fontSize: 11, color: r.modelPaid?"#c9a96e":C.muted }}>{r.modelPaid?"지급":"대기"}</span></td>
                <td style={td}><span style={{ fontSize: 11, color: r.invoiceIssued?C.purple:C.muted }}>{r.invoiceIssued?"발행":"미발행"}</span></td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr style={{ position: "sticky", bottom: 0, background: C.card2 }}>
                <td style={{ ...td, fontWeight: 800 }} colSpan={6}>합계 {rows.length}건</td>
                <td style={{ ...numTd, fontWeight: 800 }}>{won(tot.supply)}</td>
                <td style={{ ...numTd, fontWeight: 800 }}>{won(tot.charge)}</td>
                <td style={{ ...numTd, fontWeight: 800 }}>{won(tot.deposit)}</td>
                <td style={{ ...numTd, fontWeight: 800 }}>{won(tot.balance)}</td>
                <td style={{ ...numTd, fontWeight: 800, color: "#c9a96e" }}>{won(tot.payout)}</td>
                <td style={td} colSpan={2}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p style={{ fontSize: 11, color: C.muted, margin: "10px 0 0" }}>화면은 핵심 항목만 표시합니다. 엑셀에는 계약ID·부가세·입금일·계산서발행일·원천징수·마진 등 전체 컬럼이 포함됩니다.</p>
    </Modal>
  );
}
