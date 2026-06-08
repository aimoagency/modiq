import { useState, useEffect, useMemo } from "react";

// ── 프리텐다드 폰트 로드 ──────────────────────────────────────
(()=>{
  if (!document.getElementById("pretendard-font")) {
    const link = document.createElement("link");
    link.id = "pretendard-font";
    link.rel = "stylesheet";
    link.href = "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css";
    document.head.appendChild(link);
  }
  const style = document.getElementById("pretendard-global") || document.createElement("style");
  style.id = "pretendard-global";
  style.textContent = `*, *::before, *::after { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', sans-serif !important; }`;
  if (!document.getElementById("pretendard-global")) document.head.appendChild(style);
})();

const APP_VERSION = "0.7.6";
const SUPABASE_URL = "https://fijtpyrmqzjefucsqfos.supabase.co";
const SUPABASE_KEY = "sb_publishable_jx5epW3SB77-naKWZeUYnA_v5xoAgbU";

const sb = async (table: string, method = "GET", body: any = null, query = ""): Promise<any> => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: method === "POST" || method === "PATCH" ? "return=representation" : "",
    },
    body: body ? JSON.stringify(body) : null,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text);
  return text ? JSON.parse(text) : [];
};

const sbAuth = async (endpoint: string, body: any): Promise<any> => {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${endpoint}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || data.message || "인증 오류");
  return data;
};

// ── 유틸 ──────────────────────────────────────────────────────
const fmt     = (n: number) => Number(n || 0).toLocaleString("ko-KR") + "원";
const fmtNum  = (n: any) => Number(String(n).replace(/,/g,"") || 0).toLocaleString("ko-KR");
const parseNum= (s: string) => Number(String(s).replace(/,/g,"")) || 0;
const pad     = (n: number) => String(n).padStart(2, "0");
const fmtDate = (d: string) => d ? d.replace(/-/g, ".") : "-";

// HH:MM 24h → 오전/오후 표시
const fmt12 = (hhmm: string) => {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h < 12 ? "오전" : "오후";
  let h12 = h % 12; if (h12 === 0) h12 = 12;
  return `${ampm} ${h12}:${pad(m)}`;
};
const fmtTime = (s: string, e: string) => s && e ? `${fmt12(s)} ~ ${fmt12(e)}` : s ? fmt12(s) : "-";

// 오전/오후 + h12 + min → HH:MM 24h
const toHHMM = (ampm: string, h: number, m: number): string => {
  let h24 = h % 12;
  if (ampm === "오후") h24 += 12;
  return `${pad(h24)}:${pad(m)}`;
};

// HH:MM → {ampm, h12, m}
const parseHHMM = (hhmm: string) => {
  if (!hhmm) return { ampm: "오전", h12: 9, m: 0 };
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h < 12 ? "오전" : "오후";
  let h12 = h % 12; if (h12 === 0) h12 = 12;
  return { ampm, h12, m };
};

const toMin = (t: string) => { if (!t) return null; const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const scheduleConflict = (aS: string, aE: string, bS: string, bE: string) => {
  // 시간 중 하나라도 없으면 충돌 불판단 (시간 미입력 허용)
  if (!aS||!aE||!bS||!bE) return { conflict: false, reason: "" };
  const as = toMin(aS), ae = toMin(aE), bs = toMin(bS), be = toMin(bE);
  if (as===null||ae===null||bs===null||be===null) return { conflict: false, reason: "" };
  if (as < be && bs < ae) return { conflict: true, reason: "시간대 겹침" };
  const gap = as >= be ? as - be : bs - ae;
  if (gap < 180) return { conflict: true, reason: `간격 ${Math.floor(gap/60)}h ${gap%60}m (3h 미만)` };
  return { conflict: false, reason: "" };
};

const visaViolation = (model: any, date: string) => {
  if (!model?.is_foreigner || !date) return null;
  const { visa_entry: en, visa_exit: ex, name } = model;
  if (!en || !ex) return `${name}: 비자 입출국일 미등록`;
  if (date < en) return `촬영일(${date})이 입국일(${en}) 이전`;
  if (date > ex) return `촬영일(${date})이 출국일(${ex}) 이후`;
  return null;
};

const makeModelId  = (name: string, ssn6: string) => `M_${name}_${ssn6}`;
const makeClientId = (name: string, phone4: string) => `C_${name}_${phone4}`;

// 인스타그램 URL/아이디 정규화
// @username, username, https://instagram.com/username 모두 인식
const normalizeInstagram = (val: string): string => {
  if (!val.trim()) return "";
  const v = val.trim();
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  const handle = v.startsWith("@") ? v.slice(1) : v;
  return `https://www.instagram.com/${handle}`;
};

// 비자 D-day 계산
const visaDday = (exitDate: string): string => {
  if (!exitDate) return "";
  const diff = Math.ceil((new Date(exitDate).getTime() - new Date().getTime()) / (1000*60*60*24));
  if (diff < 0) return "만료";
  return `D-${diff}`;
};

const getTrialDaysLeft = (trialEndsAt: string | null) => {
  if (!trialEndsAt) return null;
  const diff = new Date(trialEndsAt).getTime() - new Date().getTime();
  return Math.ceil(diff / (1000*60*60*24));
};

// ── 요금제 ─────────────────────────────────────────────────────
const PLAN_FEATURES: Record<string, { baseMembers: number; additionalPrice: number; alimtalk: boolean }> = {
  trial:    { baseMembers: 1,  additionalPrice: 0,     alimtalk: false },
  starter:  { baseMembers: 2,  additionalPrice: 20000, alimtalk: false },
  standard: { baseMembers: 5,  additionalPrice: 15000, alimtalk: true  },
  pro:      { baseMembers: 10, additionalPrice: 15000, alimtalk: true  },
};
const PLANS = [
  { id:"starter",  name:"Starter",  price:79000,  priceYearly:57000,  storage:"10GB",  color:"#4A90D9", popular:false,
    features:["모델 등록 무제한","고객사 등록 무제한","섭외 관리 무제한","기본 담당자 2명","스토리지 10GB","정산 관리","일정 충돌 감지"] },
  { id:"standard", name:"Standard", price:149000, priceYearly:107000, storage:"50GB",  color:"#7B68EE", popular:true,
    features:["Starter 모든 기능","기본 담당자 5명","스토리지 50GB","카카오 알림톡 포함","프로젝트별 정산","월별/담당자별 리포트","우선 고객 지원"] },
  { id:"pro",      name:"Pro",      price:249000, priceYearly:179000, storage:"200GB", color:"#2ECC71", popular:false,
    features:["Standard 모든 기능","기본 담당자 10명","스토리지 200GB","자체 카카오 채널","외국인 모델 비자 관리","전담 고객 매니저","API 연동 지원"] },
];
const getTotalMemberLimit = (plan: string, extra = 0) => (PLAN_FEATURES[plan]?.baseMembers || 1) + extra;

// ── 상수 ──────────────────────────────────────────────────────
const MODEL_CATEGORIES = ["여성","남성","시니어","키즈","플러스사이즈","기타"];
const CLIENT_INDUSTRIES = ["광고대행사","마케팅에이전시","프로덕션","패션브랜드","뷰티","홈쇼핑","매거진/미디어","온라인플랫폼","웨딩/이벤트","브랜드(종합)","기타"];
const SHOOT_TYPES_PHOTO = ["광고사진","화보","카탈로그","SNS콘텐츠","룩북","제품사진"];
const SHOOT_TYPES_VIDEO = ["CF/TVC","바이럴영상","SNS영상","홈쇼핑","유튜브","브랜드필름"];
const USAGE_SCOPES = ["온라인","스폰서애드","잡지","옥외광고","인쇄물","홈쇼핑","TVC"];
const USAGE_PERIODS = ["6개월","12개월","18개월","24개월","기타"];
const HOURS = [1,2,3,4,5,6,7,8,9,10,11,12];
const MINS  = [0,10,20,30,40,50];

// ── 섭외 상태 ────────────────────────────────────────────────────
const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  INQUIRY:   { label:"문의접수",   color:"#378ADD", bg:"#1a2f4a" },
  PROPOSED:  { label:"모델제안",   color:"#9B8FE8", bg:"#2a2550" },
  SELECTING: { label:"선택대기",   color:"#E8A020", bg:"#3a2a00" },
  CHECKING:  { label:"스케줄확인", color:"#E8A020", bg:"#3a2a00" },
  HOLD:      { label:"HOLD",      color:"#E88030", bg:"#3a1a00" },
  CONFIRMED: { label:"섭외확정",   color:"#2ECC71", bg:"#1a3a20" },
  COMPLETED: { label:"촬영완료",   color:"#52D48A", bg:"#1a3a20" },
  SETTLED:   { label:"정산완료",   color:"#52D48A", bg:"#1a4a20" },
  CANCELLED: { label:"취소",       color:"#E85050", bg:"#3a1a1a" },
};

// ── 섭외 타입 ──────────────────────────────────────────────────────
const BOOKING_TYPES: Record<string, { label: string; icon: string; color: string; hasContract: boolean }> = {
  SHOOT:    { label:"촬영",      icon:"📷", color:"#3b82f6", hasContract:true  },
  MEETING:  { label:"실물 미팅", icon:"🤝", color:"#8b5cf6", hasContract:false },
  FITTING:  { label:"피팅",      icon:"👗", color:"#ec4899", hasContract:false },
  AUDITION: { label:"오디션",    icon:"🎬", color:"#f59e0b", hasContract:false },
};

// ── 색상 팔레트 ────────────────────────────────────────────────
const C = {
  sidebar:"#111318", sideHover:"#1e2128", sideActive:"#1d4ed8",
  bg:"#0f1117", card:"#1a1d27", card2:"#22263a", border:"#2a2d3e",
  text:"#ffffff", textSub:"#c8ccd8", muted:"#6b7280",
  blue:"#3b82f6", purple:"#8b5cf6", green:"#10b981",
  red:"#ef4444", yellow:"#f59e0b", orange:"#f97316",
};

const inp: React.CSSProperties = {
  width:"100%", padding:"9px 12px", background:"#22263a",
  border:`1px solid ${C.border}`, borderRadius:6, color:C.text,
  fontSize:13, boxSizing:"border-box" as const, marginBottom:10,
};
const btnS = (bg: string, disabled=false): React.CSSProperties => ({
  padding:"6px 12px", background:disabled?"#333":bg,
  color:disabled?C.muted:"white", border:"none", borderRadius:6,
  cursor:disabled?"not-allowed":"pointer", fontWeight:600, fontSize:12, opacity:disabled?0.7:1,
});

function Badge({ code }: { code: string }) {
  const s = STATUS[code] || STATUS.INQUIRY;
  return <span style={{ background:s.bg, color:s.color, border:`1px solid ${s.color}50`, borderRadius:6, padding:"3px 10px", fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>{s.label}</span>;
}

function Modal({ onClose, children, wide=false }: { onClose:()=>void; children:React.ReactNode; wide?:boolean }) {
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", justifyContent:"center", alignItems:"center", zIndex:1000 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:24, width:"92%", maxWidth:wide?680:480, maxHeight:"90vh", overflowY:"auto" }}>
        {children}
      </div>
    </div>
  );
}

// ── 시간 선택기 (가로 소형) ────────────────────────────────────
function TimePicker({ label, value, onChange }: { label:string; value:string; onChange:(v:string)=>void }) {
  const parsed = parseHHMM(value);
  const [ampm, setAmpm] = useState(parsed.ampm);
  const [h12,  setH12]  = useState(parsed.h12);
  const [m,    setM]    = useState(parsed.m);

  useEffect(() => { onChange(toHHMM(ampm, h12, m)); }, [ampm, h12, m]);

  const sel: React.CSSProperties = { background:"#22263a", border:`1px solid ${C.border}`, borderRadius:5, color:C.text, fontSize:12, padding:"4px 3px", cursor:"pointer" };
  const ap = (val: string): React.CSSProperties => ({ padding:"4px 7px", border:`1px solid ${val===ampm?C.blue:C.border}`, borderRadius:5, cursor:"pointer", fontSize:11, fontWeight:700, background:val===ampm?C.blue+"22":"#22263a", color:val===ampm?C.blue:C.muted });

  return (
    <div>
      <label style={{ fontSize:10, color:C.muted, display:"block", marginBottom:3 }}>{label}</label>
      <div style={{ display:"flex", alignItems:"center", gap:4 }}>
        <button type="button" onClick={()=>setAmpm("오전")} style={ap("오전")}>오전</button>
        <button type="button" onClick={()=>setAmpm("오후")} style={ap("오후")}>오후</button>
        <select value={h12} onChange={e=>setH12(Number(e.target.value))} style={{ ...sel, width:44 }}>
          {HOURS.map(h=><option key={h} value={h}>{h}</option>)}
        </select>
        <span style={{ color:C.muted, fontSize:11 }}>:</span>
        <select value={m} onChange={e=>setM(Number(e.target.value))} style={{ ...sel, width:48 }}>
          {MINS.map(mn=><option key={mn} value={mn}>{pad(mn)}</option>)}
        </select>
        
      </div>
    </div>
  );
}

// ── 멀티 체크박스 ─────────────────────────────────────────────
function MultiCheck({ label, options, value, onChange }: { label:string; options:string[]; value:string[]; onChange:(v:string[])=>void }) {
  const toggle = (opt: string) => {
    const next = value.includes(opt) ? value.filter(v=>v!==opt) : [...value, opt];
    onChange(next);
  };
  return (
    <div style={{ marginBottom:10 }}>
      <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:6 }}>{label}</label>
      <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
        {options.map(opt=>(
          <button key={opt} type="button" onClick={()=>toggle(opt)} style={{
            padding:"5px 12px", border:`1px solid ${value.includes(opt)?C.blue:C.border}`,
            borderRadius:20, fontSize:12, cursor:"pointer", transition:"all 0.15s",
            background: value.includes(opt) ? C.blue+"22" : "#22263a",
            color: value.includes(opt) ? C.blue : C.textSub,
            fontWeight: value.includes(opt) ? 700 : 400,
          }}>{opt}</button>
        ))}
      </div>
    </div>
  );
}

// ── 금액 입력 ─────────────────────────────────────────────────
function MoneyInput({ label, value, onChange, placeholder="0" }: { label:string; value:number; onChange:(v:number)=>void; placeholder?:string }) {
  return (
    <div style={{ marginBottom:10 }}>
      <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>{label}</label>
      <div style={{ position:"relative" }}>
        <input
          type="text"
          value={value ? fmtNum(value) : ""}
          onChange={e=>onChange(parseNum(e.target.value))}
          placeholder={placeholder}
          style={{ ...inp, marginBottom:0, paddingRight:28 }}
        />
        <span style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", color:C.muted, fontSize:12 }}>원</span>
      </div>
    </div>
  );
}

const SESSION_KEY = "modiq_session_v6";
type AuthMode = "login"|"signup";
type Page = "dashboard"|"bookings"|"models"|"customers"|"settlement"|"members"|"plan"|"calendar";

