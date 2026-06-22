import { useState, useMemo, useEffect, useRef } from "react";
import { C, inp, btnS } from "../theme";
import Modal from "./Modal";
import { MODEL_CATEGORIES, CLIENT_CATEGORIES } from "../constants";
import { makeModelId, makeClientId, normalizeInstagram, validateBizNo, parseNum } from "../lib/utils";
import { User, Building2, AlertTriangle } from "./icons";

// ── SheetJS 런타임 로드 (CDN, Pretendard와 동일 패턴) ──
let xlsxPromise: Promise<any> | null = null;
function loadXLSX(): Promise<any> {
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

// ── 필드 정의 ──
type FieldDef = {
  key: string;
  label: string;
  required?: boolean;
  type?: "text" | "number" | "bool" | "date" | "ssn6";
  aliases: string[];
  options?: string[];
};

const MODEL_FIELDS: FieldDef[] = [
  { key: "name", label: "모델명", required: true, aliases: ["모델명", "이름", "성명", "name", "모델", "닉네임"] },
  { key: "ssn6", label: "생년월일 6자리", required: true, type: "ssn6", aliases: ["생년월일", "주민번호", "주민", "주민등록번호", "ssn", "앞6자리", "주민앞", "생일"] },
  { key: "gender", label: "성별", options: ["남", "여"], aliases: ["성별", "gender", "남녀", "sex", "성", "남여"] },
  { key: "phone", label: "전화번호", aliases: ["전화", "연락처", "휴대폰", "핸드폰", "phone", "번호", "모바일", "tel", "hp"] },
  { key: "email", label: "이메일", aliases: ["이메일", "email", "메일", "e-mail"] },
  { key: "category", label: "카테고리", options: MODEL_CATEGORIES, aliases: ["카테고리", "분류", "구분", "category", "성별", "타입"] },
  { key: "rate", label: "기본단가", type: "number", aliases: ["단가", "기본단가", "rate", "출연료", "페이", "금액", "기본료"] },
  { key: "commission", label: "수수료율", type: "number", aliases: ["수수료", "수수료율", "commission", "커미션"] },
  { key: "is_foreigner", label: "외국인", type: "bool", aliases: ["외국인", "foreigner", "내외국인"] },
  { key: "visa_entry", label: "입국일", type: "date", aliases: ["입국", "입국일", "entry", "비자입국"] },
  { key: "visa_exit", label: "출국일", type: "date", aliases: ["출국", "출국일", "비자만료", "exit", "비자"] },
  { key: "instagram_url", label: "인스타그램", aliases: ["인스타", "인스타그램", "instagram", "ig", "sns"] },
  { key: "drive_url", label: "구글드라이브", aliases: ["드라이브", "구글드라이브", "drive", "포트폴리오", "자료", "사진"] },
  { key: "kakao_id", label: "카카오톡ID", aliases: ["카카오", "카톡", "kakao", "카카오톡"] },
  { key: "bank_info", label: "통장정보", aliases: ["계좌", "통장", "bank", "은행", "계좌번호"] },
  { key: "aimo_url", label: "AIMO링크", aliases: ["aimo", "아이모"] },
  { key: "memo", label: "메모", aliases: ["메모", "비고", "특이사항", "memo", "note", "참고"] },
];

const CUSTOMER_FIELDS: FieldDef[] = [
  { key: "name", label: "상호(고객사명)", required: true, aliases: ["고객사", "고객사명", "회사", "회사명", "업체", "업체명", "거래처", "상호", "법인명", "name", "client"] },
  { key: "category", label: "분야", aliases: ["분야", "카테고리", "분류", "category"] },
  { key: "rep_name", label: "대표자(성명)", aliases: ["대표", "대표자", "대표자명", "성명", "대표이사", "ceo", "representative"] },
  { key: "phone", label: "전화번호", required: true, aliases: ["전화", "연락처", "phone", "번호", "대표번호", "tel", "휴대폰"] },
  { key: "manager_name", label: "담당자명", aliases: ["담당자", "담당", "담당자명", "manager", "매니저", "담당자성함"] },
  { key: "email", label: "이메일", aliases: ["이메일", "email", "메일", "e-mail"] },
  { key: "biz_no", label: "사업자등록번호", aliases: ["사업자", "사업자등록번호", "사업자번호", "bizno", "사업자등록"] },
  { key: "address", label: "사업장주소", aliases: ["주소", "사업장주소", "사업장소재지", "소재지", "address"] },
  { key: "biz_type", label: "업태", aliases: ["업태", "biztype"] },
  { key: "biz_item", label: "종목", aliases: ["종목", "bizitem", "item"] },
  { key: "tax_email", label: "계산서이메일", aliases: ["계산서", "세금계산서", "계산서이메일", "taxemail", "세금계산서이메일"] },
  { key: "brand", label: "브랜드명", aliases: ["브랜드", "브랜드명", "brand"] },
  { key: "memo", label: "메모", aliases: ["메모", "비고", "특이사항", "memo", "note", "참고"] },
];

const norm = (s: string) => String(s || "").toLowerCase().replace(/[\s_\-./()]/g, "");

// 주민 앞6자리 추출: 생년월일(YYYYMMDD/YYYY-MM-DD)·주민번호(900101-1234567) 모두 처리
const toSSN6 = (raw: string): string => {
  const d = String(raw || "").replace(/[^0-9]/g, "");
  if (!d) return "";
  if (d.length === 8 && (d.startsWith("19") || d.startsWith("20"))) return d.slice(2, 8); // YYYYMMDD
  return d.slice(0, 6);
};
const toBool = (raw: string): boolean => {
  const v = norm(raw);
  return ["y", "yes", "o", "예", "true", "1", "외국인", "foreigner", "v"].includes(v);
};
// 날짜 정규화 → YYYY-MM-DD (실패 시 빈값)
const toDate = (raw: string): string => {
  const v = String(raw || "").trim();
  if (!v) return "";
  const m = v.replace(/[.]/g, "-").replace(/\//g, "-").match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  const d2 = v.replace(/[^0-9]/g, "");
  if (d2.length === 8) return `${d2.slice(0, 4)}-${d2.slice(4, 6)}-${d2.slice(6, 8)}`;
  return "";
};

type RowStatus = "new" | "dup" | "error";
type Row = { key: number; data: Record<string, string> };

export default function BulkUploadModal({
  entity,
  existingKeys,
  onClose,
  onCommit,
  isMobile = false,
}: {
  entity: "model" | "customer";
  existingKeys: Map<string, string>; // 자연키(이름+주민/전화) → 기존 레코드의 실제 id
  onClose: () => void;
  onCommit: (items: { id: string; mode: "insert" | "update"; record: Record<string, any> }[]) => Promise<{ inserted: number; updated: number }>;
  isMobile?: boolean;
}) {
  const FIELDS = entity === "model" ? MODEL_FIELDS : CUSTOMER_FIELDS;
  const title = entity === "model" ? "모델 대량 등록" : "고객사 대량 등록";
  const Icon = entity === "model" ? User : Building2;

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [rawRows, setRawRows] = useState<string[][]>([]); // 파일 전체(헤더 포함)
  const [headerRow, setHeaderRow] = useState(0); // 헤더 행 인덱스
  const [mapping, setMapping] = useState<Record<string, number>>({}); // fieldKey → 컬럼인덱스(-1=없음)
  const [rows, setRows] = useState<Row[]>([]); // 미리보기 행
  const [include, setInclude] = useState<Set<number>>(new Set());
  const [overwrite, setOverwrite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [pasteText, setPasteText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const idOf = (data: Record<string, string>): string =>
    entity === "model"
      ? makeModelId(data.name || "", toSSN6(data.ssn6 || ""))
      : makeClientId(data.name || "", String(data.phone || "").replace(/[^0-9]/g, "").slice(-4));

  const headers = rawRows[headerRow] || [];

  // 헤더 → 자동 매핑
  const autoMap = (hdrs: string[]) => {
    const map: Record<string, number> = {};
    FIELDS.forEach((f) => {
      let found = -1;
      for (let i = 0; i < hdrs.length; i++) {
        const h = norm(hdrs[i]);
        if (!h) continue;
        if (f.aliases.some((a) => h === norm(a) || h.includes(norm(a)) || norm(a).includes(h))) { found = i; break; }
      }
      map[f.key] = found;
    });
    setMapping(map);
  };

  // ── 1단계: 파일 파싱 ──
  const handleFile = async (file: File) => {
    setErr("");
    try {
      const XLSX = await loadXLSX();
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false, blankrows: false });
      if (!aoa.length) { setErr("빈 파일입니다."); return; }
      // 헤더 추정: 비어있지 않은 셀이 가장 많은 상위 5행 중 첫 행
      let best = 0, bestCnt = -1;
      for (let i = 0; i < Math.min(5, aoa.length); i++) {
        const cnt = aoa[i].filter((c) => String(c).trim()).length;
        if (cnt > bestCnt) { bestCnt = cnt; best = i; }
      }
      const trimmed = aoa.map((r) => r.map((c) => String(c ?? "").trim()));
      setRawRows(trimmed);
      setHeaderRow(best);
      autoMap(trimmed[best] || []);
      setStep(2);
    } catch (e) { setErr("파일을 읽지 못했습니다: " + String(e)); }
  };

  const handlePaste = () => {
    setErr("");
    const lines = pasteText.replace(/\r/g, "").split("\n").filter((l) => l.trim() !== "");
    if (!lines.length) { setErr("붙여넣은 내용이 없습니다."); return; }
    const sep = lines[0].includes("\t") ? "\t" : ",";
    const aoa = lines.map((l) => l.split(sep).map((c) => c.trim()));
    setRawRows(aoa);
    setHeaderRow(0);
    autoMap(aoa[0] || []);
    setStep(2);
  };

  // ── 2단계 → 3단계: 매핑 적용 ──
  const applyMapping = () => {
    const dataRows = rawRows.slice(headerRow + 1).filter((r) => r.some((c) => String(c).trim()));
    const out: Row[] = dataRows.map((r, idx) => {
      const data: Record<string, string> = {};
      FIELDS.forEach((f) => {
        const ci = mapping[f.key];
        let v = ci != null && ci >= 0 ? String(r[ci] ?? "").trim() : "";
        if (f.type === "ssn6") v = toSSN6(v);
        else if (f.type === "date") v = toDate(v);
        else if (f.type === "number") v = String(parseNum(v) || "");
        else if (f.type === "bool") v = toBool(v) ? "Y" : "";
        data[f.key] = v;
      });
      return { key: idx, data };
    });
    setRows(out);
    setStep(3);
  };

  // ── 행 상태 계산 ──
  const seenIds = useMemo(() => {
    const m: Record<string, number> = {};
    rows.forEach((r) => { const id = idOf(r.data); m[id] = (m[id] || 0) + 1; });
    return m;
  }, [rows]);

  const rowInfo = (r: Row): { id: string; status: RowStatus; msg: string } => {
    const id = idOf(r.data);
    // 필수값
    for (const f of FIELDS) if (f.required && !r.data[f.key]) return { id, status: "error", msg: `${f.label} 누락` };
    if (entity === "model" && !/^\d{6}$/.test(r.data.ssn6 || "")) return { id, status: "error", msg: "주민 앞6자리 형식" };
    if (r.data.biz_no) { const bn = r.data.biz_no.replace(/[^0-9]/g, ""); if (bn && !validateBizNo(bn)) return { id, status: "error", msg: "사업자번호 오류" }; }
    const dupExisting = existingKeys.has(id);
    const dupInFile = (seenIds[id] || 0) > 1;
    if (dupExisting) return { id, status: "dup", msg: "기존 등록됨" };
    if (dupInFile) return { id, status: "dup", msg: "파일 내 중복" };
    return { id, status: "new", msg: "신규" };
  };

  // rows 변경 시 include 재계산 (신규는 자동 체크, 오류는 해제)
  const recomputeInclude = (rs: Row[]) => {
    const next = new Set<number>();
    rs.forEach((r) => {
      const { status } = rowInfoFor(r, rs);
      if (status === "new") next.add(r.key);
      else if (status === "dup" && overwrite) next.add(r.key);
    });
    setInclude(next);
  };
  // seenIds 의존 없이 즉시 계산용
  const rowInfoFor = (r: Row, rs: Row[]) => {
    const id = idOf(r.data);
    for (const f of FIELDS) if (f.required && !r.data[f.key]) return { id, status: "error" as RowStatus };
    if (entity === "model" && !/^\d{6}$/.test(r.data.ssn6 || "")) return { id, status: "error" as RowStatus };
    if (r.data.biz_no) { const bn = r.data.biz_no.replace(/[^0-9]/g, ""); if (bn && !validateBizNo(bn)) return { id, status: "error" as RowStatus }; }
    const cnt = rs.filter((x) => idOf(x.data) === id).length;
    if (existingKeys.has(id) || cnt > 1) return { id, status: "dup" as RowStatus };
    return { id, status: "new" as RowStatus };
  };

  // step 3 진입 시 / 덮어쓰기 토글 시 include 초기화
  const goPreview = () => { applyMapping(); };
  useEffect(() => { if (step === 3) recomputeInclude(rows); /* eslint-disable-next-line */ }, [step, rows.length, overwrite]);

  const editCell = (key: number, field: string, val: string) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, data: { ...r.data, [field]: val } } : r)));
  };

  const counts = useMemo(() => {
    let n = 0, d = 0, e = 0;
    rows.forEach((r) => { const s = rowInfo(r).status; if (s === "new") n++; else if (s === "dup") d++; else e++; });
    return { n, d, e };
  }, [rows, overwrite, seenIds]);

  const includedCount = useMemo(() => rows.filter((r) => include.has(r.key) && rowInfo(r).status !== "error").length, [rows, include, seenIds]);

  const handleSave = async () => {
    setErr("");
    const items = rows
      .filter((r) => include.has(r.key))
      .map((r) => ({ r, info: rowInfo(r) }))
      .filter((x) => x.info.status !== "error")
      .map((x) => {
        const record: Record<string, any> = {};
        FIELDS.forEach((f) => {
          let v: any = x.r.data[f.key] ?? "";
          if (f.type === "number") v = parseNum(v) || (f.key === "commission" ? 15 : 0);
          else if (f.type === "bool") v = toBool(v);
          else if (f.key === "instagram_url") v = normalizeInstagram(v);
          else if (f.key === "biz_no") v = v.replace(/[^0-9]/g, "");
          record[f.key] = v;
        });
        if (entity === "model") {
          record.ssn6 = toSSN6(record.ssn6);
          if (!record.is_foreigner) { record.visa_entry = null; record.visa_exit = null; }
          else { record.visa_entry = record.visa_entry || null; record.visa_exit = record.visa_exit || null; }
          if (record.commission === "" || record.commission == null) record.commission = 15;
          // 성별 표준화: 남/M → "M", 여/F → "F" (규칙 ID 발급에 사용)
          const g = String(record.gender || "");
          record.gender = /여|f|female/i.test(g) ? "F" : /남|m|male/i.test(g) ? "M" : "";
        }
        const key = x.info.id; // idOf = 자연키(이름+주민/전화)
        const isDup = existingKeys.has(key);
        const mode: "insert" | "update" = isDup && overwrite ? "update" : "insert";
        // 업데이트는 기존 레코드의 실제 id, 신규는 빈값(부모가 규칙 ID 발급)
        const realId = mode === "update" ? (existingKeys.get(key) as string) : "";
        return { id: realId, mode, record };
      });
    if (!items.length) { setErr("저장할 항목이 없습니다. 체크된 행을 확인하세요."); return; }
    setLoading(true);
    try {
      const res = await onCommit(items);
      alert(`완료: 신규 ${res.inserted}건${res.updated ? `, 수정 ${res.updated}건` : ""} 저장되었습니다.`);
      onClose();
    } catch (e) { setErr("저장 실패: " + String(e)); }
    finally { setLoading(false); }
  };

  const stColor = (s: RowStatus) => (s === "new" ? C.green : s === "dup" ? C.yellow : C.red);
  const stLabel = (s: RowStatus) => (s === "new" ? "신규" : s === "dup" ? "중복" : "오류");

  return (
    <Modal onClose={onClose} maxW={step === 3 ? 960 : 560}>
      <h3 style={{ marginTop: 0, color: C.text }}><Icon size={17} style={{ verticalAlign: -2 }} /> {title} <span style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>({step}/3 단계)</span></h3>

      {/* ───── 1단계: 업로드 ───── */}
      {step === 1 && (
        <div>
          <p style={{ fontSize: 13, color: C.textSub, marginTop: 4 }}>
            기존에 쓰시던 엑셀(.xlsx) 또는 CSV 파일을 올리면, Modiq 입력 항목에 자동으로 맞춰 드립니다. 컬럼 이름이 달라도 다음 단계에서 직접 연결·수정할 수 있습니다.
          </p>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
          <button onClick={() => fileRef.current?.click()} style={{ ...btnS(C.blue), width: "100%", padding: "14px", fontSize: 14, marginBottom: 14 }}>
            📁 엑셀 / CSV 파일 선택
          </button>
          <p style={{ fontSize: 12, color: C.muted, textAlign: "center", margin: "0 0 8px" }}>또는 엑셀·구글시트에서 복사한 표를 붙여넣기</p>
          <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder={"첫 줄은 머리글(예: 이름  전화  이메일)\n홍길동\t010-1234-5678\thong@x.com"}
            style={{ ...inp, height: 90, resize: "vertical", fontFamily: "monospace" }} />
          <button onClick={handlePaste} disabled={!pasteText.trim()} style={{ ...btnS(C.purple, !pasteText.trim()), width: "100%" }}>붙여넣기 내용 불러오기</button>
          {err && <p style={{ color: C.red, fontSize: 12, marginTop: 10 }}><AlertTriangle size={12} style={{ verticalAlign: -2 }} /> {err}</p>}
        </div>
      )}

      {/* ───── 2단계: 컬럼 매핑 ───── */}
      {step === 2 && (
        <div>
          <p style={{ fontSize: 13, color: C.textSub, marginTop: 4 }}>업로드한 파일의 컬럼을 Modiq 항목에 연결하세요. 자동으로 추정해 두었으니 틀린 부분만 바꾸시면 됩니다.</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: C.muted }}>머리글(컬럼명) 행:</label>
            <select value={headerRow} style={{ ...inp, marginBottom: 0, width: "auto", padding: "6px 10px" }}
              onChange={(e) => { const h = Number(e.target.value); setHeaderRow(h); autoMap(rawRows[h] || []); }}>
              {rawRows.slice(0, 6).map((r, i) => <option key={i} value={i}>{i + 1}행: {r.slice(0, 4).join(" / ").slice(0, 30) || "(빈 행)"}</option>)}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "minmax(0,1fr)" : "minmax(0,1fr) minmax(0,1fr)", gap: 10, maxHeight: "50vh", overflowY: "auto" }}>
            {FIELDS.map((f) => (
              <div key={f.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: f.required ? C.text : C.muted, minWidth: 92, fontWeight: f.required ? 700 : 500 }}>{f.label}{f.required && " *"}</span>
                <select value={mapping[f.key] ?? -1} onChange={(e) => setMapping({ ...mapping, [f.key]: Number(e.target.value) })}
                  style={{ ...inp, marginBottom: 0, flex: 1, padding: "6px 8px", fontSize: 12 }}>
                  <option value={-1}>— 없음 —</option>
                  {headers.map((h, i) => <option key={i} value={i}>{h || `(${i + 1}열)`}</option>)}
                </select>
              </div>
            ))}
          </div>
          {(() => {
            const missing = FIELDS.filter((f) => f.required && (mapping[f.key] ?? -1) < 0);
            return missing.length > 0 ? <p style={{ color: C.orange, fontSize: 12, marginTop: 10 }}><AlertTriangle size={12} style={{ verticalAlign: -2 }} /> 필수 항목 미연결: {missing.map((f) => f.label).join(", ")}</p> : null;
          })()}
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button onClick={() => setStep(1)} style={{ ...btnS("#333"), flex: 1 }}>← 뒤로</button>
            <button onClick={goPreview} disabled={FIELDS.some((f) => f.required && (mapping[f.key] ?? -1) < 0)}
              style={{ ...btnS(C.blue, FIELDS.some((f) => f.required && (mapping[f.key] ?? -1) < 0)), flex: 2 }}>미리보기 →</button>
          </div>
          {err && <p style={{ color: C.red, fontSize: 12, marginTop: 10 }}>{err}</p>}
        </div>
      )}

      {/* ───── 3단계: 미리보기·검토 ───── */}
      {step === 3 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10, fontSize: 12 }}>
            <span style={{ color: C.green, fontWeight: 700 }}>● 신규 {counts.n}</span>
            <span style={{ color: C.yellow, fontWeight: 700 }}>● 중복 {counts.d}</span>
            <span style={{ color: C.red, fontWeight: 700 }}>● 오류 {counts.e}</span>
            <label style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, color: C.textSub, cursor: "pointer" }}>
              <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} /> 중복 항목 덮어쓰기(수정)
            </label>
          </div>
          <p style={{ fontSize: 11, color: C.muted, margin: "0 0 8px" }}>셀을 클릭해 직접 수정할 수 있습니다. 빨강(오류) 행은 수정 전까지 저장에서 제외됩니다.</p>
          <div style={{ overflowX: "auto", maxHeight: "52vh", overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 8 }}>
            <table style={{ borderCollapse: "collapse", fontSize: 12, whiteSpace: "nowrap" }}>
              <thead>
                <tr style={{ background: C.card2, position: "sticky", top: 0, zIndex: 1 }}>
                  <th style={{ padding: "6px 8px", borderBottom: `1px solid ${C.border}` }}>
                    <input type="checkbox"
                      checked={includedCount > 0 && includedCount === rows.filter((r) => rowInfo(r).status !== "error").length}
                      onChange={(e) => {
                        if (e.target.checked) setInclude(new Set(rows.filter((r) => rowInfo(r).status !== "error" && (overwrite || rowInfo(r).status !== "dup")).map((r) => r.key)));
                        else setInclude(new Set());
                      }} />
                  </th>
                  <th style={{ padding: "6px 8px", borderBottom: `1px solid ${C.border}`, color: C.muted }}>상태</th>
                  {FIELDS.map((f) => <th key={f.key} style={{ padding: "6px 8px", borderBottom: `1px solid ${C.border}`, color: f.required ? C.text : C.muted, textAlign: "left" }}>{f.label}{f.required && " *"}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const info = rowInfo(r);
                  const disabled = info.status === "error";
                  return (
                    <tr key={r.key} style={{ background: disabled ? C.red + "12" : info.status === "dup" ? C.yellow + "0e" : "transparent" }}>
                      <td style={{ padding: "3px 8px", borderBottom: `1px solid ${C.border}`, textAlign: "center" }}>
                        <input type="checkbox" disabled={disabled} checked={include.has(r.key)}
                          onChange={(e) => setInclude((s) => { const n = new Set(s); if (e.target.checked) n.add(r.key); else n.delete(r.key); return n; })} />
                      </td>
                      <td style={{ padding: "3px 8px", borderBottom: `1px solid ${C.border}` }}>
                        <span title={info.msg} style={{ color: stColor(info.status), fontWeight: 700, fontSize: 11 }}>{stLabel(info.status)}</span>
                      </td>
                      {FIELDS.map((f) => (
                        <td key={f.key} style={{ padding: 0, borderBottom: `1px solid ${C.border}`, borderLeft: `1px solid ${C.border}` }}>
                          {f.options ? (
                            <select value={r.data[f.key] || ""} onChange={(e) => editCell(r.key, f.key, e.target.value)}
                              style={{ border: "none", background: "transparent", color: C.text, fontSize: 12, padding: "5px 6px", minWidth: 80 }}>
                              <option value="">-</option>
                              {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                            </select>
                          ) : (
                            <input value={r.data[f.key] || ""} onChange={(e) => editCell(r.key, f.key, e.target.value)}
                              style={{ border: "none", background: "transparent", color: f.required && !r.data[f.key] ? C.red : C.text, fontSize: 12, padding: "5px 6px", width: f.key === "memo" || f.key === "name" ? 120 : 90, minWidth: 60 }} />
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {err && <p style={{ color: C.red, fontSize: 12, marginTop: 10 }}><AlertTriangle size={12} style={{ verticalAlign: -2 }} /> {err}</p>}
          <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center" }}>
            <button onClick={() => setStep(2)} style={{ ...btnS("#333") }}>← 매핑 수정</button>
            <span style={{ fontSize: 12, color: C.textSub, marginLeft: "auto" }}>선택 {includedCount}건 저장 예정</span>
            <button onClick={handleSave} disabled={loading || includedCount === 0} style={{ ...btnS(C.green, loading || includedCount === 0) }}>{loading ? "저장 중…" : `${includedCount}건 저장`}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