// ── 캘린더 컴포넌트 ────────────────────────────────────────────
function CalendarView({ bookings, models, customers, onSelectBooking, onAddBooking, initModelId = "" }: {
  bookings: any[]; models: any[]; customers: any[];
  onSelectBooking: (b: any) => void;
  onAddBooking: (preModel?: string, preDate?: string) => void;
  initModelId?: string;
}) {
  const today = new Date();
  const [calYear,    setCalYear]    = useState(today.getFullYear());
  const [calMonth,   setCalMonth]   = useState(today.getMonth());
  const [selDate,    setSelDate]    = useState<string|null>(null);
  const [modelFilter,setModelFilter]= useState(initModelId); // 모델 필터

  const firstDay    = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
  const prevDays    = new Date(calYear, calMonth, 0).getDate();
  const monthStr    = `${calYear}-${String(calMonth+1).padStart(2,"0")}`;
  const todayStr    = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;

  // 필터 적용된 섭외
  const filteredBookings = modelFilter ? bookings.filter(b=>b.model_id===modelFilter) : bookings;

  const bookingsByDate: Record<string, any[]> = {};
  filteredBookings.forEach(b=>{ if(b.shoot_date){ if(!bookingsByDate[b.shoot_date]) bookingsByDate[b.shoot_date]=[]; bookingsByDate[b.shoot_date].push(b); }});

  const selDateBookings = selDate ? (bookingsByDate[selDate]||[]) : [];

  const prevMonth = () => { if(calMonth===0){setCalYear(y=>y-1);setCalMonth(11);}else{setCalMonth(m=>m-1);}; setSelDate(null); };
  const nextMonth = () => { if(calMonth===11){setCalYear(y=>y+1);setCalMonth(0);}else{setCalMonth(m=>m+1);}; setSelDate(null); };

  const cells: { date:string|null; day:number; cur:boolean }[] = [];
  for(let i=0;i<firstDay;i++) cells.push({ date:null, day:prevDays-firstDay+i+1, cur:false });
  for(let d=1;d<=daysInMonth;d++){
    const ds=`${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    cells.push({ date:ds, day:d, cur:true });
  }
  let nd=1; while(cells.length<42) cells.push({ date:null, day:nd++, cur:false });

  const DOW = ["일","월","화","수","목","금","토"];

  // 비자 범위 계산 (모델 필터 시)
  const filteredModel = modelFilter ? models.find(m=>m.id===modelFilter) : null;
  const visaEntry = filteredModel?.visa_entry || null;
  const visaExit  = filteredModel?.visa_exit  || null;

  // 날짜가 비자 유효 범위 밖인지
  const isOutsideVisa = (date: string) => {
    if (!filteredModel?.is_foreigner || !visaEntry || !visaExit) return false;
    return date < visaEntry || date > visaExit;
  };
  // 날짜가 비자 만료 임박(7일 이내)인지
  const isVisaExpiring = (date: string) => {
    if (!visaExit) return false;
    const diff = (new Date(visaExit).getTime() - new Date(date).getTime()) / (1000*60*60*24);
    return diff >= 0 && diff <= 7;
  };

  const filterModel = models.find(m=>m.id===modelFilter);

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:C.text }}>📅 캘린더</h1>
        <button onClick={()=>onAddBooking(modelFilter||undefined, selDate||undefined)} style={btnS(C.green)}>+ 섭외 추가</button>
      </div>

      {/* 모델 필터 */}
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14, flexWrap:"wrap" }}>
        <span style={{ fontSize:12, color:C.muted, fontWeight:600 }}>모델 필터:</span>
        <button onClick={()=>setModelFilter("")} style={{ padding:"4px 12px", borderRadius:20, border:`1px solid ${!modelFilter?C.blue:C.border}`, background:!modelFilter?C.blue+"22":"transparent", color:!modelFilter?C.blue:C.muted, fontSize:12, fontWeight:600, cursor:"pointer" }}>전체</button>
        {models.map(m=>{
          const isSel = modelFilter===m.id;
          return (
            <button key={m.id} onClick={()=>{ setModelFilter(isSel?"":m.id); setSelDate(null); }}
              style={{ display:"flex", alignItems:"center", gap:5, padding:"4px 10px", borderRadius:20, border:`1px solid ${isSel?C.blue:C.border}`, background:isSel?C.blue+"22":"transparent", color:isSel?C.blue:C.textSub, fontSize:12, fontWeight:isSel?700:400, cursor:"pointer" }}
            >
              {m.thumb_url
                ? <img src={m.thumb_url} alt="" style={{ width:16, height:16, borderRadius:"50%", objectFit:"cover" }} />
                : <span style={{ width:16, height:16, borderRadius:"50%", background:"linear-gradient(135deg,#c9a96e,#8b6a3e)", display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:9, color:"white", fontWeight:800 }}>{m.name[0]}</span>
              }
              {m.name}
              {m.is_foreigner&&<span style={{ fontSize:10 }}>✈️</span>}
            </button>
          );
        })}
      </div>

      {/* 비자 정보 배너 (외국인 모델 필터 시) */}
      {filteredModel?.is_foreigner&&visaEntry&&visaExit&&(
        <div style={{ display:"flex", gap:12, alignItems:"center", background:"#1a2f4a", border:`1px solid ${C.blue}50`, borderRadius:8, padding:"8px 14px", marginBottom:14 }}>
          <span style={{ fontSize:13 }}>✈️</span>
          <span style={{ fontSize:12, color:C.textSub }}><strong style={{ color:C.text }}>{filteredModel.name}</strong> 비자 유효 기간</span>
          <span style={{ fontSize:12, color:C.blue, fontWeight:700 }}>{visaEntry.replace(/-/g,".")} ~ {visaExit.replace(/-/g,".")}</span>
          {(()=>{
            const dday = visaDday(visaExit);
            const color = dday==="만료"?C.red:parseInt(dday.slice(2))<=7?C.orange:C.green;
            return <span style={{ marginLeft:"auto", background:color+"22", color, border:`1px solid ${color}44`, borderRadius:20, padding:"2px 10px", fontSize:11, fontWeight:700 }}>{dday}</span>;
          })()}
        </div>
      )}

      {/* 월 네비 */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
        <button onClick={prevMonth} style={{ background:C.card, border:`1px solid ${C.border}`, color:C.text, borderRadius:8, padding:"6px 13px", cursor:"pointer", fontSize:16 }}>‹</button>
        <h2 style={{ margin:0, fontSize:20, fontWeight:800, color:C.text, minWidth:140, textAlign:"center" }}>{calYear}년 {calMonth+1}월</h2>
        <button onClick={nextMonth} style={{ background:C.card, border:`1px solid ${C.border}`, color:C.text, borderRadius:8, padding:"6px 13px", cursor:"pointer", fontSize:16 }}>›</button>
        <button onClick={()=>{ setCalYear(today.getFullYear()); setCalMonth(today.getMonth()); setSelDate(todayStr); }} style={{ ...btnS(C.blue), padding:"5px 14px", fontSize:12 }}>오늘</button>
        {(()=>{ const cnt=filteredBookings.filter(b=>b.shoot_date?.startsWith(monthStr)).length; return cnt>0?<span style={{ fontSize:12, color:C.muted }}>이달 <strong style={{ color:C.text }}>{cnt}건</strong></span>:null; })()}
      </div>

      {/* 달력 */}
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden", marginBottom:selDate?16:0 }}>
        {/* 요일 헤더 */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", borderBottom:`1px solid ${C.border}` }}>
          {DOW.map((d,i)=>(
            <div key={d} style={{ padding:"9px 0", textAlign:"center", fontSize:11, fontWeight:700, color:i===0?C.red:i===6?C.blue:C.muted }}>{d}</div>
          ))}
        </div>
        {/* 날짜 셀 */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)" }}>
          {cells.map((cell,i)=>{
            const col=i%7;
            const isToday    = cell.cur&&cell.date===todayStr;
            const isSel      = cell.cur&&cell.date===selDate;
            const outsideVisa= cell.cur&&cell.date?isOutsideVisa(cell.date):false;
            const expiringV  = cell.cur&&cell.date?isVisaExpiring(cell.date):false;
            const dayBookings= cell.date?(bookingsByDate[cell.date]||[]):[];
            const isVisaExit = cell.date===visaExit;

            let cellBg = "transparent";
            if (isSel)         cellBg = C.blue+"18";
            else if (isToday)  cellBg = C.card2;
            else if (outsideVisa) cellBg = "rgba(232,80,80,0.06)";
            else if (expiringV)   cellBg = "rgba(248,159,39,0.08)";

            return (
              <div key={i} onClick={()=>{ if(cell.cur&&cell.date){ setSelDate(cell.date===selDate?null:cell.date); }}}
                style={{ minHeight:84, padding:"7px 7px 5px", borderRight:col<6?`1px solid ${C.border}`:"none", borderBottom:i<35?`1px solid ${C.border}`:"none", background:cellBg, cursor:cell.cur?"pointer":"default", transition:"background 0.12s", position:"relative" }}
                onMouseEnter={e=>{ if(cell.cur&&!isSel&&!outsideVisa) e.currentTarget.style.background=C.card2; }}
                onMouseLeave={e=>{ if(cell.cur&&!isSel) e.currentTarget.style.background=outsideVisa?"rgba(232,80,80,0.06)":expiringV?"rgba(248,159,39,0.08)":"transparent"; }}
              >
                {/* 비자 만료일 표시선 */}
                {isVisaExit&&<div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:C.red, borderRadius:"2px 2px 0 0" }} />}

                {/* 날짜 숫자 */}
                <div style={{ marginBottom:3 }}>
                  <span style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:22, height:22, borderRadius:"50%", fontSize:12, fontWeight:isToday?800:600, background:isToday?C.blue:isVisaExit?C.red+"22":"transparent", color:isToday?"white":isVisaExit?C.red:!cell.cur?C.border:col===0?C.red:col===6?C.blue:outsideVisa?C.muted:C.text }}>{cell.day}</span>
                  {isVisaExit&&<span style={{ fontSize:9, color:C.red, fontWeight:700, marginLeft:2 }}>출국</span>}
                </div>

                {/* 섭외 뱃지 */}
                <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                  {dayBookings.slice(0,2).map((b,bi)=>{
                    const m=models.find(mm=>mm.id===b.model_id);
                    const bt = BOOKING_TYPES[b.booking_type||"SHOOT"] || BOOKING_TYPES.SHOOT;
                    const s=STATUS[b.status]||STATUS.INQUIRY;
                    return (
                      <div key={bi} onClick={e=>{ e.stopPropagation(); onSelectBooking(b); }}
                        style={{ background:s.color+"28", color:s.color, border:`1px solid ${s.color}44`, borderRadius:4, padding:"2px 5px", fontSize:10, fontWeight:700, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", cursor:"pointer", display:"flex", alignItems:"center", gap:3 }}
                        title={`${bt.icon} ${m?.name||"?"} · ${bt.label} · ${s.label}`}
                      >
                        <span style={{ fontSize:9 }}>{bt.icon}</span>
                        {m?.thumb_url
                          ? <img src={m.thumb_url} alt="" style={{ width:11, height:11, borderRadius:"50%", objectFit:"cover", flexShrink:0 }} />
                          : <span style={{ fontSize:9 }}>{(m?.name||"?")[0]}</span>
                        }
                        <span style={{ overflow:"hidden", textOverflow:"ellipsis" }}>{m?.name||"?"}</span>
                      </div>
                    );
                  })}
                  {dayBookings.length>2&&(
                    <div onClick={e=>{ e.stopPropagation(); cell.date&&setSelDate(cell.date); }}
                      style={{ fontSize:10, color:C.blue, fontWeight:700, padding:"2px 5px", background:C.blue+"18", borderRadius:4, cursor:"pointer", textAlign:"center" }}>
                      +{dayBookings.length-2}건
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 선택된 날짜 섭외 목록 */}
      {selDate&&(
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:20 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <div>
              <p style={{ margin:0, fontWeight:800, fontSize:15, color:C.text }}>📋 {selDate.replace(/-/g,".")}</p>
              <p style={{ margin:"3px 0 0", fontSize:12, color:C.muted }}>
                총 <strong style={{ color:C.text }}>{selDateBookings.length}건</strong>
                {selDateBookings.filter(b=>b.status==="HOLD").length>0&&<span style={{ marginLeft:8, color:C.yellow, fontWeight:700 }}>⚠️ HOLD {selDateBookings.filter(b=>b.status==="HOLD").length}건</span>}
                {isOutsideVisa(selDate)&&filteredModel&&<span style={{ marginLeft:8, color:C.red, fontWeight:700, fontSize:11 }}>⚠️ 비자 범위 밖</span>}
              </p>
            </div>
            {/* 날짜 클릭 → 해당 모델 + 날짜 pre-선택 섭외 등록 */}
            <button onClick={()=>onAddBooking(modelFilter||undefined, selDate)}
              style={{ ...btnS(C.green), padding:"6px 14px", fontSize:12 }}>
              {modelFilter&&filterModel ? `+ ${filterModel.name} 섭외 추가` : "+ 섭외 추가"}
            </button>
          </div>

          {selDateBookings.length===0
            ? (
              <div style={{ textAlign:"center", padding:"24px 0" }}>
                <p style={{ color:C.muted, fontSize:13, margin:"0 0 12px" }}>이 날 섭외 일정이 없습니다.</p>
                {isOutsideVisa(selDate)&&filteredModel&&<p style={{ color:C.red, fontSize:12, margin:0 }}>⚠️ {filteredModel.name}의 비자 유효 기간({visaEntry?.replace(/-/g,".")} ~ {visaExit?.replace(/-/g,".")}) 밖입니다.</p>}
              </div>
            )
            : (
              <div style={{ display:"grid", gap:8 }}>
                {[...selDateBookings].sort((a,b)=>(a.start_time||"") < (b.start_time||"") ? -1:1).map((b,idx)=>{
                  const model  = models.find(m=>m.id===b.model_id);
                  const client = customers.find(c=>c.id===b.customer_id);
                  const s  = STATUS[b.status]||STATUS.INQUIRY;
                  const bt = BOOKING_TYPES[b.booking_type||"SHOOT"]||BOOKING_TYPES.SHOOT;
                  return (
                    <div key={b.id} onClick={()=>onSelectBooking(b)}
                      style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", background:C.card2, borderRadius:10, border:`1px solid ${C.border}`, cursor:"pointer", transition:"border-color 0.15s" }}
                      onMouseEnter={e=>(e.currentTarget.style.borderColor=s.color+"80")}
                      onMouseLeave={e=>(e.currentTarget.style.borderColor=C.border)}
                    >
                      <span style={{ width:22, height:22, borderRadius:"50%", background:s.color+"33", color:s.color, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, flexShrink:0 }}>{idx+1}</span>
                      {/* 타입 아이콘 */}
                      <span style={{ fontSize:16, flexShrink:0 }} title={bt.label}>{bt.icon}</span>
                      {/* 썸네일 */}
                      {model?.thumb_url
                        ? <img src={model.thumb_url} alt="" style={{ width:34, height:34, borderRadius:"50%", objectFit:"cover", flexShrink:0, border:`2px solid ${s.color}50` }} />
                        : <div style={{ width:34, height:34, borderRadius:"50%", background:"linear-gradient(135deg,#c9a96e,#8b6a3e)", display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontWeight:800, fontSize:13, flexShrink:0 }}>{(model?.name||"?")[0]}</div>
                      }
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3, flexWrap:"wrap" }}>
                          <span style={{ fontWeight:700, fontSize:13, color:C.text }}>{model?.name||"?"}</span>
                          <span style={{ fontSize:11, color:C.muted }}>→</span>
                          <span style={{ fontSize:12, color:C.textSub }}>{client?.name||"?"}</span>
                          <Badge code={b.status} />
                          <span style={{ background:bt.color+"22", color:bt.color, border:`1px solid ${bt.color}44`, borderRadius:4, padding:"1px 7px", fontSize:10, fontWeight:700 }}>{bt.icon} {bt.label}</span>
                        </div>
                        <div style={{ fontSize:11, color:C.muted, display:"flex", gap:8, flexWrap:"wrap" }}>
                          {b.start_time&&<span>🕐 {fmtTime(b.start_time,b.end_time)}</span>}
                          {b.location&&<span>📍 {b.location}</span>}
                          {b.project_name&&<span>📁 {b.project_name}</span>}
                        </div>
                      </div>
                      <div style={{ textAlign:"right", flexShrink:0 }}>
                        {b.shoot_fee>0&&<p style={{ margin:0, fontSize:13, color:"#c9a96e", fontWeight:800 }}>{b.shoot_fee.toLocaleString()}원</p>}
                        {b.status==="CONFIRMED"&&!b.deposit_paid&&<p style={{ margin:"3px 0 0", fontSize:10, color:C.red, fontWeight:700 }}>계약금 미입금</p>}
                      </div>
                      <span style={{ color:C.muted, fontSize:15 }}>›</span>
                    </div>
                  );
                })}
              </div>
            )
          }
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
export default function App() {

  const [authMode,    setAuthMode]    = useState<AuthMode>("login");
  const [session,     setSession]     = useState<any>(null);
  const [agency,      setAgency]      = useState<any>(null);
  const [myRole,      setMyRole]      = useState<"owner"|"member">("member");
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [agencyName,  setAgencyName]  = useState("");
  const [authError,   setAuthError]   = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [models,    setModels]    = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [bookings,  setBookings]  = useState<any[]>([]);
  const [projects,  setProjects]  = useState<any[]>([]);
  const [members,   setMembers]   = useState<any[]>([]);

  const [page, setPage] = useState<Page>("dashboard");
  const [calInitModel, setCalInitModel] = useState("");  // 모델 상세 → 캘린더 이동 시 pre-선택
  const [planBilling, setPlanBilling] = useState<"monthly"|"yearly">("monthly");

  // 필터
  const [modelQ,      setModelQ]      = useState("");
  const [customerQ,   setCustomerQ]   = useState("");
  const [bookingQ,    setBookingQ]    = useState("");
  const [bookingStatusF,  setBookingStatusF]  = useState("ALL");
  const [bookingManagerF, setBookingManagerF] = useState("ALL");
  const [settlementTab,     setSettlementTab]     = useState<"PENDING"|"SETTLED"|"UNPAID">("PENDING");
  const [settlementMonth,   setSettlementMonth]   = useState("ALL");
  const [settlementModel,   setSettlementModel]   = useState("ALL");
  const [settlementMgr,     setSettlementMgr]     = useState("ALL");
  const [settlementProject, setSettlementProject] = useState("ALL");

  // 모달
  const [showModelForm,    setShowModelForm]    = useState(false);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [showBookingForm,  setShowBookingForm]  = useState(false);
  const [showProjectForm,  setShowProjectForm]  = useState(false);
  const [editingBooking,   setEditingBooking]   = useState(false); // 섭외 상세 편집 모드

  // ── 프로젝트 폼 state ──
  const [pName,       setPName]       = useState("");
  const [pCustomer,   setPCustomer]   = useState("");
  const [pCustSearch, setPCustSearch] = useState("");
  const [pDate,       setPDate]       = useState("");
  const [pStart,      setPStart]      = useState("");
  const [pEnd,        setPEnd]        = useState("");
  const [pLocation,   setPLocation]   = useState("");
  const [pManager,    setPManager]    = useState("");
  const [pBookingType,setPBookingType]= useState("SHOOT");
  const [pShootTypes, setPShootTypes] = useState<string[]>([]);
  const [pUsageScope, setPUsageScope] = useState<string[]>([]);
  const [pUsagePeriod,setPUsagePeriod]= useState("");
  const [pMemo,       setPMemo]       = useState("");
  const [pStatus,     setPStatus]     = useState("INQUIRY");
  // 프로젝트 모델 라인 (모델별 개별 금액)
  const [pModelLines, setPModelLines] = useState<{modelId:string; fee:number; deposit:number; balance:number; depositDue:string; balanceDue:string; search:string}[]>([]);
  const [pModelSearch,setPModelSearch]= useState("");

  const resetProjectForm = () => {
    setPName(""); setPCustomer(""); setPCustSearch(""); setPDate(""); setPStart(""); setPEnd("");
    setPLocation(""); setPManager(""); setPBookingType("SHOOT"); setPShootTypes([]); setPUsageScope([]);
    setPUsagePeriod(""); setPMemo(""); setPStatus("INQUIRY"); setPModelLines([]); setPModelSearch("");
  };

  const addProjectModelLine = (modelId: string) => {
    if (pModelLines.find(l=>l.modelId===modelId)) return;
    setPModelLines(prev=>[...prev, { modelId, fee:0, deposit:0, balance:0, depositDue:"", balanceDue:"", search:"" }]);
    setPModelSearch("");
  };
  const removeProjectModelLine = (modelId: string) => setPModelLines(prev=>prev.filter(l=>l.modelId!==modelId));
  const updateProjectModelLine = (modelId: string, field: string, value: any) =>
    setPModelLines(prev=>prev.map(l=>l.modelId===modelId?{...l,[field]:value}:l));

  const handleAddProject = async () => {
    if (!pName)                return alert("프로젝트명 필수");
    if (!pCustomer)            return alert("고객사 필수");
    if (!pDate)                return alert("촬영 날짜 필수");
    if (pModelLines.length===0) return alert("모델 1명 이상 추가");

    const projId = `PRJ_${Date.now()}`;
    const proj = {
      id: projId, name: pName, customer_id: pCustomer, shoot_date: pDate,
      start_time: pStart, end_time: pEnd, location: pLocation, manager: pManager,
      booking_type: pBookingType, shoot_types: pShootTypes, usage_scope: pUsageScope,
      usage_period: pUsagePeriod, memo: pMemo, status: pStatus,
      model_count: pModelLines.length, agency_id: agency.id,
      created_at: new Date().toISOString(),
    };

    const newBookings: any[] = [];
    const holdWarnings: string[] = [];

    for (let i=0; i<pModelLines.length; i++) {
      const line = pModelLines[i];
      const model = models.find(m=>m.id===line.modelId);
      const visa = visaViolation(model, pDate);
      if (visa) return alert(`비자 오류 [${model?.name}]: ${visa}`);

      const conflicts = bookings.filter(b=>b.model_id===line.modelId&&b.shoot_date===pDate&&b.status!=="CANCELLED");
      let autoHold = false; let holdReason = "";
      for (const b of conflicts) {
        const c = scheduleConflict(pStart, pEnd, b.start_time, b.end_time);
        if (c.conflict) { autoHold = true; holdReason = c.reason; break; }
      }
      const finalStatus = autoHold ? "HOLD" : pStatus;
      const nb = {
        id:`B_${Date.now()}_${i}`, project_id: projId, model_id: line.modelId,
        customer_id: pCustomer, booking_type: pBookingType, shoot_date: pDate,
        start_time: pStart, end_time: pEnd, manager: pManager, status: finalStatus,
        project_name: pName, location: pLocation, shoot_types: pShootTypes,
        usage_scope: pUsageScope, usage_period: pUsagePeriod,
        shoot_fee: line.fee, deposit_amt: line.deposit, deposit_due: line.depositDue,
        balance_amt: line.balance, balance_due: line.balanceDue,
        memo: pMemo, commission_rate: 15, is_paid: false, settlement_memo: "",
        messages: [], agency_id: agency.id,
      };
      newBookings.push(nb);
      if (autoHold) holdWarnings.push(`${model?.name}: ${holdReason}`);
    }

    try {
      await sb("projects","POST",proj);
      for (const nb of newBookings) await sb("bookings","POST",nb);
      setProjects(prev=>[proj,...prev]);
      setBookings(prev=>[...newBookings,...prev]);
      resetProjectForm(); setShowProjectForm(false);
      if (holdWarnings.length>0) alert(`⚠️ HOLD 처리된 모델\n${holdWarnings.join("\n")}`);
      else alert(`✅ 프로젝트 등록 완료 — 모델 ${newBookings.length}명`);
    } catch(e) { alert("프로젝트 추가 실패: "+String(e)); }
  };
  const [showMemberForm,   setShowMemberForm]   = useState(false);
  const [selectedBooking,    setSelectedBooking]    = useState<any>(null);
  const [selectedModel,      setSelectedModel]      = useState<any>(null);
  const [selectedCustomer,   setSelectedCustomer]   = useState<any>(null); // 고객사 상세
  const [selectedSettlement, setSelectedSettlement] = useState<any>(null);
  const [mEditMode, setMEditMode] = useState(false);
  const [cEditMode, setCEditMode] = useState(false); // 고객사 수정 모드

  // 섭외 추가 - 검색
  const [bModelSearch,    setBModelSearch]    = useState("");
  const [bCustomerSearch, setBCustomerSearch] = useState("");

  // ── 모델 폼 ──
  const [mName,      setMName]      = useState("");
  const [mSSN,       setMSSN]       = useState("");
  const [mPhone,     setMPhone]     = useState("");
  const [mEmail,     setMEmail]     = useState("");
  const [mCategory,  setMCategory]  = useState("");
  const [mRate,      setMRate]      = useState(0);
  const [mCommission,setMCommission]= useState(15);
  const [mForeigner,   setMForeigner]   = useState(false);
  const [mEntry,       setMEntry]       = useState("");
  const [mExit,        setMExit]        = useState("");
  const [mInstagram,   setMInstagram]   = useState("");
  const [mDrive,       setMDrive]       = useState("");
  const [mKakao,       setMKakao]       = useState("");
  const [mBank,        setMBank]        = useState("");
  const [mThumb,       setMThumb]       = useState("");
  const [mAimoUrl,     setMAimoUrl]     = useState("");
  const [mMemo,        setMMemo]        = useState("");

  // ── 고객사 폼 ──
  const [cName,       setCName]       = useState("");
  const [cBrand,      setCBrand]      = useState("");
  const [cManager,    setCManager]    = useState("");
  const [cPhone,      setCPhone]      = useState("");
  const [cEmail,      setCEmail]      = useState("");
  const [cIndustry,   setCIndustry]   = useState("");
  const [cMemo,       setCMemo]       = useState("");

  // ── 섭외 폼 ──
  const [bModel,        setBModel]        = useState("");
  const [bModels,       setBModels]       = useState<string[]>([]);  // 다중 모델
  const [bBookingType,  setBBookingType]  = useState("SHOOT");
  const [bCustomer,     setBCustomer]     = useState("");
  const [bDate,         setBDate]         = useState("");
  const [bStart,        setBStart]        = useState("");
  const [bEnd,          setBEnd]          = useState("");
  const [bManager,      setBManager]      = useState("");
  const [bStatus,       setBStatus]       = useState("INQUIRY");
  const [bProject,    setBProject]    = useState("");
  const [bLocation,   setBLocation]   = useState("");
  const [bShootTypes, setBShootTypes] = useState<string[]>([]);
  const [bUsageScope, setBUsageScope] = useState<string[]>([]);
  const [bUsagePeriod,setBUsagePeriod]= useState("");
  const [bBudget,       setBBudget]       = useState(0);
  const [bDeposit,      setBDeposit]      = useState(0);
  const [bDepositDue,   setBDepositDue]   = useState("");
  const [bBalance,      setBBalance]      = useState(0);
  const [bBalanceDue,   setBBalanceDue]   = useState("");
  const [bResultDrive,  setBResultDrive]  = useState("");
  const [bMemo,         setBMemo]         = useState("");

  // ── 섭외 메시지 ──
  const [bMsgText,      setBMsgText]      = useState("");

  // ── 담당자 폼 ──
  const [memName,  setMemName]  = useState("");
  const [memPos,   setMemPos]   = useState("");
  const [memPhone, setMemPhone] = useState("");
  const [memEmail, setMemEmail] = useState("");
  const [memPw,    setMemPw]    = useState("");

  // ── 정산 편집 ──
  const [editFee,  setEditFee]  = useState("");
  const [editMemo, setEditMemo] = useState("");
  const [editPaid, setEditPaid] = useState(false);

  // ──────────────────────────────────────────────
  // 초기화
  // ──────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) {
      try {
        const { user, agencyData, role } = JSON.parse(saved);
        setSession(user); setAgency(agencyData); setMyRole(role);
        loadData(agencyData.id);
      } catch { localStorage.removeItem(SESSION_KEY); }
    }
  }, []);

  const saveSession = (u: any, ag: any, role: "owner"|"member") =>
    localStorage.setItem(SESSION_KEY, JSON.stringify({ user:u, agencyData:ag, role }));

  const loadData = async (agencyId: string) => {
    try {
      const [m, c, b, p, mb] = await Promise.all([
        sb("models",        "GET", null, `?agency_id=eq.${agencyId}&order=created_at.desc`),
        sb("customers",     "GET", null, `?agency_id=eq.${agencyId}&order=created_at.desc`),
        sb("bookings",      "GET", null, `?agency_id=eq.${agencyId}&order=shoot_date.desc`),
        sb("projects",      "GET", null, `?agency_id=eq.${agencyId}&order=created_at.desc`),
        sb("agency_members","GET", null, `?agency_id=eq.${agencyId}`),
      ]);
      setModels(m||[]); setCustomers(c||[]); setBookings(b||[]); setProjects(p||[]); setMembers(mb||[]);
    } catch (e) { console.error("로드 실패", e); }
  };

  // ── 인증 ──
  const handleSignup = async () => {
    if (!email||!password||!agencyName) return setAuthError("모든 항목을 입력하세요");
    if (password.length < 6) return setAuthError("비밀번호 6자 이상");
    setAuthLoading(true); setAuthError("");
    try {
      const authRes = await sbAuth("signup", { email, password });
      const user = authRes.user;
      const agId = `AGY_${Date.now()}`;
      const trialEnd = new Date(Date.now() + 14*24*60*60*1000).toISOString();
      const agencyData = { id:agId, name:agencyName, owner_id:user.id, owner_email:email, plan:"trial", additional_members:0, trial_ends_at:trialEnd, created_at:new Date().toISOString() };
      await sb("agencies","POST",agencyData);
      await sb("agency_members","POST",{ id:`MEM_${user.id}`, agency_id:agId, user_id:user.id, email, name:agencyName+" 대표", position:"대표", phone:"", role:"owner", created_at:new Date().toISOString() });
      setSession(user); setAgency(agencyData); setMyRole("owner");
      saveSession(user, agencyData, "owner");
      await loadData(agId);
    } catch (e: any) { setAuthError(e.message||"회원가입 실패"); }
    finally { setAuthLoading(false); }
  };

  const handleLogin = async () => {
    if (!email||!password) return setAuthError("이메일과 비밀번호를 입력하세요");
    setAuthLoading(true); setAuthError("");
    try {
      const authRes = await sbAuth("token?grant_type=password", { email, password });
      const user = authRes.user;
      const memberRows = await sb("agency_members","GET",null,`?user_id=eq.${user.id}`);
      if (!memberRows?.length) {
        const agRows = await sb("agencies","GET",null,`?owner_id=eq.${user.id}`);
        if (!agRows?.length) throw new Error("소속 에이전시를 찾을 수 없습니다");
        const agencyData = agRows[0];
        setSession(user); setAgency(agencyData); setMyRole("owner");
        saveSession(user, agencyData, "owner"); await loadData(agencyData.id);
      } else {
        const member = memberRows[0];
        const agRows = await sb("agencies","GET",null,`?id=eq.${member.agency_id}`);
        const agencyData = agRows[0];
        const role = member.role==="owner"?"owner":"member";
        setSession(user); setAgency(agencyData); setMyRole(role);
        saveSession(user, agencyData, role); await loadData(agencyData.id);
      }
    } catch (e: any) { setAuthError(e.message||"로그인 실패"); }
    finally { setAuthLoading(false); }
  };

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null); setAgency(null); setMyRole("member");
    setEmail(""); setPassword(""); setAgencyName("");
    setModels([]); setCustomers([]); setBookings([]); setMembers([]);
    setPage("dashboard");
  };

  // ── 모델 추가 ──
  const resetModelForm = () => { setMName(""); setMSSN(""); setMPhone(""); setMEmail(""); setMCategory(""); setMRate(0); setMCommission(15); setMForeigner(false); setMEntry(""); setMExit(""); setMInstagram(""); setMDrive(""); setMKakao(""); setMBank(""); setMThumb(""); setMAimoUrl(""); setMMemo(""); };
  const handleAddModel = async () => {
    if (!mName||!mSSN) return alert("모델명과 주민번호 앞 6자리 필수");
    const nm = { id:makeModelId(mName,mSSN), name:mName, ssn6:mSSN, phone:mPhone, email:mEmail, category:mCategory, rate:mRate, commission:mCommission, is_foreigner:mForeigner, visa_entry:mForeigner?mEntry:null, visa_exit:mForeigner?mExit:null, instagram_url:normalizeInstagram(mInstagram), drive_url:mDrive, kakao_id:mKakao, bank_info:mBank, thumb_url:mThumb, aimo_url:mAimoUrl, memo:mMemo, agency_id:agency.id };
    try {
      await sb("models","POST",nm);
      setModels([nm,...models]);
      resetModelForm(); setShowModelForm(false);
    } catch (e) { alert("모델 추가 실패: "+String(e)); }
  };

  const openEditModel = (m: any) => {
    setSelectedModel(m);
    setMName(m.name||""); setMSSN(m.ssn6||""); setMPhone(m.phone||""); setMEmail(m.email||"");
    setMCategory(m.category||""); setMRate(m.rate||0); setMCommission(m.commission||15);
    setMForeigner(m.is_foreigner||false); setMEntry(m.visa_entry||""); setMExit(m.visa_exit||"");
    setMInstagram(m.instagram_url||""); setMDrive(m.drive_url||"");
    setMKakao(m.kakao_id||""); setMBank(m.bank_info||""); setMThumb(m.thumb_url||""); setMAimoUrl(m.aimo_url||""); setMMemo(m.memo||"");
    setMEditMode(true);
  };

  const handleSaveModel = async () => {
    if (!mName) return alert("모델명 필수");
    const updated = { name:mName, ssn6:mSSN, phone:mPhone, email:mEmail, category:mCategory, rate:mRate, commission:mCommission, is_foreigner:mForeigner, visa_entry:mForeigner?mEntry:null, visa_exit:mForeigner?mExit:null, instagram_url:normalizeInstagram(mInstagram), drive_url:mDrive, kakao_id:mKakao, bank_info:mBank, thumb_url:mThumb, aimo_url:mAimoUrl, memo:mMemo };
    try {
      await sb("models","PATCH",updated,`?id=eq.${selectedModel.id}`);
      setModels(models.map(m => m.id===selectedModel.id ? {...m,...updated} : m));
      setMEditMode(false); setSelectedModel(null); resetModelForm();
      alert("저장되었습니다.");
    } catch (e) { alert("수정 실패: "+String(e)); }
  };

  // ── 고객사 추가 ──
  const resetCustomerForm = () => { setCName(""); setCBrand(""); setCManager(""); setCPhone(""); setCEmail(""); setCIndustry(""); setCMemo(""); };
  const handleAddCustomer = async () => {
    if (!cName||!cPhone) return alert("고객사명과 전화번호 필수");
    const nc = { id:makeClientId(cName,cPhone.slice(-4)), name:cName, brand:cBrand, manager_name:cManager, phone:cPhone, email:cEmail, industry:cIndustry, memo:cMemo, agency_id:agency.id };
    try {
      await sb("customers","POST",nc);
      setCustomers([nc,...customers]);
      resetCustomerForm(); setShowCustomerForm(false);
    } catch (e) { alert("고객사 추가 실패: "+String(e)); }
  };

  const openEditCustomer = (c: any) => {
    setSelectedCustomer(c);
    setCName(c.name||""); setCBrand(c.brand||""); setCManager(c.manager_name||"");
    setCPhone(c.phone||""); setCEmail(c.email||""); setCIndustry(c.industry||""); setCMemo(c.memo||"");
    setCEditMode(true);
  };

  const handleSaveCustomer = async () => {
    if (!cName) return alert("고객사명 필수");
    const updated = { name:cName, brand:cBrand, manager_name:cManager, phone:cPhone, email:cEmail, industry:cIndustry, memo:cMemo };
    try {
      await sb("customers","PATCH",updated,`?id=eq.${selectedCustomer.id}`);
      setCustomers(customers.map(c => c.id===selectedCustomer.id ? {...c,...updated} : c));
      setCEditMode(false); setSelectedCustomer(null); resetCustomerForm();
      alert("저장되었습니다.");
    } catch (e) { alert("수정 실패: "+String(e)); }
  };

  // ── 섭외 추가 ──
  const resetBookingForm = () => { setBModel(""); setBModels([]); setBCustomer(""); setBModelSearch(""); setBCustomerSearch(""); setBDate(""); setBStart(""); setBEnd(""); setBManager(""); setBStatus("INQUIRY"); setBProject(""); setBLocation(""); setBShootTypes([]); setBUsageScope([]); setBUsagePeriod(""); setBBudget(0); setBDeposit(0); setBDepositDue(""); setBBalance(0); setBBalanceDue(""); setBResultDrive(""); setBMemo(""); setBBookingType("SHOOT"); };
  const handleSaveBookingEdit = async () => {
    if (!selectedBooking) return;
    const updates = {
      booking_type: selectedBooking.booking_type,
      project_name: selectedBooking.project_name,
      customer_id:  selectedBooking.customer_id,
      shoot_date:   selectedBooking.shoot_date,
      start_time:   selectedBooking.start_time,
      end_time:     selectedBooking.end_time,
      location:     selectedBooking.location,
      manager:      selectedBooking.manager,
      usage_period: selectedBooking.usage_period,
      shoot_types:  selectedBooking.shoot_types,
      usage_scope:  selectedBooking.usage_scope,
      shoot_fee:    selectedBooking.shoot_fee,
      deposit_amt:  selectedBooking.deposit_amt,
      deposit_due:  selectedBooking.deposit_due,
      balance_amt:  selectedBooking.balance_amt,
      balance_due:  selectedBooking.balance_due,
      memo:         selectedBooking.memo,
    };
    try {
      await sb("bookings","PATCH", updates, `?id=eq.${selectedBooking.id}`);
      setBookings(bookings.map(b=>b.id===selectedBooking.id?{...b,...updates}:b));
      setEditingBooking(false);
      alert("✅ 섭외 정보가 수정되었습니다.");
    } catch(e) { alert("수정 실패: "+String(e)); }
  };

  const handleAddBooking = async () => {
    if (!bModel||!bCustomer||!bDate) return alert("모델, 고객사, 날짜 필수");
    const model = models.find(m=>m.id===bModel);
    const visa = visaViolation(model, bDate);
    if (visa) return alert("비자 오류: "+visa);

    const conflicts = bookings.filter(b=>b.model_id===bModel&&b.shoot_date===bDate&&b.status!=="CANCELLED");
    let autoHold = false; let holdReason = "";
    for (const b of conflicts) {
      const c = scheduleConflict(bStart, bEnd, b.start_time, b.end_time);
      if (c.conflict) { autoHold = true; holdReason = c.reason; break; }
    }
    const finalStatus = autoHold ? "HOLD" : bStatus;
    const nb = { id:`B_${Date.now()}`, model_id:bModel, customer_id:bCustomer, booking_type:bBookingType, shoot_date:bDate, start_time:bStart, end_time:bEnd, manager:bManager, status:finalStatus, project_name:bProject, location:bLocation, shoot_types:bShootTypes, usage_scope:bUsageScope, usage_period:bUsagePeriod, shoot_fee:bBudget, deposit_amt:bDeposit, deposit_due:bDepositDue, balance_amt:bBalance, balance_due:bBalanceDue, result_drive_url:bResultDrive, memo:bMemo, commission_rate:15, is_paid:false, settlement_memo:"", messages:[], agency_id:agency.id };
    try {
      await sb("bookings","POST",nb);
      setBookings([nb,...bookings]);
      resetBookingForm(); setShowBookingForm(false);
      if (autoHold) alert(`⚠️ HOLD 처리됨\n사유: ${holdReason}\n같은 날 동일 모델 섭외와 시간이 충돌합니다.`);
    } catch(e) { alert("섭외 추가 실패: "+String(e)); }
  };

  const handleChangeStatus = async (id: string, status: string) => {
    try {
      await sb("bookings","PATCH",{status},`?id=eq.${id}`);
      setBookings(bookings.map(b=>b.id===id?{...b,status}:b));
      setSelectedBooking((prev:any)=>prev?{...prev,status}:null);
    } catch (e) { alert("상태 변경 실패: "+String(e)); }
  };

  // ── 정산 ──
  const openSettlement = (b: any) => { setSelectedSettlement(b); setEditFee(String(b.shoot_fee||"")); setEditMemo(b.settlement_memo||""); setEditPaid(b.is_paid||false); };
  const handleSaveSettlement = async () => {
    if (!selectedSettlement) return;
    const updates = { shoot_fee:Number(editFee)||0, settlement_memo:editMemo, is_paid:editPaid };
    try {
      await sb("bookings","PATCH",updates,`?id=eq.${selectedSettlement.id}`);
      setBookings(bookings.map(b=>b.id===selectedSettlement.id?{...b,...updates}:b));
      setSelectedSettlement(null);
    } catch (e) { alert("정산 저장 실패: "+String(e)); }
  };

  // ── 담당자 ──
  const handleAddMember = async () => {
    if (!memEmail||!memName||!memPw) return alert("이름, 이메일, 비밀번호 필수");
    if (memPw.length < 6) return alert("비밀번호 6자 이상");
    const maxM = getTotalMemberLimit(agency.plan, agency.additional_members||0);
    if (members.length >= maxM) return alert(`최대 ${maxM}명 도달`);
    try {
      const authRes = await sbAuth("signup",{email:memEmail,password:memPw});
      const newUser = authRes.user;
      const nm = { id:`MEM_${newUser.id}`, agency_id:agency.id, user_id:newUser.id, email:memEmail, name:memName, position:memPos, phone:memPhone, role:"member", created_at:new Date().toISOString() };
      await sb("agency_members","POST",nm);
      setMembers([...members,nm]);
      setMemName(""); setMemPos(""); setMemPhone(""); setMemEmail(""); setMemPw("");
      setShowMemberForm(false);
      alert(`${memName} 담당자 추가 완료!\n로그인: ${memEmail}`);
    } catch (e: any) { alert("담당자 추가 실패: "+(e.message||String(e))); }
  };

  const handleDeleteMember = async (id: string) => {
    if (!confirm("삭제하시겠습니까?")) return;
    try { await sb("agency_members","DELETE",null,`?id=eq.${id}`); setMembers(members.filter(m=>m.id!==id)); }
    catch (e) { alert("삭제 실패: "+String(e)); }
  };

  const handleChangePlan = async (planId: string) => {
    try {
      const updated = {...agency, plan:planId};
      await sb("agencies","PATCH",{plan:planId},`?id=eq.${agency.id}`);
      setAgency(updated); saveSession(session, updated, myRole);
      alert("요금제가 변경되었습니다.");
    } catch (e) { alert("변경 실패: "+String(e)); }
  };

  // ── 정산 필터 ──
  const settlementData = useMemo(()=>bookings.filter(b=>["COMPLETED","SETTLED"].includes(b.status)),[bookings]);
  const filteredSettlement = useMemo(()=>{
    return settlementData.filter(b=>{
      if (settlementTab==="PENDING"){ if(b.status!=="COMPLETED"||b.is_paid) return false; }
      if (settlementTab==="SETTLED"){ if(!(b.status==="SETTLED"||b.is_paid)) return false; }
      if (settlementTab==="UNPAID") { if(!(b.status==="SETTLED"&&!b.is_paid)) return false; }
      if (settlementMonth!=="ALL"&&!b.shoot_date?.startsWith(settlementMonth)) return false;
      if (settlementModel!=="ALL"&&b.model_id!==settlementModel) return false;
      if (settlementMgr!=="ALL"&&b.manager!==settlementMgr) return false;
      if (settlementProject!=="ALL"&&b.project_name!==settlementProject) return false;
      return true;
    });
  },[settlementData,settlementTab,settlementMonth,settlementModel,settlementMgr,settlementProject]);

  const settlementSummary = useMemo(()=>{
    const total = filteredSettlement.reduce((s,b)=>s+(b.shoot_fee||0),0);
    const commission = Math.round(total*0.15);
    return { total, commission, modelPay:total-commission };
  },[filteredSettlement]);

  const settlementMonths   = useMemo(()=>{ const s=new Set<string>(); settlementData.forEach(b=>{if(b.shoot_date)s.add(b.shoot_date.slice(0,7))}); return Array.from(s).sort().reverse(); },[settlementData]);
  const settlementProjects = useMemo(()=>{ const s=new Set<string>(); settlementData.forEach(b=>{if(b.project_name)s.add(b.project_name)}); return Array.from(s); },[settlementData]);

  const filteredModels    = models.filter(m=>m.name?.includes(modelQ)||m.phone?.includes(modelQ));
  const filteredCustomers = customers.filter(c=>c.name?.includes(customerQ)||c.phone?.includes(customerQ)||c.brand?.includes(customerQ));
  const filteredBookings  = bookings.filter(b=>{
    const mn=models.find(m=>m.id===b.model_id)?.name||"";
    const cn=customers.find(c=>c.id===b.customer_id)?.name||"";
    const matchQ=mn.includes(bookingQ)||cn.includes(bookingQ)||(b.project_name||"").includes(bookingQ);
    const matchSt=bookingStatusF==="ALL"||b.status===bookingStatusF;
    const matchMg=bookingManagerF==="ALL"||b.manager===bookingManagerF;
    return matchQ&&matchSt&&matchMg;
  });

  const maxMembers  = getTotalMemberLimit(agency?.plan||"trial", agency?.additional_members||0);
  const memberNames = members.map(m=>m.name);
  const planCfg     = PLAN_FEATURES[agency?.plan||"trial"];
  const trialDays   = getTrialDaysLeft(agency?.trial_ends_at);
  const trialExpired= trialDays!==null&&trialDays<=0&&agency?.plan==="trial";

  // ── 네비 탭 ──
  const NavTab = ({ target, label, icon }: { target:Page; label:string; icon:string }) => (
    <button onClick={()=>setPage(target)} style={{
      width:"100%", display:"flex", alignItems:"center", gap:10,
      padding:"9px 12px", borderRadius:8, border:"none", cursor:"pointer",
      background:page===target?C.sideActive:"transparent",
      color:page===target?"white":C.textSub,
      fontSize:13, fontWeight:page===target?700:400, marginBottom:2, textAlign:"left",
      transition:"all 0.15s",
    }}
      onMouseEnter={e=>{ if(page!==target){e.currentTarget.style.background=C.sideHover;e.currentTarget.style.color="white";} }}
      onMouseLeave={e=>{ if(page!==target){e.currentTarget.style.background="transparent";e.currentTarget.style.color=C.textSub;} }}
    >
      <span style={{ fontSize:15 }}>{icon}</span><span>{label}</span>
    </button>
  );

  // ══════════════════════════════════════════════
  // 로그인 화면
  // ══════════════════════════════════════════════
  if (!session||!agency) {
    return (
      <div style={{ minHeight:"100vh", width:"100vw", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:40, width:"90%", maxWidth:400 }}>
          <div style={{ textAlign:"center", marginBottom:22 }}>
            <h1 style={{ color:C.text, fontSize:26, margin:"0 0 4px", fontWeight:800 }}>Modiq</h1>
            <p style={{ color:C.muted, fontSize:12, margin:0 }}>모델 에이전시 관리 플랫폼 v{APP_VERSION}</p>
          </div>
          <div style={{ display:"flex", background:"#0f1117", borderRadius:8, padding:4, marginBottom:22 }}>
            {(["login","signup"] as AuthMode[]).map(mode=>(
              <button key={mode} onClick={()=>{setAuthMode(mode);setAuthError("");}} style={{ flex:1, padding:"8px 0", border:"none", borderRadius:6, cursor:"pointer", fontWeight:600, fontSize:14, background:authMode===mode?C.blue:"transparent", color:authMode===mode?"white":C.muted, transition:"all 0.2s" }}>
                {mode==="login"?"로그인":"회원가입"}
              </button>
            ))}
          </div>
          {authMode==="signup" && (
            <>
              <input style={inp} type="text" placeholder="에이전시명 *" value={agencyName} onChange={e=>{setAgencyName(e.target.value);setAuthError("");}} />
              <div style={{ background:"#1a3a1a", border:"1px solid #2ECC71", borderRadius:8, padding:"10px 14px", marginBottom:10, fontSize:12 }}>
                <p style={{ margin:0, color:"#2ECC71", fontWeight:700 }}>🎉 14일 무료 체험</p>
                <p style={{ margin:"4px 0 0", color:C.textSub }}>신용카드 없이 모든 기능을 무료로 사용해보세요!</p>
              </div>
            </>
          )}
          <input style={inp} type="email" placeholder="이메일 *" value={email} onChange={e=>{setEmail(e.target.value);setAuthError("");}} onKeyDown={e=>e.key==="Enter"&&(authMode==="login"?handleLogin():handleSignup())} />
          <input style={inp} type="password" placeholder="비밀번호 (6자 이상) *" value={password} onChange={e=>{setPassword(e.target.value);setAuthError("");}} onKeyDown={e=>e.key==="Enter"&&(authMode==="login"?handleLogin():handleSignup())} />
          {authError && <p style={{ color:C.red, fontSize:12, margin:"-4px 0 10px", textAlign:"center" }}>{authError}</p>}
          <button onClick={authMode==="login"?handleLogin:handleSignup} disabled={authLoading} style={{ ...btnS(C.blue,authLoading), width:"100%", padding:12, fontSize:15, marginTop:4 }}>
            {authLoading?"처리 중...":authMode==="login"?"로그인 →":"무료 체험 시작 →"}
          </button>
          <p style={{ color:C.muted, fontSize:12, marginTop:14, textAlign:"center" }}>
            {authMode==="login"
              ? <><span>계정이 없으신가요? </span><span onClick={()=>setAuthMode("signup")} style={{ color:C.blue,cursor:"pointer",fontWeight:600 }}>무료 체험 시작</span></>
              : <><span>이미 계정이 있으신가요? </span><span onClick={()=>setAuthMode("login")} style={{ color:C.blue,cursor:"pointer",fontWeight:600 }}>로그인</span></>
            }
          </p>
        </div>
      </div>
    );
  }

  // ── 만료 화면 ──
  if (trialExpired) {
    return (
      <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ background:C.card, border:`1px solid ${C.red}50`, borderRadius:14, padding:40, width:"90%", maxWidth:460, textAlign:"center" }}>
          <p style={{ fontSize:40, margin:"0 0 14px" }}>⛔</p>
          <h2 style={{ color:C.text, margin:"0 0 8px" }}>무료 체험이 만료되었습니다</h2>
          <p style={{ color:C.textSub, marginBottom:28 }}>계속 사용하려면 요금제를 선택하세요.<br/>데이터는 안전하게 보관되어 있습니다.</p>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:20 }}>
            {PLANS.map(plan=>(
              <div key={plan.id} style={{ background:"white", borderRadius:10, padding:16, cursor:"pointer", border:"2px solid transparent", transition:"border 0.2s" }}
                onClick={()=>handleChangePlan(plan.id)}
                onMouseEnter={e=>(e.currentTarget.style.border=`2px solid ${plan.color}`)}
                onMouseLeave={e=>(e.currentTarget.style.border="2px solid transparent")}
              >
                <p style={{ margin:"0 0 4px", fontWeight:800, fontSize:15, color:"#111" }}>{plan.name}</p>
                <p style={{ margin:0, fontSize:13, color:"#333", fontWeight:700 }}>{fmt(plan.price)}<span style={{ fontSize:11, fontWeight:400 }}>/월</span></p>
              </div>
            ))}
          </div>
          <button onClick={handleLogout} style={{ ...btnS(C.muted), fontSize:12 }}>로그아웃</button>
        </div>
      </div>
    );
  }

  const memberPct = (members.length/maxMembers)*100;

  const navItems = [
    { target:"dashboard"  as Page, label:"대시보드", icon:"🏠" },
    { target:"calendar"   as Page, label:"캘린더",   icon:"📅" },
    { target:"bookings"   as Page, label:"섭외",     icon:"📋" },
    { target:"models"     as Page, label:"모델",     icon:"👤" },
    { target:"customers"  as Page, label:"고객사",   icon:"🏢" },
    { target:"settlement" as Page, label:"정산",     icon:"💰" },
  ];
  const adminItems = [
    ...(myRole==="owner"?[{target:"members" as Page,label:"담당자",icon:"👥"}]:[]),
    { target:"plan" as Page, label:"요금제", icon:"💳" },
  ];

  // ══════════════════════════════════════════════
  // 메인 레이아웃
  // ══════════════════════════════════════════════
  return (
    <div style={{ display:"flex", minHeight:"100vh", width:"100vw", background:C.bg, color:C.text }}>

      {/* ── 사이드바 ── */}
      <div style={{ width:220, minWidth:220, background:C.sidebar, borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column", position:"fixed", top:0, left:0, bottom:0, zIndex:200 }}>
        <div style={{ padding:"20px 16px 16px", borderBottom:`1px solid ${C.border}` }}>
          <p style={{ margin:0, fontSize:18, fontWeight:900, color:C.text, letterSpacing:"-0.5px" }}>
            <span style={{ color:C.blue }}>M</span>odiq
          </p>
          <p style={{ margin:"4px 0 0", fontSize:11, color:C.muted }}>v{APP_VERSION}</p>
        </div>
        <div style={{ padding:"12px 8px", flex:1, overflowY:"auto" }}>
          <p style={{ margin:"0 0 6px 8px", fontSize:10, fontWeight:700, color:C.muted, letterSpacing:"0.8px", textTransform:"uppercase" }}>메뉴</p>
          {navItems.map(item=><NavTab key={item.target} {...item} />)}
          <p style={{ margin:"16px 0 6px 8px", fontSize:10, fontWeight:700, color:C.muted, letterSpacing:"0.8px", textTransform:"uppercase" }}>관리</p>
          {adminItems.map(item=><NavTab key={item.target} {...item} />)}
        </div>
        {trialDays!==null&&trialDays>0&&(
          <div style={{ margin:"0 8px 8px", padding:"10px 12px", borderRadius:8, background:trialDays<=3?"#3a1a00":"#1a3a20", border:`1px solid ${trialDays<=3?C.orange:C.green}50` }}>
            <p style={{ margin:0, fontSize:12, fontWeight:700, color:trialDays<=3?C.orange:C.green }}>{trialDays<=3?"⚠️":"🎉"} 무료 체험 D-{trialDays}</p>
            <p style={{ margin:"4px 0 0", fontSize:11, color:C.textSub }}>{trialDays<=3?"곧 만료됩니다!":"무료 체험 중"}</p>
          </div>
        )}
        <div style={{ padding:"12px 8px", borderTop:`1px solid ${C.border}` }}>
          <div style={{ padding:"8px 12px", borderRadius:8, marginBottom:4 }}>
            <p style={{ margin:0, fontSize:13, fontWeight:700, color:C.text }}>{agency.name}</p>
            <p style={{ margin:"2px 0 0", fontSize:11, color:C.muted }}>{myRole==="owner"?"👑 대표":"👤 담당자"}</p>
          </div>
          <button onClick={handleLogout} style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"8px 12px", borderRadius:8, border:"none", cursor:"pointer", background:"transparent", color:C.muted, fontSize:13, textAlign:"left" }}
            onMouseEnter={e=>{e.currentTarget.style.background=C.sideHover;e.currentTarget.style.color=C.red;}}
            onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=C.muted;}}
          >
            <span>🚪</span><span>로그아웃</span>
          </button>
        </div>
      </div>

      {/* ── 메인 콘텐츠 ── */}
      <div style={{ flex:1, marginLeft:220, padding:"28px 28px", overflowY:"auto", minHeight:"100vh" }}>

        {/* ════ 대시보드 ════ */}
        {page==="dashboard" && (()=>{
          const activeBookings   = bookings.filter(b=>["CONFIRMED","CHECKING","HOLD","SELECTING","INQUIRY","PROPOSED"].includes(b.status));
          const holdBookings     = bookings.filter(b=>b.status==="HOLD");
          const unpaidDeposit    = bookings.filter(b=>b.status==="CONFIRMED"&&!b.deposit_amt);
          return (
          <div>
            <h1 style={{ margin:"0 0 20px", fontSize:22, fontWeight:800, color:C.text }}>대시보드</h1>

            {/* 통계 카드 4개 */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:16 }}>
              {[
                { label:"진행중 섭외",  value:`${activeBookings.length}건`,  color:C.blue   },
                { label:"HOLD",         value:`${holdBookings.length}건`,    color:C.yellow },
                { label:"계약금 미입금", value:`${unpaidDeposit.length}건`,  color:C.red    },
                { label:"등록 모델",     value:`${models.length}명`,          color:"#c9a96e"},
              ].map(item=>(
                <div key={item.label} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"16px 18px" }}>
                  <p style={{ fontSize:11, color:C.muted, margin:0 }}>{item.label}</p>
                  <p style={{ fontSize:24, fontWeight:800, margin:"6px 0 0", color:item.color }}>{item.value}</p>
                </div>
              ))}
            </div>

            {/* 이번 주 섭외 미리보기 */}
            {(()=>{
              const now = new Date();
              const day = now.getDay(); // 0=일
              const monday = new Date(now); monday.setDate(now.getDate() - (day===0?6:day-1));
              const sunday = new Date(monday); sunday.setDate(monday.getDate()+6);
              const toStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
              const todayStr = toStr(now);
              const tomorrowStr = toStr(new Date(now.getFullYear(), now.getMonth(), now.getDate()+1));
              const weekDays: { label:string; date:string; short:string }[] = [];
              for(let i=0;i<7;i++){
                const d = new Date(monday); d.setDate(monday.getDate()+i);
                const ds = toStr(d);
                weekDays.push({ label:["월","화","수","목","금","토","일"][i], date:ds, short:ds });
              }
              const weekBookings = bookings.filter(b=>b.shoot_date>=toStr(monday)&&b.shoot_date<=toStr(sunday));
              const todayCnt    = bookings.filter(b=>b.shoot_date===todayStr).length;
              const tomorrowCnt = bookings.filter(b=>b.shoot_date===tomorrowStr).length;
              const weekTotal   = weekBookings.length;

              return (
                <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:16, marginBottom:16 }}>
                  {/* 헤더 */}
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                    <p style={{ margin:0, fontWeight:700, fontSize:14, color:C.text }}>📅 이번 주 섭외</p>
                    <button onClick={()=>setPage("calendar")} style={{ background:"none", border:"none", color:C.blue, cursor:"pointer", fontSize:12, fontWeight:600 }}>캘린더 전체 보기 →</button>
                  </div>

                  {/* 오늘/내일 요약 */}
                  <div style={{ display:"flex", gap:10, marginBottom:14 }}>
                    {[
                      { label:"오늘",  cnt:todayCnt,    date:todayStr,    color:C.blue   },
                      { label:"내일",  cnt:tomorrowCnt, date:tomorrowStr, color:C.purple },
                      { label:"이번 주",cnt:weekTotal,  date:null,        color:C.green  },
                    ].map(item=>(
                      <div key={item.label} onClick={()=>{ if(item.date) setPage("calendar"); }} style={{ flex:1, background:C.card2, borderRadius:8, padding:"10px 14px", cursor:item.date?"pointer":"default", border:`1px solid ${item.cnt>0?item.color+"50":C.border}`, transition:"border-color 0.15s" }}
                        onMouseEnter={e=>{ if(item.date) e.currentTarget.style.borderColor=item.color; }}
                        onMouseLeave={e=>{ e.currentTarget.style.borderColor=item.cnt>0?item.color+"50":C.border; }}
                      >
                        <p style={{ margin:0, fontSize:11, color:C.muted }}>{item.label}</p>
                        <p style={{ margin:"4px 0 0", fontSize:20, fontWeight:800, color:item.cnt>0?item.color:C.muted }}>{item.cnt}<span style={{ fontSize:12, fontWeight:400, marginLeft:3 }}>건</span></p>
                      </div>
                    ))}
                  </div>

                  {/* 요일별 바 */}
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4 }}>
                    {weekDays.map(wd=>{
                      const cnt = bookings.filter(b=>b.shoot_date===wd.date).length;
                      const isToday = wd.date===todayStr;
                      const maxCnt = Math.max(...weekDays.map(w=>bookings.filter(b=>b.shoot_date===w.date).length), 1);
                      return (
                        <div key={wd.date} onClick={()=>setPage("calendar")} style={{ cursor:"pointer", textAlign:"center" }}>
                          <div style={{ fontSize:10, color:isToday?C.blue:C.muted, fontWeight:isToday?700:400, marginBottom:4 }}>{wd.label}</div>
                          {/* 바 */}
                          <div style={{ height:32, background:C.border, borderRadius:4, overflow:"hidden", position:"relative" }}>
                            <div style={{ position:"absolute", bottom:0, left:0, right:0, height:`${cnt===0?0:Math.max(20,(cnt/maxCnt)*100)}%`, background:isToday?C.blue:cnt>0?C.green+"99":C.border, borderRadius:4, transition:"height 0.3s" }} />
                          </div>
                          <div style={{ fontSize:11, fontWeight:700, marginTop:3, color:cnt>0?C.text:C.muted }}>{cnt>0?cnt:"·"}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* HOLD 경고 카드 */}
            {holdBookings.length>0&&(
              <div style={{ background:"rgba(251,191,36,0.07)", border:`1px solid ${C.yellow}50`, borderRadius:10, padding:16, marginBottom:16 }}>
                <p style={{ margin:"0 0 12px", fontWeight:800, fontSize:13, color:C.yellow }}>⚠️ HOLD — 동시 섭외 충돌 확인 필요</p>
                {holdBookings.map(b=>{
                  const model  = models.find(m=>m.id===b.model_id);
                  const client = customers.find(c=>c.id===b.customer_id);
                  return (
                    <div key={b.id} onClick={()=>setSelectedBooking(b)} style={{ display:"flex", alignItems:"center", gap:12, padding:"8px 0", borderBottom:`1px solid rgba(251,191,36,0.15)`, cursor:"pointer" }}>
                      <Badge code="HOLD" />
                      <span style={{ color:C.text, fontWeight:700 }}>{model?.name||"?"}</span>
                      <span style={{ color:C.muted, fontSize:12 }}>{fmtDate(b.shoot_date)} · {client?.name||"?"} · {b.project_name||b.location||""}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 진행중 섭외 현황 */}
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:20 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <p style={{ margin:0, fontWeight:700, fontSize:15, color:C.text }}>📋 진행중 섭외 현황</p>
                <button onClick={()=>setPage("bookings")} style={{ background:"none", border:"none", color:C.blue, cursor:"pointer", fontSize:13, fontWeight:600 }}>전체 보기 →</button>
              </div>
              {activeBookings.length===0 ? <p style={{ color:C.muted, fontSize:13 }}>진행중인 섭외가 없습니다.</p> : (()=>{
                // 프로젝트 단위 그루핑
                const projGroup: Record<string, any[]> = {};
                const singles: any[] = [];
                activeBookings.slice(0,10).forEach(b=>{
                  if (b.project_id) {
                    if (!projGroup[b.project_id]) projGroup[b.project_id]=[];
                    projGroup[b.project_id].push(b);
                  } else { singles.push(b); }
                });
                const rows: React.ReactNode[] = [];
                // 프로젝트 그룹 먼저
                Object.entries(projGroup).forEach(([pid, bs])=>{
                  const proj = projects.find(p=>p.id===pid);
                  const client = customers.find(c=>c.id===bs[0]?.customer_id);
                  const statuses = [...new Set(bs.map(b=>b.status))];
                  const hasHold = statuses.includes("HOLD");
                  rows.push(
                    <div key={pid} style={{ padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <span style={{ background:C.blue+"22", color:C.blue, border:`1px solid ${C.blue}44`, borderRadius:4, padding:"2px 8px", fontSize:10, fontWeight:700 }}>🗂️ 프로젝트</span>
                        {hasHold&&<span style={{ background:C.yellow+"22", color:C.yellow, border:`1px solid ${C.yellow}44`, borderRadius:4, padding:"2px 8px", fontSize:10, fontWeight:700 }}>⚠️HOLD</span>}
                        <div style={{ flex:1 }}>
                          <p style={{ margin:0, fontSize:13, fontWeight:700, color:C.text }}>{proj?.name||bs[0]?.project_name||"프로젝트"} <span style={{ color:C.muted, fontWeight:400 }}>· {client?.name||"?"}</span></p>
                          <p style={{ margin:"2px 0 0", fontSize:11, color:C.muted }}>{fmtDate(bs[0]?.shoot_date)} · 모델 {bs.length}명: {bs.map(b=>models.find(m=>m.id===b.model_id)?.name||"?").join(", ")}</p>
                        </div>
                        <div style={{ textAlign:"right" }}>
                          {bs.reduce((s,b)=>s+(b.shoot_fee||0),0)>0&&<p style={{ margin:0, fontSize:13, fontWeight:700, color:"#c9a96e" }}>{bs.reduce((s,b)=>s+(b.shoot_fee||0),0).toLocaleString()}원</p>}
                        </div>
                      </div>
                    </div>
                  );
                });
                // 단건 섭외
                singles.forEach(b=>{
                  const model  = models.find(m=>m.id===b.model_id);
                  const client = customers.find(c=>c.id===b.customer_id);
                  rows.push(
                    <div key={b.id} onClick={()=>setSelectedBooking(b)} style={{ display:"flex", alignItems:"center", gap:14, padding:"10px 0", borderBottom:`1px solid ${C.border}`, cursor:"pointer" }}>
                      <Badge code={b.status} />
                      <div style={{ flex:1 }}>
                        <p style={{ margin:0, fontSize:13, fontWeight:700, color:C.text }}>{model?.name||"?"} · <span style={{ color:C.muted, fontWeight:400 }}>{client?.name||"?"}</span></p>
                        <p style={{ margin:"3px 0 0", fontSize:11, color:C.muted }}>{fmtDate(b.shoot_date)}{b.project_name?` · ${b.project_name}`:""}</p>
                      </div>
                      <div style={{ textAlign:"right" }}>
                        {b.shoot_fee>0&&<p style={{ margin:0, fontSize:13, fontWeight:700, color:"#c9a96e" }}>{b.shoot_fee.toLocaleString()}원</p>}
                        {!b.deposit_amt&&b.status==="CONFIRMED"&&<p style={{ margin:"2px 0 0", fontSize:11, color:C.red, fontWeight:700 }}>계약금 미입금</p>}
                      </div>
                    </div>
                  );
                });
                return <>{rows}</>;
              })()}
            </div>
          </div>
          );
        })()}

        {/* ════ 캘린더 ════ */}
        {page==="calendar" && (
          <CalendarView
            bookings={bookings}
            models={models}
            customers={customers}
            onSelectBooking={setSelectedBooking}
            initModelId={calInitModel}
            onAddBooking={(preModel, preDate)=>{
              if(preModel){ setBModel(preModel); setBModels([preModel]); setBModelSearch(models.find(m=>m.id===preModel)?.name||""); }
              if(preDate)  { setBDate(preDate); }
              setShowBookingForm(true);
            }}
          />
        )}


        {/* ════ 섭외 ════ */}
        {page==="bookings" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:C.text }}>📋 섭외 ({filteredBookings.length}건)</h1>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={()=>setShowBookingForm(true)} style={btnS(C.blue)}>+ 단건 섭외</button>
                <button onClick={()=>setShowProjectForm(true)}  style={btnS(C.green)}>+ 프로젝트 섭외</button>
              </div>
            </div>
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:14, marginBottom:14, display:"flex", gap:10, flexWrap:"wrap" }}>
              <input style={{ ...inp, marginBottom:0, flex:"1 1 160px" }} placeholder="🔍 모델/고객사/프로젝트" value={bookingQ} onChange={e=>setBookingQ(e.target.value)} />
              <select style={{ ...inp, marginBottom:0, flex:"1 1 130px" }} value={bookingStatusF} onChange={e=>setBookingStatusF(e.target.value)}>
                <option value="ALL">전체 상태</option>
                {Object.entries(STATUS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
              </select>
              <select style={{ ...inp, marginBottom:0, flex:"1 1 120px" }} value={bookingManagerF} onChange={e=>setBookingManagerF(e.target.value)}>
                <option value="ALL">전체 담당자</option>
                {memberNames.map(m=><option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            {filteredBookings.length===0 ? <p style={{ color:C.muted }}>결과 없음</p> : (
              <div style={{ display:"grid", gap:8 }}>
                {filteredBookings.map(b=>(
                  <div key={b.id} onClick={()=>setSelectedBooking(b)} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:16, cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center", transition:"border-color 0.2s" }}
                    onMouseEnter={e=>(e.currentTarget.style.borderColor=C.blue)}
                    onMouseLeave={e=>(e.currentTarget.style.borderColor=C.border)}
                  >
                    <div>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                        {(()=>{ const bt=BOOKING_TYPES[b.booking_type||"SHOOT"]||BOOKING_TYPES.SHOOT; return <span style={{ background:bt.color+"22", color:bt.color, border:`1px solid ${bt.color}44`, borderRadius:4, padding:"1px 7px", fontSize:11, fontWeight:700 }}>{bt.icon} {bt.label}</span>; })()}
                        <p style={{ margin:0, fontWeight:700, fontSize:14, color:C.text }}>{models.find(m=>m.id===b.model_id)?.name||"?"} → {customers.find(c=>c.id===b.customer_id)?.name||"?"}</p>
                      </div>
                      {b.project_name&&<p style={{ margin:"3px 0 0", fontSize:12, color:C.blue }}>📁 {b.project_name}</p>}
                      <p style={{ margin:"4px 0 0", fontSize:12, color:C.muted }}>
                        📅 {fmtDate(b.shoot_date)} {fmtTime(b.start_time,b.end_time)}
                        {b.location?` · 📍${b.location}`:""}
                        {b.manager?` · 👤${b.manager}`:""}
                        {b.shoot_fee?` · 💰${b.shoot_fee.toLocaleString()}원`:""}
                      </p>
                      {(b.shoot_types||[]).length>0&&<p style={{ margin:"3px 0 0", fontSize:11, color:C.muted }}>{(b.shoot_types||[]).join(" · ")}</p>}
                    </div>
                    <Badge code={b.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════ 모델 ════ */}
        {page==="models" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:C.text }}>👤 모델 ({filteredModels.length}명)</h1>
              <button onClick={()=>setShowModelForm(true)} style={btnS(C.blue)}>+ 모델 추가</button>
            </div>
            <input style={inp} placeholder="🔍 이름 또는 전화번호" value={modelQ} onChange={e=>setModelQ(e.target.value)} />
            {filteredModels.length===0 ? <p style={{ color:C.muted }}>모델이 없습니다.</p> : (
              <div style={{ display:"grid", gap:6 }}>
                {filteredModels.map(m=>{
                  const dday = m.is_foreigner ? visaDday(m.visa_exit) : "";
                  const ddayColor = dday==="만료" ? C.red : dday.startsWith("D-") && parseInt(dday.slice(2)) <= 7 ? C.orange : C.yellow;
                  return (
                    <div key={m.id} onClick={()=>{ setSelectedModel(m); setMEditMode(false); }} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 16px", cursor:"pointer", display:"flex", alignItems:"center", gap:12, transition:"border-color 0.2s" }}
                      onMouseEnter={e=>(e.currentTarget.style.borderColor=C.blue)}
                      onMouseLeave={e=>(e.currentTarget.style.borderColor=C.border)}
                    >
                      {/* 원형 썸네일 */}
                      {m.thumb_url
                        ? <img src={m.thumb_url} alt={m.name} style={{ width:36, height:36, borderRadius:"50%", objectFit:"cover", flexShrink:0, border:`1px solid ${C.border}` }} />
                        : <div style={{ width:36, height:36, borderRadius:"50%", background:"linear-gradient(135deg,#c9a96e,#8b6a3e)", display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontWeight:800, fontSize:14, flexShrink:0 }}>{m.name?m.name[0]:"?"}</div>
                      }
                      {/* 이름 */}
                      <span style={{ fontWeight:800, fontSize:15, color:C.text, minWidth:60 }}>{m.name}</span>
                      {/* 카테고리/성별 */}
                      {m.category&&<span style={{ background:C.card2, color:C.textSub, fontSize:11, padding:"2px 8px", borderRadius:10, whiteSpace:"nowrap" }}>{m.category}</span>}
                      {/* 외국인 D-day */}
                      {m.is_foreigner&&dday&&<span style={{ background:ddayColor+"22", color:ddayColor, border:`1px solid ${ddayColor}50`, fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:10, whiteSpace:"nowrap" }}>✈️ {dday}</span>}
                      {/* 전화 */}
                      {m.phone&&<span style={{ fontSize:12, color:C.muted }}>📞 {m.phone}</span>}
                      {/* 단가/수수료 */}
                      {m.rate>0&&<span style={{ fontSize:12, color:C.textSub }}>💰 {m.rate.toLocaleString()}원</span>}
                      {m.commission>0&&<span style={{ fontSize:12, color:C.textSub }}>수수료 {m.commission}%</span>}
                      {/* 브랜드 아이콘 링크 */}
                      {m.instagram_url&&<a href={m.instagram_url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{ display:"flex", alignItems:"center", gap:3, fontSize:12, color:"#E1306C", textDecoration:"none", whiteSpace:"nowrap" }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="5" stroke="#E1306C" strokeWidth="2"/><circle cx="12" cy="12" r="4.5" stroke="#E1306C" strokeWidth="2"/><circle cx="17.5" cy="6.5" r="1.5" fill="#E1306C"/></svg> 인스타</a>}
                      {m.aimo_url&&<a href={m.aimo_url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{ fontSize:12, textDecoration:"none", whiteSpace:"nowrap", background:"linear-gradient(135deg,#4f46e5,#06b6d4)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", fontWeight:700 }}>AIMO</a>}
                      <span style={{ marginLeft:"auto", fontSize:11, color:C.muted, whiteSpace:"nowrap" }}>섭외 {bookings.filter(b=>b.model_id===m.id).length}건 →</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ════ 고객사 ════ */}
        {page==="customers" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:C.text }}>🏢 고객사 ({filteredCustomers.length}개)</h1>
              <button onClick={()=>setShowCustomerForm(true)} style={btnS(C.purple)}>+ 고객사 추가</button>
            </div>
            <input style={inp} placeholder="🔍 고객사명/브랜드명/전화번호" value={customerQ} onChange={e=>setCustomerQ(e.target.value)} />
            {filteredCustomers.length===0 ? <p style={{ color:C.muted }}>고객사가 없습니다.</p> : (
              <div style={{ display:"grid", gap:6 }}>
                {filteredCustomers.map(c=>(
                  <div key={c.id} onClick={()=>{ setSelectedCustomer(c); setCEditMode(false); }} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 16px", cursor:"pointer", display:"flex", alignItems:"center", gap:12, transition:"border-color 0.2s" }}
                    onMouseEnter={e=>(e.currentTarget.style.borderColor=C.purple)}
                    onMouseLeave={e=>(e.currentTarget.style.borderColor=C.border)}
                  >
                    <span style={{ fontWeight:800, fontSize:15, color:C.text, minWidth:80 }}>{c.name}</span>
                    {c.brand&&<span style={{ fontSize:13, color:C.blue }}>· {c.brand}</span>}
                    {c.industry&&<span style={{ background:C.card2, color:C.textSub, fontSize:11, padding:"2px 8px", borderRadius:10, whiteSpace:"nowrap" }}>{c.industry}</span>}
                    {c.manager_name&&<span style={{ fontSize:12, color:C.muted }}>👤 {c.manager_name}</span>}
                    {c.phone&&<span style={{ fontSize:12, color:C.muted }}>📞 {c.phone}</span>}
                    {c.email&&<span style={{ fontSize:12, color:C.muted }}>✉️ {c.email}</span>}
                    <span style={{ marginLeft:"auto", fontSize:11, color:C.muted, whiteSpace:"nowrap" }}>섭외 {bookings.filter(b=>b.customer_id===c.id).length}건 →</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════ 정산 ════ */}
        {page==="settlement" && (
          <div>
            <h1 style={{ margin:"0 0 20px", fontSize:22, fontWeight:800, color:C.text }}>💰 정산 관리</h1>
            <div style={{ display:"flex", gap:8, marginBottom:16 }}>
              {([
                { key:"PENDING", label:"정산대기",   color:C.yellow },
                { key:"SETTLED", label:"정산완료",   color:C.green  },
                { key:"UNPAID",  label:"미입금잔금", color:C.red    },
              ] as const).map(tab=>(
                <button key={tab.key} onClick={()=>setSettlementTab(tab.key)} style={{ padding:"9px 20px", border:`2px solid ${settlementTab===tab.key?tab.color:C.border}`, borderRadius:8, cursor:"pointer", fontWeight:700, fontSize:13, background:settlementTab===tab.key?tab.color+"22":C.card, color:settlementTab===tab.key?tab.color:C.textSub, transition:"all 0.2s" }}>{tab.label}</button>
              ))}
            </div>
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:12, marginBottom:14, display:"flex", gap:10, flexWrap:"wrap" }}>
              <select style={{ ...inp, marginBottom:0, flex:"1 1 120px" }} value={settlementMonth} onChange={e=>setSettlementMonth(e.target.value)}>
                <option value="ALL">전체 월</option>
                {settlementMonths.map(m=><option key={m} value={m}>{m.replace("-","년 ")}월</option>)}
              </select>
              <select style={{ ...inp, marginBottom:0, flex:"1 1 130px" }} value={settlementModel} onChange={e=>setSettlementModel(e.target.value)}>
                <option value="ALL">전체 모델</option>
                {models.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <select style={{ ...inp, marginBottom:0, flex:"1 1 120px" }} value={settlementMgr} onChange={e=>setSettlementMgr(e.target.value)}>
                <option value="ALL">전체 담당자</option>
                {memberNames.map(m=><option key={m} value={m}>{m}</option>)}
              </select>
              <select style={{ ...inp, marginBottom:0, flex:"1 1 130px" }} value={settlementProject} onChange={e=>setSettlementProject(e.target.value)}>
                <option value="ALL">전체 프로젝트</option>
                {settlementProjects.map(p=><option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:14 }}>
              {[
                { label:"총 촬영비",         value:fmt(settlementSummary.total),      color:C.text  },
                { label:"수수료 (15%)",       value:fmt(settlementSummary.commission), color:C.blue  },
                { label:"모델 수령액 (85%)", value:fmt(settlementSummary.modelPay),   color:C.green },
              ].map(item=>(
                <div key={item.label} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:16, textAlign:"center" }}>
                  <p style={{ margin:0, fontSize:11, color:C.muted }}>{item.label}</p>
                  <p style={{ margin:"8px 0 0", fontSize:17, fontWeight:800, color:item.color }}>{item.value}</p>
                </div>
              ))}
            </div>
            {filteredSettlement.length===0 ? <p style={{ color:C.muted }}>해당 항목이 없습니다.</p> : (
              <div style={{ display:"grid", gap:8 }}>
                {filteredSettlement.map(b=>{
                  const model = models.find(m=>m.id===b.model_id);
                  const client = customers.find(c=>c.id===b.customer_id);
                  const fee=b.shoot_fee||0, comm=Math.round(fee*0.15);
                  return (
                    <div key={b.id} onClick={()=>openSettlement(b)} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:16, cursor:"pointer", display:"flex", alignItems:"center", gap:14, transition:"border-color 0.2s" }}
                      onMouseEnter={e=>(e.currentTarget.style.borderColor=C.yellow)}
                      onMouseLeave={e=>(e.currentTarget.style.borderColor=C.border)}
                    >
                      {/* 아바타 */}
                      <div style={{ width:44, height:44, borderRadius:"50%", background:"linear-gradient(135deg,#c9a96e,#8b6a3e)", display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontWeight:800, fontSize:15, flexShrink:0 }}>
                        {(model?.name||"?")[0]}
                      </div>
                      {/* 정보 */}
                      <div style={{ flex:1 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                          <span style={{ color:C.text, fontWeight:700, fontSize:14 }}>{model?.name||"?"}</span>
                          <span style={{ color:C.muted, fontSize:12 }}>· {client?.name||"?"}</span>
                          {b.project_name&&<span style={{ color:C.blue, fontSize:12 }}>📁 {b.project_name}</span>}
                          <Badge code={b.status} />
                        </div>
                        <span style={{ color:C.muted, fontSize:12 }}>📅 {fmtDate(b.shoot_date)}  👤 {b.manager||"-"}</span>
                      </div>
                      {/* 금액 */}
                      {fee>0&&(
                        <div style={{ textAlign:"right" }}>
                          <p style={{ margin:0, color:"#e8d5b7", fontWeight:800, fontSize:16 }}>{fee.toLocaleString()}원</p>
                          <p style={{ margin:"2px 0 0", color:C.green, fontSize:12 }}>수령액 {(fee-comm).toLocaleString()}원</p>
                        </div>
                      )}
                      {/* 정산처리 버튼 */}
                      {!b.is_paid&&(
                        <button onClick={e=>{ e.stopPropagation(); openSettlement(b); }} style={{ ...btnS(C.green), padding:"6px 14px", fontSize:12, flexShrink:0 }}>정산처리</button>
                      )}
                      {b.is_paid&&<span style={{ color:C.green, fontSize:12, fontWeight:700, flexShrink:0 }}>✅ 완료</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ════ 담당자 ════ */}
        {page==="members"&&myRole==="owner"&&(
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:C.text }}>👥 담당자 관리</h1>
              <button onClick={()=>setShowMemberForm(true)} style={btnS(C.purple)}>+ 담당자 추가</button>
            </div>
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:16, marginBottom:16 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                <span style={{ fontWeight:700, color:C.text }}>담당자 한도</span>
                <span style={{ fontWeight:700, color:memberPct>=100?C.red:C.green }}>{members.length}/{maxMembers}명</span>
              </div>
              <div style={{ background:C.border, borderRadius:4, height:6 }}>
                <div style={{ width:`${Math.min(memberPct,100)}%`, height:"100%", background:memberPct>=100?C.red:C.green, borderRadius:4 }} />
              </div>
            </div>
            {members.filter(m=>m.role==="owner").map(m=>(
              <div key={m.id} style={{ background:"#1a2f1a", border:`1px solid ${C.green}40`, borderRadius:10, padding:18, marginBottom:10 }}>
                <p style={{ margin:"0 0 12px", fontWeight:700, color:C.green }}>👑 최초 관리자 (대표)</p>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                  {[["이름",m.name],["직위",m.position||"-"],["전화번호",m.phone||"-"],["이메일",m.email]].map(([label,val])=>(
                    <div key={label}><p style={{ margin:0, fontSize:11, color:C.muted }}>{label}</p><p style={{ margin:"3px 0 0", fontSize:13, color:C.text }}>{val}</p></div>
                  ))}
                </div>
              </div>
            ))}
            <p style={{ fontWeight:700, color:C.text, margin:"16px 0 10px" }}>추가 담당자 ({members.filter(m=>m.role!=="owner").length}명)</p>
            {members.filter(m=>m.role!=="owner").length===0 ? <p style={{ color:C.muted, fontSize:13 }}>추가된 담당자가 없습니다.</p> : (
              <div style={{ display:"grid", gap:8 }}>
                {members.filter(m=>m.role!=="owner").map(m=>(
                  <div key={m.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:16, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, flex:1 }}>
                      {[["이름",m.name],["직위",m.position||"-"],["전화번호",m.phone||"-"],["이메일",m.email]].map(([label,val])=>(
                        <div key={label}><p style={{ margin:0, fontSize:11, color:C.muted }}>{label}</p><p style={{ margin:"3px 0 0", fontSize:13, color:C.text }}>{val}</p></div>
                      ))}
                    </div>
                    <button onClick={()=>handleDeleteMember(m.id)} style={{ ...btnS(C.red), padding:"6px 12px", fontSize:12, marginLeft:14 }}>삭제</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════ 요금제 ════ */}
        {page==="plan"&&(
          <div>
            <div style={{ textAlign:"center", marginBottom:32 }}>
              <h1 style={{ margin:"0 0 8px", fontSize:28, fontWeight:900, color:C.text }}>요금제 선택</h1>
              <p style={{ margin:"0 0 20px", fontSize:14, color:C.muted }}>에이전시 규모에 맞는 요금제를 선택하세요</p>
              <div style={{ display:"inline-flex", background:"#22263a", borderRadius:8, padding:4, gap:4 }}>
                {["monthly","yearly"].map(t=>(
                  <button key={t} onClick={()=>setPlanBilling(t as "monthly"|"yearly")} style={{ padding:"7px 20px", border:"none", borderRadius:6, cursor:"pointer", fontWeight:600, fontSize:13, transition:"all 0.2s", background:planBilling===t?"white":"transparent", color:planBilling===t?"#111":C.muted }}>
                    {t==="monthly"?"월간":"연간"}
                  </button>
                ))}
              </div>
              {planBilling==="yearly"&&<p style={{ margin:"10px 0 0", fontSize:13, color:C.green, fontWeight:600 }}>🎉 연간 결제 시 최대 28% 할인</p>}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:16, maxWidth:900, margin:"0 auto" }}>
              {PLANS.map(plan=>{
                const isCurrent=agency.plan===plan.id;
                const cfg=PLAN_FEATURES[plan.id];
                const price=planBilling==="yearly"?plan.priceYearly:plan.price;
                return (
                  <div key={plan.id} style={{ background:"#1a1d27", border:`1px solid ${isCurrent?plan.color:plan.popular?plan.color+"80":C.border}`, borderRadius:14, padding:28, position:"relative", boxShadow:isCurrent?`0 0 0 2px ${plan.color}40`:plan.popular?`0 8px 32px ${plan.color}20`:"none", transition:"transform 0.2s, box-shadow 0.2s" }}
                    onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow=`0 12px 40px ${plan.color}25`;}}
                    onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow=isCurrent?`0 0 0 2px ${plan.color}40`:plan.popular?`0 8px 32px ${plan.color}20`:"none";}}
                  >
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                      <h3 style={{ margin:0, fontSize:20, fontWeight:800, color:C.text }}>{plan.name}</h3>
                      <div style={{ display:"flex", gap:6 }}>
                        {plan.popular&&!isCurrent&&<span style={{ background:plan.color, color:"white", fontSize:11, fontWeight:800, padding:"4px 10px", borderRadius:20 }}>POPULAR</span>}
                        {isCurrent&&<span style={{ background:plan.color+"22", color:plan.color, border:`1px solid ${plan.color}`, fontSize:11, fontWeight:700, padding:"4px 10px", borderRadius:20 }}>현재 플랜</span>}
                      </div>
                    </div>
                    <div style={{ marginBottom:20 }}>
                      <div style={{ display:"flex", alignItems:"baseline", gap:4 }}>
                        <span style={{ fontSize:40, fontWeight:900, color:C.text, lineHeight:1 }}>{(price/10000).toFixed(0)}만</span>
                        <span style={{ fontSize:16, color:C.muted }}>원</span>
                      </div>
                      <p style={{ margin:"4px 0 0", fontSize:12, color:C.muted }}>{planBilling==="yearly"?"월 환산 · 연간 결제":"매월 청구"}</p>
                    </div>
                    {myRole==="owner"&&(
                      <button onClick={()=>handleChangePlan(plan.id)} disabled={isCurrent} style={{ width:"100%", padding:"12px 0", border:"none", borderRadius:8, cursor:isCurrent?"not-allowed":"pointer", fontWeight:700, fontSize:14, marginBottom:22, transition:"opacity 0.2s", background:isCurrent?"#2a2d3e":plan.color, color:isCurrent?C.muted:"white", opacity:isCurrent?0.7:1 }}>
                        {isCurrent?"현재 요금제":"시작하기"}
                      </button>
                    )}
                    <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:18 }}>
                      <p style={{ margin:"0 0 12px", fontSize:12, fontWeight:700, color:C.textSub }}>포함 기능:</p>
                      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                        {plan.features.map((f,i)=>(
                          <div key={i} style={{ display:"flex", alignItems:"center", gap:10 }}>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="8" fill={plan.color+"22"}/><path d="M5 8l2 2 4-4" stroke={plan.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            <span style={{ fontSize:13, color:C.textSub }}>{f}</span>
                          </div>
                        ))}
                        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="8" fill={plan.color+"22"}/><path d="M5 8l2 2 4-4" stroke={plan.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          <span style={{ fontSize:13, color:C.textSub }}>추가 담당자 {cfg.additionalPrice.toLocaleString()}원/명</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p style={{ textAlign:"center", marginTop:28, fontSize:12, color:C.muted }}>모든 요금제는 14일 무료 체험 후 결제됩니다 · 언제든지 변경/해지 가능</p>
          </div>
        )}
      </div>

      {/* ════ 모달: 섭외 상세 ════ */}
      {selectedBooking&&(
        <Modal onClose={()=>{ setSelectedBooking(null); setEditingBooking(false); }} wide>
          {/* 헤더 */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <h3 style={{ margin:0, color:C.text }}>📋 섭외 상세</h3>
            <div style={{ display:"flex", gap:8 }}>
              {!editingBooking
                ? <button onClick={()=>setEditingBooking(true)} style={{ ...btnS(C.purple), fontSize:12 }}>✏️ 수정</button>
                : <>
                    <button onClick={handleSaveBookingEdit} style={{ ...btnS(C.green), fontSize:12 }}>💾 저장</button>
                    <button onClick={()=>setEditingBooking(false)} style={{ ...btnS("#555"), fontSize:12 }}>취소</button>
                  </>
              }
            </div>
          </div>

          {/* 상태 변경 */}
          <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:16 }}>
            {Object.entries(STATUS).map(([code,s])=>(
              <button key={code} onClick={()=>handleChangeStatus(selectedBooking.id,code)} style={{ padding:"5px 11px", borderRadius:6, border:"none", cursor:"pointer", fontSize:11, fontWeight:700, background:selectedBooking.status===code?s.color:"#2a2a3a", color:"white" }}>{s.label}</button>
            ))}
          </div>

          {/* 조회 모드 */}
          {!editingBooking ? (
            <>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
                {[
                  ["모델",    models.find(m=>m.id===selectedBooking.model_id)?.name],
                  ["고객사",  customers.find(c=>c.id===selectedBooking.customer_id)?.name],
                  ["프로젝트",selectedBooking.project_name],
                  ["촬영일",  fmtDate(selectedBooking.shoot_date)],
                  ["시간",    fmtTime(selectedBooking.start_time,selectedBooking.end_time)],
                  ["장소",    selectedBooking.location],
                  ["담당자",  selectedBooking.manager],
                  ["사용기간",selectedBooking.usage_period],
                ].filter(([,v])=>v).map(([k,v])=>(
                  <div key={String(k)}>
                    <p style={{ margin:0, fontSize:11, color:C.muted }}>{k}</p>
                    <p style={{ margin:"3px 0 0", fontSize:13, fontWeight:600, color:C.text }}>{v}</p>
                  </div>
                ))}
              </div>
              {(selectedBooking.shoot_types||[]).length>0&&(
                <div style={{ marginBottom:10 }}>
                  <p style={{ margin:"0 0 6px", fontSize:11, color:C.muted }}>촬영 유형</p>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                    {selectedBooking.shoot_types.map((t:string)=><span key={t} style={{ background:C.card2, color:C.textSub, fontSize:12, padding:"3px 10px", borderRadius:10 }}>{t}</span>)}
                  </div>
                </div>
              )}
              {(selectedBooking.usage_scope||[]).length>0&&(
                <div style={{ marginBottom:14 }}>
                  <p style={{ margin:"0 0 6px", fontSize:11, color:C.muted }}>사용 범위</p>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                    {selectedBooking.usage_scope.map((s:string)=><span key={s} style={{ background:C.card2, color:C.textSub, fontSize:12, padding:"3px 10px", borderRadius:10 }}>{s}</span>)}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* 편집 모드 */
            <>
              {/* 섭외 유형 */}
              <div style={{ marginBottom:10 }}>
                <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:6 }}>섭외 유형</label>
                <div style={{ display:"flex", gap:6 }}>
                  {Object.entries(BOOKING_TYPES).map(([key,bt])=>(
                    <button key={key} type="button" onClick={()=>setSelectedBooking((p:any)=>({...p,booking_type:key}))}
                      style={{ padding:"4px 11px", borderRadius:6, border:`1px solid ${selectedBooking.booking_type===key?bt.color:C.border}`, background:selectedBooking.booking_type===key?bt.color+"22":"transparent", color:selectedBooking.booking_type===key?bt.color:C.muted, fontSize:12, fontWeight:selectedBooking.booking_type===key?700:400, cursor:"pointer" }}>
                      {bt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
                <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>프로젝트명</label>
                  <input style={inp} value={selectedBooking.project_name||""} onChange={e=>setSelectedBooking((p:any)=>({...p,project_name:e.target.value}))} /></div>
                <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>촬영 장소</label>
                  <input style={inp} value={selectedBooking.location||""} onChange={e=>setSelectedBooking((p:any)=>({...p,location:e.target.value}))} /></div>
              </div>
              {/* 날짜+시간 */}
              <div style={{ background:C.card2, borderRadius:8, padding:"10px 12px", marginBottom:10 }}>
                <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:6 }}>📅 촬영 일정</label>
                <input style={{ ...inp, marginBottom:8, padding:"6px 10px", fontSize:12 }} type="date" value={selectedBooking.shoot_date||""} onChange={e=>setSelectedBooking((p:any)=>({...p,shoot_date:e.target.value}))} />
                <div style={{ display:"flex", alignItems:"flex-end", gap:16 }}>
                  <TimePicker label="시작" value={selectedBooking.start_time||""} onChange={v=>setSelectedBooking((p:any)=>({...p,start_time:v}))} />
                  <span style={{ color:C.muted, fontSize:13, paddingBottom:6 }}>~</span>
                  <TimePicker label="종료" value={selectedBooking.end_time||""} onChange={v=>setSelectedBooking((p:any)=>({...p,end_time:v}))} />
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
                <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>담당 MD</label>
                  <input style={inp} value={selectedBooking.manager||""} onChange={e=>setSelectedBooking((p:any)=>({...p,manager:e.target.value}))} /></div>
                <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>사용 기간</label>
                  <select style={inp} value={selectedBooking.usage_period||""} onChange={e=>setSelectedBooking((p:any)=>({...p,usage_period:e.target.value}))}>
                    <option value="">선택</option>
                    {USAGE_PERIODS.map(p=><option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              {/* 촬영유형 */}
              {selectedBooking.booking_type==="SHOOT"&&(
                <div style={{ marginBottom:10 }}>
                  <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:6 }}>촬영 유형</label>
                  <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                    {[...SHOOT_TYPES_PHOTO,...SHOOT_TYPES_VIDEO].map(t=>(
                      <button key={t} type="button"
                        onClick={()=>setSelectedBooking((p:any)=>({ ...p, shoot_types: p.shoot_types?.includes(t) ? p.shoot_types.filter((x:string)=>x!==t) : [...(p.shoot_types||[]),t] }))}
                        style={{ padding:"3px 10px", borderRadius:5, border:`1px solid ${(selectedBooking.shoot_types||[]).includes(t)?C.blue:C.border}`, background:(selectedBooking.shoot_types||[]).includes(t)?C.blue+"22":"transparent", color:(selectedBooking.shoot_types||[]).includes(t)?C.blue:C.muted, fontSize:11, cursor:"pointer" }}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* 사용 범위 */}
              <div style={{ marginBottom:10 }}>
                <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:6 }}>사용 범위</label>
                <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                  {USAGE_SCOPES.map(s=>(
                    <button key={s} type="button"
                      onClick={()=>setSelectedBooking((p:any)=>({ ...p, usage_scope: p.usage_scope?.includes(s) ? p.usage_scope.filter((x:string)=>x!==s) : [...(p.usage_scope||[]),s] }))}
                      style={{ padding:"3px 10px", borderRadius:5, border:`1px solid ${(selectedBooking.usage_scope||[]).includes(s)?C.blue:C.border}`, background:(selectedBooking.usage_scope||[]).includes(s)?C.blue+"22":"transparent", color:(selectedBooking.usage_scope||[]).includes(s)?C.blue:C.muted, fontSize:11, cursor:"pointer" }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* 계약금/잔금 — 조회+편집 공통 (잔금 자동계산) */}
          <div style={{ background:C.card2, borderRadius:10, padding:14, marginBottom:14 }}>
            <p style={{ margin:"0 0 10px", fontSize:12, fontWeight:700, color:C.yellow }}>💰 계약금 / 잔금</p>
            {editingBooking ? (
              /* 편집 모드: 계약총액·계약금 입력 → 잔금 자동계산 */
              <>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:10 }}>
                  <div>
                    <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>계약 총액</label>
                    <div style={{ position:"relative" }}>
                      <input style={{ ...inp, marginBottom:0, paddingRight:24 }} type="number" placeholder="0"
                        value={selectedBooking.shoot_fee||""}
                        onChange={e=>{ const fee=Number(e.target.value)||0; const dep=selectedBooking.deposit_amt||0; setSelectedBooking((p:any)=>({...p, shoot_fee:fee, balance_amt: Math.max(0,fee-dep)})); }}
                      />
                      <span style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", fontSize:11, color:C.muted }}>원</span>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>계약금</label>
                    <div style={{ position:"relative" }}>
                      <input style={{ ...inp, marginBottom:0, paddingRight:24 }} type="number" placeholder="0"
                        value={selectedBooking.deposit_amt||""}
                        onChange={e=>{ const dep=Number(e.target.value)||0; const fee=selectedBooking.shoot_fee||0; setSelectedBooking((p:any)=>({...p, deposit_amt:dep, balance_amt: Math.max(0,fee-dep)})); }}
                      />
                      <span style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", fontSize:11, color:C.muted }}>원</span>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>잔금 <span style={{ color:C.blue, fontSize:10 }}>(자동계산)</span></label>
                    <div style={{ background:"#1a1e2e", border:`1px solid ${C.blue}40`, borderRadius:6, padding:"8px 10px", fontSize:13, fontWeight:700, color:C.blue }}>
                      {((selectedBooking.shoot_fee||0)-(selectedBooking.deposit_amt||0)).toLocaleString()}원
                    </div>
                  </div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>계약금 입금 예정일</label>
                    <input style={{ ...inp, marginBottom:0 }} type="date" value={selectedBooking.deposit_due||""} onChange={e=>setSelectedBooking((p:any)=>({...p,deposit_due:e.target.value}))} /></div>
                  <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>잔금 입금 예정일</label>
                    <input style={{ ...inp, marginBottom:0 }} type="date" value={selectedBooking.balance_due||""} onChange={e=>setSelectedBooking((p:any)=>({...p,balance_due:e.target.value}))} /></div>
                </div>
              </>
            ) : (
              /* 조회 모드: 계약금/잔금 입금 확인 */
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                <div>
                  <p style={{ margin:"0 0 4px", color:C.muted, fontSize:11 }}>계약금</p>
                  <p style={{ margin:"0 0 4px", color:C.text, fontWeight:700 }}>{selectedBooking.deposit_amt?selectedBooking.deposit_amt.toLocaleString()+"원":"-"}</p>
                  <p style={{ margin:"0 0 6px", color:C.muted, fontSize:11 }}>예정일: {fmtDate(selectedBooking.deposit_due)||"-"}</p>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <input type="date" defaultValue={selectedBooking.deposit_paid||""}
                      onChange={async e=>{ await sb("bookings","PATCH",{deposit_paid:e.target.value||null},`?id=eq.${selectedBooking.id}`); setBookings(bookings.map(b=>b.id===selectedBooking.id?{...b,deposit_paid:e.target.value}:b)); setSelectedBooking((p:any)=>({...p,deposit_paid:e.target.value})); }}
                      style={{ background:"#22263a", border:`1px solid ${C.border}`, borderRadius:6, padding:"4px 8px", color:C.text, fontSize:11, outline:"none" }} />
                    <span style={{ fontSize:11, fontWeight:700, color:selectedBooking.deposit_paid?C.green:C.red }}>{selectedBooking.deposit_paid?"✓입금":"미입금"}</span>
                  </div>
                </div>
                <div>
                  <p style={{ margin:"0 0 4px", color:C.muted, fontSize:11 }}>잔금</p>
                  <p style={{ margin:"0 0 4px", color:C.text, fontWeight:700 }}>{selectedBooking.balance_amt?selectedBooking.balance_amt.toLocaleString()+"원":"-"}</p>
                  <p style={{ margin:"0 0 6px", color:C.muted, fontSize:11 }}>예정일: {fmtDate(selectedBooking.balance_due)||"-"}</p>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <input type="date" defaultValue={selectedBooking.balance_paid||""}
                      onChange={async e=>{ await sb("bookings","PATCH",{balance_paid:e.target.value||null},`?id=eq.${selectedBooking.id}`); setBookings(bookings.map(b=>b.id===selectedBooking.id?{...b,balance_paid:e.target.value}:b)); setSelectedBooking((p:any)=>({...p,balance_paid:e.target.value})); }}
                      style={{ background:"#22263a", border:`1px solid ${C.border}`, borderRadius:6, padding:"4px 8px", color:C.text, fontSize:11, outline:"none" }} />
                    <span style={{ fontSize:11, fontWeight:700, color:selectedBooking.balance_paid?C.green:C.red }}>{selectedBooking.balance_paid?"✓입금":"미입금"}</span>
                  </div>
                </div>
              </div>
            )}
            {selectedBooking.shoot_fee>0&&(
              <div style={{ marginTop:10, padding:"8px 12px", background:"rgba(201,169,110,0.08)", borderRadius:8, display:"flex", justifyContent:"space-between" }}>
                <span style={{ color:C.muted, fontSize:12 }}>모델 정산액 ({models.find(m=>m.id===selectedBooking.model_id)?.commission||15}% 수수료 제외)</span>
                <span style={{ color:"#c9a96e", fontWeight:800 }}>{Math.round(selectedBooking.shoot_fee*(1-(models.find(m=>m.id===selectedBooking.model_id)?.commission||15)/100)).toLocaleString()}원</span>
              </div>
            )}
          </div>

          {/* 메시지 이력 */}
          <div style={{ background:C.card2, borderRadius:10, padding:14, marginBottom:14 }}>
            <p style={{ margin:"0 0 10px", fontSize:12, fontWeight:700, color:C.text }}>💬 메시지 이력</p>
            <div style={{ maxHeight:120, overflowY:"auto", display:"flex", flexDirection:"column", gap:6, marginBottom:10 }}>
              {!(selectedBooking.messages?.length) ? <p style={{ color:C.muted, fontSize:12, margin:0 }}>메시지 없음</p> :
                selectedBooking.messages.map((msg:any,i:number)=>(
                  <div key={i} style={{ fontSize:12 }}>
                    <span style={{ color:"#c9a96e", fontWeight:700 }}>{msg.sender}</span>
                    <span style={{ color:C.muted, fontSize:10 }}> · {msg.at}</span>
                    <div style={{ color:C.textSub, marginTop:2 }}>{msg.text||msg.content}</div>
                  </div>
                ))
              }
            </div>
            <div style={{ display:"flex", gap:6 }}>
              <input value={bMsgText} onChange={e=>setBMsgText(e.target.value)}
                onKeyDown={async e=>{ if(e.key==="Enter"&&bMsgText.trim()){ const msg={sender:"에이전시",text:bMsgText,at:new Date().toISOString().slice(0,10)}; const msgs=[...(selectedBooking.messages||[]),msg]; await sb("bookings","PATCH",{messages:msgs},`?id=eq.${selectedBooking.id}`); setBookings(bookings.map(b=>b.id===selectedBooking.id?{...b,messages:msgs}:b)); setSelectedBooking((p:any)=>({...p,messages:msgs})); setBMsgText(""); }}}
                placeholder="메모 또는 전달사항..."
                style={{ flex:1, background:"#22263a", border:`1px solid ${C.border}`, borderRadius:6, padding:"7px 10px", color:C.text, fontSize:12, outline:"none" }} />
              <button onClick={async()=>{ if(!bMsgText.trim())return; const msg={sender:"에이전시",text:bMsgText,at:new Date().toISOString().slice(0,10)}; const msgs=[...(selectedBooking.messages||[]),msg]; await sb("bookings","PATCH",{messages:msgs},`?id=eq.${selectedBooking.id}`); setBookings(bookings.map(b=>b.id===selectedBooking.id?{...b,messages:msgs}:b)); setSelectedBooking((p:any)=>({...p,messages:msgs})); setBMsgText(""); }} style={{ ...btnS(C.purple), padding:"7px 14px", fontSize:12 }}>기록</button>
            </div>
          </div>
          {selectedBooking.result_drive_url&&(
            <div style={{ marginBottom:14 }}>
              <a href={selectedBooking.result_drive_url} target="_blank" rel="noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:6, background:C.blue+"22", color:C.blue, border:`1px solid ${C.blue}50`, borderRadius:8, padding:"8px 14px", fontSize:13, fontWeight:600, textDecoration:"none" }}>
                📁 결과물 구글 드라이브 열기 →
              </a>
            </div>
          )}
          <button onClick={()=>{ setSelectedBooking(null); setEditingBooking(false); }} style={{ ...btnS(C.muted), width:"100%" }}>닫기</button>
        </Modal>
      )}

      {/* ════ 모달: 정산 상세 ════ */}
      {selectedSettlement&&(
        <Modal onClose={()=>setSelectedSettlement(null)}>
          <h3 style={{ marginTop:0, color:C.text }}>💰 정산 상세</h3>
          <p style={{ color:C.text }}><strong style={{ color:C.muted }}>모델:</strong> {models.find(m=>m.id===selectedSettlement.model_id)?.name}</p>
          <p style={{ color:C.text }}><strong style={{ color:C.muted }}>고객사:</strong> {customers.find(c=>c.id===selectedSettlement.customer_id)?.name}</p>
          <p style={{ fontSize:12, color:C.muted, marginBottom:6 }}>촬영비 (원)</p>
          <input style={inp} type="number" placeholder="촬영비 입력" value={editFee} onChange={e=>setEditFee(e.target.value)} />
          {editFee&&Number(editFee)>0&&(
            <div style={{ background:C.card2, borderRadius:8, padding:12, marginBottom:10, fontSize:13 }}>
              <p style={{ margin:"0 0 4px", color:C.text }}>에이전시 수수료: <strong style={{ color:C.blue }}>{Math.round(Number(editFee)*0.15).toLocaleString()}원</strong></p>
              <p style={{ margin:0, color:C.text }}>모델 수령액: <strong style={{ color:C.green }}>{Math.round(Number(editFee)*0.85).toLocaleString()}원</strong></p>
            </div>
          )}
          <p style={{ fontSize:12, color:C.muted, marginBottom:6 }}>메모</p>
          <textarea style={{ ...inp, height:70, resize:"none" }} placeholder="정산 메모" value={editMemo} onChange={e=>setEditMemo(e.target.value)} />
          <label style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14, cursor:"pointer", color:C.text }}>
            <input type="checkbox" checked={editPaid} onChange={e=>setEditPaid(e.target.checked)} />입금 완료
          </label>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={handleSaveSettlement} style={{ ...btnS(C.green), flex:1 }}>저장</button>
            <button onClick={()=>setSelectedSettlement(null)} style={{ ...btnS("#333"), flex:1 }}>취소</button>
          </div>
        </Modal>
      )}

      {/* ════ 모달: 모델 상세 ════ */}
      {selectedModel&&!mEditMode&&(
        <Modal onClose={()=>setSelectedModel(null)} wide>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <h2 style={{ margin:0, color:C.text }}>{selectedModel.name}</h2>
                {selectedModel.category&&<span style={{ background:C.card2, color:C.textSub, fontSize:12, padding:"3px 10px", borderRadius:10 }}>{selectedModel.category}</span>}
                {selectedModel.is_foreigner&&(()=>{
                  const dday=visaDday(selectedModel.visa_exit);
                  const ddayColor=dday==="만료"?C.red:C.orange;
                  return <span style={{ background:ddayColor+"22", color:ddayColor, border:`1px solid ${ddayColor}50`, fontSize:12, fontWeight:700, padding:"3px 10px", borderRadius:10 }}>✈️ {dday}</span>;
                })()}
              </div>
              <p style={{ margin:"4px 0 0", fontSize:12, color:C.muted }}>ID: {selectedModel.id}</p>
            </div>
            <button onClick={()=>openEditModel(selectedModel)} style={{ ...btnS(C.purple), fontSize:12 }}>✏️ 정보 수정</button>
            <button onClick={()=>{ setCalInitModel(selectedModel.id); setPage("calendar"); setSelectedModel(null); }} style={{ ...btnS(C.blue), fontSize:12 }}>📅 캘린더 보기</button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:16 }}>
            {[
              ["전화번호", selectedModel.phone],
              ["이메일",   selectedModel.email],
              ["기본 단가", selectedModel.rate ? `${Number(selectedModel.rate).toLocaleString()}원` : "-"],
              ["수수료율", selectedModel.commission ? `${selectedModel.commission}%` : "-"],
            ].map(([k,v])=>(
              <div key={String(k)}>
                <p style={{ margin:0, fontSize:11, color:C.muted }}>{k}</p>
                <p style={{ margin:"3px 0 0", fontSize:14, fontWeight:600, color:C.text }}>{v||"-"}</p>
              </div>
            ))}
            {selectedModel.is_foreigner&&<>
              <div><p style={{ margin:0, fontSize:11, color:C.muted }}>입국일</p><p style={{ margin:"3px 0 0", fontSize:14, fontWeight:600, color:C.text }}>{fmtDate(selectedModel.visa_entry)}</p></div>
              <div><p style={{ margin:0, fontSize:11, color:C.muted }}>출국일</p><p style={{ margin:"3px 0 0", fontSize:14, fontWeight:600, color:C.yellow }}>{fmtDate(selectedModel.visa_exit)}</p></div>
            </>}
          </div>
          {/* 링크 */}
          <div style={{ display:"flex", gap:10, marginBottom:14 }}>
            {selectedModel.instagram_url&&<a href={selectedModel.instagram_url} target="_blank" rel="noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:6, background:"#E1306C22", color:"#E1306C", border:"1px solid #E1306C50", borderRadius:8, padding:"8px 14px", fontSize:13, fontWeight:600, textDecoration:"none" }}>📸 인스타그램 열기 →</a>}
            {selectedModel.drive_url&&<a href={selectedModel.drive_url} target="_blank" rel="noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:6, background:C.blue+"22", color:C.blue, border:`1px solid ${C.blue}50`, borderRadius:8, padding:"8px 14px", fontSize:13, fontWeight:600, textDecoration:"none" }}>📁 구글 드라이브 열기 →</a>}
            {selectedModel.aimo_url&&<a href={selectedModel.aimo_url} target="_blank" rel="noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:6, background:"linear-gradient(135deg,#4f46e522,#06b6d422)", border:"1px solid #4f46e550", borderRadius:8, padding:"8px 14px", fontSize:13, fontWeight:700, textDecoration:"none", color:"#818cf8" }}>🔗 AIMO 프로필 열기 →</a>}
          </div>
          {selectedModel.memo&&<div style={{ background:C.card2, borderRadius:8, padding:12, marginBottom:14 }}><p style={{ margin:0, fontSize:12, color:C.muted }}>메모</p><p style={{ margin:"4px 0 0", fontSize:13, color:C.text }}>{selectedModel.memo}</p></div>}
          {/* 섭외 이력 */}
          <div>
            <p style={{ fontSize:13, fontWeight:700, color:C.text, margin:"0 0 10px" }}>섭외 이력 ({bookings.filter(b=>b.model_id===selectedModel.id).length}건)</p>
            {bookings.filter(b=>b.model_id===selectedModel.id).slice(0,5).map(b=>(
              <div key={b.id} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
                <div>
                  <span style={{ fontSize:13, color:C.text }}>{customers.find(c=>c.id===b.customer_id)?.name||"?"}</span>
                  <span style={{ fontSize:12, color:C.muted, marginLeft:8 }}>📅 {fmtDate(b.shoot_date)}</span>
                </div>
                <Badge code={b.status} />
              </div>
            ))}
          </div>
          <button onClick={()=>setSelectedModel(null)} style={{ ...btnS(C.muted), width:"100%", marginTop:16 }}>닫기</button>
        </Modal>
      )}

      {/* ════ 모달: 고객사 상세 ════ */}
      {selectedCustomer&&!cEditMode&&(
        <Modal onClose={()=>setSelectedCustomer(null)} wide>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <h2 style={{ margin:0, color:C.text }}>{selectedCustomer.name}</h2>
                {selectedCustomer.brand&&<span style={{ fontSize:13, color:C.blue, fontWeight:600 }}>· {selectedCustomer.brand}</span>}
                {selectedCustomer.industry&&<span style={{ background:C.card2, color:C.textSub, fontSize:12, padding:"3px 10px", borderRadius:10 }}>{selectedCustomer.industry}</span>}
              </div>
              <p style={{ margin:"4px 0 0", fontSize:12, color:C.muted }}>ID: {selectedCustomer.id}</p>
            </div>
            <button onClick={()=>openEditCustomer(selectedCustomer)} style={{ ...btnS(C.purple), fontSize:12 }}>✏️ 정보 수정</button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:16 }}>
            {[
              ["담당자명", selectedCustomer.manager_name],
              ["전화번호", selectedCustomer.phone],
              ["이메일",   selectedCustomer.email],
              ["업종",     selectedCustomer.industry],
            ].map(([k,v])=>(
              <div key={String(k)}>
                <p style={{ margin:0, fontSize:11, color:C.muted }}>{k}</p>
                <p style={{ margin:"3px 0 0", fontSize:14, fontWeight:600, color:C.text }}>{v||"-"}</p>
              </div>
            ))}
          </div>
          {selectedCustomer.memo&&<div style={{ background:C.card2, borderRadius:8, padding:12, marginBottom:14 }}><p style={{ margin:0, fontSize:12, color:C.muted }}>메모</p><p style={{ margin:"4px 0 0", fontSize:13, color:C.text }}>{selectedCustomer.memo}</p></div>}
          <div>
            <p style={{ fontSize:13, fontWeight:700, color:C.text, margin:"0 0 10px" }}>섭외 이력 ({bookings.filter(b=>b.customer_id===selectedCustomer.id).length}건)</p>
            {bookings.filter(b=>b.customer_id===selectedCustomer.id).slice(0,5).map(b=>(
              <div key={b.id} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
                <div>
                  <span style={{ fontSize:13, color:C.text }}>{models.find(m=>m.id===b.model_id)?.name||"?"}</span>
                  <span style={{ fontSize:12, color:C.muted, marginLeft:8 }}>📅 {fmtDate(b.shoot_date)}</span>
                </div>
                <Badge code={b.status} />
              </div>
            ))}
          </div>
          <button onClick={()=>setSelectedCustomer(null)} style={{ ...btnS(C.muted), width:"100%", marginTop:16 }}>닫기</button>
        </Modal>
      )}

      {/* ════ 모달: 고객사 수정 ════ */}
      {selectedCustomer&&cEditMode&&(
        <Modal onClose={()=>{setCEditMode(false);setSelectedCustomer(null);resetCustomerForm();}}>
          <h3 style={{ marginTop:0, color:C.text }}>🏢 고객사 정보 수정</h3>
          <p style={{ fontSize:11, color:C.muted, marginTop:0 }}>ID: {selectedCustomer.id}</p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>고객사명 *</label><input style={inp} value={cName} onChange={e=>setCName(e.target.value)} /></div>
            <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>브랜드명</label><input style={inp} value={cBrand} onChange={e=>setCBrand(e.target.value)} /></div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>담당자명</label><input style={inp} value={cManager} onChange={e=>setCManager(e.target.value)} /></div>
            <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>전화번호</label><input style={inp} type="tel" value={cPhone} onChange={e=>setCPhone(e.target.value)} /></div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>이메일</label><input style={inp} type="email" value={cEmail} onChange={e=>setCEmail(e.target.value)} /></div>
            <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>업종</label>
              <select style={inp} value={cIndustry} onChange={e=>setCIndustry(e.target.value)}>
                <option value="">선택</option>
                {CLIENT_INDUSTRIES.map(i=><option key={i} value={i}>{i}</option>)}
              </select>
            </div>
          </div>
          <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>메모</label>
          <textarea style={{ ...inp, height:60, resize:"none" }} value={cMemo} onChange={e=>setCMemo(e.target.value)} />
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={handleSaveCustomer} style={{ ...btnS(C.green), flex:1 }}>저장</button>
            <button onClick={()=>{setCEditMode(false);setSelectedCustomer(null);resetCustomerForm();}} style={{ ...btnS("#333"), flex:1 }}>취소</button>
          </div>
        </Modal>
      )}
      {(showModelForm||mEditMode)&&(
        <Modal onClose={()=>{setShowModelForm(false);setMEditMode(false);setSelectedModel(null);resetModelForm();}}>
          <h3 style={{ marginTop:0, color:C.text }}>{mEditMode?"👤 모델 정보 수정":"👤 모델 추가"}</h3>
          {mEditMode&&<p style={{ fontSize:11, color:C.muted, marginTop:0 }}>ID: {selectedModel?.id}</p>}

          {/* 썸네일 업로드 */}
          <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:14 }}>
            <div style={{ position:"relative", flexShrink:0 }}>
              {mThumb
                ? <img src={mThumb} alt="썸네일" style={{ width:64, height:64, borderRadius:"50%", objectFit:"cover", border:`2px solid ${C.border}` }} />
                : <div style={{ width:64, height:64, borderRadius:"50%", background:"linear-gradient(135deg,#c9a96e,#8b6a3e)", display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontWeight:800, fontSize:22 }}>{mName?mName[0]:"?"}</div>
              }
              <label style={{ position:"absolute", bottom:0, right:0, background:C.blue, borderRadius:"50%", width:22, height:22, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", border:"2px solid #1a1d27" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.5" strokeLinecap="round"/></svg>
                <input type="file" accept="image/*" style={{ display:"none" }} onChange={e=>{
                  const file = e.target.files?.[0]; if(!file) return;
                  if(file.size > 600*1024) return alert("이미지 크기는 600KB 이하만 가능합니다");
                  const reader = new FileReader();
                  reader.onload = ev => setMThumb(ev.target?.result as string);
                  reader.readAsDataURL(file);
                  e.target.value="";
                }} />
              </label>
            </div>
            <div>
              <p style={{ margin:0, fontSize:12, color:C.text, fontWeight:600 }}>프로필 사진</p>
              <p style={{ margin:"2px 0 0", fontSize:11, color:C.muted }}>600KB 이하 · JPG/PNG</p>
              {mThumb&&<button type="button" onClick={()=>setMThumb("")} style={{ marginTop:4, background:"none", border:"none", color:C.red, cursor:"pointer", fontSize:11, padding:0 }}>× 삭제</button>}
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>모델명 *</label>
              <input style={inp} value={mName} onChange={e=>setMName(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>주민번호 앞 6자리 *</label>
              <input style={inp} value={mSSN} onChange={e=>setMSSN(e.target.value)} />
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>전화번호</label>
              <input style={inp} type="tel" value={mPhone} onChange={e=>setMPhone(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>이메일</label>
              <input style={inp} type="email" value={mEmail} onChange={e=>setMEmail(e.target.value)} />
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>카테고리</label>
              <select style={inp} value={mCategory} onChange={e=>setMCategory(e.target.value)}>
                <option value="">선택</option>
                {MODEL_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>기본 단가 (원)</label>
              <input style={inp} type="text" placeholder="0"
                value={mRate ? Number(mRate).toLocaleString("ko-KR") : ""}
                onChange={e=>{ const v=e.target.value.replace(/,/g,""); if(!isNaN(Number(v))) setMRate(Number(v)); }} />
            </div>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>수수료율 (%)</label>
              <input style={inp} type="number" placeholder="15" value={mCommission||""} onChange={e=>setMCommission(Number(e.target.value))} />
            </div>
          </div>
          <label style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12, cursor:"pointer", color:C.text }}>
            <input type="checkbox" checked={mForeigner} onChange={e=>setMForeigner(e.target.checked)} />외국인 모델
          </label>
          {mForeigner&&(
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div>
                <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>입국일</label>
                <input style={inp} type="date" value={mEntry} onChange={e=>setMEntry(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>출국일</label>
                <input style={inp} type="date" value={mExit} onChange={e=>setMExit(e.target.value)} />
              </div>
            </div>
          )}

          {/* 링크 — 브랜드 아이콘 */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div>
              <label style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:"#E1306C", marginBottom:5 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" stroke="#E1306C" strokeWidth="2"/><circle cx="12" cy="12" r="4.5" stroke="#E1306C" strokeWidth="2"/><circle cx="17.5" cy="6.5" r="1.5" fill="#E1306C"/></svg>
                인스타그램
              </label>
              <input style={inp} type="text" placeholder="@아이디 또는 URL" value={mInstagram} onChange={e=>setMInstagram(e.target.value)} />
            </div>
            <div>
              <label style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:"#4285F4", marginBottom:5 }}>
                <svg width="13" height="13" viewBox="0 0 87.3 78" fill="none"><path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 53H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066DA"/><path d="M43.65 25L29.9 1.2C28.55.4 27 0 25.45 0c-1.55 0-3.1.4-4.5 1.2L6.6 11.4C5.25 12.2 4.1 13.3 3.3 14.65L43.65 25z" fill="#00AC47"/><path d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.95 0H25.45c-1.55 0-3.1.4-4.5 1.2L43.65 25z" fill="#EA4335"/><path d="M43.65 53H27.5L13.75 76.8c1.4.8 2.95 1.2 4.5 1.2h50.4c1.55 0 3.1-.4 4.5-1.2L57.4 53H43.65z" fill="#00832D"/><path d="M73.65 25H43.65l13.75 28h16.25l-2.5-4.35L87.3 25H73.65z" fill="#FFBA00"/><path d="M87.3 25H73.65L57.4 53H73.65L87.3 25z" fill="#FF6D00"/></svg>
                구글 드라이브
              </label>
              <input style={inp} type="url" placeholder="https://drive.google.com/..." value={mDrive} onChange={e=>setMDrive(e.target.value)} />
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div>
              <label style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, marginBottom:5, color:"#3A2A00" }}>
                <svg width="14" height="14" viewBox="0 0 24 24"><ellipse cx="12" cy="11" rx="10" ry="8.5" fill="#FEE500"/><circle cx="9" cy="11" r="1.2" fill="#3A1D00"/><circle cx="12" cy="11" r="1.2" fill="#3A1D00"/><circle cx="15" cy="11" r="1.2" fill="#3A1D00"/></svg>
                <span style={{ color:"#c9a000" }}>카카오톡 ID</span>
              </label>
              <input style={inp} placeholder="카카오톡 아이디" value={mKakao} onChange={e=>setMKakao(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>🏦 통장 정보</label>
              <input style={inp} placeholder="은행명 + 계좌번호" value={mBank} onChange={e=>setMBank(e.target.value)} />
            </div>
          </div>

          {/* AIMO 링크 */}
          <div>
            <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, marginBottom:5 }}>
              <span style={{ background:"linear-gradient(135deg,#4f46e5,#06b6d4)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", fontWeight:800, fontSize:13, letterSpacing:"-0.5px" }}>AIMO</span>
              <span style={{ color:C.muted }}>모델 페이지 링크 (aimo.kr)</span>
            </label>
            <input style={inp} type="url" placeholder="https://aimo.kr/models/..." value={mAimoUrl} onChange={e=>setMAimoUrl(e.target.value)} />
          </div>

          <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5, marginTop:4 }}>메모</label>
          <textarea style={{ ...inp, height:60, resize:"none" }} placeholder="특이사항" value={mMemo} onChange={e=>setMMemo(e.target.value)} />
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={mEditMode?handleSaveModel:handleAddModel} style={{ ...btnS(C.green), flex:1 }}>{mEditMode?"저장":"추가"}</button>
            <button onClick={()=>{setShowModelForm(false);setMEditMode(false);setSelectedModel(null);resetModelForm();}} style={{ ...btnS("#333"), flex:1 }}>취소</button>
          </div>
        </Modal>
      )}
      {/* ════ 모달: 고객사 추가 ════ */}
      {showCustomerForm&&(
        <Modal onClose={()=>{setShowCustomerForm(false);resetCustomerForm();}}>
          <h3 style={{ marginTop:0, color:C.text }}>🏢 고객사 추가</h3>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>고객사명 *</label>
              <input style={inp} value={cName} onChange={e=>setCName(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>브랜드명</label>
              <input style={inp} value={cBrand} onChange={e=>setCBrand(e.target.value)} />
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>담당자명</label>
              <input style={inp} value={cManager} onChange={e=>setCManager(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>전화번호 *</label>
              <input style={inp} type="tel" value={cPhone} onChange={e=>setCPhone(e.target.value)} />
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>이메일</label>
              <input style={inp} type="email" value={cEmail} onChange={e=>setCEmail(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>업종</label>
              <select style={inp} value={cIndustry} onChange={e=>setCIndustry(e.target.value)}>
                <option value="">선택</option>
                {CLIENT_INDUSTRIES.map(i=><option key={i} value={i}>{i}</option>)}
              </select>
            </div>
          </div>
          <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>메모</label>
          <textarea style={{ ...inp, height:60, resize:"none" }} placeholder="특이사항" value={cMemo} onChange={e=>setCMemo(e.target.value)} />
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={handleAddCustomer} style={{ ...btnS(C.green), flex:1 }}>추가</button>
            <button onClick={()=>{setShowCustomerForm(false);resetCustomerForm();}} style={{ ...btnS("#333"), flex:1 }}>취소</button>
          </div>
        </Modal>
      )}


      {/* ════ 모달: 프로젝트 섭외 추가 ════ */}
      {showProjectForm&&(
        <Modal onClose={()=>{ setShowProjectForm(false); resetProjectForm(); }} wide>
          <h3 style={{ marginTop:0, color:C.text }}>🗂️ 프로젝트 섭외 추가</h3>
          <p style={{ margin:"0 0 14px", fontSize:12, color:C.muted }}>공통 촬영 정보를 입력하고, 모델별 개별 금액을 설정합니다.</p>

          {/* 섭외 유형 */}
          <div style={{ marginBottom:10 }}>
            <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:6 }}>섭외 유형 *</label>
            <div style={{ display:"flex", gap:6 }}>
              {Object.entries(BOOKING_TYPES).map(([key,bt])=>(
                <button key={key} type="button" onClick={()=>setPBookingType(key)}
                  style={{ padding:"4px 11px", borderRadius:6, border:`1px solid ${pBookingType===key?bt.color:C.border}`, background:pBookingType===key?bt.color+"22":"transparent", color:pBookingType===key?bt.color:C.muted, fontSize:12, fontWeight:pBookingType===key?700:400, cursor:"pointer" }}>
                  {bt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 프로젝트명 + 고객사 */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>프로젝트명 *</label>
              <input style={inp} placeholder="예) 2026 SS 룩북" value={pName} onChange={e=>setPName(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>고객사 * {pCustomer ? <span style={{ color:C.green }}>✓</span> : null}</label>
              <input style={inp} placeholder="🔍 고객사 검색..." value={pCustSearch} onChange={e=>{ setPCustSearch(e.target.value); setPCustomer(""); }} />
              {pCustSearch&&!pCustomer&&(
                <div style={{ background:C.card2, border:`1px solid ${C.border}`, borderRadius:8, maxHeight:130, overflowY:"auto", marginTop:-8 }}>
                  {customers.filter(c=>c.name.toLowerCase().includes(pCustSearch.toLowerCase())).map(c=>(
                    <div key={c.id} onClick={()=>{ setPCustomer(c.id); setPCustSearch(c.name); }}
                      style={{ padding:"8px 12px", cursor:"pointer", fontSize:13, color:C.text }}
                      onMouseEnter={e=>(e.currentTarget.style.background=C.sideHover)}
                      onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                      {c.name}{c.brand ? ` · ${c.brand}` : ""}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 날짜 + 시간 */}
          <div style={{ background:C.card2, borderRadius:8, padding:"10px 12px", marginBottom:10 }}>
            <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:6 }}>📅 촬영 일정</label>
            <input style={{ ...inp, marginBottom:8, padding:"6px 10px", fontSize:12 }} type="date" value={pDate} onChange={e=>setPDate(e.target.value)} />
            <div style={{ display:"flex", alignItems:"flex-end", gap:16 }}>
              <TimePicker label="시작" value={pStart} onChange={setPStart} />
              <span style={{ color:C.muted, fontSize:13, paddingBottom:6 }}>~</span>
              <TimePicker label="종료" value={pEnd}   onChange={setPEnd}   />
            </div>
          </div>

          {/* 장소 + 담당자 + 상태 */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:10 }}>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>촬영 장소</label>
              <input style={inp} placeholder="스튜디오명 / 주소" value={pLocation} onChange={e=>setPLocation(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>담당 MD</label>
              <input style={inp} placeholder="담당자 이름" value={pManager} onChange={e=>setPManager(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>초기 상태</label>
              <select style={inp} value={pStatus} onChange={e=>setPStatus(e.target.value)}>
                {Object.entries(STATUS).filter(([k])=>!["COMPLETED","SETTLED","CANCELLED"].includes(k)).map(([k,v])=>(
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 촬영 유형 (촬영 타입만) */}
          {pBookingType==="SHOOT" ? (
            <div style={{ marginBottom:10 }}>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:6 }}>촬영 유형</label>
              <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                {[...SHOOT_TYPES_PHOTO,...SHOOT_TYPES_VIDEO].map(t=>(
                  <button key={t} type="button"
                    onClick={()=>setPShootTypes(prev=>prev.includes(t)?prev.filter(x=>x!==t):[...prev,t])}
                    style={{ padding:"3px 10px", borderRadius:5, border:`1px solid ${pShootTypes.includes(t)?C.blue:C.border}`, background:pShootTypes.includes(t)?C.blue+"22":"transparent", color:pShootTypes.includes(t)?C.blue:C.muted, fontSize:11, cursor:"pointer" }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* 메모 */}
          <div style={{ marginBottom:10 }}>
            <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>메모</label>
            <textarea style={{ ...inp, minHeight:56, resize:"vertical" as const }} placeholder="특이사항, 요청사항..." value={pMemo} onChange={e=>setPMemo(e.target.value)} />
          </div>

          {/* 모델 라인 */}
          <div style={{ background:C.card2, border:`1px solid ${C.blue}40`, borderRadius:10, padding:14, marginBottom:14 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <p style={{ margin:0, fontWeight:700, fontSize:13, color:C.blue }}>👥 섭외 모델 ({pModelLines.length}명)</p>
              {pModelLines.length>0 ? <span style={{ fontSize:11, color:C.muted }}>모델별 개별 금액 설정</span> : null}
            </div>

            {/* 모델 검색 */}
            <div style={{ marginBottom: pModelLines.length>0 ? 12 : 0 }}>
              <input style={{ ...inp, marginBottom:0 }} placeholder="🔍 모델 검색 후 클릭으로 추가..." value={pModelSearch} onChange={e=>setPModelSearch(e.target.value)} />
              {pModelSearch ? (
                <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, maxHeight:150, overflowY:"auto", marginTop:2 }}>
                  {models.filter(m=>m.name.toLowerCase().includes(pModelSearch.toLowerCase())&&!pModelLines.find(l=>l.modelId===m.id)).length===0
                    ? <p style={{ padding:"9px 14px", color:C.muted, fontSize:12, margin:0 }}>검색 결과 없음</p>
                    : models.filter(m=>m.name.toLowerCase().includes(pModelSearch.toLowerCase())&&!pModelLines.find(l=>l.modelId===m.id)).map(m=>(
                      <div key={m.id} onClick={()=>addProjectModelLine(m.id)}
                        style={{ padding:"9px 14px", cursor:"pointer", display:"flex", alignItems:"center", gap:8, borderBottom:`1px solid ${C.border}` }}
                        onMouseEnter={e=>(e.currentTarget.style.background=C.sideHover)}
                        onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                        {m.thumb_url
                          ? <img src={m.thumb_url} alt="" style={{ width:26, height:26, borderRadius:"50%", objectFit:"cover", flexShrink:0 }} />
                          : <div style={{ width:26, height:26, borderRadius:"50%", background:"linear-gradient(135deg,#c9a96e,#8b6a3e)", display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:11, fontWeight:800, flexShrink:0 }}>{m.name[0]}</div>
                        }
                        <div style={{ flex:1 }}>
                          <span style={{ fontWeight:700, color:C.text, fontSize:13 }}>{m.name}</span>
                          {m.category ? <span style={{ fontSize:11, color:C.muted, marginLeft:6 }}>{m.category}</span> : null}
                          {m.rate>0 ? <span style={{ fontSize:11, color:"#c9a96e", marginLeft:6 }}>기본단가 {m.rate.toLocaleString()}원</span> : null}
                          {m.is_foreigner ? <span style={{ fontSize:11, color:C.yellow, marginLeft:6 }}>✈️ {visaDday(m.visa_exit)}</span> : null}
                        </div>
                        <span style={{ fontSize:11, color:C.blue, fontWeight:700 }}>+ 추가</span>
                      </div>
                    ))
                  }
                </div>
              ) : null}
            </div>

            {/* 모델별 금액 라인 */}
            {pModelLines.length>0 ? (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {pModelLines.map((line, idx)=>{
                  const m = models.find(mm=>mm.id===line.modelId);
                  const bt = BOOKING_TYPES[pBookingType]||BOOKING_TYPES.SHOOT;
                  return (
                    <div key={line.modelId} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 12px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom: bt.hasContract ? 10 : 0 }}>
                        <span style={{ width:20, height:20, borderRadius:"50%", background:C.blue+"33", color:C.blue, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:800, flexShrink:0 }}>{idx+1}</span>
                        {m?.thumb_url
                          ? <img src={m.thumb_url} alt="" style={{ width:28, height:28, borderRadius:"50%", objectFit:"cover", flexShrink:0 }} />
                          : <div style={{ width:28, height:28, borderRadius:"50%", background:"linear-gradient(135deg,#c9a96e,#8b6a3e)", display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:11, fontWeight:800, flexShrink:0 }}>{(m?.name||"?")[0]}</div>
                        }
                        <div style={{ flex:1 }}>
                          <span style={{ fontWeight:700, fontSize:13, color:C.text }}>{m?.name||"?"}</span>
                          {m?.category ? <span style={{ fontSize:11, color:C.muted, marginLeft:6 }}>{m.category}</span> : null}
                        </div>
                        <button type="button" onClick={()=>removeProjectModelLine(line.modelId)} style={{ background:"none", border:"none", color:C.red, cursor:"pointer", fontSize:18, lineHeight:1, padding:"0 4px" }}>×</button>
                      </div>
                      {bt.hasContract ? (
                        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
                          <MoneyInput label="계약 총액" value={line.fee}    onChange={v=>updateProjectModelLine(line.modelId,"fee",v)} />
                          <MoneyInput label="계약금"    value={line.deposit} onChange={v=>updateProjectModelLine(line.modelId,"deposit",v)} />
                          <MoneyInput label="잔금"      value={line.balance} onChange={v=>updateProjectModelLine(line.modelId,"balance",v)} />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                {BOOKING_TYPES[pBookingType]?.hasContract && pModelLines.length>1 ? (
                  <div style={{ display:"flex", justifyContent:"flex-end", gap:16, padding:"8px 12px", background:C.card2, borderRadius:8, fontSize:12 }}>
                    <span style={{ color:C.muted }}>총 계약:</span>
                    <span style={{ color:"#c9a96e", fontWeight:800 }}>{pModelLines.reduce((s,l)=>s+l.fee,0).toLocaleString()}원</span>
                    <span style={{ color:C.muted, marginLeft:8 }}>계약금 합계:</span>
                    <span style={{ color:C.green, fontWeight:800 }}>{pModelLines.reduce((s,l)=>s+l.deposit,0).toLocaleString()}원</span>
                  </div>
                ) : null}
              </div>
            ) : (
              <p style={{ textAlign:"center", color:C.muted, fontSize:12, margin:"12px 0 0", padding:"12px 0", borderTop:`1px dashed ${C.border}` }}>
                위 검색창에서 모델을 추가하세요
              </p>
            )}
          </div>

          <div style={{ display:"flex", gap:10 }}>
            <button onClick={()=>{ setShowProjectForm(false); resetProjectForm(); }} style={{ ...btnS("#333"), flex:1 }}>취소</button>
            <button onClick={handleAddProject} style={{ ...btnS(C.green), flex:2, fontWeight:800 }}>
              🗂️ 프로젝트 등록 {pModelLines.length>0 ? `(모델 ${pModelLines.length}명)` : ""}
            </button>
          </div>
        </Modal>
      )}


      {/* ════ 모달: 단건 섭외 추가 ════ */}
      {showBookingForm&&(
        <Modal onClose={()=>{setShowBookingForm(false);resetBookingForm();}} wide>
          <h3 style={{ marginTop:0, color:C.text }}>📋 단건 섭외 추가</h3>

          {/* 섭외 유형 */}
          <div style={{ marginBottom:10 }}>
            <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:6 }}>섭외 유형 *</label>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {Object.entries(BOOKING_TYPES).map(([key, bt])=>(
                <button key={key} type="button" onClick={()=>setBBookingType(key)}
                  style={{ padding:"4px 11px", borderRadius:6, border:`1px solid ${bBookingType===key?bt.color:C.border}`, background:bBookingType===key?bt.color+"22":"transparent", color:bBookingType===key?bt.color:C.muted, fontSize:12, fontWeight:bBookingType===key?700:400, cursor:"pointer", transition:"all 0.15s" }}>
                  {bt.label}
                </button>
              ))}
            </div>
          </div>
          {/* 모델 선택 (단일) */}
          <div style={{ marginBottom:10 }}>
            <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>
              모델 * {bModel&&(()=>{ const m=models.find(mm=>mm.id===bModel); return m?<span style={{ color:C.green, marginLeft:4 }}>✓ {m.name}</span>:null; })()}
            </label>
            {/* 선택된 모델 칩 */}
            {bModel&&(()=>{ const m=models.find(mm=>mm.id===bModel); return m?(
              <div style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"4px 10px", background:C.green+"22", border:`1px solid ${C.green}50`, borderRadius:20, fontSize:12, marginBottom:8 }}>
                {m.thumb_url&&<img src={m.thumb_url} alt="" style={{ width:16, height:16, borderRadius:"50%", objectFit:"cover" }} />}
                <span style={{ color:C.text, fontWeight:600 }}>{m.name}</span>
                {m.category&&<span style={{ color:C.muted, fontSize:11 }}>{m.category}</span>}
                <span onClick={()=>{ setBModel(""); setBModelSearch(""); }} style={{ color:C.muted, cursor:"pointer", fontSize:14, lineHeight:1, marginLeft:2 }}>×</span>
              </div>
            ):null; })()}
            {!bModel&&(
              <>
                <input style={inp} placeholder="🔍 모델 이름 검색..." value={bModelSearch} onChange={e=>{ setBModelSearch(e.target.value); setBModel(""); }} />
                {bModelSearch&&(
                  <div style={{ background:C.card2, border:`1px solid ${C.border}`, borderRadius:8, maxHeight:160, overflowY:"auto", marginTop:-8, marginBottom:10 }}>
                    {models.filter(m=>m.name.toLowerCase().includes(bModelSearch.toLowerCase())).length===0
                      ? <p style={{ padding:"10px 14px", color:C.muted, fontSize:12, margin:0 }}>검색 결과 없음</p>
                      : models.filter(m=>m.name.toLowerCase().includes(bModelSearch.toLowerCase())).map(m=>(
                        <div key={m.id} onClick={()=>{ setBModel(m.id); setBModelSearch(m.name); }}
                          style={{ padding:"9px 14px", cursor:"pointer", display:"flex", alignItems:"center", gap:8, borderBottom:`1px solid ${C.border}` }}
                          onMouseEnter={e=>(e.currentTarget.style.background=C.sideHover)}
                          onMouseLeave={e=>(e.currentTarget.style.background="transparent")}
                        >
                          {m.thumb_url
                            ? <img src={m.thumb_url} alt="" style={{ width:26, height:26, borderRadius:"50%", objectFit:"cover", flexShrink:0 }} />
                            : <div style={{ width:26, height:26, borderRadius:"50%", background:"linear-gradient(135deg,#c9a96e,#8b6a3e)", display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:11, fontWeight:800, flexShrink:0 }}>{m.name[0]}</div>
                          }
                          <div style={{ flex:1 }}>
                            <span style={{ fontWeight:700, color:C.text, fontSize:13 }}>{m.name}</span>
                            {m.category&&<span style={{ fontSize:11, color:C.muted, marginLeft:6 }}>{m.category}</span>}
                            {m.is_foreigner&&<span style={{ fontSize:11, color:C.yellow, marginLeft:6 }}>✈️ {visaDday(m.visa_exit)}</span>}
                          </div>
                        </div>
                      ))
                    }
                  </div>
                )}
              </>
            )}
          </div>

          {/* 고객사 검색 */}
          <div style={{ marginBottom:10 }}>
            <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>고객사 * {bCustomer&&<span style={{ color:C.green }}>✓ {customers.find(c=>c.id===bCustomer)?.name}</span>}</label>
            <input style={inp} placeholder="🔍 고객사 이름 검색..." value={bCustomerSearch} onChange={e=>{ setBCustomerSearch(e.target.value); setBCustomer(""); }} />
            {bCustomerSearch&&!bCustomer&&(
              <div style={{ background:C.card2, border:`1px solid ${C.border}`, borderRadius:8, maxHeight:160, overflowY:"auto", marginTop:-8, marginBottom:10 }}>
                {customers.filter(c=>c.name.toLowerCase().includes(bCustomerSearch.toLowerCase())||c.brand?.toLowerCase().includes(bCustomerSearch.toLowerCase())).length===0
                  ? <p style={{ padding:"10px 14px", color:C.muted, fontSize:12, margin:0 }}>검색 결과 없음</p>
                  : customers.filter(c=>c.name.toLowerCase().includes(bCustomerSearch.toLowerCase())||c.brand?.toLowerCase().includes(bCustomerSearch.toLowerCase())).map(c=>(
                    <div key={c.id} onClick={()=>{ setBCustomer(c.id); setBCustomerSearch(c.name); }} style={{ padding:"10px 14px", cursor:"pointer", display:"flex", alignItems:"center", gap:8, borderBottom:`1px solid ${C.border}` }}
                      onMouseEnter={e=>(e.currentTarget.style.background=C.sideHover)}
                      onMouseLeave={e=>(e.currentTarget.style.background="transparent")}
                    >
                      <span style={{ fontWeight:700, color:C.text }}>{c.name}</span>
                      {c.brand&&<span style={{ fontSize:11, color:C.muted }}>{c.brand}</span>}
                      {c.industry&&<span style={{ fontSize:11, color:C.muted }}>{c.industry}</span>}
                    </div>
                  ))
                }
              </div>
            )}
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>프로젝트명</label>
              <input style={inp} value={bProject} onChange={e=>setBProject(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>촬영 장소</label>
              <input style={inp} value={bLocation} onChange={e=>setBLocation(e.target.value)} placeholder="예: 스튜디오 A" />
            </div>
          </div>

          {/* 날짜 + 시간 */}
          <div style={{ background:C.card2, borderRadius:8, padding:"10px 12px", marginBottom:10 }}>
            <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:6 }}>📅 촬영 일정</label>
            <input style={{ ...inp, marginBottom:8, padding:"6px 10px", fontSize:12 }} type="date" value={bDate} onChange={e=>setBDate(e.target.value)} />
            <div style={{ display:"flex", alignItems:"flex-end", gap:16 }}>
              <TimePicker label="시작" value={bStart} onChange={setBStart} />
              <span style={{ color:C.muted, fontSize:13, paddingBottom:6 }}>~</span>
              <TimePicker label="종료" value={bEnd}   onChange={setBEnd}   />
            </div>
          </div>

          {/* 촬영 유형 - 사진/영상 그룹 */}
          <div style={{ marginBottom:10 }}>
            <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:8 }}>촬영 유형 (복수 선택 가능)</label>
            <div style={{ marginBottom:8 }}>
              <p style={{ margin:"0 0 6px", fontSize:11, color:C.textSub, fontWeight:600 }}>📸 사진</p>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {SHOOT_TYPES_PHOTO.map(opt=>(
                  <button key={opt} type="button" onClick={()=>{const next=bShootTypes.includes(opt)?bShootTypes.filter(v=>v!==opt):[...bShootTypes,opt];setBShootTypes(next);}} style={{ padding:"5px 12px", border:`1px solid ${bShootTypes.includes(opt)?C.blue:C.border}`, borderRadius:20, fontSize:12, cursor:"pointer", background:bShootTypes.includes(opt)?C.blue+"22":"#22263a", color:bShootTypes.includes(opt)?C.blue:C.textSub, fontWeight:bShootTypes.includes(opt)?700:400 }}>{opt}</button>
                ))}
              </div>
            </div>
            <div>
              <p style={{ margin:"0 0 6px", fontSize:11, color:C.textSub, fontWeight:600 }}>🎬 영상</p>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {SHOOT_TYPES_VIDEO.map(opt=>(
                  <button key={opt} type="button" onClick={()=>{const next=bShootTypes.includes(opt)?bShootTypes.filter(v=>v!==opt):[...bShootTypes,opt];setBShootTypes(next);}} style={{ padding:"5px 12px", border:`1px solid ${bShootTypes.includes(opt)?C.purple:C.border}`, borderRadius:20, fontSize:12, cursor:"pointer", background:bShootTypes.includes(opt)?C.purple+"22":"#22263a", color:bShootTypes.includes(opt)?C.purple:C.textSub, fontWeight:bShootTypes.includes(opt)?700:400 }}>{opt}</button>
                ))}
              </div>
            </div>
          </div>

          {/* 사용 범위 + 기간 */}
          <MultiCheck label="사용 범위" options={USAGE_SCOPES} value={bUsageScope} onChange={setBUsageScope} />
          <div style={{ marginBottom:10 }}>
            <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:6 }}>사용 기간</label>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {USAGE_PERIODS.map(p=>(
                <button key={p} type="button" onClick={()=>setBUsagePeriod(bUsagePeriod===p?"":p)} style={{ padding:"5px 14px", border:`1px solid ${bUsagePeriod===p?C.green:C.border}`, borderRadius:20, fontSize:12, cursor:"pointer", background:bUsagePeriod===p?C.green+"22":"#22263a", color:bUsagePeriod===p?C.green:C.textSub, fontWeight:bUsagePeriod===p?700:400 }}>{p}</button>
              ))}
            </div>
          </div>

          {/* 금액 — 촬영 타입만 표시 */}
          {BOOKING_TYPES[bBookingType]?.hasContract&&(
          <div style={{ background:C.card2, borderRadius:8, padding:14, marginBottom:10 }}>
            <p style={{ margin:"0 0 12px", fontSize:12, fontWeight:700, color:C.yellow }}>💰 계약 금액</p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
              <MoneyInput label="계약 총액" value={bBudget}  onChange={setBBudget}  />
              <MoneyInput label="계약금"    value={bDeposit} onChange={setBDeposit} />
              <MoneyInput label="잔금"      value={bBalance} onChange={setBBalance} />
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:4 }}>
              <div>
                <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>계약금 입금 예정일</label>
                <input style={inp} type="date" value={bDepositDue} onChange={e=>setBDepositDue(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>잔금 입금 예정일</label>
                <input style={inp} type="date" value={bBalanceDue} onChange={e=>setBBalanceDue(e.target.value)} />
              </div>
            </div>
          </div>
          )}

          {/* 담당자 + 상태 + 메모 */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>담당자</label>
              <select style={inp} value={bManager} onChange={e=>setBManager(e.target.value)}>
                <option value="">선택</option>
                {members.map(m=><option key={m.id} value={m.name}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>섭외 상태</label>
              <select style={inp} value={bStatus} onChange={e=>setBStatus(e.target.value)}>
                {Object.entries(STATUS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>메모</label>
          <textarea style={{ ...inp, height:60, resize:"none" }} placeholder="특이사항" value={bMemo} onChange={e=>setBMemo(e.target.value)} />
          <div>
            <label style={{ fontSize:11, color:C.blue, display:"block", marginBottom:5 }}>📁 결과물 구글 드라이브 URL (선택)</label>
            <input style={inp} type="url" placeholder="https://drive.google.com/..." value={bResultDrive} onChange={e=>setBResultDrive(e.target.value)} />
          </div>

          <div style={{ display:"flex", gap:10 }}>
            <button onClick={handleAddBooking} style={{ ...btnS(C.green), flex:1 }}>추가</button>
            <button onClick={()=>{setShowBookingForm(false);resetBookingForm();}} style={{ ...btnS("#333"), flex:1 }}>취소</button>
          </div>
        </Modal>
      )}

      {/* ════ 모달: 담당자 추가 ════ */}
      {showMemberForm&&(
        <Modal onClose={()=>setShowMemberForm(false)}>
          <h3 style={{ marginTop:0, color:C.text }}>👥 담당자 추가</h3>
          <p style={{ fontSize:12, color:C.muted, marginTop:0 }}><strong style={{ color:C.text }}>{agency.name}</strong> 소속으로 추가됩니다.</p>
          <input style={inp} type="text"     placeholder="이름 *"                   value={memName}  onChange={e=>setMemName(e.target.value)}  />
          <input style={inp} type="text"     placeholder="직위 (예: 매니저)"          value={memPos}   onChange={e=>setMemPos(e.target.value)}   />
          <input style={inp} type="tel"      placeholder="전화번호"                  value={memPhone} onChange={e=>setMemPhone(e.target.value)} />
          <input style={inp} type="email"    placeholder="이메일 *"                  value={memEmail} onChange={e=>setMemEmail(e.target.value)} />
          <input style={inp} type="password" placeholder="초기 비밀번호 (6자 이상) *" value={memPw}    onChange={e=>setMemPw(e.target.value)}    />
          <p style={{ fontSize:11, color:C.muted, margin:"-4px 0 12px" }}>💡 비밀번호는 담당자에게 별도 전달하세요</p>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={handleAddMember} style={{ ...btnS(C.green), flex:1 }}>추가</button>
            <button onClick={()=>setShowMemberForm(false)} style={{ ...btnS("#333"), flex:1 }}>취소</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
