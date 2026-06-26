import React from "react";
import { useState, useEffect, useMemo, useRef, lazy, Suspense, type ComponentType } from "react";
import { C, inp, btnS } from "./theme";
import {
  APP_VERSION, SESSION_KEY, DATA_CACHE_KEY, STATUS, BOOKING_TYPES,
  PLAN_FEATURES, PLANS, getTotalMemberLimit,
  MODEL_CATEGORIES, GENDERS, MODEL_FIELDS, HAIR_LENGTHS, EYE_COLORS, CLIENT_INDUSTRIES, SHOOT_TYPES_PHOTO, SHOOT_TYPES_VIDEO,
  USAGE_SCOPES, USAGE_PERIODS, USAGE_REGIONS, COUNTRIES, HOURS, MINS, statusOptionsForType,
  FEATURE_DISTRIBUTION,
} from "./constants";
import { generateModelId, generateCastId, genderNatCode, natTypeOf, nextModelSeq, nextCastSeq, randomId } from "./lib/ids";
import type { AuthMode, Page } from "./constants";
import { sb, sbAuth, setAuthTokens, getAuthTokens, refreshSession, setOnAuthFail, persistThumb } from "./lib/supabase";
import { loadSharedSchedule, type SharedBusy } from "./lib/distribution";
import {
  fmt, fmtNum, parseNum, pad, fmtDate, fmt12, fmtTime,
  toHHMM, parseHHMM, toMin, scheduleConflict, visaViolation,
  makeModelId, makeClientId, normalizeInstagram, visaDday, getTrialDaysLeft, ageFromSSN6, validateBizNo,
  bookingTotal, overchargeTotal, clientBalance, bookingAgencyFee, bookingModelPay,
  modelTaxType, modelGross, modelWithholding, clientCharge,
  bookingSession, sessionLabel, foreignerRate, payCfg,
} from "./lib/utils";
import Badge from "./components/Badge";
import BizLicenseUpload from "./components/BizLicenseUpload";
import CategorySelect from "./components/CategorySelect";
import type { BizLicenseInfo } from "./lib/ocr";
import TypeIcon from "./components/TypeIcon";
import Modal from "./components/Modal";
import CloseButton from "./components/CloseButton";
import TimePicker from "./components/TimePicker";
import MultiCheck from "./components/MultiCheck";
import MoneyInput from "./components/MoneyInput";
import ErrorBoundary from "./components/ErrorBoundary";
// 코드 스플릿 청크 로드 실패(주로 새 배포로 옛 해시 청크 소멸) 시 1회 자동 새로고침 → 검은 화면 대신 정상 복구.
// 직전 자동 새로고침이 10초 이내면 무한 루프로 보고 에러를 던져 ErrorBoundary가 폴백을 표시.
function lazyRetry<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(() => factory().catch((err) => {
    try {
      const KEY = "modiq_chunk_reload_at";
      const last = Number(sessionStorage.getItem(KEY) || 0);
      if (Date.now() - last > 10000) {
        sessionStorage.setItem(KEY, String(Date.now()));
        window.location.reload();
        return new Promise<{ default: T }>(() => {}); // 새로고침 대기(영구 pending) → 깜빡임/에러 표시 방지
      }
    } catch {}
    throw err;
  }));
}
const CalendarView = lazyRetry(() => import("./views/CalendarView"));
import { Home, Calendar, ClipboardList, User, Users, Building2, Store, Coins, CreditCard, Pencil, Save, Folder, FolderOpen, Plane, Link2, Banknote, MessageSquare, Crown, PartyPopper, AlertTriangle, Ban, Camera, Clapperboard, Lightbulb, Sun, Moon, Menu, Search, ExternalLink, TrendingUp, Gauge, CalendarCheck, ClipboardCheck, Mannequin, Building, BarChart, CoinStack, Agents, CardCheck, CardStack, Settings, AimoMark, Handshake } from "./components/icons";
import { useIsMobile } from "./lib/useIsMobile";
import { sendAlimtalkBoth } from "./lib/alimtalk";
import DashboardView from "./views/DashboardView"; // 첫 화면 — 즉시 렌더 위해 메인 번들에 포함(지연 로딩 제외)
const BookingsView = lazyRetry(() => import("./views/BookingsView"));
const ModelsView = lazyRetry(() => import("./views/ModelsView"));
const CustomersView = lazyRetry(() => import("./views/CustomersView"));
const SettlementView = lazyRetry(() => import("./views/SettlementView"));
const MembersView = lazyRetry(() => import("./views/MembersView"));
const PlanView = lazyRetry(() => import("./views/PlanView"));
const RevenueView = lazyRetry(() => import("./views/RevenueView"));
const CompanyView = lazyRetry(() => import("./views/CompanyView"));
const PackagesView = lazyRetry(() => import("./views/PackagesView"));
const ModelStudioView = lazyRetry(() => import("./views/ModelStudioView"));
const PackagePublicView = lazyRetry(() => import("./views/PackagePublicView"));
const CalendarAddView = lazyRetry(() => import("./views/CalendarAddView"));
const CalSubscribeView = lazyRetry(() => import("./views/CalSubscribeView"));
const DistributionView = lazyRetry(() => import("./views/DistributionView"));
import { bookingToCalEvent, calShareUrl, genCalToken, calSubscribePageUrl } from "./lib/calendar";
import { sendCalEmail, sendCancelEmail, sendInviteEmail } from "./lib/email";
import { gcalSync } from "./lib/gcal";
import type { Pkg } from "./lib/packages";
import { useBackClose, topBack } from "./lib/backstack";
import BulkUploadModal from "./components/BulkUploadModal";
import CompCardModal from "./components/CompCardModal";
import SettlementStatementModal from "./components/SettlementStatementModal";

// ── 프리텐다드 폰트 로드 ──
(()=>{
  if (!document.getElementById("pretendard-font")) {
    const link = document.createElement("link");
    link.id = "pretendard-font";
    link.rel = "stylesheet";
    link.media = "print"; link.onload = () => { link.media = "all"; }; // 비차단 로드
    link.href = "/fonts/pretendard-subset.css";
    document.head.appendChild(link);
  }
  const style = document.getElementById("pretendard-global") || document.createElement("style");
  style.id = "pretendard-global";
  style.textContent = `@font-face { font-family: 'Pretendard-fallback'; src: local('Apple SD Gothic Neo'), local('AppleSDGothicNeo-Regular'), local('Malgun Gothic'), local('Noto Sans KR'), local('Roboto'); size-adjust: 105.6%; ascent-override: 95.2%; descent-override: 24.1%; line-gap-override: 0%; }
*, *::before, *::after { box-sizing: border-box; font-family: 'Pretendard', 'Pretendard-fallback', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', sans-serif !important; }\nhtml, body { margin: 0; padding: 0; background: var(--c-bg); max-width: 100%; overflow-x: hidden; }
:root { --c-bg:#0f1117; --c-card:#1a1d27; --c-card2:#22263a; --c-border:#2a2d3e; --c-text:#f0f2f5; --c-text-sub:#c8ccd8; --c-muted:#9aa1ad; --c-sidebar:#111318; --c-side-hover:#1e2128; --c-nav-active:#23262e; }
@media (max-width: 767px) { input, select, textarea { font-size: 16px !important; } }
html.light { --c-bg:#f7f8fa; --c-card:#ffffff; --c-card2:#f1f3f5; --c-border:#e2e5ea; --c-text:#111827; --c-text-sub:#3f4754; --c-muted:#5b626d; --c-sidebar:#fbfbfc; --c-side-hover:#eef0f3; --c-nav-active:#e9ecef; }\n#root { min-height: 100vh; }
/* 전역 폰트 확대 — 인라인 px 폰트를 한 번에 키우기 위해 루트 비례 확대. 웹 ~+2pt / 모바일 ~+1pt 체감. (조정 가능) */
#root { zoom: 1.14; }
@media (max-width: 767px) { #root { zoom: 1.07; } }`;
  if (!document.getElementById("pretendard-global")) document.head.appendChild(style);
})();

// ═══════════════
// 코드 스플리팅 로딩 표시 (lazy 뷰 fallback)
function PageLoading() {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:"60px 20px", color:C.muted, fontSize:14 }}>
      불러오는 중…
    </div>
  );
}

export default function App() {

  const [authMode,    setAuthMode]    = useState<AuthMode>("login");
  // 첫 렌더부터 저장된 세션을 동기적으로 복원 → 로그인 화면 깜빡임 없이 즉시 대시보드 표시(토큰 검증은 백그라운드)
  const _savedSession = (() => { try { const s = JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); return s?.tokens?.refresh_token ? s : null; } catch { return null; } })();
  // 🔒 보호 영역(CLAUDE.md "대시보드 로딩/첫 화면" 참조) — 임의 수정 금지.
  // 저장된 세션의 에이전시 데이터 캐시를 첫 렌더부터 동기 주입 → 대시보드 숫자 0 깜빡임 방지(이후 백그라운드 최신화)
  const _cachedData = (() => { try { const agId = _savedSession?.agencyData?.id; if (!agId) return null; const c = JSON.parse(localStorage.getItem(DATA_CACHE_KEY) || "null"); return (c && c.agencyId === agId) ? c : null; } catch { return null; } })();
  const [session,     setSession]     = useState<any>(_savedSession?.user || null);
  const [agency,      setAgency]      = useState<any>(_savedSession?.agencyData || null);
  const [myRole,      setMyRole]      = useState<"owner"|"member">(_savedSession?.role || "member");
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [agencyName,  setAgencyName]  = useState("");
  const [bizNo,       setBizNo]       = useState("");
  const [authError,   setAuthError]   = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false); // 이메일 인증 메일 발송됨(가입 후 인증 대기)
  const [syncing, setSyncing] = useState(!!_savedSession); // 세션 있으면 첫 동기화 전까지 스켈레톤(데이터 비었을 때 0 대신)

  const [models,    setModels]    = useState<any[]>(_cachedData?.models || []);
  const [customers, setCustomers] = useState<any[]>(_cachedData?.customers || []);
  const [bookings,  setBookings]  = useState<any[]>(_cachedData?.bookings || []);
  const [projects,  setProjects]  = useState<any[]>(_cachedData?.projects || []);
  const [modelOffs,   setModelOffs]   = useState<any[]>([]); // 모델별 휴무 기간
  const [packages,    setPackages]    = useState<Pkg[]>([]); // 모델 사진 패키지
  const [selectedProjectId, setSelectedProjectId] = useState<string|null>(null); // 프로젝트 상세
  const isMobile = useIsMobile();
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [theme, setTheme] = useState<string>(()=>{ try { return localStorage.getItem("modiq_theme")||"dark"; } catch { return "dark"; } });
  useEffect(()=>{ document.documentElement.classList.toggle("light", theme==="light"); try { localStorage.setItem("modiq_theme", theme); } catch {} }, [theme]);
  // 구글 캘린더 연동 콜백 복귀(?gcal=ok|fail): 새 탭이 modiq로 돌아오면 안내 후 URL 정리(새로고침 반복 방지).
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const g = sp.get("gcal");
      if (!g) return;
      const em = sp.get("email") || "";
      if (g === "ok") alert("✅ 구글 캘린더 연동 완료" + (em ? `\n연동 계정: ${em}` : "") + (sp.get("already") ? "\n(이미 연동돼 있어요)" : ""));
      else alert("구글 캘린더 연동을 마치지 못했어요.\n이미 연동돼 있을 수 있으니 회사정보에서 상태를 확인하거나, 잠시 후 다시 시도해 주세요.");
      ["gcal","email","already","reason"].forEach(k=>sp.delete(k));
      const qs = sp.toString();
      window.history.replaceState(null, "", window.location.pathname + (qs ? "?" + qs : "") + window.location.hash);
    } catch {}
  }, []);
  const [members,   setMembers]   = useState<any[]>(_cachedData?.members || []);

  const [page, setPage] = useState<Page>("dashboard");
  // 캘린더를 벗어나면 pre-선택(모델/날짜)을 비워, 메뉴로 재진입 시 항상 "전체"로 복귀
  useEffect(() => { if (page !== "calendar") { setCalInitModel(""); setCalInitDate(null); } }, [page]);
  const [calInitModel, setCalInitModel] = useState("");  // 모델 상세 → 캘린더 이동 시 pre-선택
  const [calInitDate,  setCalInitDate]  = useState<string|null>(null); // 대시보드 → 캘린더 특정 날짜 패널 자동 오픈(1회성)
  const [studioInitModel, setStudioInitModel] = useState("");  // 모델 수정 → 스튜디오 이동 시 pre-선택
  const [planBilling, setPlanBilling] = useState<"monthly"|"yearly">("monthly");

  // 필터
  const [modelQ,      setModelQ]      = useState("");
  // 받은(대대행) 발송 중 '아직 유효한' 출처 발송 id 집합 — 만료/철회된 출처의 편입 모델은 목록에서 자동 숨김.
  // distIdsLoaded=false(조회 전·실패)면 숨기지 않음(오숨김 방지).
  const [activeDistIds, setActiveDistIds] = useState<Set<string>>(new Set());
  const [distIdsLoaded, setDistIdsLoaded] = useState(false);
  // 편입(대대행) 모델의 A쪽 점유일 — source_model_id 기준 라이브 조회. 모델 캘린더에 '외부 점유'로 표시.
  const [sharedBusy, setSharedBusy] = useState<Record<string, SharedBusy[]>>({});
  // 대대행 모델: A쪽(발송처) 점유일이면 그 날은 사용 불가(날짜 단위·시간 비공개) → 섭외 시 HOLD 판정에 사용.
  // ⚠️ B가 이미 그 모델로 같은 날 잡아둔 건이 있으면 제외(A가 B 일정을 등록해 되돌아온 '반사' 중복 방지).
  const subAgencyBusy = (model: any, date?: string): boolean =>
    !!model?.source_model_id && !!date &&
    (sharedBusy[model.source_model_id] || []).some((x: any) => (x.shoot_date || "").slice(0, 10) === date) &&
    !bookings.some((b: any) => b.model_id === model.id && b.shoot_date === date && b.status !== "CANCELLED");
  const [customerQ,   setCustomerQ]   = useState("");
  const [bookingQ,    setBookingQ]    = useState("");
  const [bookingStatusF,  setBookingStatusF]  = useState("ALL");
  const [bookingTypeF,    setBookingTypeF]    = useState("ALL");
  const [bookingManagerF, setBookingManagerF] = useState("ALL");
  const [bookingMonthF,   setBookingMonthF]   = useState("ALL");
  const [settlementTab,     setSettlementTab]     = useState<"PENDING"|"SETTLED"|"UNPAID">("PENDING");
  const [settlementMonth,   setSettlementMonth]   = useState("ALL");
  const [settlementModel,   setSettlementModel]   = useState("ALL");
  const [settlementMgr,     setSettlementMgr]     = useState("ALL");
  const [settlementProject, setSettlementProject] = useState("ALL");
  const [settlementClient,  setSettlementClient]  = useState("ALL"); // 정산 고객사 필터

  // 모달
  const [showModelForm,    setShowModelForm]    = useState(false);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [bulkEntity,       setBulkEntity]       = useState<null|"model"|"customer">(null); // 대량 등록 모달
  const [showStatement,    setShowStatement]    = useState(false); // 정산 내역서 모달
  const [showBookingForm,  setShowBookingForm]  = useState(false);
  const [showAddPicker,    setShowAddPicker]    = useState(false);
  const [addPrefill,       setAddPrefill]       = useState<{date?:string; model?:string}>({});
  const [showProjectForm,  setShowProjectForm]  = useState(false);
  const [editingBooking,   setEditingBooking]   = useState(false); // 섭외 상세 편집 모드
  const [bookingBaseline, setBookingBaseline] = useState(""); // 섭외 편집 시작 스냅샷(변경감지)

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
  const [pUsageRegion,setPUsageRegion]= useState("국내");
  const [pMemo,       setPMemo]       = useState("");
  const [pStatus,     setPStatus]     = useState("INQUIRY");
  // 프로젝트 모델 라인 (모델별 개별 금액)
  const [pModelLines, setPModelLines] = useState<{modelId:string; fee:number; deposit:number; balance:number; depositDue:string; balanceDue:string; search:string; date:string; start:string; end:string; location:string}[]>([]);
  const [pDeposit, setPDeposit] = useState(0);
  const [pDepositDue, setPDepositDue] = useState("");
  const [pBalanceDue, setPBalanceDue] = useState("");
  const [pModelSearch,setPModelSearch]= useState("");

  const resetProjectForm = () => {
    setPName(""); setPCustomer(""); setPCustSearch(""); setPDate(""); setPStart(""); setPEnd("");
    setPLocation(""); setPManager(""); setPBookingType("SHOOT"); setPShootTypes([]); setPUsageScope([]);
    setPUsagePeriod(""); setPUsageRegion("국내"); setPMemo(""); setPStatus("INQUIRY"); setPModelLines([]); setPModelSearch(""); setPMedia([]); setPRefImages([]); setPRefVideos([]); setPDeposit(0); setPDepositDue(""); setPBalanceDue("");
  };

  const addProjectModelLine = (modelId: string) => {
    if (pModelLines.find(l=>l.modelId===modelId)) return;
    setPModelLines(prev=>{ const last=prev[prev.length-1]; return [...prev, { modelId, fee:0, deposit:0, balance:0, depositDue:"", balanceDue:"", search:"", date:last?.date||"", start:last?.start||"", end:last?.end||"", location:last?.location||"" }]; });
    setPModelSearch("");
  };
  const removeProjectModelLine = (modelId: string) => setPModelLines(prev=>prev.filter(l=>l.modelId!==modelId));
  const updateProjectModelLine = (modelId: string, field: string, value: any) =>
    setPModelLines(prev=>prev.map(l=>l.modelId===modelId?{...l,[field]:value}:l));

  const handleAddProject = async () => {
    if (!pName)                return alert("프로젝트명 필수");
    if (!pCustomer)            return alert("고객사 필수");
    if (pModelLines.length===0) return alert("모델 1명 이상 추가");
    const noDate = pModelLines.find(l=>!l.date);
    if (noDate) return alert(`${models.find(m=>m.id===noDate.modelId)?.name||"모델"}의 촬영일을 입력하세요`);

    // 촬영 프로젝트: 같은 날 미팅/피팅/오디션은 촬영 우선 → 미팅 HOLD 처리
    const meetingsToHold:string[]=[];
    if (pBookingType==="SHOOT") {
      const warns:string[]=[];
      for (const l of pModelLines) {
        const lDate=l.date||pDate, lStart=l.start||pStart, lEnd=l.end||pEnd;
        const ms=bookings.filter(b=>b.model_id===l.modelId&&b.shoot_date===lDate&&b.status!=="CANCELLED"&&b.status!=="HOLD"&&!BOOKING_TYPES[b.booking_type||"SHOOT"]?.hasContract&&scheduleConflict(lStart,lEnd,b.start_time,b.end_time,"SHOOT",b.booking_type,l.location||pLocation,b.location).conflict);
        ms.forEach(b=>meetingsToHold.push(b.id));
        if (ms.length>0) { const nm=models.find(m=>m.id===l.modelId)?.name||"모델"; const lb=[...new Set(ms.map(b=>BOOKING_TYPES[b.booking_type||"SHOOT"]?.label))].join(", "); warns.push(`· ${nm} — ${fmtDate(lDate)} ${lb}`); }
      }
      if (warns.length>0) {
        const ok = window.confirm(`⚠️ 아래 모델은 촬영일과 같은 날 미팅 일정이 있습니다.\n${warns.join("\n")}\n\n촬영이 우선이라 해당 미팅은 HOLD로 변경됩니다.\n[확인] 촬영 등록 + 미팅 HOLD (고객사와 일정 조율 필요)\n[취소] 등록 중단`);
        if (!ok) return;
      }
    }

    const projId = randomId("PRJ");
    const _agNo = (agency as any).agency_no || 1;
    const _baseCastSeq = nextCastSeq(bookings, _agNo);
    const proj = {
      id: projId, name: pName, customer_id: pCustomer, shoot_date: pDate,
      start_time: pStart, end_time: pEnd, location: pLocation, manager: pManager,
      booking_type: pBookingType, shoot_types: pShootTypes, usage_scope: pUsageScope,
      usage_period: pUsagePeriod, usage_region: pUsageRegion, memo: pMemo, status: pStatus,
      model_count: pModelLines.length, agency_id: agency.id,
      created_at: new Date().toISOString(),
    };

    const newBookings: any[] = [];
    const holdWarnings: string[] = [];

    for (let i=0; i<pModelLines.length; i++) {
      const line = pModelLines[i];
      const model = models.find(m=>m.id===line.modelId);
      const visa = visaViolation(model, line.date||pDate);
      if (visa) return alert(`비자 오류 [${model?.name}]: ${visa}`);

      const lDate=line.date||pDate, lStart=line.start||pStart, lEnd=line.end||pEnd, lLoc=line.location||pLocation;
      const _totalFee=pModelLines.reduce((sm,l)=>sm+l.fee,0);
      const depShare=_totalFee>0?Math.round(pDeposit*line.fee/_totalFee):0;
      const conflicts = bookings.filter(b=>b.model_id===line.modelId&&b.shoot_date===lDate&&b.status!=="CANCELLED");
      let autoHold = false; let holdReason = "";
      for (const b of conflicts) {
        const bIsShoot = !!BOOKING_TYPES[b.booking_type||"SHOOT"]?.hasContract;
        if (pBookingType==="SHOOT" && !bIsShoot) continue; // 촬영 vs 미팅: 미팅은 위에서 HOLD 처리 (촬영은 통과)
        const c = scheduleConflict(lStart, lEnd, b.start_time, b.end_time, pBookingType, b.booking_type, lLoc, b.location);
        if (c.conflict) { autoHold = true; holdReason = c.reason; break; }
      }
      // 대대행: A쪽(발송처) 점유일이면 그 모델은 그 날 불가 → HOLD (날짜 단위)
      if (!autoHold && subAgencyBusy(model, lDate)) { autoHold = true; holdReason = `${model?.source_agency_name || "발송처"} 스케줄 확인 요망`; }
      const finalStatus = autoHold ? "HOLD" : pStatus;
      const nb = {
        id:generateCastId(_agNo, _baseCastSeq+i), project_id: projId, model_id: line.modelId,
        customer_id: pCustomer, booking_type: pBookingType, shoot_date: lDate,
        start_time: lStart, end_time: lEnd, manager: pManager, status: finalStatus,
        project_name: pName, location: lLoc, shoot_types: pShootTypes,
        usage_scope: pUsageScope, usage_period: pUsagePeriod, usage_region: pUsageRegion,
        shoot_fee: line.fee, deposit_amt: depShare, deposit_due: pDepositDue,
        balance_amt: line.fee-depShare, balance_due: pBalanceDue,
        memo: pMemo, commission_rate: 15, is_paid: false, settlement_memo: "",
        messages: [], agency_id: agency.id,
        ...(pRefImages.length>0?{reference_images:pRefImages}:{}),
        ...(pRefVideos.length>0?{reference_videos:pRefVideos}:{}),
      };
      newBookings.push(nb);
      if (autoHold) holdWarnings.push(`${model?.name}: ${holdReason}`);
    }

    try {
      await sb("projects","POST",proj);
      for (const nb of newBookings) await sb("bookings","POST",nb);
      for (const mid of meetingsToHold) await sb("bookings","PATCH",{status:"HOLD"},`?id=eq.${mid}`);
      setProjects(prev=>[proj,...prev]);
      setBookings(prev=>{ const held=prev.map(b=>meetingsToHold.includes(b.id)?{...b,status:"HOLD"}:b); return [...newBookings,...held]; });
      resetProjectForm(); setShowProjectForm(false);
      if (holdWarnings.length>0) alert(`⚠️ HOLD 처리된 모델\n${holdWarnings.join("\n")}`);
      else if (meetingsToHold.length>0) alert(`✅ 프로젝트 등록 완료 — 모델 ${newBookings.length}명\n겹치는 미팅 ${meetingsToHold.length}건이 HOLD로 변경됐습니다.`);
      else alert(`✅ 프로젝트 등록 완료 — 모델 ${newBookings.length}명`);
    } catch(e) { alert("프로젝트 추가 실패: "+String(e)); }
  };
  const [showMemberForm,   setShowMemberForm]   = useState(false);
  const [selectedBooking,    setSelectedBooking]    = useState<any>(null);
  const [selectedModel,      setSelectedModel]      = useState<any>(null);
  const [compModel,          setCompModel]          = useState<any>(null); // 컴카드 모달 대상(모델 DB 상세에서 열기)
  const [showSendMenu,       setShowSendMenu]       = useState(false); // 섭외 상세 '일정 보내기' 선택창
  const [selectedCustomer,   setSelectedCustomer]   = useState<any>(null); // 고객사 상세
  const [selectedSettlement, setSelectedSettlement] = useState<any>(null);
  const [modalStack, setModalStack] = useState<{type:string; id:string}[]>([]); // 모달 백스택: 닫으면 직전 상세로 복귀
  const [navHover, setNavHover] = useState(false); // 좌측 메뉴 호버 시 펼침
  // 터치 기기(태블릿/패드 등)는 hover가 풀리지 않아, 사이드바를 탭으로 펼친 뒤 메뉴를 골라도
  // navHover가 true로 남아 안 닫힌다. 페이지가 바뀌면 hover 불가 기기에서만 강제로 접는다.
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(hover: none)").matches) setNavHover(false);
  }, [page]);
  const [mEditMode, setMEditMode] = useState(false);
  const [modelHistAll, setModelHistAll] = useState(false);
  const [showCareer, setShowCareer] = useState(false); // 모델 상세 경력 펼침
  const [custHistAll, setCustHistAll] = useState(false);
  const [cEditMode, setCEditMode] = useState(false); // 고객사 수정 모드

  // 섭외 추가 - 검색
  const [bModelSearch,    setBModelSearch]    = useState("");
  const [bCustomerSearch, setBCustomerSearch] = useState("");

  // ── 모델 폼 ──
  const [mName,      setMName]      = useState("");
  const [mSSN,       setMSSN]       = useState("");
  const [mAddress,    setMAddress]    = useState("");   // 모델 주소 (세무신고용)
  const [mNationalId, setMNationalId] = useState("");   // 식별번호 평문 (저장 후 즉시 비움)
  const [showIdInput, setShowIdInput] = useState(false); // 마스킹 대신 입력칸 표시
  const [mPhone,     setMPhone]     = useState("");
  const [mEmail,     setMEmail]     = useState("");
  const [mCategory,  setMCategory]  = useState("");
  const [mCareerYears, setMCareerYears] = useState(""); // 경력(년) — 수동 숫자 입력, 소수 가능
  const [mGender,    setMGender]    = useState(""); // 성별 M/F (ID 생성용)
  const [mBirthYear, setMBirthYear] = useState(""); // 출생연도(YYYY) — 발송용
  const [mRate,      setMRate]      = useState(0);
  const [mCountry,     setMCountry]     = useState("대한민국");
  const [mEntry,       setMEntry]       = useState("");
  const [mExit,        setMExit]        = useState("");
  // 외국인 모델
  const [mIsForeign,   setMIsForeign]   = useState(false);
  const [mVisaType,    setMVisaType]    = useState("");   // 'E6'|'C4'|'OTHER'
  const [mHasAlienCard,setMHasAlienCard]= useState(false);
  const [mPayMethod,   setMPayMethod]   = useState("");   // 'bank'|'payoneer'|'wise'|'cash'
  const [mPayDetail,   setMPayDetail]   = useState<any>({});
  const [mTaxRate,     setMTaxRate]     = useState<number>(0);
  const [showForeignModal, setShowForeignModal] = useState(false);
  const [mInstagram,   setMInstagram]   = useState("");
  const [mDrive,       setMDrive]       = useState("");
  const [mKakao,       setMKakao]       = useState("");
  const [mBank,        setMBank]        = useState("");
  const [mBankName,    setMBankName]    = useState(""); // 은행명
  const [mBankAcct,    setMBankAcct]    = useState(""); // 계좌번호
  const [mThumb,       setMThumb]       = useState("");
  const [mAimoUrl,     setMAimoUrl]     = useState("");
  const [mMemo,        setMMemo]        = useState("");
  // ── 신체/프로필 확장 ──
  const [mHeight,      setMHeight]      = useState("");
  const [mShoe,        setMShoe]        = useState("");
  const [mBust,        setMBust]        = useState("");
  const [mWaist,       setMWaist]       = useState("");
  const [mHip,         setMHip]         = useState("");
  const [mHair,        setMHair]        = useState("");
  const [mEye,         setMEye]         = useState("");
  const [mTattoo,      setMTattoo]      = useState(false);
  const [mUnderwear,   setMUnderwear]   = useState(false);
  const [mFields,      setMFields]      = useState<string[]>([]);
  const [mSpecialty,   setMSpecialty]   = useState("");
  const [mCareer,      setMCareer]      = useState(""); // 경력(작품·활동 이력)
  const [mCareerOpen,  setMCareerOpen]  = useState(false); // 수정폼 경력 입력칸 펼침
  const [mFollowers,   setMFollowers]   = useState("");
  const [mHairColor,   setMHairColor]   = useState("");
  const [mSizeUnit,    setMSizeUnit]    = useState<"cm"|"inch">("inch"); // 3사이즈 입력 단위(기본 inch, 저장은 항상 cm)
  // 정산 세무: 유형 + 기본 정산방식(섭외에서 미지정 시 사용)
  const [mTaxType,  setMTaxType]  = useState<"foreigner"|"freelancer"|"company">("freelancer");
  // 대대행(소속사) 모델: 모델 개인정보 대신 '소속 에이전시' 정보로 정산(세금계산서 10%)
  const [mAgencyName,    setMAgencyName]    = useState(""); // 소속 에이전시명
  const [mAgencyContact, setMAgencyContact] = useState(""); // 담당자명
  const [mAgencyPhone,   setMAgencyPhone]   = useState(""); // 담당자 연락처
  const [mAgencyEmail,   setMAgencyEmail]   = useState(""); // 에이전시 이메일(일정·정산 연락)
  const [mAgencyBizNo,   setMAgencyBizNo]   = useState(""); // 사업자등록번호(세금계산서)
  const [mPayType,  setMPayType]  = useState<"rate"|"fixed">("fixed");
  const [mPayValue, setMPayValue] = useState(0); // (구) 단일 정산값 — 하위호환
  // 정산방식 값(세션별): 비율이면 %, 정액이면 원
  const [mPayDayValue,  setMPayDayValue]  = useState(0);
  const [mPayHalfValue, setMPayHalfValue] = useState(0);
  const [mPayHourValue, setMPayHourValue] = useState(0);
  // 모델료(원): Day(9h) / Half day(5h) / Hour(1h)
  const [mFeeDay,  setMFeeDay]  = useState(0);
  const [mFeeHalf, setMFeeHalf] = useState(0);
  const [mFeeHour, setMFeeHour] = useState(0);

  // ── 고객사 폼 ──
  const [cName,       setCName]       = useState("");
  const [cBrand,      setCBrand]      = useState("");
  const [cManager,    setCManager]    = useState("");
  const [cPhone,      setCPhone]      = useState("");
  const [cEmail,      setCEmail]      = useState("");
  const [cIndustry,   setCIndustry]   = useState("");
  const [cBizNo,      setCBizNo]      = useState("");   // 사업자등록번호
  const [cTaxEmail,   setCTaxEmail]   = useState("");   // 계산서 발송 이메일
  const [cMemo,       setCMemo]       = useState("");
  const [cRepName,    setCRepName]    = useState("");   // 대표자(성명)
  const [cAddress,    setCAddress]    = useState("");   // 사업장 주소
  const [cBizType,    setCBizType]    = useState("");   // 업태
  const [cBizItem,    setCBizItem]    = useState("");   // 종목
  const [cCategory,   setCCategory]   = useState("");   // 분야

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
  const [bUsageRegion,setBUsageRegion]= useState("국내");
  const [bBudget,       setBBudget]       = useState(0);
  const [bDeposit,      setBDeposit]      = useState(0);
  const [bDepositDue,   setBDepositDue]   = useState("");
  const [bBalance,      setBBalance]      = useState(0);
  const [bBalanceDue,   setBBalanceDue]   = useState("");
  const [bResultDrive,  setBResultDrive]  = useState("");
  // 섭외 상세 모달 — 추가금(오버차지) 입력
  const [bocReason,     setBocReason]     = useState("");
  const [bocAmount,     setBocAmount]     = useState(0);
  const [showBocInput,  setShowBocInput]  = useState(false);
  const [bMedia,        setBMedia]        = useState<string[]>([]); // 사진/영상 1차 선택
  const [bRefImages,    setBRefImages]    = useState<string[]>([]); // 촬영 레퍼런스
  const [pRefImages,    setPRefImages]    = useState<string[]>([]); // 프로젝트 레퍼런스
  const [bRefVideos,    setBRefVideos]    = useState<string[]>([]); // 영상 링크 (단일)
  const [pRefVideos,    setPRefVideos]    = useState<string[]>([]); // 영상 링크 (프로젝트)
  const [pMedia,        setPMedia]        = useState<string[]>([]); // 프로젝트 사진/영상
  const [lightboxSrc,   setLightboxSrc]   = useState<string|null>(null);
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
  const [editPaid, setEditPaid] = useState(false);          // 고객사 입금완료
  const [editModelPaid, setEditModelPaid] = useState(false); // 모델 지급완료
  const [editOvercharges, setEditOvercharges] = useState<{reason:string; amount:number}[]>([]);
  const [ocReason, setOcReason] = useState("");
  const [ocAmount, setOcAmount] = useState(0);
  const [showOcInput, setShowOcInput] = useState(false);
  // 정산 내역서용: 섭외별 정산방식 override + 단계별 날짜·상태
  const [editPayType,    setEditPayType]    = useState<""|"rate"|"fixed">("");  // ""=모델 기본값 사용
  const [editPayValue,   setEditPayValue]   = useState("");
  const [editDepositPaid,setEditDepositPaid]= useState(false);
  const [editDepositDate,setEditDepositDate]= useState("");
  const [editBalancePaid,setEditBalancePaid]= useState(false);
  const [editBalanceDate,setEditBalanceDate]= useState("");
  const [editInvoiceIssued,setEditInvoiceIssued]= useState(false);
  const [editInvoiceDate,setEditInvoiceDate]= useState("");
  const [editModelPaidDate,setEditModelPaidDate]= useState("");

  // ──────────────────────────────────────────────
  // 초기화
  // ──────────────────────────────────────────────
  useEffect(() => {
    try { sessionStorage.removeItem("modiq_boot_retry"); } catch {} // 마운트 성공 → 부팅 로드실패 안전장치 플래그 해제
    // 세션 만료/무효 시 reload(부팅 스플래시 재노출) 대신, 화면 내에서 로그인 화면으로 즉시 전환
    setOnAuthFail(()=>{ localStorage.removeItem(SESSION_KEY); setAuthTokens(null,null); setSession(null); setAgency(null); setMyRole("member"); });
    const saved = localStorage.getItem(SESSION_KEY);
    if (!saved) return;
    (async () => {
      try {
        const { user, agencyData, role, tokens } = JSON.parse(saved);
        if (!tokens?.refresh_token) { localStorage.removeItem(SESSION_KEY); return; } // 구버전 세션 → 재로그인
        setAuthTokens(tokens.access_token||null, tokens.refresh_token);
        // 1) 세션·캐시를 즉시 적용해 화면과 숫자를 바로 표시 (네트워크 응답 대기 없음)
        setSession(user); setAgency(agencyData); setMyRole(role);
        restoreDataCache(agencyData.id);
        // 2) 토큰을 먼저 갱신해 신선한 access token을 확보한 뒤 데이터 조회.
        //    (병렬 실행 시 만료된 access token으로 쿼리가 401 → 쿼리마다 refresh가 동시 폭주하는
        //     레이스가 발생해 간헐적으로 로딩이 풀리지 않거나 로그인 화면으로 튕겼다. 순차 실행으로 제거.)
        let fresh = await refreshSession();       // 서버 검증 + 토큰 갱신
        if (!fresh) { await new Promise(s=>setTimeout(s,500)); fresh = await refreshSession(); } // 일시 실패(네트워크/토큰회전) 1회 재시도 → 로그인 튕김 방지
        if (!fresh) { localStorage.removeItem(SESSION_KEY); setAuthTokens(null,null); setSession(null); setAgency(null); setMyRole("member"); return; } // reload 대신 인라인 로그인 전환(스플래시 재노출 방지)
        await loadData(agencyData.id);              // 갱신된 토큰으로 최신 데이터 조회
        localStorage.setItem(SESSION_KEY, JSON.stringify({ user, agencyData, role, tokens:getAuthTokens() }));
      } catch { localStorage.removeItem(SESSION_KEY); }
    })();
  }, []);

  const saveSession = (u: any, ag: any, role: "owner"|"member") =>
    localStorage.setItem(SESSION_KEY, JSON.stringify({ user:u, agencyData:ag, role, tokens:getAuthTokens() }));

  // ── 데이터 캐시 (재방문 시 숫자 즉시 표시) ──
  // 이미지 등 큰 문자열은 제외해 localStorage 용량 초과 방지 (숫자/카운트 계산엔 불필요)
  const slimForCache = (rows:any[]) => {
    if (!Array.isArray(rows)) return [];
    return rows.map(r => {
      const o:any = {};
      for (const k in r) {
        const v = (r as any)[k];
        if (typeof v === "string" && v.length > 300) continue;
        if (Array.isArray(v) && v.some(x => typeof x === "string" && x.length > 300)) continue;
        o[k] = v;
      }
      return o;
    });
  };
  const saveDataCache = (agencyId:string, d:any) => {
    try { localStorage.setItem(DATA_CACHE_KEY, JSON.stringify({ agencyId, t:Date.now(), ...d })); } catch {}
  };
  const restoreDataCache = (agencyId:string):boolean => {
    try {
      const raw = localStorage.getItem(DATA_CACHE_KEY); if (!raw) return false;
      const c = JSON.parse(raw); if (c.agencyId !== agencyId) return false;
      if (c.models)    setModels(c.models);
      if (c.customers) setCustomers(c.customers);
      if (c.bookings)  setBookings(c.bookings);
      if (c.projects)  setProjects(c.projects);
      if (c.members)   setMembers(c.members);
      return true;
    } catch { return false; }
  };

  // 모델 일반 조회 컬럼 — 무거운 base64 이미지 컬럼(compcard ~2MB/8행)을 제외해 첫 로딩 속도 개선.
  // compcard는 컴카드 생성/저장 전용이라 어디서도 표시·조회하지 않으므로 빼도 안전(편집 PATCH에도 미포함).
  // ⚠️ models 테이블에 컬럼을 추가하면 이 목록에도 추가할 것(누락 시 그 값이 안 불러와짐).
  const MODEL_COLS = "id,name,ssn6,phone,is_foreigner,visa_entry,visa_exit,memo,agency_id,created_at,email,category,rate,commission,instagram_url,drive_url,kakao_id,bank_info,aimo_url,payout_tax_type,payout_pay_type,payout_pay_value,payout_biz_no,country,height,shoe,bust,waist,hip,hair_length,hair_color,eye_color,tattoo,underwear_ok,fields,specialty,instagram_followers,photos,cal_token,gender,nationality_type,visa_type,has_alien_card,payment_method,payment_detail,tax_rate,payout_day_value,payout_half_value,fee_day,fee_half,fee_hour,payout_hour_value,liked_photos,career,national_id_masked,national_id_type,address,agency_name,agency_contact,agency_phone,agency_email,agency_biz_no,career_years,thumb_url,birth_year,share_consent";
  // V4 대대행 출처 컬럼(마이그레이션 적용 후 존재) — 미적용 환경에선 loadData가 자동 폴백
  const MODEL_COLS_V4 = MODEL_COLS + ",source_agency_id,source_agency_name,source_distribution_id,source_model_id";

  const loadData = async (agencyId: string) => {
    setSyncing(true);
    // 🔒 보호 영역(CLAUDE.md "대시보드 로딩/첫 화면" 참조) — 임의 수정 금지.
    // 대시보드 필수 데이터(섭외·모델·고객사·프로젝트)는 함께 받아 '한 번에' 반영 → 부분 0 깜빡임 방지.
    // ⚠️ 필수 4종을 따로따로 set 하면 부분 0 깜빡임 재발.
    // 담당자(members) 등 비필수는 그 뒤 백그라운드로 점진적 로딩(대시보드 표시를 막지 않음).
    const fetched: Record<string, any[]> = {};
    let allOk = true;
    const fetch1 = async (table: string, query: string): Promise<any[]|null> => {
      try { const rows = await sb(table,"GET",null,query); fetched[table] = rows||[]; return rows||[]; }
      catch (e) { allOk = false; console.error(`로드 실패: ${table}`, e); return null; }
    };
    // 모델: V4 출처 컬럼 포함 조회 → 컬럼 미존재(마이그레이션 전)면 기본 컬럼으로 1회 폴백(앱 깨짐 방지)
    const fetchModels = async (): Promise<any[]|null> => {
      const q = (cols:string) => `?agency_id=eq.${agencyId}&order=created_at.desc&select=${cols}`;
      try { const rows = await sb("models","GET",null,q(MODEL_COLS_V4)); fetched["models"]=rows||[]; return rows||[]; }
      catch {
        try { const rows = await sb("models","GET",null,q(MODEL_COLS)); fetched["models"]=rows||[]; return rows||[]; }
        catch (e2) { allOk=false; console.error("로드 실패: models", e2); return null; }
      }
    };
    const [mm, cc, bb, pp] = await Promise.all([
      fetchModels(),
      fetch1("customers", `?agency_id=eq.${agencyId}&order=created_at.desc`),
      fetch1("bookings",  `?agency_id=eq.${agencyId}&order=shoot_date.desc`),
      fetch1("projects",  `?agency_id=eq.${agencyId}&order=created_at.desc`),
    ]);
    if (mm) setModels(mm); if (cc) setCustomers(cc); if (bb) setBookings(bb); if (pp) setProjects(pp);
    setSyncing(false); // 대시보드 데이터 준비 완료 → 스켈레톤 해제(나머지는 이어서 점진적)
    const mb = await fetch1("agency_members", `?agency_id=eq.${agencyId}`);
    if (mb) setMembers(mb);
    // 캐시는 전부 성공했을 때만 저장(부분 실패 시 기존 캐시 보존)
    if (allOk) saveDataCache(agencyId, {
      models:slimForCache(fetched.models||[]), customers:slimForCache(fetched.customers||[]),
      bookings:slimForCache(fetched.bookings||[]), projects:slimForCache(fetched.projects||[]),
      members:slimForCache(fetched.agency_members||[]),
    });
    try {
      const mo = await sb("model_offs","GET",null,`?agency_id=eq.${agencyId}&order=start_date.desc`);
      setModelOffs(mo||[]);
    } catch { setModelOffs([]); } // model_offs 테이블 미생성 시 무시
    // 받은(대대행) 발송 중 유효한 출처 id 집합 — 만료/철회된 출처의 편입 모델 자동 숨김용.
    // 실패(테이블 미생성/RLS) 시 distIdsLoaded=false 유지 → 숨기지 않음(안전).
    try {
      const recs = await sb("distribution_recipients","GET",null,`?recipient_agency_id=eq.${agencyId}&select=distribution:talent_distributions(id,status,expires_at)`);
      const now = Date.now();
      const ids = new Set<string>();
      (recs||[]).forEach((r:any)=>{ const d=r.distribution; if (d && d.status==="active" && (!d.expires_at || new Date(d.expires_at).getTime()>now)) ids.add(d.id); });
      setActiveDistIds(ids); setDistIdsLoaded(true);
    } catch { setDistIdsLoaded(false); }
    // 편입 모델의 A쪽 점유일(가용일) 라이브 조회 — source_model_id 보유 모델만.
    try {
      const srcIds = (mm||[]).map((m:any)=>m.source_model_id).filter(Boolean);
      if (srcIds.length) setSharedBusy(await loadSharedSchedule(srcIds));
    } catch { /* RPC 미적용/실패 시 표시만 생략(안전) */ }
    // ⚠️ packages(사진 패키지)는 용량이 매우 커서 첫 진입에서 제외 — 패키지/스튜디오 진입 시 지연 로딩(loadPackages)
  };

  // 패키지(사진) 지연 로딩 — 패키지/스튜디오 페이지 첫 진입 때만 1회 조회
  const packagesLoadedRef = useRef(false);
  // 목록은 무거운 items(사진)/brand_logo를 제외하고 경량 조회 → 상세는 열 때 지연 로딩(PackagesView.hydrate)
  const LIGHT_PKG_COLS = "id,agency_id,title,client_name,layout,memo,show_brand,brand_name,share_token,is_public,created_at,item_count";
  const loadPackages = async (agencyId: string) => {
    if (packagesLoadedRef.current) return;
    packagesLoadedRef.current = true;
    try {
      let pk: any;
      try {
        pk = await sb("packages","GET",null,`?agency_id=eq.${agencyId}&order=created_at.desc&select=${LIGHT_PKG_COLS}`);
      } catch {
        // item_count 컬럼 미생성(package_item_count_setup.sql 미실행) → 전체 조회로 폴백
        pk = await sb("packages","GET",null,`?agency_id=eq.${agencyId}&order=created_at.desc`);
      }
      setPackages(pk||[]);
    } catch { setPackages([]); packagesLoadedRef.current = false; } // 실패 시 재시도 허용
  };
  useEffect(() => {
    if ((page==="packages"||page==="studio") && agency?.id) loadPackages(agency.id);
  }, [page, agency?.id]);

  // ── 인증 ──
  // 에이전시 생성(가입 즉시 또는 이메일 인증 후 첫 로그인) — 공통 헬퍼
  const provisionAgency = async (user: any, em: string, name: string, bizNoNorm: string) => {
    const agId = `AGY_${Date.now()}`;
    // 에이전시+대표 멤버를 SECURITY DEFINER RPC로 원자 생성(owner_id=auth.uid() 서버 강제 → RLS 안전)
    const res = await sb("rpc/create_agency_for_owner", "POST", { p_id: agId, p_name: name, p_biz_no: bizNoNorm, p_email: em });
    const agencyData = (Array.isArray(res) ? res[0] : res) || { id:agId, name, biz_no:bizNoNorm, owner_id:user.id, owner_email:em, plan:"trial", additional_members:0, trial_ends_at:new Date(Date.now()+14*24*60*60*1000).toISOString(), created_at:new Date().toISOString() };
    try { localStorage.removeItem("modiq_pending"); } catch {}
    setSession(user); setAgency(agencyData); setMyRole("owner");
    saveSession(user, agencyData, "owner");
    await loadData(agencyData.id);
  };

  const handleSignup = async () => {
    if (!email||!password||!agencyName||!bizNo) return setAuthError("모든 항목을 입력하세요");
    if (password.length < 6) return setAuthError("비밀번호 6자 이상");
    const bizNoNorm = bizNo.replace(/[^0-9]/g,"");
    if (!validateBizNo(bizNoNorm)) return setAuthError("올바른 사업자등록번호가 아닙니다 (10자리·체크섬 확인)");
    setAuthLoading(true); setAuthError("");
    try {
      let authRes: any;
      try {
        authRes = await sbAuth("signup", { email, password });
      } catch (e: any) {
        // 이미 가입된 이메일(이전 시도에서 계정만 만들어진 '고아' 계정 포함)이면 로그인으로 세션을 얻어 이어서 진행(복구)
        if (/already.*regist|registered|user_already_exists|email.*exist/i.test(String(e?.message || e)))
          authRes = await sbAuth("token?grant_type=password", { email, password });
        else throw e;
      }
      // ⚠️ GoTrue 버전/설정에 따라 /signup 응답에 세션(access_token)이 없을 수 있다(이메일 확인 OFF여도).
      // 세션 없이 곧장 INSERT하면 anon 권한으로 실행돼 RLS(42501 "new row violates ...")로 막힌다.
      // → 반드시 세션(JWT)을 확보한 뒤에만 agencies/agency_members를 생성한다.
      let access = authRes.access_token || authRes.session?.access_token || null;
      let refresh = authRes.refresh_token || authRes.session?.refresh_token || null;
      let user = authRes.user || (authRes.id ? authRes : null);
      // 세션이 없으면: 이메일 인증 ON(미인증) 또는 일부 설정에서 signup이 세션 미발급 → 로그인 시도로 구분
      if (!access) {
        try {
          const login = await sbAuth("token?grant_type=password", { email, password });
          access = login.access_token || null; refresh = login.refresh_token || null; user = login.user || user;
        } catch (le: any) {
          // 미인증이면 인증 메일 대기 안내. 에이전시는 인증 후 첫 로그인에서 생성 — 가입정보 임시 보관.
          if (/confirm|인증/i.test(String(le?.message || le))) {
            try { localStorage.setItem("modiq_pending", JSON.stringify({ email, name: agencyName, biz_no: bizNoNorm })); } catch {}
            setConfirmSent(true); setAuthMode("login");
            return;
          }
          throw le;
        }
      }
      if (!access || !user?.id) throw new Error("세션 생성에 실패했습니다. 잠시 후 다시 시도해주세요.");
      setAuthTokens(access, refresh);
      await provisionAgency(user, email, agencyName, bizNoNorm);
    } catch (e: any) {
      const msg = String(e?.message||e);
      if (/duplicate|unique|conflict|23505/i.test(msg)) setAuthError("이미 등록된 사업자번호입니다. 대표/관리자에게 담당자 초대를 요청하세요.");
      else setAuthError(msg||"회원가입 실패");
    }
    finally { setAuthLoading(false); }
  };

  const handleLogin = async () => {
    if (!email||!password) return setAuthError("이메일과 비밀번호를 입력하세요");
    setAuthLoading(true); setAuthError("");
    try {
      const authRes = await sbAuth("token?grant_type=password", { email, password });
      setAuthTokens(authRes.access_token||null, authRes.refresh_token||null);
      const user = authRes.user;
      const memberRows = await sb("agency_members","GET",null,`?user_id=eq.${user.id}`);
      if (!memberRows?.length) {
        const agRows = await sb("agencies","GET",null,`?owner_id=eq.${user.id}`);
        if (!agRows?.length) {
          // 이메일 인증 완료 후 첫 로그인: 보관해둔 가입정보로 에이전시 생성
          let pending: any = null;
          try { pending = JSON.parse(localStorage.getItem("modiq_pending")||"null"); } catch {}
          if (pending?.email===email && pending?.name && pending?.biz_no) { await provisionAgency(user, email, pending.name, pending.biz_no); return; }
          throw new Error("가입 정보를 찾지 못했어요. 회원가입을 다시 진행해 주세요.");
        }
        const agencyData = agRows[0];
        setSession(user); setAgency(agencyData); setMyRole("owner");
        saveSession(user, agencyData, "owner");
        restoreDataCache(agencyData.id); // 🔒 보호(CLAUDE.md 참조): 캐시 있으면 숫자 즉시 표시 → 로그인 직후 빈 스켈레톤 방지. 제거 금지.
        await loadData(agencyData.id);
      } else {
        const member = memberRows[0];
        const agRows = await sb("agencies","GET",null,`?id=eq.${member.agency_id}`);
        const agencyData = agRows[0];
        const role = member.role==="owner"?"owner":"member";
        setSession(user); setAgency(agencyData); setMyRole(role);
        saveSession(user, agencyData, role);
        restoreDataCache(agencyData.id); // 🔒 보호(CLAUDE.md 참조): 캐시 있으면 숫자 즉시 표시 → 로그인 직후 빈 스켈레톤 방지. 제거 금지.
        await loadData(agencyData.id);
      }
    } catch (e: any) {
      const m = String(e?.message||e);
      setAuthError(/confirm|인증/i.test(m) ? "이메일 인증이 필요해요.\n받은 메일의 인증 링크를 먼저 눌러 주세요." : (m||"로그인 실패"));
    }
    finally { setAuthLoading(false); }
  };

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(DATA_CACHE_KEY);
    packagesLoadedRef.current = false;
    setAuthTokens(null, null);
    setSession(null); setAgency(null); setMyRole("member");
    setEmail(""); setPassword(""); setAgencyName("");
    setModels([]); setCustomers([]); setBookings([]); setMembers([]); setPackages([]);
    setPage("dashboard");
  };

  // ── 모델 추가 ──
  // 외국인 '국내 계좌이체' 지급정보를 표시용 통장(bank_info)에 미러링 — 기존 통장값이 비어있을 때만(데이터 보존)
  const effectiveBankInfo = () => {
    if (mIsForeign && mPayMethod === "bank" && !String(mBank || "").trim() && mPayDetail?.bank && mPayDetail?.account)
      return `${mPayDetail.bank} ${mPayDetail.account}`.trim();
    return mBank;
  };
  // 외국인 '국내 계좌이체' 은행/계좌 입력 → 아래 통장(bank_info) 입력칸 실시간 반영(지우면 같이 비움)
  const syncBankInfoFromForeign = (bank: string, account: string) => {
    setMBankName(bank); setMBankAcct(account); setMBank(`${bank} ${account}`.trim());
  };
  const resetModelForm = () => { setMName(""); setMSSN(""); setMPhone(""); setMEmail(""); setMCategory(""); setMCareerYears(""); setMGender(""); setMBirthYear(""); setMRate(0); setMEntry(""); setMExit(""); setMIsForeign(false); setMVisaType(""); setMHasAlienCard(false); setMPayMethod(""); setMPayDetail({}); setMTaxRate(0); setMInstagram(""); setMDrive(""); setMKakao(""); setMBank(""); setMBankName(""); setMBankAcct(""); setMThumb(""); setMAimoUrl(""); setMMemo(""); setMCountry("대한민국"); setMTaxType("freelancer"); setMPayType("fixed"); setMPayValue(0); setMPayDayValue(0); setMPayHalfValue(0); setMPayHourValue(0); setMFeeDay(0); setMFeeHalf(0); setMFeeHour(0); setMHeight(""); setMShoe(""); setMBust(""); setMWaist(""); setMHip(""); setMHair(""); setMEye(""); setMTattoo(false); setMUnderwear(false); setMFields([]); setMSpecialty(""); setMCareer(""); setMCareerOpen(false); setMFollowers(""); setMHairColor(""); setMSizeUnit("inch"); setMAddress(""); setMNationalId(""); setShowIdInput(false); setMAgencyName(""); setMAgencyContact(""); setMAgencyPhone(""); setMAgencyEmail(""); setMAgencyBizNo(""); };
  // 사이즈 단위 변환 (저장은 항상 cm)
  const sizeToCm = (v: string) => (mSizeUnit === "inch" && v && !isNaN(Number(v)) ? String(Math.round(Number(v) * 2.54)) : v);
  const convSizeVal = (v: string, to: "cm"|"inch") => (v === "" || isNaN(Number(v)) ? v : to === "inch" ? String(Math.round(Number(v) / 2.54 * 10) / 10) : String(Math.round(Number(v) * 2.54)));
  const switchSizeUnit = (u: "cm"|"inch") => { if (u === mSizeUnit) return; setMBust(b => convSizeVal(b, u)); setMWaist(w => convSizeVal(w, u)); setMHip(h => convSizeVal(h, u)); setMSizeUnit(u); };
  const handleAddModel = async () => {
    if (!mName || (mTaxType!=="company" && !mBirthYear)) return alert(mTaxType==="company"?"모델명 필수":"모델명과 출생연도 필수");
    if (!mGender) return alert("성별을 선택하세요 (모델 ID 생성에 필요).");
    const isFgn = mIsForeign;
    if (isFgn && (!mEntry || !mExit)) return alert("입출국 날짜를 입력해주세요.");
    const _natType = isFgn ? "X" : "K";
    const _agencyNo = (agency as any).agency_no || 1;
    const newModelId = generateModelId(genderNatCode(mGender, _natType), _agencyNo, nextModelSeq(models));
    const nm = { id:newModelId, gender:mGender, nationality_type:_natType, birth_year:mBirthYear!==""?Number(mBirthYear):null, share_consent:true, name:mName, ssn6:mSSN, phone:mPhone, email:mEmail, category:mCategory, career_years:mCareerYears!==""?Number(mCareerYears):null, rate:mRate, is_foreigner:isFgn, country:mCountry, visa_entry:isFgn&&mEntry?mEntry:null, visa_exit:isFgn&&mExit?mExit:null, visa_type:isFgn?mVisaType:null, has_alien_card:isFgn?mHasAlienCard:false, payment_method:isFgn?mPayMethod:null, payment_detail:isFgn?mPayDetail:{}, tax_rate:isFgn&&mTaxRate?mTaxRate:null, instagram_url:normalizeInstagram(mInstagram), drive_url:mDrive, kakao_id:mKakao, bank_info:mBank, thumb_url:mThumb, aimo_url:mAimoUrl, memo:mMemo, payout_tax_type:mTaxType, payout_pay_type:mPayType, payout_pay_value:mPayDayValue, payout_day_value:mPayDayValue, payout_half_value:mPayHalfValue, payout_hour_value:mPayHourValue, fee_day:mFeeDay, fee_half:mFeeHalf, fee_hour:mFeeHour, height:mHeight, shoe:mShoe, bust:sizeToCm(mBust), waist:sizeToCm(mWaist), hip:sizeToCm(mHip), hair_length:mHair, hair_color:mHairColor, eye_color:mEye, tattoo:mTattoo, underwear_ok:mUnderwear, fields:mFields, specialty:mSpecialty, career:mCareer, instagram_followers:mFollowers, address:mAddress, agency_name:mTaxType==="company"?mAgencyName:null, agency_contact:mTaxType==="company"?mAgencyContact:null, agency_phone:mTaxType==="company"?mAgencyPhone:null, agency_email:mTaxType==="company"?mAgencyEmail:null, agency_biz_no:mTaxType==="company"?mAgencyBizNo:null, agency_id:agency.id };
    try {
      nm.thumb_url = await persistThumb(mThumb, agency.id, newModelId); // 썸네일 base64 → Storage URL(행 경량화)
      nm.bank_info = effectiveBankInfo(); // 외국인 국내계좌 → 통장 자동 반영(비어있을 때만)
      await sb("models","POST",nm);
      setModels([nm,...models]);
      if (mNationalId.trim() && canViewFinance) await saveModelNationalId(newModelId);
      resetModelForm(); setShowModelForm(false);
    } catch (e) { alert("모델 추가 실패: "+String(e)); }
  };

  // ── 받은(공유) 모델 → 대대행(소속사)으로 편입 (V4) ──
  // 발송 스냅샷의 공유 필드(이름·신체·사진·노출가 등)만 복사하고, 세무유형은 '소속사(company) 10% 고정',
  // A 업체정보(상호·사업자번호·연락처·계좌)는 발송 스냅샷(payoutInfo)에서 자동 채운다. 출처(A)도 자동 기록.
  // 민감정보(주민번호 등)는 발송 자체가 안 되므로 제외. 국적정보 없어 내국인(K) 기본.
  const handleImportSharedModel = async (
    sm: any,
    src?: { senderName?: string; senderAgencyId?: string; distributionId?: string; payoutInfo?: any }
  ): Promise<{ ok: boolean; id?: string; error?: string; degraded?: boolean }> => {
    try {
      const gender = sm.gender === "M" ? "M" : "F";
      const isFgn = !!sm.is_foreigner;
      const natType = isFgn ? "X" : "K";
      const agNo = (agency as any)?.agency_no || 1;
      const photos = Array.isArray(sm.photos) ? sm.photos.filter((p: any) => typeof p === "string" && p) : [];
      const newId = generateModelId(genderNatCode(gender, natType), agNo, nextModelSeq(models));
      const pi = src?.payoutInfo || {};
      const senderName = src?.senderName || "";
      const nm: any = {
        id: newId, agency_id: agency.id, name: sm.display_name || "(이름없음)",
        gender, nationality_type: natType, is_foreigner: isFgn, share_consent: true,
        country: sm.country || (isFgn ? "외국" : "대한민국"),
        category: sm.category ?? null,
        career_years: sm.career_years ?? null,
        visa_entry: isFgn ? (sm.visa_entry || null) : null,
        visa_exit: isFgn ? (sm.visa_exit || null) : null,
        birth_year: sm.birth_year ?? null,
        height: sm.height ?? null, bust: sm.bust ?? null, waist: sm.waist ?? null, hip: sm.hip ?? null, shoe: sm.shoe ?? null,
        hair_length: sm.hair_length ?? null, hair_color: sm.hair_color ?? null, eye_color: sm.eye_color ?? null,
        tattoo: sm.tattoo ?? false, underwear_ok: sm.underwear_ok ?? false,
        specialty: sm.specialty ?? null, fields: Array.isArray(sm.fields) ? sm.fields : (sm.fields ?? null),
        fee_day: sm.fee_day ?? null, fee_half: sm.fee_half ?? null, fee_hour: sm.fee_hour ?? null,
        photos, thumb_url: photos[0] || null,
        // 연락처/이메일 = 발송업체(A) 정보 (전화=A 연락처 / 이메일=A 구글캘린더 연동 메일 — 일정 수락이 A 캘린더로)
        phone: pi.contact || null,
        email: pi.gcal_email || pi.tax_email || null,
        instagram_url: sm.instagram_url || null,
        // 소속사 고정 — A에게 세금계산서 10%로 정산
        payout_tax_type: "company", payout_pay_type: "rate",
        // A 업체정보 자동 (소속 에이전시 정보로 정산서 발행)
        agency_name: pi.company_name || senderName || null,
        agency_biz_no: pi.biz_no || null,
        agency_contact: pi.rep_name || null,
        agency_phone: pi.contact || null,
        agency_email: pi.gcal_email || pi.tax_email || null,
        bank_info: pi.bank || null,
        address: pi.address || null,
        // 출처(A) 자동 기록 — 에이전시별 필터/추적 + 가용일 라이브 조회(source_model_id)
        source_agency_id: src?.senderAgencyId || null,
        source_agency_name: senderName || pi.company_name || null,
        source_distribution_id: src?.distributionId || null,
        source_model_id: sm.source_model_id || null,
        memo: senderName ? `${senderName} 발송 편입` : "발송 편입",
      };
      try {
        await sb("models", "POST", nm);
        setModels(prev => [nm, ...prev]);
      } catch (e1: any) {
        // V4 출처 컬럼(source_*) 미적용 시 → 출처 필드 빼고 재시도(기본 대대행 편입은 되게).
        // ⚠️ 이 경우 출처 필터·가용일·자동숨김은 동작 안 함 → SQL 적용 후 재편입해야 전체 기능 사용.
        const msg = String(e1?.message || e1);
        if (/source_(agency|model|distribution)|PGRST204|schema cache/i.test(msg)) {
          const { source_agency_id, source_agency_name, source_distribution_id, source_model_id, ...basic } = nm;
          await sb("models", "POST", basic);
          setModels(prev => [basic as any, ...prev]);
          return { ok: true, id: newId, degraded: true };
        }
        throw e1;
      }
      return { ok: true, id: newId };
    } catch (e: any) {
      return { ok: false, error: String(e?.message || e) };
    }
  };

  const openEditModel = (m: any) => {
    setSelectedModel(m);
    setMName(m.name||""); setMSSN(m.ssn6||""); setMPhone(m.phone||""); setMEmail(m.email||"");
    setMGender(m.gender||(m.category==="남성"?"M":m.category==="여성"?"F":""));
    setMCategory(m.category||""); setMCareerYears(m.career_years!=null?String(m.career_years):""); setMBirthYear(m.birth_year!=null?String(m.birth_year):""); setMRate(m.rate||0);
    setMCountry(m.country||"대한민국"); setMEntry(m.visa_entry||""); setMExit(m.visa_exit||"");
    setMIsForeign(!!m.is_foreigner); setMVisaType(m.visa_type||""); setMHasAlienCard(!!m.has_alien_card); setMPayMethod(m.payment_method||""); setMPayDetail(m.payment_detail&&typeof m.payment_detail==="object"?m.payment_detail:{}); setMTaxRate(Number(m.tax_rate)||0);
    setMInstagram(m.instagram_url||""); setMDrive(m.drive_url||"");
    setMKakao(m.kakao_id||""); setMThumb(m.thumb_url||""); setMAimoUrl(m.aimo_url||""); setMMemo(m.memo||"");
    { const _b=m.bank_info||""; setMBank(_b); const _sp=_b.indexOf(" "); setMBankName(_sp>=0?_b.slice(0,_sp):(_b&&!/\d/.test(_b)?_b:"")); setMBankAcct(_sp>=0?_b.slice(_sp+1):(/\d/.test(_b)?_b:"")); }
    setMHeight(m.height||""); setMShoe(m.shoe||""); setMBust(convSizeVal(m.bust||"","inch")); setMWaist(convSizeVal(m.waist||"","inch")); setMHip(convSizeVal(m.hip||"","inch")); setMHair(m.hair_length||""); setMHairColor(m.hair_color||""); setMEye(m.eye_color||""); setMTattoo(!!m.tattoo); setMUnderwear(!!m.underwear_ok); setMFields(Array.isArray(m.fields)?m.fields:[]); setMSpecialty(m.specialty||""); setMCareer(m.career||""); setMCareerOpen(!!m.career); setMFollowers(m.instagram_followers||""); setMSizeUnit("inch");
    setMAddress(m.address||""); setMNationalId(""); setShowIdInput(false);
    setMAgencyName(m.agency_name||""); setMAgencyContact(m.agency_contact||""); setMAgencyPhone(m.agency_phone||""); setMAgencyEmail(m.agency_email||""); setMAgencyBizNo(m.agency_biz_no||"");
    setMTaxType(m.source_agency_id?"company":m.payout_tax_type==="company"?"company":(m.payout_tax_type==="foreigner"||m.is_foreigner)?"foreigner":"freelancer"); setMPayType(m.payout_pay_type==="fixed"?"fixed":"rate"); setMPayValue(m.payout_pay_value||0);
    setMPayValue(m.payout_pay_value ?? 0); setMPayDayValue(m.payout_day_value ?? m.payout_pay_value ?? 0); setMPayHalfValue(m.payout_half_value ?? 0); setMPayHourValue(m.payout_hour_value ?? 0);
    setMFeeDay(m.fee_day ?? 0); setMFeeHalf(m.fee_half ?? 0); setMFeeHour(m.fee_hour ?? 0);
    setMEditMode(true);
  };

  const [modelBaseline, setModelBaseline] = useState("");
  const buildModelData = () => { const isFgn = mIsForeign; return ({ name:mName, ssn6:mSSN, phone:mPhone, email:mEmail, gender:mGender, nationality_type:isFgn?"X":"K", birth_year:mBirthYear!==""?Number(mBirthYear):null, share_consent:true, category:mCategory, career_years:mCareerYears!==""?Number(mCareerYears):null, rate:mRate, is_foreigner:isFgn, country:mCountry, visa_type:isFgn?mVisaType:null, has_alien_card:isFgn?mHasAlienCard:false, payment_method:isFgn?mPayMethod:null, payment_detail:isFgn?mPayDetail:{}, tax_rate:isFgn&&mTaxRate?mTaxRate:null, visa_entry:isFgn&&mEntry?mEntry:null, visa_exit:isFgn&&mExit?mExit:null, instagram_url:normalizeInstagram(mInstagram), drive_url:mDrive, kakao_id:mKakao, bank_info:mBank, thumb_url:mThumb, aimo_url:mAimoUrl, memo:mMemo, payout_tax_type:mTaxType, payout_pay_type:mPayType, payout_pay_value:mPayDayValue, payout_day_value:mPayDayValue, payout_half_value:mPayHalfValue, payout_hour_value:mPayHourValue, fee_day:mFeeDay, fee_half:mFeeHalf, fee_hour:mFeeHour, height:mHeight, shoe:mShoe, bust:sizeToCm(mBust), waist:sizeToCm(mWaist), hip:sizeToCm(mHip), hair_length:mHair, hair_color:mHairColor, eye_color:mEye, tattoo:mTattoo, underwear_ok:mUnderwear, fields:mFields, specialty:mSpecialty, career:mCareer, instagram_followers:mFollowers, address:mAddress, agency_name:mTaxType==="company"?mAgencyName:null, agency_contact:mTaxType==="company"?mAgencyContact:null, agency_phone:mTaxType==="company"?mAgencyPhone:null, agency_email:mTaxType==="company"?mAgencyEmail:null, agency_biz_no:mTaxType==="company"?mAgencyBizNo:null }); };
  useEffect(() => { if (showModelForm || mEditMode) setModelBaseline(JSON.stringify(buildModelData())); }, [showModelForm, mEditMode, selectedModel?.id]);
  const handleSaveModel = async () => {
    if (!mName) return alert("모델명 필수");
    if (mIsForeign && (!mEntry || !mExit)) return alert("입출국 날짜를 입력해주세요.");
    const updated = buildModelData();
    try {
      updated.thumb_url = await persistThumb(mThumb, agency.id, selectedModel.id); // 썸네일 base64 → Storage URL(행 경량화)
      updated.bank_info = effectiveBankInfo(); // 외국인 국내계좌 → 통장 자동 반영(비어있을 때만)
      await sb("models","PATCH",updated,`?id=eq.${selectedModel.id}`);
      setModels(models.map(m => m.id===selectedModel.id ? {...m,...updated} : m));
      if (mNationalId.trim() && canViewFinance) await saveModelNationalId(selectedModel.id);
      setMEditMode(false); setSelectedModel(null); resetModelForm();
      alert("저장되었습니다.");
    } catch (e) { alert("수정 실패: "+String(e)); }
  };

  // 식별번호(주민/외국인등록/여권) 보안 저장 — 별도 RPC(암호화·대표/정산권한자 전용). 평문은 저장 후 비움.
  const saveModelNationalId = async (modelId: string): Promise<boolean> => {
    const v = mNationalId.trim();
    if (!v) return false;
    const idType = !mIsForeign ? "rrn" : (mHasAlienCard ? "arc" : "passport");
    try {
      const masked = await sb("rpc/set_model_national_id", "POST", { p_model_id: modelId, p_id_type: idType, p_id_plain: v });
      setModels(prev => prev.map(m => m.id===modelId ? { ...m, national_id_masked: masked, national_id_type: idType } : m));
      setSelectedModel((p:any)=> (p && p.id===modelId) ? { ...p, national_id_masked: masked, national_id_type: idType } : p);
      setMNationalId(""); setShowIdInput(false);
      return true;
    } catch (e) { alert("식별번호 저장 실패(권한·형식 확인): " + String(e)); return false; }
  };

  const handleDeleteModel = async () => {
    if (!selectedModel) return;
    const cnt = bookings.filter(b=>b.model_id===selectedModel.id).length;
    const msg = cnt>0
      ? `'${selectedModel.name}' 모델을 삭제할까요?\n⚠️ 이 모델의 섭외 이력 ${cnt}건이 있습니다. 삭제 시 모델 정보가 사라져 해당 섭외엔 '?'로 표시됩니다.`
      : `'${selectedModel.name}' 모델을 삭제할까요?`;
    if (!confirm(msg)) return;
    try {
      await sb("models","DELETE",null,`?id=eq.${selectedModel.id}`);
      setModels(models.filter(m=>m.id!==selectedModel.id));
      setMEditMode(false); setSelectedModel(null); resetModelForm();
    } catch (e) { alert("삭제 실패: "+String(e)); }
  };

  // ── 고객사 추가 ──
  // 사업자등록증 OCR 결과 → 고객사 폼 자동 입력 (스키마에 없는 항목은 메모에 보존)
  const applyBizInfo = (info: BizLicenseInfo) => {
    if (info.companyName) setCName(info.companyName);
    if (info.businessNumber) setCBizNo(info.businessNumber);
    if (info.representativeName) setCRepName(info.representativeName);
    if (info.address) setCAddress(info.address);
    if (info.businessType) setCBizType(info.businessType);
    if (info.businessItem) setCBizItem(info.businessItem);
    if (info.corporateNumber) setCMemo(prev => prev ? prev : `법인등록번호: ${info.corporateNumber}`);
  };
  const resetCustomerForm = () => { setCName(""); setCBrand(""); setCManager(""); setCPhone(""); setCEmail(""); setCIndustry(""); setCBizNo(""); setCTaxEmail(""); setCMemo(""); setCRepName(""); setCAddress(""); setCBizType(""); setCBizItem(""); setCCategory(""); };
  const handleAddCustomer = async () => {
    if (!cName||!cPhone) return alert("고객사명과 전화번호 필수");
    const bn = cBizNo.replace(/[^0-9]/g,"");
    if (bn && !validateBizNo(bn)) return alert("올바른 사업자등록번호가 아닙니다 (10자리·체크섬 확인)");
    const nc = { id:randomId("CL"), name:cName, brand:cBrand, manager_name:cManager, phone:cPhone, email:cEmail, biz_no:bn, tax_email:cTaxEmail, memo:cMemo, rep_name:cRepName, address:cAddress, biz_type:cBizType, biz_item:cBizItem, category:cCategory, agency_id:agency.id };
    try {
      await sb("customers","POST",nc);
      setCustomers([nc,...customers]);
      resetCustomerForm(); setShowCustomerForm(false);
    } catch (e) { alert("고객사 추가 실패: "+String(e)); }
  };

  // ── 기존 모델 ID → 규칙 ID(MK/FK/MX/FX) 일괄 변경 ──
  // 섭외(bookings)·휴무(model_offs)의 model_id 참조도 함께 업데이트. FK 안전 순서: 새 행 insert → 참조 갱신 → 옛 행 delete
  const isSpecModelId = (id: string) => /^(?:MK|FK|MX|FX)\d{3}-\d{6}-\d{4}$/.test(id);
  const legacyIdCount = useMemo(() => models.filter(m => !isSpecModelId(String(m.id || ""))).length, [models]);
  const migrateModelIds = async () => {
    const legacy = models.filter(m => !isSpecModelId(String(m.id || "")));
    if (!legacy.length) { alert("규칙 ID로 변경할 모델이 없습니다. 모두 규칙 ID예요."); return; }
    if (!confirm(`기존 모델 ${legacy.length}명의 ID를 규칙 ID(MK/FK/MX/FX)로 변경합니다.\n섭외·휴무 연결도 함께 업데이트됩니다.\n\n⚠️ 진행 전 Supabase에서 백업을 권장합니다. 진행할까요?`)) return;
    const agNo = (agency as any).agency_no || 1;
    let seq = nextModelSeq(models);
    let done = 0;
    try {
      for (const m of legacy) {
        const natType = (m.is_foreigner || m.nationality_type === "X" || (m.country && m.country !== "대한민국")) ? "X" : "K";
        const gender = m.gender === "M" ? "M" : "F"; // 미지정 시 기본 F
        const newId = generateModelId(genderNatCode(gender, natType), agNo, seq++);
        const oldQ = `?id=eq.${encodeURIComponent(m.id)}`;
        const oldRefQ = `?model_id=eq.${encodeURIComponent(m.id)}`;
        const { id: _drop, ...rest } = m;                         // 1) 새 id로 모델 복제
        await sb("models", "POST", { ...rest, id: newId });
        await sb("bookings", "PATCH", { model_id: newId }, oldRefQ); // 2) 섭외 참조 갱신
        try { await sb("model_offs", "PATCH", { model_id: newId }, oldRefQ); } catch {} // 휴무(테이블 없을 수 있음)
        await sb("models", "DELETE", null, oldQ);                  // 3) 옛 모델 삭제
        setModels(prev => prev.map(x => x.id === m.id ? { ...x, id: newId } : x));
        setBookings(prev => prev.map(b => b.model_id === m.id ? { ...b, model_id: newId } : b));
        setModelOffs(prev => prev.map(o => o.model_id === m.id ? { ...o, model_id: newId } : o));
        done++;
      }
      alert(`완료 — 모델 ${done}명의 ID를 규칙 ID로 변경했습니다.`);
    } catch (e) { alert("변경 중 오류: " + String(e) + "\n일부만 처리됐을 수 있어요. 새로고침 후 다시 실행하면 남은 모델만 이어서 변경합니다."); }
  };

  const openEditCustomer = (c: any) => {
    setSelectedCustomer(c);
    setCName(c.name||""); setCBrand(c.brand||""); setCManager(c.manager_name||"");
    setCPhone(c.phone||""); setCEmail(c.email||""); setCIndustry(c.industry||"");
    setCBizNo(c.biz_no||""); setCTaxEmail(c.tax_email||""); setCMemo(c.memo||"");
    setCRepName(c.rep_name||""); setCAddress(c.address||""); setCBizType(c.biz_type||""); setCBizItem(c.biz_item||""); setCCategory(c.category||"");
    setCEditMode(true);
  };

  const [customerBaseline, setCustomerBaseline] = useState("");
  const buildCustomerData = () => { const bn = cBizNo.replace(/[^0-9]/g,""); return ({ name:cName, brand:cBrand, manager_name:cManager, phone:cPhone, email:cEmail, biz_no:bn, tax_email:cTaxEmail, memo:cMemo, rep_name:cRepName, address:cAddress, biz_type:cBizType, biz_item:cBizItem, category:cCategory }); };
  useEffect(() => { if (showCustomerForm || cEditMode) setCustomerBaseline(JSON.stringify(buildCustomerData())); }, [showCustomerForm, cEditMode, selectedCustomer?.id]);
  const handleSaveCustomer = async () => {
    if (!cName) return alert("고객사명 필수");
    const bn = cBizNo.replace(/[^0-9]/g,"");
    if (bn && !validateBizNo(bn)) return alert("올바른 사업자등록번호가 아닙니다 (10자리·체크섬 확인)");
    const updated = buildCustomerData();
    try {
      await sb("customers","PATCH",updated,`?id=eq.${selectedCustomer.id}`);
      setCustomers(customers.map(c => c.id===selectedCustomer.id ? {...c,...updated} : c));
      setCEditMode(false); setSelectedCustomer(null); resetCustomerForm();
      alert("저장되었습니다.");
    } catch (e) { alert("수정 실패: "+String(e)); }
  };

  const handleDeleteCustomer = async () => {
    if (!selectedCustomer) return;
    const cnt = bookings.filter(b=>b.customer_id===selectedCustomer.id).length;
    const msg = cnt>0
      ? `'${selectedCustomer.name}' 고객사를 삭제할까요?\n⚠️ 이 고객사의 섭외 이력 ${cnt}건이 있습니다. 삭제 시 고객사 정보가 사라져 해당 섭외엔 '?'로 표시됩니다.`
      : `'${selectedCustomer.name}' 고객사를 삭제할까요?`;
    if (!confirm(msg)) return;
    try {
      await sb("customers","DELETE",null,`?id=eq.${selectedCustomer.id}`);
      setCustomers(customers.filter(c=>c.id!==selectedCustomer.id));
      setCEditMode(false); setSelectedCustomer(null); resetCustomerForm();
    } catch (e) { alert("삭제 실패: "+String(e)); }
  };

  // ── 모델·고객사 대량 등록 ──
  const handleBulkCommit = async (
    entity: "model"|"customer",
    items: { id:string; mode:"insert"|"update"; record:Record<string,any> }[]
  ): Promise<{ inserted:number; updated:number }> => {
    const table = entity === "model" ? "models" : "customers";
    // 신규 항목 ID 발급: 모델은 규칙 ID(MK/FK/MX/FX…), 고객사는 임의 ID
    const _agNo = (agency as any).agency_no || 1;
    let _seq = nextModelSeq(models);
    const inserts = items.filter(i=>i.mode==="insert").map(i=>{
      let id = i.id;
      if (!id) {
        if (entity === "model") {
          const natType = i.record.is_foreigner ? "X" : "K";
          const gender = i.record.gender === "M" ? "M" : "F"; // 미지정 시 기본 F
          id = generateModelId(genderNatCode(gender, natType), _agNo, _seq++);
        } else {
          id = randomId("CL");
        }
      }
      return { ...i.record, id, agency_id:agency.id };
    });
    const updates = items.filter(i=>i.mode==="update");
    let insertedRows: any[] = [];
    if (inserts.length) insertedRows = await sb(table, "POST", inserts);
    for (const u of updates) await sb(table, "PATCH", u.record, `?id=eq.${u.id}`);
    const newRows = insertedRows.length ? insertedRows : inserts;
    const updMap = new Map(updates.map(u=>[u.id, u.record]));
    if (entity === "model") {
      setModels(prev => [...newRows, ...prev.map(m => updMap.has(m.id) ? {...m, ...updMap.get(m.id)} : m)]);
    } else {
      setCustomers(prev => [...newRows, ...prev.map(c => updMap.has(c.id) ? {...c, ...updMap.get(c.id)} : c)]);
    }
    return { inserted: inserts.length, updated: updates.length };
  };

  // ── 섭외 추가 ──
  const resetBookingForm = () => { setBModel(""); setBModels([]); setBCustomer(""); setBModelSearch(""); setBCustomerSearch(""); setBDate(""); setBStart(""); setBEnd(""); setBManager(""); setBStatus("INQUIRY"); setBProject(""); setBLocation(""); setBShootTypes([]); setBUsageScope([]); setBUsagePeriod(""); setBUsageRegion("국내"); setBBudget(0); setBDeposit(0); setBDepositDue(""); setBBalance(0); setBBalanceDue(""); setBResultDrive(""); setBMemo(""); setBBookingType("SHOOT"); setBMedia([]); setBRefImages([]); setBRefVideos([]); };
  // 레퍼런스 이미지: 캔버스 축소(긴변 900px) 후 저장
  const resizeImage = (file: File, cb: (data:string)=>void) => {
    if (!file.type.startsWith("image/")) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 900;
      const sc = Math.min(1, max/Math.max(img.width, img.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.width*sc); cv.height = Math.round(img.height*sc);
      cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
      cb(cv.toDataURL("image/jpeg", 0.72));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };
  const addRefImages = (files: FileList|null) => {
    if (!files) return;
    Array.from(files).forEach(f=>resizeImage(f, data=>setBRefImages(prev=>prev.length>=8?prev:[...prev, data])));
  };
  // 프로필 썸네일 압축 — 목록/아바타에 작게만 보이는 사진이라 360px·JPEG로 줄여 20~100KB 수준으로 저장.
  // (스튜디오 '대표 변경'의 makeThumb와 동일 정책 → 행 용량/첫 로딩 부담 제거)
  const compressThumb = (file: File, cb: (data:string)=>void) => {
    if (!file.type.startsWith("image/")) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 150; // 썸네일은 작게만 보여(아바타/스튜디오 원형) 150px로 충분 → 용량 ↓
      const sc = Math.min(1, max/Math.max(img.width, img.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.width*sc); cv.height = Math.round(img.height*sc);
      cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
      cb(cv.toDataURL("image/jpeg", 0.6));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };
  const addRefsToSelected = (files: FileList|null) => {
    if (!files) return;
    Array.from(files).forEach(f=>resizeImage(f, data=>setSelectedBooking((p:any)=>{ const cur=p?.reference_images||[]; return !p||cur.length>=8?p:{...p, reference_images:[...cur, data]}; })));
  };
  const promptVideoUrl = (): string|null => {
    const u = window.prompt("영상 링크를 입력하세요 (유튜브/릴스/드라이브 URL)");
    if (!u||!u.trim()) return null;
    return u.trim().startsWith("http") ? u.trim() : "https://"+u.trim();
  };
  const addRefsToProject = (files: FileList|null) => {
    if (!files) return;
    Array.from(files).forEach(f=>resizeImage(f, data=>setPRefImages(prev=>prev.length>=8?prev:[...prev, data])));
  };

  const handleSaveBookingEdit = async () => {
    if (!selectedBooking) return;
    const prev = bookings.find(b=>b.id===selectedBooking.id);
    const oldDate = prev?.shoot_date;
    // 모델 휴무 충돌(날짜·모델이 바뀌어 휴무일에 걸린 경우) — 경고 후 강행 허용
    if (prev?.shoot_date!==selectedBooking.shoot_date || prev?.model_id!==selectedBooking.model_id) {
      const eoff = modelOffOn(selectedBooking.model_id, selectedBooking.shoot_date);
      if (eoff) {
        const nm = models.find(m=>m.id===selectedBooking.model_id)?.name||"이 모델";
        const ok = window.confirm(`⚠️ ${nm}은(는) ${fmtDate(eoff.start_date)} ~ ${fmtDate(eoff.end_date)} 휴무입니다${eoff.reason?` (${eoff.reason})`:""}.\n해당 날짜(${fmtDate(selectedBooking.shoot_date)})로 변경할까요?\n\n[확인] 그대로 저장  [취소] 중단`);
        if (!ok) return;
      }
    }
    const updates: any = {
      booking_type: selectedBooking.booking_type,
      project_name: selectedBooking.project_name,
      customer_id:  selectedBooking.customer_id,
      shoot_date:   selectedBooking.shoot_date,
      start_time:   selectedBooking.start_time,
      end_time:     selectedBooking.end_time,
      location:     selectedBooking.location,
      manager:      selectedBooking.manager,
      usage_period: selectedBooking.usage_period,
      usage_region: selectedBooking.usage_region,
      shoot_types:  selectedBooking.shoot_types,
      usage_scope:  selectedBooking.usage_scope,
      shoot_fee:    selectedBooking.shoot_fee,
      model_pay_type:  selectedBooking.model_pay_type || null,
      model_pay_value: selectedBooking.model_pay_type ? (Number(selectedBooking.model_pay_value)||0) : null,
      deposit_amt:  selectedBooking.deposit_amt,
      deposit_due:  selectedBooking.deposit_due,
      balance_amt:  clientBalance(selectedBooking),
      balance_due:  selectedBooking.balance_due,
      overcharges:  selectedBooking.overcharges||[],
      memo:         selectedBooking.memo,
      status:       selectedBooking.status,
      ...(selectedBooking.reference_images!==undefined?{reference_images:selectedBooking.reference_images||[]}:{}),
      ...(selectedBooking.reference_videos!==undefined?{reference_videos:selectedBooking.reference_videos||[]}:{}),
    };
    // ── 우선순위 충돌 재검사 (촬영 > 미팅/피팅/오디션) ──
    const othersSameDay = bookings.filter(b=>b.id!==selectedBooking.id&&b.model_id===selectedBooking.model_id&&b.shoot_date===selectedBooking.shoot_date&&b.status!=="CANCELLED");
    const blocks = (t:any, peers:any[]) => peers.some(b=>{
      // 시간 겹침/버퍼 부족일 때만 충돌(같은 날이라고 무조건 보류하지 않음 — 간격 규칙 적용)
      if (!scheduleConflict(t.start_time,t.end_time,b.start_time,b.end_time,t.booking_type,b.booking_type,t.location,b.location).conflict) return false;
      const tS=!!BOOKING_TYPES[t.booking_type||"SHOOT"]?.hasContract, bS=!!BOOKING_TYPES[b.booking_type||"SHOOT"]?.hasContract;
      if (tS!==bS) return !tS; // 충돌 시 우선순위: 비촬영(미팅/피팅/오디션)을 보류, 촬영은 유지
      return true; // 동급 + 충돌 → 보류
    });
    const eIsShoot = !!BOOKING_TYPES[selectedBooking.booking_type||"SHOOT"]?.hasContract;
    const eInactive = selectedBooking.status==="CANCELLED"; // 취소 건은 일정에서 빠지므로 충돌 무관
    // 대대행: A쪽(발송처) 점유일로 옮기면 그 날 불가 → HOLD (날짜 단위)
    const eHold = !eInactive && (blocks(selectedBooking, othersSameDay) || subAgencyBusy(models.find(m=>m.id===selectedBooking.model_id), selectedBooking.shoot_date));
    const reason = "동일 모델 일정 충돌";
    const meetingsToHold = (eIsShoot && !eInactive) ? othersSameDay.filter(b=>!BOOKING_TYPES[b.booking_type||"SHOOT"]?.hasContract && b.status!=="HOLD").map(b=>b.id) : [];
    if (meetingsToHold.length>0) {
      const labels=[...new Set(othersSameDay.filter(b=>meetingsToHold.includes(b.id)).map(b=>BOOKING_TYPES[b.booking_type||"SHOOT"]?.label))].join(", ");
      const ok=window.confirm(`⚠️ 같은 날 ${labels} 일정이 있습니다.\n촬영이 우선이라 그 ${labels}은(는) HOLD로 변경됩니다.\n\n[확인] 저장 + 미팅 HOLD\n[취소] 중단`);
      if (!ok) return;
    }
    if (eHold && selectedBooking.status!=="HOLD") updates.status = "HOLD";
    if (!eHold && selectedBooking.status==="HOLD") updates.status = "CHECKING";
    try {
      await sb("bookings","PATCH", updates, `?id=eq.${selectedBooking.id}`);
      let updatedList = bookings.map(b=>b.id===selectedBooking.id?{...b,...updates}:b);
      for (const mid of meetingsToHold) { await sb("bookings","PATCH",{status:"HOLD"},`?id=eq.${mid}`); updatedList=updatedList.map(b=>b.id===mid?{...b,status:"HOLD"}:b); }

      // ── 같은 모델의 다른 HOLD 건도 보류 사유 풀리면 자동 해제 ──
      const affectedDates = [oldDate, selectedBooking.shoot_date].filter(Boolean);
      let releasedCnt = 0;
      for (const hb of updatedList.filter(b=>b.id!==selectedBooking.id&&!meetingsToHold.includes(b.id)&&b.model_id===selectedBooking.model_id&&b.status==="HOLD"&&affectedDates.includes(b.shoot_date))) {
        const peers = updatedList.filter(b=>b.id!==hb.id&&b.model_id===hb.model_id&&b.shoot_date===hb.shoot_date&&b.status!=="CANCELLED");
        if (!blocks(hb, peers)) {
          await sb("bookings","PATCH",{status:"CHECKING"},`?id=eq.${hb.id}`);
          updatedList = updatedList.map(b=>b.id===hb.id?{...b,status:"CHECKING"}:b);
          releasedCnt++;
        }
      }
      setBookings(updatedList);
      // ── 알림톡: 확정/취소 전환 또는 일시·장소 변경 시 모델에게 발송 ──
      {
        const finalStatus = updates.status;
        const tm = models.find(m=>m.id===selectedBooking.model_id);
        const tc = customers.find(c=>c.id===selectedBooking.customer_id);
        const baseArgs = { modelName:tm?.name||"모델", booking:{...selectedBooking, ...updates}, clientName:tc?.name||"고객사", managerName:selectedBooking.manager||"담당자", senderLabel:agency?.name||"에이전시", contactPhone:agency?.contact_phone||agency?.rep_phone||"" };
        const statusChanged = !!prev && prev.status!==finalStatus;
        const whenLocChanged = !!prev && (prev.shoot_date!==selectedBooking.shoot_date || prev.start_time!==selectedBooking.start_time || prev.end_time!==selectedBooking.end_time || prev.location!==selectedBooking.location);
        const tcPhone = tc?.phone||"";
        if (statusChanged && finalStatus==="CONFIRMED") sendAlimtalkBoth(tm?.phone||"", tcPhone, "CONFIRM", baseArgs);
        else if (statusChanged && finalStatus==="CANCELLED") sendAlimtalkBoth(tm?.phone||"", tcPhone, "CANCEL", baseArgs);
        else if (whenLocChanged && finalStatus!=="CANCELLED" && finalStatus!=="HOLD") {
          const fw = (d?:string,s?:string,e?:string)=>`${d?d.replace(/-/g,"."):"미정"}${s&&e?` ${s}~${e}`:""}`;
          sendAlimtalkBoth(tm?.phone||"", tcPhone, "CHANGE", { ...baseArgs, before:`${fw(prev?.shoot_date,prev?.start_time,prev?.end_time)} / ${prev?.location||"-"}`, after:`${fw(selectedBooking.shoot_date,selectedBooking.start_time,selectedBooking.end_time)} / ${selectedBooking.location||"-"}` });
        }
        // 구글 캘린더 자동 동기화 + 메일:
        //  - 확정 전환 → 초대 메일 / 취소 전환 → 취소 안내 메일
        //  - 확정 상태에서 일시·장소 변경 → (미수락) 초대 메일 자동 재발송 / (수락) 구글 일정 갱신만(현행)
        if ((statusChanged || whenLocChanged) && finalStatus!=="HOLD") {
          const mailFlag = (statusChanged && (finalStatus==="CONFIRMED"||finalStatus==="CANCELLED")) || (whenLocChanged && finalStatus==="CONFIRMED");
          syncBookingToCalendar({ ...selectedBooking, ...updates }, tm, tc, { mail: mailFlag });
        }
      }
      setSelectedBooking((p:any)=>p?{...p,...updates}:p);
      setEditingBooking(false);
      if (updates.status==="HOLD") alert(`⚠️ 저장됨 — 수정된 일정이 충돌하여 HOLD 처리되었습니다.\n사유: ${reason}`);
      else if (updates.status==="CHECKING") alert("✅ 수정되었습니다.\n일정 충돌이 해소되어 HOLD가 해제되었습니다. (→ 스케줄확인)");
      else if (meetingsToHold.length>0) alert(`✅ 수정되었습니다.\n겹치는 미팅 ${meetingsToHold.length}건이 HOLD로 변경됐습니다. 고객사와 일정을 조율하세요.`);
      else if (releasedCnt>0) alert(`✅ 수정되었습니다.\n충돌이 해소된 HOLD ${releasedCnt}건이 자동 해제되었습니다. (→ 스케줄확인)`);
      else alert("✅ 섭외 정보가 수정되었습니다.");
    } catch(e) { alert("수정 실패: "+String(e)); }
  };

  // 미등록 모델/고객 즉시 등록(이름만) — 상세는 나중에 보완
  const quickAddModel = async (name: string): Promise<string|null> => {
    const nm=name.trim(); if(!nm) return null;
    const m:any = { id:`M_${Date.now()}`, name:nm, agency_id:agency.id, payout_tax_type:"freelancer", payout_pay_type:"rate", payout_pay_value:0, created_at:new Date().toISOString() };
    try { await sb("models","POST",m); setModels(prev=>[m,...prev]); return m.id; }
    catch(e){ alert("모델 등록 실패: "+String(e)); return null; }
  };
  const quickAddCustomer = async (name: string): Promise<string|null> => {
    const nm=name.trim(); if(!nm) return null;
    const c:any = { id:`C_${Date.now()}`, name:nm, agency_id:agency.id, created_at:new Date().toISOString() };
    try { await sb("customers","POST",c); setCustomers(prev=>[c,...prev]); return c.id; }
    catch(e){ alert("고객사 등록 실패: "+String(e)); return null; }
  };

  const handleAddBooking = async () => {
    if (!bModel||!bCustomer||!bDate) return alert("모델, 고객사, 날짜 필수");
    const model = models.find(m=>m.id===bModel);
    const visa = visaViolation(model, bDate);
    if (visa) return alert("비자 오류: "+visa);

    // 모델 휴무 충돌: 경고 후 강행 허용
    const off = modelOffOn(bModel, bDate);
    if (off) {
      const ok = window.confirm(`⚠️ ${model?.name||"이 모델"}은(는) ${fmtDate(off.start_date)} ~ ${fmtDate(off.end_date)} 휴무입니다${off.reason?` (${off.reason})`:""}.\n해당 날짜(${fmtDate(bDate)})에 섭외를 진행할까요?\n\n[확인] 그래도 등록  [취소] 중단`);
      if (!ok) return;
    }

    // 우선순위 충돌 처리: 촬영 > 미팅/피팅/오디션
    const sameDay = bookings.filter(b=>b.model_id===bModel&&b.shoot_date===bDate&&b.status!=="CANCELLED");
    const newIsShoot = bBookingType==="SHOOT";
    let autoHold = false; let holdReason = "";
    const meetingsToHold:string[]=[];
    for (const b of sameDay) {
      const bIsShoot = !!BOOKING_TYPES[b.booking_type||"SHOOT"]?.hasContract;
      if (newIsShoot && !bIsShoot) {
        // 촬영 추가 vs 기존 미팅(같은 날): 시간이 실제로 충돌할 때만 미팅 HOLD (간격 충분하면 유지)
        const c = scheduleConflict(bStart, bEnd, b.start_time, b.end_time, bBookingType, b.booking_type, bLocation, b.location);
        if (c.conflict && b.status!=="HOLD") meetingsToHold.push(b.id);
      } else {
        // 동급 또는 미팅 vs 기존 촬영: 시간 겹치면 새 건 HOLD
        const c = scheduleConflict(bStart, bEnd, b.start_time, b.end_time, bBookingType, b.booking_type, bLocation, b.location);
        if (c.conflict) { autoHold = true; holdReason = c.reason; }
      }
    }
    // 대대행: A쪽(발송처) 점유일이면 그 날은 불가 → HOLD (날짜 단위)
    if (!autoHold && subAgencyBusy(models.find(m=>m.id===bModel), bDate)) { autoHold = true; holdReason = `${models.find(m=>m.id===bModel)?.source_agency_name || "발송처"} 스케줄 확인 요망`; }
    // 촬영이 기존 미팅과 겹치면 확인 (확인 시 미팅 HOLD 처리)
    if (meetingsToHold.length>0) {
      const labels = [...new Set(sameDay.filter(b=>meetingsToHold.includes(b.id)).map(b=>BOOKING_TYPES[b.booking_type||"SHOOT"]?.label))].join(", ");
      const ok = window.confirm(`⚠️ ${model?.name} 모델은 같은 날(${fmtDate(bDate)}) ${labels} 일정이 있습니다.\n촬영이 우선이라 그 ${labels}은(는) HOLD로 변경됩니다.\n\n[확인] 촬영 등록 + 미팅 HOLD (고객사와 일정 조율 필요)\n[취소] 등록 중단`);
      if (!ok) return;
    }
    const finalStatus = autoHold ? "HOLD" : bStatus;
    const nb = { id:generateCastId((agency as any).agency_no||1, nextCastSeq(bookings,(agency as any).agency_no||1)), model_id:bModel, customer_id:bCustomer, booking_type:bBookingType, shoot_date:bDate, start_time:bStart, end_time:bEnd, manager:bManager, status:finalStatus, project_name:bProject, location:bLocation, shoot_types:bShootTypes, usage_scope:bUsageScope, usage_period:bUsagePeriod, usage_region:bUsageRegion, shoot_fee:bBudget, deposit_amt:bDeposit, deposit_due:bDepositDue, balance_amt:bBalance, balance_due:bBalanceDue, result_drive_url:bResultDrive, memo:bMemo, commission_rate:15, is_paid:false, settlement_memo:"", messages:[], agency_id:agency.id, ...(bRefImages.length>0?{reference_images:bRefImages}:{}), ...(bRefVideos.length>0?{reference_videos:bRefVideos}:{}) };
    try {
      await sb("bookings","POST",nb);
      let list=[nb,...bookings];
      for (const mid of meetingsToHold) { await sb("bookings","PATCH",{status:"HOLD"},`?id=eq.${mid}`); list=list.map(b=>b.id===mid?{...b,status:"HOLD"}:b); }
      setBookings(list);
      resetBookingForm(); setShowBookingForm(false);
      if (autoHold) alert(`⚠️ HOLD 처리됨\n사유: ${holdReason}`);
      else if (meetingsToHold.length>0) alert(`✅ 촬영 등록 완료\n겹치는 미팅 ${meetingsToHold.length}건이 HOLD로 변경됐습니다. 고객사와 일정을 조율하세요.`);
    } catch(e) { alert("섭외 추가 실패: "+String(e)); }
  };


  // ── 모델 휴무(기간) ──
  const handleAddModelOff = async (model_id: string, start_date: string, end_date: string, reason = "") => {
    if (!model_id) return alert("모델을 선택하세요");
    if (!start_date || !end_date) return alert("휴무 시작일과 종료일을 입력하세요");
    if (end_date < start_date) return alert("종료일이 시작일보다 빠릅니다");
    const row = { id:`MO_${Date.now()}`, agency_id: agency.id, model_id, start_date, end_date, reason: reason||"" };
    try { await sb("model_offs","POST",row); setModelOffs([row, ...modelOffs]); }
    catch(e) { alert("휴무 저장 실패 — Supabase에 model_offs 테이블이 필요합니다.\n(supabase/model_offs_setup.sql 실행)\n"+String(e)); }
  };
  const handleDeleteModelOff = async (id: string) => {
    if (!confirm("이 휴무를 해제할까요?")) return;
    try { await sb("model_offs","DELETE",null,`?id=eq.${id}`); setModelOffs(modelOffs.filter(o=>o.id!==id)); }
    catch(e) { alert("휴무 해제 실패: "+String(e)); }
  };
  // 해당 모델이 그 날짜에 휴무인지 → 휴무 레코드(or null)
  const modelOffOn = (model_id: string, date: string) =>
    modelOffs.find(o => o.model_id===model_id && date>=o.start_date && date<=o.end_date) || null;

  // ── 섭외 일정 → 모델에게 보내기 (3가지 방법) ──
  // 구글 등록 실패 시 raw 에러(JSON) 대신 사용자가 바로 조치할 수 있는 문구로 변환
  const friendlyGcalErr = (err?: string) => {
    const e = (err || "").toLowerCase();
    if (e.includes("invalid_grant") || e.includes("expired") || e.includes("revoked") || e.includes("access_token"))
      return "구글 캘린더 연동이 만료되었어요.\n설정 → 구글 캘린더 연동 에서 계정을 다시 연결해 주세요.";
    if (e.includes("timerangeempty") || e.includes("time range"))
      return "일정의 종료 시간을 확인해 주세요.\n종료가 없으면 시작 +2시간으로 등록됩니다 — 다시 시도해 주세요.";
    return "구글 캘린더 등록에 실패했어요.\n설정에서 구글 연동 상태를 확인하거나 잠시 후 다시 시도해 주세요.";
  };
  const doGcalSync = async () => {
    const b = selectedBooking; if (!b) return;
    const m = models.find(x=>x.id===b.model_id), c = customers.find(x=>x.id===b.customer_id);
    const ev = bookingToCalEvent(b, m?.name||"모델", c?.name||"고객사");
    const input: any = { action: b.gcal_event_id?"update":"create", agency_id: agency.id, event_id: b.gcal_event_id, summary: ev.title, description: ev.description, location: ev.location, attendee_email: m?.email||"" };
    if (ev.start) { const hms=(s:string)=>{ const a=String(s).split(":"); return `${(a[0]||"00").padStart(2,"0")}:${a[1]||"00"}:${a[2]||"00"}`; }; input.start=`${ev.date}T${hms(ev.start)}`; input.end=`${ev.date}T${hms(ev.end||ev.start)}`; input.all_day=false; }
    else { input.all_day=true; input.date=ev.date; }
    const r = await gcalSync(input);
    if (r.skipped) return alert("구글 캘린더가 연동되지 않았습니다.\n설정 → 구글 캘린더 연동하기 를 먼저 해주세요.");
    if (r.ok) { if (!b.gcal_event_id && r.event_id) { try { await sb("bookings","PATCH",{gcal_event_id:r.event_id},`?id=eq.${b.id}`); setBookings(bookings.map(x=>x.id===b.id?{...x,gcal_event_id:r.event_id}:x)); setSelectedBooking((s:any)=>s?{...s,gcal_event_id:r.event_id}:s); } catch {} } alert(`구글 캘린더에 일정이 등록되고 ${m?.email||"모델"} 으로 초대를 보냈습니다.`); }
    else alert(friendlyGcalErr(r.error));
  };
  const doSendCalMail = async () => {
    const b = selectedBooking; if (!b) return;
    const m = models.find(x=>x.id===b.model_id), c = customers.find(x=>x.id===b.customer_id);
    if (!m?.email) return alert("모델 이메일이 없습니다. 모델 정보에 이메일을 입력하세요.");
    // 외부 발송 전 확인 — 수신자·일정 검토 후 보내기
    const tyLabel = BOOKING_TYPES[b.booking_type||"SHOOT"]?.label || "일정";
    const whenStr = b.shoot_date ? `${String(b.shoot_date).replace(/-/g,".")}${b.start_time?` ${b.start_time}`:""}${b.end_time?`~${b.end_time}`:""}` : "날짜 미정";
    const labelStr = b.project_name || c?.name || tyLabel;
    if (!confirm(`✉️ 일정 메일을 보낼까요?\n\n받는 사람  ${m.name||"모델"} <${m.email}>\n유형  ${tyLabel}\n일정  ${labelStr}\n일시  ${whenStr}`)) return;
    const tok = await ensureCalToken(m);
    const r = await sendCalEmail(m.email, bookingToCalEvent(b, m?.name||"모델", c?.name||"고객사"), m?.name||"", tok?calSubscribePageUrl(tok):"", agency?.name||"", agency?.owner_email||"", { project: b.project_name, brand: c?.name, type: b.booking_type });
    if (r.ok) alert(`${m.email} 으로 일정을 보냈습니다.`);
    else if (r.skipped) alert("메일 발송이 아직 연결되지 않았습니다.\n(email-send 함수 배포 필요)");
    else alert("메일 발송 실패: "+(r.error||""));
  };
  const doCopyCalLink = async () => {
    const b = selectedBooking; if (!b) return;
    const m = models.find(x=>x.id===b.model_id), c = customers.find(x=>x.id===b.customer_id);
    const url = calShareUrl(bookingToCalEvent(b, m?.name||"모델", c?.name||"고객사"));
    try { await navigator.clipboard.writeText(url); alert("캘린더 링크가 복사되었습니다.\n카톡·메시지에 붙여 보내면 모델이 자기 캘린더에 추가할 수 있어요.\n\n"+url); }
    catch { prompt("아래 링크를 복사해 모델에게 보내세요:", url); }
  };

  // 모델 캘린더 구독 토큰 보장(없으면 생성·저장). 실패(컬럼 미생성) 시 null.
  const ensureCalToken = async (m: any): Promise<string | null> => {
    if (m?.cal_token) return m.cal_token;
    const token = genCalToken();
    try {
      await sb("models", "PATCH", { cal_token: token }, `?id=eq.${m.id}`);
      setModels(models.map(x => x.id===m.id ? { ...x, cal_token: token } : x));
      if (selectedModel?.id===m.id) setSelectedModel({ ...selectedModel, cal_token: token });
      return token;
    } catch { return null; }
  };

  // 섭외 초대(수락 요청) 메일 발송 + 응답 토큰/상태(pending) 보장. 실패해도 앱 흐름 방해 X.
  // 수락형 흐름: 이 메일을 먼저 보내고, 모델이 수락해야(booking-respond) 캘린더가 생성된다.
  const sendBookingInvite = async (tb: any, tm: any, tc: any) => {
    // 소속사 모델은 A 업체로 수락/거절을 받는다 — 이메일(=A 구글캘린더 연동 메일) 우선, 없으면 계산서 메일.
    const forAgency = tm?.payout_tax_type === "company";
    const recipient = forAgency ? (tm?.email || tm?.agency_email) : tm?.email;
    if (!recipient) return;
    let token = tb.model_resp_token;
    const patch: any = {};
    if (!token) { token = genCalToken(); patch.model_resp_token = token; }
    if (tb.model_response !== "accepted") patch.model_response = "pending";
    if (Object.keys(patch).length) {
      try {
        await sb("bookings", "PATCH", patch, `?id=eq.${tb.id}`);
        setBookings(prev => prev.map(x => x.id === tb.id ? { ...x, ...patch } : x));
        setSelectedBooking((s: any) => s && s.id === tb.id ? { ...s, ...patch } : s);
      } catch {}
    }
    try {
      const ev = bookingToCalEvent(tb, tm?.name || "모델", tc?.name || "고객사");
      // 비구글 이메일(네이버·카카오·아웃룩 등)은 구글 게스트 초대가 캘린더에 자동 동기화되지 않으므로,
      // 수락 요청 메일에 "한 번 구독" 링크를 함께 안내해 이후 일시·장소 변경이 자동 반영되게 한다.
      // 구글(gmail/googlemail) 모델은 subUrl="" → 메일은 기존과 100% 동일.
      // 모델 캘린더 구독 링크는 모델 본인에게만 의미 — 대대행(A 업체 수신)엔 붙이지 않는다.
      let subUrl = "";
      if (!forAgency) {
        const emailDomain = (recipient || "").split("@")[1]?.toLowerCase() || "";
        if (emailDomain && emailDomain !== "gmail.com" && emailDomain !== "googlemail.com") {
          const ct = await ensureCalToken(tm);
          if (ct) subUrl = calSubscribePageUrl(ct);
        }
      }
      await sendInviteEmail(recipient, ev, { bookingId: tb.id, token }, tm?.name || "", agency?.name || "", agency?.owner_email || "", { project: tb.project_name, brand: tc?.name, type: tb.booking_type, forAgency }, subUrl);
    } catch {}
  };

  // 섭외 확정/수정/취소 → (수락형) 확정 시 초대 메일 / 수락 후 일시·장소 변경 시 구글 일정 갱신 / 취소 시 삭제·안내.
  // 구글 미연동·모델 이메일 없음·메일함수 미배포 시 안전하게 no-op(앱 흐름 방해 X).
  const syncBookingToCalendar = async (tb: any, tm: any, tc: any, opts: { mail?: boolean } = {}) => {
    if (!agency?.id || !tb) return;
    // ⚠️ 모델이 메일로 수락하면 gcal_event_id/model_response는 서버(booking-respond)에서만 갱신되어
    //    에이전시 세션의 로컬 상태는 옛값(null)일 수 있다. 취소 삭제·변경 갱신이 확실히 반영되도록 최신값 재조회.
    let liveEventId = tb.gcal_event_id || "";
    let liveResp = tb.model_response || "";
    try {
      const fresh = await sb("bookings", "GET", null, `?id=eq.${encodeURIComponent(tb.id)}&select=gcal_event_id,model_response`);
      if (Array.isArray(fresh) && fresh[0]) { liveEventId = fresh[0].gcal_event_id || ""; liveResp = fresh[0].model_response || liveResp; }
    } catch {}

    // gcal_event_id 저장(상태+DB 동기). null이면 연동 해제.
    const saveEventId = async (eid: string | null) => {
      try {
        await sb("bookings", "PATCH", { gcal_event_id: eid }, `?id=eq.${tb.id}`);
        setBookings(prev => prev.map(x => x.id === tb.id ? { ...x, gcal_event_id: eid } : x));
        setSelectedBooking((s: any) => s && s.id === tb.id ? { ...s, gcal_event_id: eid } : s);
      } catch {}
    };
    // 섭외 → gcal-sync 입력(create/update 공통)
    const gcalInput = (action: "create" | "update", eid?: string) => {
      const ev = bookingToCalEvent(tb, tm?.name || "모델", tc?.name || "고객사");
      const input: any = { action, agency_id: agency.id, event_id: eid, summary: ev.title, description: ev.description, location: ev.location, attendee_email: tm?.email || "" };
      if (ev.start) { const hms = (s: string) => { const a = String(s).split(":"); return `${(a[0] || "00").padStart(2, "0")}:${a[1] || "00"}:${a[2] || "00"}`; }; input.start = `${ev.date}T${hms(ev.start)}`; input.end = `${ev.date}T${hms(ev.end || ev.start)}`; input.all_day = false; }
      else { input.all_day = true; input.date = ev.date; }
      return input;
    };

    // 취소: 구글 일정 삭제(성공했을 때만 id 정리 — 미연동·토큰만료면 id 유지해 재시도 가능) + (opts.mail) 취소 안내 메일
    if (tb.status === "CANCELLED") {
      if (liveEventId) {
        try { const r = await gcalSync({ action: "delete", agency_id: agency.id, event_id: liveEventId }); if (r.ok) await saveEventId(null); } catch {}
      }
      // 소속사는 A 업체(=구글캘린더 메일 우선)로 취소 통지.
      const cancelTo = (tm?.payout_tax_type === "company") ? (tm?.email || tm?.agency_email) : tm?.email;
      if (opts.mail && cancelTo) {
        try {
          const ev2 = bookingToCalEvent(tb, tm?.name || "모델", tc?.name || "고객사");
          await sendCancelEmail(cancelTo, ev2, tm?.name || "", agency?.name || "", agency?.owner_email || "", { project: tb.project_name, brand: tc?.name, type: tb.booking_type });
        } catch {}
      }
      return;
    }
    // 확정 계열 + 날짜 있을 때만 (수락형 흐름)
    if (!["CONFIRMED", "COMPLETED", "SETTLED"].includes(tb.status) || !tb.shoot_date) return;
    const accepted = liveResp === "accepted";
    // ① 연동된 일정 있음 → 일시·장소 변경을 in-place 반영(중복·잔존 방지, sendUpdates=all 로 모델 통지)
    if (liveEventId) {
      try { await gcalSync(gcalInput("update", liveEventId)); } catch {}
      return;
    }
    // ② 일정 없음 + 모델이 이미 수락 → 이벤트 재생성(취소 후 재확정 등). gcal-sync 가 모델 재초대.
    if (accepted) {
      try { const r = await gcalSync(gcalInput("create")); if (r.ok && r.event_id) await saveEventId(r.event_id); } catch {}
      return;
    }
    // ③ 일정 없음 + 미수락 + 확정 트리거 → 초대(수락 요청) 메일 발송
    if (opts.mail) await sendBookingInvite(tb, tm, tc);
  };

  const handleChangeStatus = async (id: string, status: string) => {
    try {
      await sb("bookings","PATCH",{status},`?id=eq.${id}`);
      let updatedList = bookings.map(b=>b.id===id?{...b,status}:b);
      // 취소 시: 같은 모델·같은 날 HOLD 건의 충돌이 풀렸으면 자동 해제
      if (status==="CANCELLED") {
        const target = updatedList.find(b=>b.id===id);
        for (const hb of updatedList.filter(b=>b.id!==id&&b.model_id===target?.model_id&&b.shoot_date===target?.shoot_date&&b.status==="HOLD")) {
          const peers = updatedList.filter(b=>b.id!==hb.id&&b.model_id===hb.model_id&&b.shoot_date===hb.shoot_date&&b.status!=="CANCELLED");
          const still = peers.some(b=>scheduleConflict(hb.start_time,hb.end_time,b.start_time,b.end_time,hb.booking_type,b.booking_type,hb.location,b.location).conflict);
          if (!still) {
            await sb("bookings","PATCH",{status:"CHECKING"},`?id=eq.${hb.id}`);
            updatedList = updatedList.map(b=>b.id===hb.id?{...b,status:"CHECKING"}:b);
          }
        }
      }
      setBookings(updatedList);
      setSelectedBooking((prev:any)=>prev?{...prev,status}:null);
      // ── 알림톡 + 구글 동기화: 확정/취소(메일·알림톡) / 완료·정산 재활성(캘린더 갱신·재생성) ──
      if (["CONFIRMED","COMPLETED","SETTLED","CANCELLED"].includes(status)) {
        const tb = updatedList.find(b=>b.id===id);
        if (tb) {
          const tm = models.find(m=>m.id===tb.model_id);
          const tc = customers.find(c=>c.id===tb.customer_id);
          if (status==="CONFIRMED"||status==="CANCELLED")
            sendAlimtalkBoth(tm?.phone||"", tc?.phone||"", status==="CONFIRMED"?"CONFIRM":"CANCEL", { modelName:tm?.name||"모델", booking:tb, clientName:tc?.name||"고객사", managerName:tb.manager||"담당자", senderLabel:agency?.name||"에이전시", contactPhone:agency?.contact_phone||agency?.rep_phone||"" });
          syncBookingToCalendar(tb, tm, tc, { mail: status==="CONFIRMED"||status==="CANCELLED" }); // 구글 자동 동기화(취소 후 재확정 시 일정 재생성 포함) + 확정/취소 시 자동 메일(합의)
        }
      }
    } catch (e) { alert("상태 변경 실패: "+String(e)); }
  };

  // ── 회사 정보 ──
  const handleSaveCompany = async (updates: any) => {
    if (!agency) return;
    try {
      await sb("agencies","PATCH",updates,`?id=eq.${agency.id}`);
      const updated = { ...agency, ...updates };
      setAgency(updated); saveSession(session, updated, myRole);
    } catch (e: any) {
      const msg = String(e?.message||e);
      if (/duplicate|unique|conflict|23505/i.test(msg)) alert("이미 등록된 사업자번호입니다.");
      else alert("저장 실패: "+msg);
    }
  };

  // 권한 부여 — 담당자에게 대표 권한 추가 (본인 권한은 유지, 공동 대표)
  const handleTransferOwner = async (target: any) => {
    if (!agency || !target) return;
    if (target.role === "owner") return alert(`${target.name}님은 이미 대표 권한을 가지고 있습니다.`);
    if (!confirm(`${target.name}님에게 대표 권한을 부여하시겠어요?\n본인 권한은 그대로 유지되며, ${target.name}님도 설정·담당자·재무 기능을 사용할 수 있게 됩니다.`)) return;
    try {
      await sb("agency_members","PATCH",{role:"owner"},`?id=eq.${target.id}`);
      setMembers(members.map(m=> m.id===target.id ? {...m,role:"owner"} : m));
      alert(`${target.name}님에게 대표 권한을 부여했습니다.`);
    } catch (e) { alert("권한 부여 실패: "+String(e)); }
  };

  // 권한 회수 — 부여했던 대표 권한을 일반 담당자로 되돌림 (본인은 회수 불가)
  const handleRevokeOwner = async (target: any) => {
    if (!agency || !target) return;
    if (target.user_id === session?.id) return alert("본인 권한은 회수할 수 없습니다.");
    const ownerCount = members.filter(m=>m.role==="owner").length;
    if (ownerCount <= 1) return alert("대표 권한 보유자가 최소 1명은 있어야 합니다.");
    if (!confirm(`${target.name}님의 대표 권한을 회수하시겠어요?\n일반 담당자로 전환됩니다.`)) return;
    try {
      await sb("agency_members","PATCH",{role:"member"},`?id=eq.${target.id}`);
      setMembers(members.map(m=> m.id===target.id ? {...m,role:"member"} : m));
      alert(`${target.name}님의 대표 권한을 회수했습니다.`);
    } catch (e) { alert("권한 회수 실패: "+String(e)); }
  };

  // ── 정산 ──
  const openSettlement = (b: any) => { setSelectedSettlement(b); setEditFee(String(b.shoot_fee||"")); setEditMemo(b.settlement_memo||""); setEditPaid(b.is_paid||false); setEditModelPaid(b.model_paid||false); setEditOvercharges(b.overcharges||[]); setOcReason(""); setOcAmount(0); setShowOcInput(false);
    setEditPayType(b.model_pay_type||""); setEditPayValue(b.model_pay_value!=null?String(b.model_pay_value):"");
    setEditDepositPaid(b.deposit_paid||false); setEditDepositDate(b.deposit_paid_date||"");
    setEditBalancePaid(b.balance_paid||false); setEditBalanceDate(b.balance_paid_date||"");
    setEditInvoiceIssued(b.tax_invoice_issued||false); setEditInvoiceDate(b.tax_invoice_date||"");
    setEditModelPaidDate(b.model_paid_date||""); };
  const handleSaveSettlement = async () => {
    if (!selectedSettlement) return;
    const newFee = Number(editFee)||0;
    const ocT = editOvercharges.reduce((s,o)=>s+(o.amount||0),0);
    const dep = selectedSettlement.deposit_amt||0;
    const updates = { shoot_fee:newFee, settlement_memo:editMemo, is_paid:editPaid, model_paid:editModelPaid, overcharges:editOvercharges, balance_amt: Math.max(0, newFee + ocT - dep),
      model_pay_type: editPayType||null, model_pay_value: editPayType?(Number(editPayValue)||0):null,
      deposit_paid: (selectedSettlement.deposit_amt||0)>0 ? editDepositPaid : false, deposit_paid_date: (selectedSettlement.deposit_amt||0)>0 ? (editDepositDate||null) : null,
      balance_paid: editBalancePaid, balance_paid_date: editBalanceDate||null,
      tax_invoice_issued: editInvoiceIssued, tax_invoice_date: editInvoiceDate||null,
      model_paid_date: editModelPaidDate||null };
    try {
      await sb("bookings","PATCH",updates,`?id=eq.${selectedSettlement.id}`);
      setBookings(bookings.map(b=>b.id===selectedSettlement.id?{...b,...updates}:b));
      setSelectedSettlement(null);
    } catch (e) { alert("정산 저장 실패: "+String(e)); }
  };

  // ── 모달 백스택: 다른 상세에서 연 모달을 닫으면 직전 상세로 복귀 ──
  const clearAllDetails = () => {
    setSelectedBooking(null); setEditingBooking(false); setShowBocInput(false); setBocReason(""); setBocAmount(0);
    setSelectedSettlement(null); setSelectedModel(null); setModelHistAll(false); setShowCareer(false); setCustHistAll(false); setSelectedCustomer(null); setSelectedProjectId(null);
  };
  const openDetailById = (type: string, id: string) => {
    if (type==="booking")        { const b=bookings.find(x=>x.id===id); if(b){ setEditingBooking(false); setSelectedBooking(b); } }
    else if (type==="settlement"){ const b=bookings.find(x=>x.id===id); if(b) openSettlement(b); }
    else if (type==="model")     { const m=models.find(x=>x.id===id);   if(m){ setMEditMode(false); setModelHistAll(false); setSelectedModel(m); } }
    else if (type==="customer")  { const c=customers.find(x=>x.id===id); if(c){ setCEditMode(false); setSelectedCustomer(c); } }
    else if (type==="project")   { setSelectedProjectId(id); }
  };
  const currentDetail = (): {type:string; id:string}|null => {
    if (selectedBooking)    return { type:"booking",    id:selectedBooking.id };
    if (selectedSettlement) return { type:"settlement", id:selectedSettlement.id };
    if (selectedModel)      return { type:"model",      id:selectedModel.id };
    if (selectedCustomer)   return { type:"customer",   id:selectedCustomer.id };
    if (selectedProjectId)  return { type:"project",    id:selectedProjectId };
    return null;
  };
  // 다른 상세에서 새 상세 열기(현재 모달을 스택에 push)
  const openDetail = (type: string, id: string) => {
    const cur = currentDetail();
    setModalStack(cur ? [...modalStack, cur] : []);
    clearAllDetails();
    openDetailById(type, id);
  };
  // 닫기: 스택에 직전 모달이 있으면 그걸 최신 데이터로 다시 열고, 없으면 그냥 닫기
  const closeDetail = () => {
    clearAllDetails();
    if (modalStack.length===0) return;
    const back = modalStack[modalStack.length-1];
    setModalStack(modalStack.slice(0,-1));
    openDetailById(back.type, back.id);
  };
  // 리스트/페이지에서 새 상세 열기 — 스택 초기화(닫으면 그냥 닫힘)
  const openBookingFresh    = (b:any)   => { setModalStack([]); setEditingBooking(false); setSelectedBooking(b); };
  const openModelFresh      = (m:any)   => { setModalStack([]); setSelectedModel(m); };
  const openCustomerFresh   = (c:any)   => { setModalStack([]); setSelectedCustomer(c); };
  const openProjectFresh    = (pid:string) => { setModalStack([]); setSelectedProjectId(pid); };
  const openSettlementFresh = (b:any)   => { setModalStack([]); openSettlement(b); };

  // ── 브라우저 앞/뒤(뒤로가기) 버튼 → 앱 내 페이지 이동 + 상세 모달 닫기 ──
  const navPopRef = useRef(false);
  useEffect(() => {
    if (navPopRef.current) { navPopRef.current = false; return; }
    try { window.history.pushState({ modiqPage: page }, ""); } catch {}
  }, [page]);
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      // (1) 자식/로컬 오버레이(미리보기·라이트박스 등)가 열려 있으면 가장 위부터 닫고 흡수
      const overlayClose = topBack();
      if (overlayClose) {
        overlayClose();
        try { window.history.pushState({ modiqPage: page }, ""); } catch {}
        return;
      }
      const detail = currentDetail();
      const anyModal = !!detail || showModelForm || mEditMode || showCustomerForm || cEditMode || showProjectForm || showBookingForm || showAddPicker || showMemberForm || showMoreMenu || showStatement || showForeignModal || !!compModel || !!bulkEntity;
      if (anyModal) {
        if (detail) closeDetail();
        try { window.history.pushState({ modiqPage: page }, ""); } catch {}
        return;
      }
      const st = e.state as { modiqPage?: Page } | null;
      navPopRef.current = true;
      setPage(st && st.modiqPage ? st.modiqPage : "dashboard");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [page, selectedBooking, selectedSettlement, selectedModel, selectedCustomer, selectedProjectId, showModelForm, mEditMode, showCustomerForm, cEditMode, showProjectForm, showBookingForm, showAddPicker, showMemberForm, showMoreMenu, showStatement, showForeignModal, compModel, bulkEntity]);
  // App 로컬 전체화면 오버레이도 뒤로가기로 닫히도록 등록(LIFO)
  useBackClose(!!lightboxSrc, () => setLightboxSrc(null));
  useBackClose(showSendMenu, () => setShowSendMenu(false));

  // ── 섭외 명세서(바우처) 발급: 인쇄/PDF용 새 창 ──
  const issueVoucher = (b: any) => {
    const model  = models.find((m:any)=>m.id===b.model_id);
    const client = customers.find((c:any)=>c.id===b.customer_id);
    const esc = (s:any) => String(s ?? "").replace(/[&<>"]/g, (ch:string)=>(({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" } as Record<string,string>)[ch]));
    const won = (n:number) => (n||0).toLocaleString("ko-KR") + "원";
    const fdate = (d?:string) => d ? esc(d.replace(/-/g,".")) : "-";
    const fbiz = (s?:string) => { const n=String(s||"").replace(/[^0-9]/g,""); return n.length===10 ? `${n.slice(0,3)}-${n.slice(3,5)}-${n.slice(5)}` : esc(s||"-"); };
    const bt = BOOKING_TYPES[b.booking_type||"SHOOT"]?.label || "촬영";
    const isConfirmed = ["CONFIRMED","COMPLETED","SETTLED"].includes(b.status);
    const docKind = isConfirmed ? "계약 확인서" : "견적·청구용";
    const total = bookingTotal(b), ocT = overchargeTotal(b), dep = b.deposit_amt||0, bal = clientBalance(b);
    const ocRows = (Array.isArray(b.overcharges)?b.overcharges:[]).map((o:any)=>`<tr><td>추가금 · ${esc(o.reason)}</td><td class="num">${won(o.amount)}</td></tr>`).join("");
    const voucherNo = `MODIQ-${(String(b.id||"").replace(/[^0-9A-Za-z]/g,"").slice(-6).toUpperCase())||"000000"}`;
    const issuedAt = new Date().toLocaleDateString("ko-KR");
    const timeStr = (b.start_time||b.end_time) ? `${esc(b.start_time||"")}${b.end_time?` ~ ${esc(b.end_time)}`:""}` : "-";
    const shootTypes = Array.isArray(b.shoot_types)&&b.shoot_types.length ? esc(b.shoot_types.join(", ")) : "-";
    const usageScope = Array.isArray(b.usage_scope)&&b.usage_scope.length ? esc(b.usage_scope.join(", ")) : "-";
    const row = (l:string, v:string) => `<div class="r"><span class="l">${l}</span><span class="v">${v}</span></div>`;
    // 공유용 요약 텍스트(카톡·문자·메일)
    const rawDate = (b.shoot_date||"").replace(/-/g,".");
    const rawTime = (b.start_time||b.end_time) ? `${b.start_time||""}${b.end_time?`~${b.end_time}`:""}` : "";
    const summary = [
      `[${b.project_name||"촬영 섭외"}] 촬영 섭외 명세서`,
      `· 모델: ${model?.name||"-"}${model?.id?` (${model.id})`:""}`,
      `· 일자: ${rawDate||"-"}${rawTime?` ${rawTime}`:""}`,
      b.location?`· 장소: ${b.location}`:"",
      `· 총액: ${(total||0).toLocaleString("ko-KR")}원 (계약금 ${(dep||0).toLocaleString("ko-KR")}원 / 잔금 ${(bal||0).toLocaleString("ko-KR")}원)`,
      `· 발급: ${agency?.name||"MODIQ"} (${voucherNo})`,
    ].filter(Boolean).join("\n");
    const subject = `${b.project_name||"촬영 섭외"} 명세서 (${voucherNo})`;
    const shareJS = JSON.stringify(summary).replace(/</g,"\\u003c");
    const subjJS  = JSON.stringify(subject).replace(/</g,"\\u003c");
    const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=792"><title>${esc(voucherNo)} · 촬영 섭외 명세서</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;background:#eceff3;color:#1f2430;padding:22px 16px 30px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sheet{max-width:760px;margin:0 auto;background:#fff;border:1px solid #e2e6ec;border-radius:14px;overflow:hidden;box-shadow:0 12px 40px -18px rgba(0,0,0,.3)}
.top{display:flex;justify-content:space-between;align-items:flex-start;padding:18px 26px;background:#ffffff;color:#1f2430;border-bottom:3px solid #c9a96e}
.hd{display:flex;align-items:center;gap:13px}
.logo{height:48px;width:auto;max-width:150px;object-fit:contain;flex-shrink:0}
.brand{font-size:12px;letter-spacing:.5px;color:#a8842c;font-weight:800}
.ttl{font-size:20px;font-weight:800;margin-top:3px;color:#1f2430}
.sub{font-size:11px;color:#8a92a0;margin-top:5px}
.tag{display:inline-block;padding:2px 8px;border-radius:6px;font-weight:800;font-size:10px;margin-right:6px;vertical-align:1px}
.tag.ok{background:#1c8f5a;color:#fff}.tag.prov{background:#d9822b;color:#fff}
.meta{text-align:right;font-size:11px;color:#8a92a0;line-height:1.65}
.meta b{color:#1f2430;font-size:12px}
.body{padding:18px 26px 22px}
.grid2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:11px;margin-bottom:13px}
.box{border:1px solid #e6e9ef;border-radius:10px;padding:11px 13px;background:#fafbfc}
.box h4{font-size:10.5px;color:#c9a96e;font-weight:800;letter-spacing:.4px;margin-bottom:7px;text-transform:uppercase}
.r{display:flex;gap:9px;font-size:12px;padding:2px 0}
.r .l{color:#7c8595;min-width:70px;flex-shrink:0}
.r .v{color:#1f2430;font-weight:600;word-break:keep-all;overflow-wrap:break-word}
.modelbar{display:flex;align-items:center;gap:11px;background:#1c2330;color:#fff;border-radius:10px;padding:11px 16px;margin-bottom:13px}
.modelbar .lab{font-size:10.5px;color:#c9a96e;font-weight:800}
.modelbar .nm{font-size:18px;font-weight:800}
.sec{font-size:10.5px;color:#7c8595;font-weight:800;letter-spacing:.4px;margin:0 0 7px;text-transform:uppercase}
table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:13px}
td{padding:7px 11px;border-bottom:1px solid #eef1f5}
td.num{text-align:right;font-weight:700;font-variant-numeric:tabular-nums}
tr.tot td{background:#fbf7ef;border-top:2px solid #c9a96e;border-bottom:none;font-size:14px;font-weight:800;color:#8a6d2f}
tr.due td{color:#5a6373;font-size:11px}
.notice{font-size:10px;color:#6b7280;line-height:1.65;background:#f6f8fa;border-radius:8px;padding:9px 12px;margin-bottom:13px}
.sign{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:11px}
.sigbox{border:1px solid #e6e9ef;border-radius:10px;padding:11px 13px;min-height:74px;position:relative}
.sigbox .who{font-size:11px;color:#7c8595;font-weight:700}
.sigbox .nm{font-size:13px;font-weight:800;margin-top:4px;color:#1f2430}
.sigbox .seal{position:absolute;right:13px;bottom:11px;font-size:10px;color:#b8bfca}
.foot{text-align:center;font-size:9.5px;color:#9aa2af;margin-top:11px;line-height:1.6}
.bar{display:flex;gap:10px;justify-content:center;max-width:760px;margin:0 auto;padding:18px 0 4px}
.bb{flex:1 1 0;max-width:300px;border:none;border-radius:10px;padding:15px 16px;font-size:16px;font-weight:800;cursor:pointer;color:#fff;background:#3a4350}
.bb.share{background:#2f6fed}.bb.print{background:#1c8f5a}
.topbar{max-width:760px;margin:0 auto 10px;display:flex;justify-content:flex-end}
.xbtn{display:inline-flex;align-items:center;gap:6px;background:rgba(31,36,48,.88);color:#fff;border:none;border-radius:9px;padding:10px 16px;font-size:14px;font-weight:700;cursor:pointer}
@page{size:A4 portrait;margin:12mm 14mm}
@media print{
  html,body{background:#fff;padding:0;margin:0}
  .topbar,.bar{display:none}
  .sheet{border:none;box-shadow:none;border-radius:0;max-width:none;width:100%}
  .top{padding:14px 4px}
  .body{padding:14px 4px 4px}
  .grid2,.modelbar,table,.notice{margin-bottom:10px}
  /* A4 1장 보장: 살짝 축소 */
  .sheet{zoom:0.95}
}
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
</head><body>
<div class="topbar"><button class="xbtn" onclick="window.close()">✕ 닫기</button></div>
<div class="sheet">
  <div class="top">
    <div class="hd">${agency?.logo_url?`<img class="logo" src="${esc(agency.logo_url)}" alt="">`:""}<div><div class="brand">${esc(agency?.name||"MODIQ")}</div><div class="ttl">촬영 섭외 명세서</div><div class="sub"><span class="tag ${isConfirmed?"ok":"prov"}">${esc(docKind)}</span>Model Booking Statement</div></div></div>
    <div class="meta"><b>${esc(voucherNo)}</b><br>발급일 ${esc(issuedAt)}${b.project_name?`<br>프로젝트 ${esc(b.project_name)}`:""}</div>
  </div>
  <div class="body">
    <div class="grid2">
      <div class="box"><h4>발급처 (에이전시)</h4>
        ${row("상호", esc(agency?.name||"-"))}
        ${row("대표자", esc(agency?.rep_name||"-"))}
        ${row("연락처", esc(agency?.contact_phone||agency?.rep_phone||"-"))}
        ${row("사업자", fbiz(agency?.biz_no))}
        ${agency?.address?row("주소", esc(agency.address)):""}
      </div>
      <div class="box"><h4>고객사</h4>
        ${row("상호", esc(client?.name||"-"))}
        ${client?.brand?row("브랜드", esc(client.brand)):""}
        ${row("담당자", esc(client?.manager_name||"-"))}
        ${row("연락처", esc(client?.phone||"-"))}
        ${client?.biz_no?row("사업자", fbiz(client.biz_no)):""}
        ${client?.tax_email?row("계산서", esc(client.tax_email)):""}
      </div>
    </div>
    <p class="sec">촬영 정보</p>
    <div class="box" style="margin-bottom:18px">
      ${b.project_name?row("프로젝트", esc(b.project_name)):""}
      ${row("모델", esc((model?.name||"-") + (model?.id?` (${model.id})`:"")))}
      ${row("구분", esc(bt))}
      ${row("일자", fdate(b.shoot_date))}
      ${row("시간", timeStr)}
      ${row("장소", esc(b.location||"-"))}
      ${row("촬영범위", shootTypes)}
      ${row("사용범위", usageScope)}
      ${row("사용기간", esc(b.usage_period||"-"))}
      ${row("담당", esc(b.manager||"-"))}
    </div>
    <p class="sec">금액 명세</p>
    <table>
      <tr><td>계약 총액 (기본 촬영비)</td><td class="num">${won(b.shoot_fee||0)}</td></tr>
      ${ocRows}
      <tr class="tot"><td>${ocT>0?"최종 총액 (추가금 포함)":"총 계약 금액"}</td><td class="num">${won(total)}</td></tr>
      <tr><td>계약금</td><td class="num">${won(dep)}</td></tr>
      ${b.deposit_due?`<tr class="due"><td>계약금 입금 예정일</td><td class="num">${fdate(b.deposit_due)}</td></tr>`:""}
      <tr><td>잔금</td><td class="num">${won(bal)}</td></tr>
      ${b.balance_due?`<tr class="due"><td>잔금 입금 예정일</td><td class="num">${fdate(b.balance_due)}</td></tr>`:""}
    </table>
    <div class="notice">1. 본 명세서는 상기 촬영 섭외 건의 계약 내용을 확인·증빙하기 위한 문서이며, 양 당사자가 합의한 일정·촬영범위·사용범위 및 금액 조건을 명시합니다.<br>2. 명시된 사용 기간 및 사용 범위를 벗어나는 사용에 대해서는 반드시 사전 협의를 하여야 하며, 사전 협의 없이 사용할 경우 그에 따른 법적 피해를<br>보상하여야 합니다.<br>3. 변경 사항 발생 시 양측 협의 후 재발급됩니다.</div>
    <div class="foot">본 명세서 관련 문의는 발급처(${esc(agency?.name||"에이전시")})로 연락 바랍니다.<br>Powered by <span style="color:#a8842c;font-weight:800;letter-spacing:.3px">modiq</span> · talent agency OS</div>
  </div>
</div>
<div class="bar">
  <button id="shareBtn" class="bb share" onclick="sharePdf()">공유하기</button>
  <button class="bb print" onclick="window.print()">인쇄 / 저장</button>
</div>
<script>
var ST=${shareJS}, SU=${subjJS};
function fname(){ return (SU||'명세서').replace(/[\\\\/:*?"<>|]/g,'_'); }
async function makePdfBlob(){
  var el=document.querySelector('.sheet');
  var canvas=await html2canvas(el,{scale:2,backgroundColor:'#ffffff',useCORS:true});
  var img=canvas.toDataURL('image/jpeg',0.95);
  var jsPDF=window.jspdf.jsPDF;
  var pdf=new jsPDF('p','mm','a4');
  var pw=pdf.internal.pageSize.getWidth(), ph=pdf.internal.pageSize.getHeight();
  var ih=canvas.height*pw/canvas.width;
  if(ih<=ph){ pdf.addImage(img,'JPEG',0,0,pw,ih); }
  else { var pos=0, rem=ih; while(rem>0){ pdf.addImage(img,'JPEG',0,pos,pw,ih); rem-=ph; if(rem>0){ pdf.addPage(); pos-=ph; } } }
  return pdf.output('blob');
}
async function sharePdf(){
  var btn=document.getElementById('shareBtn'), t0=btn.textContent; btn.textContent='생성 중…'; btn.disabled=true;
  try{
    var blob=await makePdfBlob();
    var file=new File([blob], fname()+'.pdf', {type:'application/pdf'});
    if(navigator.canShare && navigator.canShare({files:[file]})){ await navigator.share({files:[file], title:SU, text:ST}); }
    else { var url=URL.createObjectURL(blob), a=document.createElement('a'); a.href=url; a.download=file.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){URL.revokeObjectURL(url);},2000); alert('이 기기는 파일 공유를 지원하지 않아 PDF를 저장했어요. 저장된 파일을 카톡·메일에 첨부해 보내세요.'); }
  }catch(e){ alert('PDF 생성 실패: '+e); }
  btn.textContent=t0; btn.disabled=false;
}
</script>
</body></html>`;
    const w = window.open("", "_blank", "width=840,height=1040");
    if (!w) { alert("팝업이 차단되었습니다. 브라우저에서 팝업을 허용한 뒤 다시 시도하세요."); return; }
    w.document.write(html);
    w.document.close();
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

  const handleUpdateMember = async (id: string, updates: any) => {
    try {
      await sb("agency_members","PATCH",updates,`?id=eq.${id}`);
      setMembers(members.map(m=>m.id===id?{...m,...updates}:m));
    } catch (e) { alert("담당자 정보 수정 실패: "+String(e)); }
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
  const settlementData = useMemo(()=>bookings.filter(b=>["COMPLETED","SETTLED"].includes(b.status) && BOOKING_TYPES[b.booking_type||"SHOOT"]?.hasContract && bookingTotal(b)>0),[bookings]);
  const filteredSettlement = useMemo(()=>{
    return settlementData.filter(b=>{
      // 정산대기 = 촬영완료 & (고객입금·모델지급 둘 다 완료가 아님) / 정산완료 = 둘 다 완료 or 상태 정산완료 / 미입금잔금 = 고객 미입금
      if (settlementTab==="PENDING"){ if(b.status!=="COMPLETED" || (b.is_paid && b.model_paid)) return false; }
      if (settlementTab==="SETTLED"){ if(!(b.status==="SETTLED" || (b.is_paid && b.model_paid))) return false; }
      if (settlementTab==="UNPAID") { if(b.is_paid) return false; }
      if (settlementMonth!=="ALL"&&!b.shoot_date?.startsWith(settlementMonth)) return false;
      if (settlementModel!=="ALL"&&b.model_id!==settlementModel) return false;
      if (settlementClient!=="ALL"&&b.customer_id!==settlementClient) return false;
      return true;
    });
  },[settlementData,settlementTab,settlementMonth,settlementModel,settlementClient]);

  const settlementSummary = useMemo(()=>{
    const total = filteredSettlement.reduce((s,b)=>s+bookingTotal(b),0);
    // 수수료·모델지급은 모델별 수수료로 건별 계산 후 합산
    const commission = filteredSettlement.reduce((s,b)=>s+bookingAgencyFee(b,models),0);
    const modelPay = filteredSettlement.reduce((s,b)=>s+bookingModelPay(b,models),0);
    // 고객사 입금(받을 돈) 흐름 — is_paid 기준
    const clientPaid   = filteredSettlement.filter(b=>b.is_paid).reduce((s,b)=>s+bookingTotal(b),0);
    const clientUnpaid = total - clientPaid;
    // 모델 지급(줄 돈) 흐름 — model_paid 기준
    const modelPaidAmt   = filteredSettlement.filter(b=>b.model_paid).reduce((s,b)=>s+bookingModelPay(b,models),0);
    const modelUnpaidAmt = Math.max(0, modelPay - modelPaidAmt);
    return { total, commission, modelPay, clientPaid, clientUnpaid, modelPaidAmt, modelUnpaidAmt };
  },[filteredSettlement, models]);

  const settlementMonths   = useMemo(()=>{ const s=new Set<string>(); settlementData.forEach(b=>{if(b.shoot_date)s.add(b.shoot_date.slice(0,7))}); return Array.from(s).sort().reverse(); },[settlementData]);
  const settlementProjects = useMemo(()=>{ const s=new Set<string>(); settlementData.forEach(b=>{if(b.project_name)s.add(b.project_name)}); return Array.from(s); },[settlementData]);

  // 로스터(목록·검색·포트폴리오·패키지)용 모델 — 출처 발송이 만료/철회된 편입 모델은 숨김.
  // ⚠️ 섭외·정산·매출·캘린더는 원본 `models`를 그대로 써서 이력이 유지된다(여긴 숨김 미적용).
  const rosterModels = useMemo(()=>{
    if (!distIdsLoaded) return models; // 출처 상태 조회 전/실패 → 숨기지 않음
    return models.filter(m => !(m.source_distribution_id && !activeDistIds.has(m.source_distribution_id)));
  }, [models, activeDistIds, distIdsLoaded]);
  const filteredModels = useMemo(()=>{
    if (!modelQ.trim()) return rosterModels;
    const q = modelQ.trim().toLowerCase();
    const custMap = new Map<string,any>(customers.map(c=>[c.id,c]));
    const matchedByCustomer = new Set<string>();
    bookings.forEach(b=>{
      const c = custMap.get(b.customer_id);
      if (c&&(c.name?.toLowerCase().includes(q)||c.brand?.toLowerCase().includes(q))) matchedByCustomer.add(b.model_id);
    });
    // 여러 단어를 공백/슬래시로 구분해 입력하면 그 중 하나라도 매칭되면 검색됨 (예: "mbc 사랑이 뭐길래")
    const terms = q.split(/[\/\s]+/).filter(Boolean);
    const hit = (m:any, t:string) =>
      m.name?.toLowerCase().includes(t) || m.phone?.includes(t) || m.email?.toLowerCase().includes(t) ||
      m.specialty?.toLowerCase().includes(t) || m.career?.toLowerCase().includes(t) || m.country?.toLowerCase().includes(t) ||
      m.source_agency_name?.toLowerCase().includes(t) ||
      (Array.isArray(m.fields)&&m.fields.join(" ").toLowerCase().includes(t)) || matchedByCustomer.has(m.id);
    return rosterModels.filter(m => terms.some(t => hit(m, t)));
  }, [rosterModels, bookings, customers, modelQ]);
  const customerCategories = useMemo(()=> Array.from(new Set(customers.map((c:any)=>c.category).filter(Boolean))) as string[], [customers]);
  // 분야 직접입력값을 에이전시 영구 목록(client_categories)에 등록
  const addClientCategory = async (name: string) => {
    const v = (name||"").trim(); if (!v || !agency) return;
    const list: string[] = Array.isArray(agency.client_categories) ? agency.client_categories : [];
    if (list.includes(v)) return;
    const next = [...list, v];
    try {
      await sb("agencies","PATCH",{ client_categories: next },`?id=eq.${agency.id}`);
      const updated = { ...agency, client_categories: next };
      setAgency(updated); saveSession(session, updated, myRole);
    } catch (e) { alert("분야 추가 실패: "+String(e)); }
  };
  const filteredCustomers = useMemo(()=>{
    if (!customerQ.trim()) return customers;
    const q = customerQ.trim().toLowerCase();
    return customers.filter(c=>c.name?.toLowerCase().includes(q)||c.phone?.includes(q)||c.brand?.toLowerCase().includes(q)||c.manager_name?.toLowerCase().includes(q)||c.email?.toLowerCase().includes(q)||c.category?.toLowerCase().includes(q)||c.rep_name?.toLowerCase().includes(q));
  }, [customers, customerQ]);
  const filteredBookings = useMemo(()=>{
    const modelNameMap = new Map<string,string>(models.map(m=>[m.id, m.name||""]));
    const custNameMap  = new Map<string,string>(customers.map(c=>[c.id, c.name||""]));
    return bookings.filter(b=>{
      const mn = modelNameMap.get(b.model_id)||"";
      const cn = custNameMap.get(b.customer_id)||"";
      const matchQ = mn.includes(bookingQ)||cn.includes(bookingQ)||(b.project_name||"").includes(bookingQ);
      const matchSt = bookingStatusF==="ALL"||b.status===bookingStatusF;
      const matchTy = bookingTypeF==="ALL"||(b.booking_type||"SHOOT")===bookingTypeF;
      const matchMg = bookingManagerF==="ALL"||b.manager===bookingManagerF;
      const matchMo = bookingMonthF==="ALL"||(b.shoot_date||"").startsWith(bookingMonthF);
      const matchCancel = bookingStatusF==="CANCELLED" || b.status!=="CANCELLED";
      return matchQ&&matchSt&&matchTy&&matchMg&&matchMo&&matchCancel;
    });
  }, [bookings, models, customers, bookingQ, bookingStatusF, bookingTypeF, bookingManagerF, bookingMonthF]);
  const bookingMonths = useMemo(()=>Array.from(new Set(bookings.filter(b=>b.shoot_date).map(b=>b.shoot_date.slice(0,7)))).sort().reverse(), [bookings]);

  const maxMembers  = getTotalMemberLimit(agency?.plan||"trial", agency?.additional_members||0);
  const memberNames = useMemo(()=>members.map(m=>m.name), [members]);
  // 재무(매출·정산) 열람 권한: 현재는 대표만. 추후 member.can_view_finance 추가 예정.
  const myMember = members.find(m=>m.user_id===session?.id);
  const canViewFinance = myRole==="owner" || !!myMember?.can_view_finance;
  const planCfg     = PLAN_FEATURES[agency?.plan||"trial"];
  const trialDays   = getTrialDaysLeft(agency?.trial_ends_at);
  const trialExpired= trialDays!==null&&trialDays<=0&&agency?.plan==="trial";

  // ── 네비 탭 ──
  const NavTab = ({ target, label, icon:Icon, expanded=true }: { target:Page; label:string; icon:any; expanded?:boolean }) => (
    <button onClick={()=>setPage(target)} title={label} style={{
      width:"100%", display:"flex", alignItems:"center", gap:10,
      justifyContent:expanded?"flex-start":"center",
      padding:expanded?"9px 12px":"10px 0", borderRadius:8, border:"none", cursor:"pointer",
      background:page===target?"var(--c-nav-active)":"transparent",
      color:page===target?"white":C.textSub,
      fontSize:13, fontWeight:page===target?700:500, marginBottom:2, textAlign:"left",
      transition:"background 0.15s,color 0.15s", whiteSpace:"nowrap", overflow:"hidden",
    }}
      onMouseEnter={e=>{ if(page!==target){e.currentTarget.style.background=C.sideHover;e.currentTarget.style.color="white";} }}
      onMouseLeave={e=>{ if(page!==target){e.currentTarget.style.background="transparent";e.currentTarget.style.color=C.textSub;} }}
    >
      <Icon size={18} strokeWidth={1.8} style={{ flexShrink:0 }} />{expanded&&<span>{label}</span>}
    </button>
  );

  // ══════════════════════════════════════════════
  // 공개 패키지 라우트 (?pkg=토큰) — 로그인 불필요, 고객사용
  // ══════════════════════════════════════════════
  const pkgToken = new URLSearchParams(window.location.search).get("pkg");
  if (pkgToken) return <Suspense fallback={<PageLoading/>}><PackagePublicView token={pkgToken} /></Suspense>;
  const calData = new URLSearchParams(window.location.search).get("cal");
  if (calData) return <Suspense fallback={<PageLoading/>}><CalendarAddView data={calData} /></Suspense>;
  const subToken = new URLSearchParams(window.location.search).get("sub");
  if (subToken) return <Suspense fallback={<PageLoading/>}><CalSubscribeView token={subToken} /></Suspense>;

  // ══════════════════════════════════════════════
  // 로그인 화면
  // ══════════════════════════════════════════════
  if (!session||!agency) {
    return (
      // 전역 #root zoom(모바일 1.07/데스크톱 1.14)을 상쇄해 로그인은 실제 뷰포트 기준 정중앙 정렬(100vw 오버플로로 인한 어긋남 방지)
      <div style={{ minHeight:"100vh", width:"100%", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", zoom: isMobile ? 0.935 : 0.877 }}>
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:40, width:"90%", maxWidth:400 }}>
          <div style={{ textAlign:"center", marginBottom:22 }}>
            <h1 style={{ color:C.text, fontSize:30, margin:"0 0 5px", fontWeight:800, letterSpacing:"-1px" }}><span style={{ color:"#A8FF00" }}>m</span>odiq</h1>
            <p style={{ color:"#A8FF00", fontSize:11, margin:0, fontWeight:700, letterSpacing:"2.5px", textTransform:"uppercase" }}>talent agency OS</p>
            <p style={{ color:C.muted, fontSize:10, margin:"4px 0 0" }}>v{APP_VERSION}</p>
          </div>
          <div style={{ display:"flex", background:"var(--c-bg)", borderRadius:8, padding:4, marginBottom:22 }}>
            {(["login","signup"] as AuthMode[]).map(mode=>(
              <button key={mode} onClick={()=>{setAuthMode(mode);setAuthError("");setConfirmSent(false);}} style={{ flex:1, padding:"8px 0", border:"none", borderRadius:6, cursor:"pointer", fontWeight:600, fontSize:14, background:authMode===mode?C.blue:"transparent", color:authMode===mode?"white":C.muted, transition:"all 0.2s" }}>
                {mode==="login"?"로그인":"회원가입"}
              </button>
            ))}
          </div>
          {authMode==="signup" && (
            <>
              <input style={inp} type="text" placeholder="에이전시명 *" value={agencyName} onChange={e=>{setAgencyName(e.target.value);setAuthError("");}} />
              <input style={inp} type="text" placeholder="사업자등록번호 * (10자리)" value={bizNo} onChange={e=>{setBizNo(e.target.value);setAuthError("");}} />
              <div style={{ background:"#1a3a1a", border:"1px solid #2ECC71", borderRadius:8, padding:"10px 14px", marginBottom:10, fontSize:12 }}>
                <p style={{ margin:0, color:"#2ECC71", fontWeight:700 }}>14일 무료 체험</p>
                <p style={{ margin:"4px 0 0", color:C.textSub }}>신용카드 없이 모든 기능을 무료로 사용해보세요!</p>
              </div>
            </>
          )}
          <input style={inp} type="email" placeholder="이메일 *" value={email} onChange={e=>{setEmail(e.target.value);setAuthError("");}} onKeyDown={e=>e.key==="Enter"&&(authMode==="login"?handleLogin():handleSignup())} />
          <input style={inp} type="password" placeholder="비밀번호 (6자 이상) *" value={password} onChange={e=>{setPassword(e.target.value);setAuthError("");}} onKeyDown={e=>e.key==="Enter"&&(authMode==="login"?handleLogin():handleSignup())} />
          {confirmSent && (
            <div style={{ background:"#13301f", border:"1px solid #2ECC71", borderRadius:8, padding:"10px 14px", marginBottom:10, fontSize:12 }}>
              <p style={{ margin:0, color:"#2ECC71", fontWeight:700 }}>📧 인증 메일을 보냈어요</p>
              <p style={{ margin:"4px 0 0", color:C.textSub, lineHeight:1.6 }}>{email} 로 보낸 링크를 눌러 인증을 완료한 뒤 로그인해 주세요. (메일이 안 보이면 스팸함도 확인)</p>
            </div>
          )}
          {authError && <p style={{ color:C.red, fontSize:12, margin:"-4px 0 10px", textAlign:"center", whiteSpace:"pre-line" }}>{authError}</p>}
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
          <p style={{ margin:"0 0 14px" }}><Ban size={40} color={C.red} /></p>
          <h2 style={{ color:C.text, margin:"0 0 8px" }}>무료 체험이 만료되었습니다</h2>
          <p style={{ color:C.textSub, marginBottom:28 }}>계속 사용하려면 요금제를 선택하세요.<br/>데이터는 안전하게 보관되어 있습니다.</p>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,minmax(0,1fr))", gap:12, marginBottom:20 }}>
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
    { target:"dashboard"  as Page, label:"대시보드", icon:Gauge },
    { target:"calendar"   as Page, label:"캘린더",   icon:CalendarCheck },
    { target:"bookings"   as Page, label:"섭외",     icon:ClipboardCheck },
    { target:"models"     as Page, label:"모델",     icon:User },
    { target:"studio"     as Page, label:"포트폴리오", icon:Camera },
    { target:"packages"   as Page, label:"패키지",   icon:CardStack },
    { target:"customers"  as Page, label:"고객사",   icon:Building },
    ...(FEATURE_DISTRIBUTION?[{ target:"distribution" as Page, label:"발송", icon:Handshake }]:[]),
    ...(canViewFinance?[
      { target:"revenue"    as Page, label:"매출 현황", icon:BarChart },
      { target:"settlement" as Page, label:"정산",     icon:CoinStack },
    ]:[]),
  ];
  const adminItems = [
    ...(myRole==="owner"?[{target:"members" as Page,label:"담당자",icon:Agents}]:[]),
    ...(myRole==="owner"?[{target:"company" as Page,label:"설정",icon:Settings}]:[]),
    { target:"plan" as Page, label:"요금제", icon:CreditCard },
  ];

  // ══════════════════════════════════════════════
  // 메인 레이아웃
  // ══════════════════════════════════════════════
  return (
    <div style={{ display:"flex", minHeight:"100vh", width:"100%", maxWidth:"100vw", background:C.bg, color:C.text }}>

      {/* ── 데스크탑 상단 바 (로고 / 업체명·다크모드·로그아웃) ── */}
      {!isMobile&&(
      <div style={{ position:"fixed", top:0, left:0, right:0, height:52, background:C.sidebar, borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 22px", zIndex:300 }}>
        <div style={{ display:"flex", flexDirection:"column", lineHeight:1.05 }}>
          <p style={{ margin:0, fontSize:20, fontWeight:900, color:C.text, letterSpacing:"-0.7px" }}><span style={{ color:"#A8FF00" }}>m</span>odiq <span style={{ fontSize:9, color:C.muted, fontWeight:500 }}>v{APP_VERSION}</span></p>
          <span style={{ fontSize:8, fontWeight:700, letterSpacing:"1.8px", color:"#A8FF00", textTransform:"uppercase", marginTop:2 }}>talent agency OS</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ display:"flex", alignItems:"center", gap:7 }}>
            <span style={{ fontSize:13, fontWeight:700, color:C.text }}>{agency.name}</span>
            <span style={{ fontSize:11, color:C.muted, whiteSpace:"nowrap" }}>{myRole==="owner"?<><Crown size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> 대표</>:<><User size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> 담당자</>}</span>
          </span>
          <button onClick={()=>setTheme(t=>t==="dark"?"light":"dark")} title={theme==="dark"?"라이트 모드":"다크 모드"} style={{ display:"flex", alignItems:"center", justifyContent:"center", width:34, height:34, borderRadius:9, border:`1px solid ${C.border}`, cursor:"pointer", background:"transparent", color:C.muted, transition:"all 0.15s" }}
            onMouseEnter={e=>{e.currentTarget.style.background=C.sideHover;e.currentTarget.style.color=C.text;}}
            onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=C.muted;}}>
            {theme==="dark"?<Sun size={15} style={{ flexShrink:0 }}/>:<Moon size={15} style={{ flexShrink:0 }}/>}
          </button>
          <button onClick={handleLogout} title="로그아웃" style={{ display:"flex", alignItems:"center", gap:6, padding:"0 14px", height:34, borderRadius:9, border:`1px solid ${C.border}`, cursor:"pointer", background:"transparent", color:C.muted, fontSize:12, fontWeight:600, transition:"all 0.15s" }}
            onMouseEnter={e=>{e.currentTarget.style.color=C.red;e.currentTarget.style.borderColor=C.red+"66";}}
            onMouseLeave={e=>{e.currentTarget.style.color=C.muted;e.currentTarget.style.borderColor=C.border;}}>
            로그아웃
          </button>
        </div>
      </div>
      )}

      {/* ── 사이드바 (아이콘 + 마우스오버 펼침) ── */}
      {!isMobile&&(
      <div onMouseEnter={()=>setNavHover(true)} onMouseLeave={()=>setNavHover(false)}
        style={{ width:navHover?212:64, minWidth:navHover?212:64, background:C.sidebar, borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column", position:"fixed", top:52, left:0, bottom:0, zIndex:250, transition:"width 0.18s ease", overflow:"hidden", boxShadow:navHover?"6px 0 24px -8px rgba(0,0,0,.45)":"none" }}>
        <div style={{ padding:"14px 12px", flex:1, overflowY:"auto", overflowX:"hidden" }}>
          {navHover&&<p style={{ margin:"0 0 6px 8px", fontSize:10, fontWeight:700, color:C.muted, letterSpacing:"0.8px", textTransform:"uppercase" }}>메뉴</p>}
          {navItems.map(item=><NavTab key={item.target} {...item} expanded={navHover} />)}
          {navHover?<p style={{ margin:"16px 0 6px 8px", fontSize:10, fontWeight:700, color:C.muted, letterSpacing:"0.8px", textTransform:"uppercase" }}>관리</p>:<div style={{ height:12 }} />}
          {adminItems.map(item=><NavTab key={item.target} {...item} expanded={navHover} />)}
          <div style={{ borderTop:`1px solid ${C.border}`, margin:"12px 4px 10px" }} />
          <a href="https://aimo.kr/search-model?utm_source=modiq&utm_medium=sidebar" target="_blank" rel="noreferrer" title="Aimo 모델 찾기"
            style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:navHover?"flex-start":"center", gap:10, padding:navHover?"9px 12px":"10px 0", borderRadius:8, textDecoration:"none", color:C.textSub, fontSize:13, fontWeight:500, transition:"all 0.15s", boxSizing:"border-box", whiteSpace:"nowrap", overflow:"hidden" }}
            onMouseEnter={e=>{e.currentTarget.style.background=C.sideHover;e.currentTarget.style.color="white";}}
            onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=C.textSub;}}
          >
            <AimoMark size={20} style={{ flexShrink:0 }} />
            {navHover&&<><span style={{ flex:1 }}>Aimo 모델 찾기</span><ExternalLink size={12} style={{ flexShrink:0, opacity:0.6 }} /></>}
          </a>
          {navHover&&<p style={{ margin:"4px 0 0 12px", fontSize:10, color:C.muted }}>15,000+ 모델 · AI 검색</p>}
        </div>
        {navHover&&trialDays!==null&&trialDays>0&&(
          <div style={{ margin:"0 12px 12px", padding:"10px 12px", borderRadius:8, background:trialDays<=3?"#3a1a00":"#1a3a20", border:`1px solid ${trialDays<=3?C.orange:C.green}50` }}>
            <p style={{ margin:0, fontSize:12, fontWeight:700, color:trialDays<=3?C.orange:C.green }}>{trialDays<=3?<AlertTriangle size={12} style={{ verticalAlign:-2, flexShrink:0 }}/>:<PartyPopper size={12} style={{ verticalAlign:-2, flexShrink:0 }}/>} 무료 체험 D-{trialDays}</p>
            <p style={{ margin:"4px 0 0", fontSize:11, color:C.textSub }}>{trialDays<=3?"곧 만료됩니다!":"무료 체험 중"}</p>
          </div>
        )}
      </div>
      )}

      {/* ── 모바일 상단 헤더 ── */}
      {isMobile&&(
        <div style={{ position:"fixed", top:0, left:0, right:0, height:52, background:C.sidebar, borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 16px", zIndex:300 }}>
          <p style={{ margin:0, fontSize:18, fontWeight:900, color:C.text, letterSpacing:"-0.5px" }}><span style={{ color:"#A8FF00" }}>m</span>odiq</p>
          <span style={{ fontSize:12, color:C.muted }}>{agency.name}</span>
        </div>
      )}

      {/* ── 메인 콘텐츠 ── */}
      <div style={{ flex:1, minWidth:0, maxWidth:"100%", marginLeft:isMobile?0:64, marginTop:isMobile?0:52, padding:isMobile?"68px 14px 88px":"32px 44px", overflowX:"hidden", overflowY:"auto", minHeight:isMobile?"100vh":"calc(100vh - 52px)" }}>
      <div style={{ maxWidth:1560, margin:"0 auto", minWidth:0 }}>

        <ErrorBoundary key={page}>
        <Suspense fallback={<PageLoading/>}>
        {/* ════ 대시보드 ════ */}
        {page==="dashboard" && <DashboardView bookings={bookings} models={models} customers={customers} projects={projects} setPage={setPage} setSelectedBooking={openBookingFresh} onSelectProject={openProjectFresh} onOpenCalendarDate={(d:string)=>{ setCalInitDate(d); setPage("calendar"); }} isMobile={isMobile} canViewFinance={canViewFinance} loading={syncing} />}

        {/* ════ 캘린더 ════ */}
        {page==="calendar" && (
          <CalendarView
            isMobile={isMobile}
            modelOffs={modelOffs}
            onAddModelOff={handleAddModelOff}
            onDeleteModelOff={handleDeleteModelOff}
            bookings={bookings}
            models={models}
            customers={customers}
            sharedBusy={sharedBusy}
            onSelectBooking={openBookingFresh}
            initModelId={calInitModel}
            initDate={calInitDate||undefined}
            onAddBooking={(preModel, preDate)=>{ setAddPrefill({ date:preDate, model:preModel }); setShowAddPicker(true); }}
          />
        )}


        {/* ════ 섭외 ════ */}
        {page==="bookings" && <BookingsView filteredBookings={filteredBookings} bookingQ={bookingQ} setBookingQ={setBookingQ} bookingStatusF={bookingStatusF} setBookingStatusF={setBookingStatusF} bookingTypeF={bookingTypeF} setBookingTypeF={setBookingTypeF} bookingManagerF={bookingManagerF} setBookingManagerF={setBookingManagerF} bookingMonthF={bookingMonthF} setBookingMonthF={setBookingMonthF} bookingMonths={bookingMonths} memberNames={memberNames} models={models} customers={customers} openAddPicker={()=>{ setAddPrefill({}); setShowAddPicker(true); }} setSelectedBooking={openBookingFresh} isMobile={isMobile} />}

        {/* ════ 모델 ════ */}
        {page==="models" && <ModelsView filteredModels={filteredModels} modelQ={modelQ} setModelQ={setModelQ} setShowModelForm={setShowModelForm} setSelectedModel={openModelFresh} setMEditMode={setMEditMode} bookings={bookings} isMobile={isMobile} onBulkAdd={()=>setBulkEntity("model")} legacyIdCount={myRole==="owner"?legacyIdCount:0} onMigrateIds={migrateModelIds} />}

        {page==="packages" && <PackagesView packages={packages} setPackages={setPackages} models={rosterModels} customers={customers} agency={agency} isMobile={isMobile} />}

        {page==="studio" && <ModelStudioView models={rosterModels} setModels={setModels} setPackages={setPackages} agency={agency} isMobile={isMobile} initModelId={studioInitModel} onEditModel={openEditModel} />}

        {/* ════ 고객사 ════ */}
        {page==="customers" && <CustomersView filteredCustomers={filteredCustomers} customerQ={customerQ} setCustomerQ={setCustomerQ} setShowCustomerForm={setShowCustomerForm} setSelectedCustomer={openCustomerFresh} setCEditMode={setCEditMode} bookings={bookings} isMobile={isMobile} onBulkAdd={()=>setBulkEntity("customer")} />}

        {/* ════ 발송(Distribution) ════ */}
        {page==="distribution" && FEATURE_DISTRIBUTION && <DistributionView agency={agency} models={models} createdBy={session?.email||myMember?.name||""} isMobile={isMobile} onImportModel={handleImportSharedModel} />}

        {/* ════ 정산 ════ */}
        {page==="revenue" && canViewFinance && <RevenueView bookings={bookings} models={models} customers={customers} agency={agency} isMobile={isMobile} onSelectBooking={openBookingFresh} />}
        {page==="settlement" && canViewFinance && <SettlementView settlementTab={settlementTab} setSettlementTab={setSettlementTab} settlementMonth={settlementMonth} setSettlementMonth={setSettlementMonth} settlementMonths={settlementMonths} settlementModel={settlementModel} setSettlementModel={setSettlementModel} settlementClient={settlementClient} setSettlementClient={setSettlementClient} settlementSummary={settlementSummary} filteredSettlement={filteredSettlement} models={models} customers={customers} openSettlement={openSettlementFresh} onOpenStatement={()=>setShowStatement(true)} isMobile={isMobile} />}

        {/* ════ 담당자 ════ */}
        {page==="members"&&myRole==="owner"&&<MembersView members={members} maxMembers={maxMembers} memberPct={memberPct} setShowMemberForm={setShowMemberForm} handleDeleteMember={handleDeleteMember} handleUpdateMember={handleUpdateMember} />}
        {page==="company"&&myRole==="owner"&&<CompanyView agency={agency} members={members} session={session} onSave={handleSaveCompany} onTransferOwner={handleTransferOwner} onRevokeOwner={handleRevokeOwner} />}

        {/* ════ 요금제 ════ */}
        {page==="plan"&&<PlanView agency={agency} myRole={myRole} planBilling={planBilling} setPlanBilling={setPlanBilling} handleChangePlan={handleChangePlan} />}
        </Suspense>
        </ErrorBoundary>
      </div>
      </div>

      {/* ════ 모달: 섭외 상세 ════ */}
      {selectedBooking&&(
        <Modal onClose={closeDetail} wide>
          {/* 헤더 */}
          <div style={{ marginBottom:14, paddingRight:isMobile?108:88 }}>
            <h3 style={{ margin:0, color:C.text }}><ClipboardList size={17} style={{ verticalAlign:-2, flexShrink:0 }}/> 섭외 상세</h3>
          </div>
          {!editingBooking&&<button type="button" onClick={()=>{ setBookingBaseline(JSON.stringify(selectedBooking)); setEditingBooking(true); }} aria-label="수정" title="수정" style={{ position:"absolute", top:10, right:isMobile?60:50, width:isMobile?40:32, height:isMobile?40:32, display:"flex", alignItems:"center", justifyContent:"center", borderRadius:"50%", border:`1px solid ${C.purple}`, background:C.card2, color:C.purple, cursor:"pointer", zIndex:60, padding:0 }}><Pencil size={isMobile?18:15}/></button>}

          {/* 일정 보내기 선택창 */}
          {showSendMenu&&(()=>{ const m=models.find(x=>x.id===selectedBooking.model_id); const hasEmail=!!m?.email; const synced=!!selectedBooking.gcal_event_id; return (
            <div onClick={()=>setShowSendMenu(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:1600, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
              <div onClick={e=>e.stopPropagation()} style={{ position:"relative", background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:20, width:"92%", maxWidth:440 }}>
                <CloseButton onClose={()=>setShowSendMenu(false)} />
                <h3 style={{ margin:"0 0 4px", color:C.text, fontSize:16 }}><Calendar size={16} style={{ verticalAlign:-2, flexShrink:0 }}/> 모델에게 일정 보내기</h3>
                {(()=>{
                  const resp=selectedBooking.model_response;
                  let txt:string, col:string;
                  if (synced) { txt="✓ 구글 캘린더에 등록됨"+(resp==="accepted"?" · 모델 수락함":""); col=C.green; }
                  else if (resp==="pending") { txt="📨 수락 초대를 보냈어요 — 모델 수락 대기 중"; col=C.orange; }
                  else if (resp==="declined") { txt="✕ 모델이 거절했어요"; col=C.red; }
                  else { txt="아직 보내기 전이에요 — 아래에서 한 가지만 선택하세요"; col=C.muted; }
                  return <div style={{ margin:"6px 0 12px", padding:"9px 12px", borderRadius:9, fontSize:12.5, fontWeight:700, color:col, background:col+"15", border:`1px solid ${col}40` }}>{txt}</div>;
                })()}
                <p style={{ margin:"0 0 8px", fontSize:11, fontWeight:700, color:C.muted }}>① 이 건만 보내기</p>

                {m?.payout_tax_type==="company" && (
                <div onClick={async()=>{ setShowSendMenu(false); await sendBookingInvite(selectedBooking, m, customers.find(c=>c.id===selectedBooking.customer_id)); alert(`${m.agency_name||"발송처"}(소속사) 이메일로 일정 확인 요청을 보냈습니다.\n수락/거절 결과는 '모델 응답'에 표시됩니다.`); }} style={{ border:`1px solid ${C.green}66`, borderRadius:10, padding:"12px 14px", marginBottom:8, cursor:"pointer", background:C.green+"12" }}>
                  <div style={{ fontSize:14, fontWeight:800, color:C.text }}>✉️ 소속사에 일정 확인 요청 <span style={{ fontSize:11, color:C.green, fontWeight:700 }}>수락/거절</span></div>
                  <div style={{ fontSize:12, color:C.muted, marginTop:3, lineHeight:1.5 }}>발송처(A) 구글캘린더 이메일로 수락/거절 요청 발송. A가 가능 여부를 확정/거절하면 '모델 응답'에 표시돼요.</div>
                </div>
                )}

                <div onClick={async()=>{ setShowSendMenu(false); await doGcalSync(); }} style={{ border:`1px solid ${(synced?C.green:C.blue)}66`, borderRadius:10, padding:"12px 14px", marginBottom:8, cursor:"pointer", background:(synced?C.green:C.blue)+"12" }}>
                  <div style={{ fontSize:14, fontWeight:800, color:C.text }}>📅 구글 캘린더 {synced?"갱신":"등록"} <span style={{ fontSize:11, color:synced?C.green:C.blue, fontWeight:700 }}>{synced?"등록됨 ✓":"추천"}</span></div>
                  <div style={{ fontSize:12, color:C.muted, marginTop:3, lineHeight:1.5 }}>{synced?"이미 캘린더에 등록된 일정이에요. 일시·장소가 바뀌었으면 눌러서 갱신하세요.":"구글 캘린더에 일정 생성 + 모델 초대. 이거 하나면 이후 변경·취소가 자동 동기화돼요. (설정에서 구글 연동 필요)"}</div>
                </div>

                <div onClick={async()=>{ if(!hasEmail){ alert("모델 이메일이 없습니다. 모델 정보에 이메일을 입력하세요."); return; } setShowSendMenu(false); await doSendCalMail(); }} style={{ border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 14px", marginBottom:8, cursor:hasEmail?"pointer":"not-allowed", opacity:hasEmail?1:0.5, background:C.card2 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:C.text }}>✉️ 이메일로 보내기</div>
                  <div style={{ fontSize:12, color:C.muted, marginTop:3, lineHeight:1.5 }}>모델 이메일로 일정(.ics 첨부)과 구독 링크를 발송. {hasEmail?"":"※ 모델 이메일 없음"}</div>
                </div>

                <div onClick={async()=>{ setShowSendMenu(false); await doCopyCalLink(); }} style={{ border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 14px", marginBottom:8, cursor:"pointer", background:C.card2 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:C.text }}>🔗 캘린더 링크 복사</div>
                  <div style={{ fontSize:12, color:C.muted, marginTop:3, lineHeight:1.5 }}>카톡·메시지에 붙여 보낼 "캘린더에 추가" 링크를 복사. (일회성, 자동 동기화 아님)</div>
                </div>

                {m && <>
                <p style={{ margin:"14px 0 8px", fontSize:11, fontWeight:700, color:C.muted }}>② 앞으로 자동 동기화 (구독)</p>
                <div onClick={async()=>{ setShowSendMenu(false); const token=await ensureCalToken(m); if(!token){ alert("구독 토큰 저장에 실패했어요.\nSupabase models 테이블에 cal_token 컬럼이 필요합니다:\nalter table models add column if not exists cal_token text;"); return; } const url=calSubscribePageUrl(token); try{ await navigator.clipboard.writeText(url); alert("구독 링크가 복사되었습니다.\n\n이 링크를 모델에게 보내면, 폰 기종(아이폰/안드로이드)에 맞는 설치·구독 방법이 자동 안내돼요. 모델이 한 번 구독하면 이후 모든 확정 일정이 자동 동기화됩니다.\n\n"+url); }catch{ prompt("구독 링크(모델에게 보내세요):", url); } }} style={{ border:`1px solid ${C.blue}66`, borderRadius:10, padding:"12px 14px", marginBottom:8, cursor:"pointer", background:C.blue+"12" }}>
                  <div style={{ fontSize:14, fontWeight:800, color:C.text }}>🔗 구독 링크 복사 <span style={{ fontSize:11, color:C.blue, fontWeight:700 }}>추천</span></div>
                  <div style={{ fontSize:12, color:C.muted, marginTop:3, lineHeight:1.5 }}>한 번 구독하면 이 모델의 모든 확정 일정이 자동으로 들어와요. (모델당 한 번만 설정)</div>
                </div>
                </>}

              </div>
            </div>
          ); })()}

          {/* 상태 (보기=배지 / 편집=선택) */}
          <div style={{ marginTop:12, marginBottom:16 }}>
            {!editingBooking
              ? (()=>{ const bt=BOOKING_TYPES[selectedBooking.booking_type||"SHOOT"]||BOOKING_TYPES.SHOOT; return (
                  <span style={{ display:"inline-flex", alignItems:"center", gap:8 }}>
                    <span style={{ display:"inline-flex", alignItems:"center", gap:5, background:bt.color+"22", color:bt.color, border:`1px solid ${bt.color}44`, borderRadius:6, padding:"3px 10px", fontSize:12, fontWeight:700 }}><TypeIcon type={selectedBooking.booking_type} size={12}/> {bt.label}</span>
                    <span style={{ color:C.muted }}>·</span>
                    <Badge code={selectedBooking.status} type={selectedBooking.booking_type} />
                  </span>
                ); })()
              : null
            }
          </div>

          {/* 조회 모드 */}
          {!editingBooking ? (
            <>
              <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr)", gap:12, marginBottom:14 }}>
                {/* 모델 (클릭 → 모델 상세) */}
                <div>
                  <p style={{ margin:0, fontSize:12, color:C.muted }}>모델</p>
                  {(()=>{ const m=models.find(m=>m.id===selectedBooking.model_id); return m
                    ? <p onClick={()=>openDetail("model", m.id)} style={{ margin:"3px 0 0", fontSize:14, fontWeight:700, color:C.blue, cursor:"pointer", textDecoration:"underline" }}>{m.name} →</p>
                    : <p style={{ margin:"3px 0 0", fontSize:14, fontWeight:600, color:C.text }}>-</p>; })()}
                </div>
                {/* 고객사 (클릭 → 고객사 상세) */}
                <div>
                  <p style={{ margin:0, fontSize:12, color:C.muted }}>고객사</p>
                  {(()=>{ const c=customers.find(c=>c.id===selectedBooking.customer_id); return c
                    ? <p onClick={()=>openDetail("customer", c.id)} style={{ margin:"3px 0 0", fontSize:14, fontWeight:700, color:C.blue, cursor:"pointer", textDecoration:"underline" }}>{c.name} →</p>
                    : <p style={{ margin:"3px 0 0", fontSize:14, fontWeight:600, color:C.text }}>-</p>; })()}
                </div>
                {[
                  ["프로젝트",selectedBooking.project_name],
                  ["촬영일",  fmtDate(selectedBooking.shoot_date)],
                  ["시간",    fmtTime(selectedBooking.start_time,selectedBooking.end_time)],
                  ["장소",    selectedBooking.location],
                  ["담당자",  selectedBooking.manager],
                  ["사용기간",selectedBooking.usage_period],
                ].filter(([,v])=>v).map(([k,v])=>(
                  <div key={String(k)}>
                    <p style={{ margin:0, fontSize:12, color:C.muted }}>{k}</p>
                    <p style={{ margin:"3px 0 0", fontSize:14, fontWeight:600, color:C.text }}>{v}</p>
                  </div>
                ))}
                {["SHOOT"].includes(selectedBooking.booking_type||"SHOOT")&&(
                  <div>
                    <p style={{ margin:0, fontSize:12, color:C.muted }}>사용국가</p>
                    <p style={{ margin:"3px 0 0", fontSize:14, fontWeight:600, color:C.text }}>{selectedBooking.usage_region||"-"}</p>
                  </div>
                )}
              </div>
              {(selectedBooking.shoot_types||[]).length>0&&(
                <div style={{ marginBottom:10 }}>
                  <p style={{ margin:"0 0 6px", fontSize:12, color:C.muted }}>촬영 유형</p>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                    {selectedBooking.shoot_types.map((t:string)=><span key={t} style={{ background:C.card2, color:C.textSub, fontSize:12, padding:"3px 10px", borderRadius:10 }}>{t}</span>)}
                  </div>
                </div>
              )}
              {(selectedBooking.usage_scope||[]).length>0&&(
                <div style={{ marginBottom:14 }}>
                  <p style={{ margin:"0 0 6px", fontSize:12, color:C.muted }}>사용 범위</p>
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
                <label style={{ fontSize:12, color:C.muted, display:"block", marginBottom:6 }}>섭외 유형</label>
                <div style={{ display:"flex", gap:6 }}>
                  {Object.entries(BOOKING_TYPES).map(([key,bt])=>(
                    <button key={key} type="button" onClick={()=>setSelectedBooking((p:any)=>({...p,booking_type:key}))}
                      style={{ padding:"4px 11px", borderRadius:6, border:`1px solid ${selectedBooking.booking_type===key?bt.color:C.border}`, background:selectedBooking.booking_type===key?bt.color+"22":"transparent", color:selectedBooking.booking_type===key?bt.color:C.muted, fontSize:12, fontWeight:selectedBooking.booking_type===key?700:400, cursor:"pointer" }}>
                      {bt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr)":"minmax(0,1fr) minmax(0,1fr)", gap:10, marginBottom:10 }}>
                <div><label style={{ fontSize:12, color:C.muted, display:"block", marginBottom:5 }}>프로젝트명</label>
                  <input style={inp} value={selectedBooking.project_name||""} onChange={e=>setSelectedBooking((p:any)=>({...p,project_name:e.target.value}))} /></div>
                <div><label style={{ fontSize:12, color:C.muted, display:"block", marginBottom:5 }}>고객사</label>
                  <select style={inp} value={selectedBooking.customer_id||""} onChange={e=>setSelectedBooking((p:any)=>({...p,customer_id:e.target.value}))}>
                    <option value="">선택</option>
                    {customers.map(c=><option key={c.id} value={c.id}>{c.name}{c.brand?` · ${c.brand}`:""}</option>)}
                  </select></div>
              </div>
              {/* 날짜+시간 */}
              <div style={{ background:C.card2, borderRadius:8, padding:"10px 12px", marginBottom:10 }}>
                <label style={{ fontSize:12, color:C.muted, display:"block", marginBottom:6 }}><Calendar size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> 촬영 일정</label>
                <input style={{ ...inp, marginBottom:8, padding:"6px 10px", fontSize:12 }} type="date" value={selectedBooking.shoot_date||""} onChange={e=>setSelectedBooking((p:any)=>({...p,shoot_date:e.target.value}))} />
                <div style={{ display:"flex", alignItems:"flex-end", gap:10 }}>
                  <div style={{ flex:1, minWidth:0 }}><TimePicker label="시작" value={selectedBooking.start_time||""} onChange={v=>setSelectedBooking((p:any)=>({...p,start_time:v}))} /></div>
                  <div style={{ flex:1, minWidth:0 }}><TimePicker label="종료" value={selectedBooking.end_time||""} onChange={v=>setSelectedBooking((p:any)=>({...p,end_time:v}))} /></div>
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr)":"minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)", gap:10, marginBottom:10 }}>
                <div><label style={{ fontSize:12, color:C.muted, display:"block", marginBottom:5 }}>촬영 장소</label>
                  <input style={inp} value={selectedBooking.location||""} onChange={e=>setSelectedBooking((p:any)=>({...p,location:e.target.value}))} placeholder="예: 스튜디오 A" /></div>
                <div><label style={{ fontSize:12, color:C.muted, display:"block", marginBottom:5 }}>담당자</label>
                  <select style={inp} value={selectedBooking.manager||""} onChange={e=>setSelectedBooking((p:any)=>({...p,manager:e.target.value}))}>
                    <option value="">선택</option>
                    {members.map(m=><option key={m.id} value={m.name}>{m.name}</option>)}
                  </select></div>
                <div><label style={{ fontSize:12, color:C.muted, display:"block", marginBottom:5 }}>섭외 상태</label>
                  <select style={inp} value={selectedBooking.status} onChange={e=>setSelectedBooking((p:any)=>({...p,status:e.target.value}))}>
                    {statusOptionsForType(selectedBooking.booking_type, selectedBooking.status).map(([k,l])=><option key={k} value={k}>{l}</option>)}
                  </select></div>
              </div>
              {/* 촬영유형 (사진/영상 그룹) */}
              {selectedBooking.booking_type==="SHOOT"&&(
                <div style={{ marginBottom:10 }}>
                  <label style={{ fontSize:12, color:C.muted, display:"block", marginBottom:6 }}>촬영 유형 (복수 선택 가능)</label>
                  {([["사진",SHOOT_TYPES_PHOTO,C.blue],["영상",SHOOT_TYPES_VIDEO,C.purple]] as const).map(([grp,opts,col])=>(
                    <div key={grp} style={{ marginBottom:8 }}>
                      <span style={{ fontSize:11, color:col, fontWeight:700, display:"block", marginBottom:5 }}>{grp}</span>
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                        {opts.map(t=>(
                          <button key={t} type="button"
                            onClick={()=>setSelectedBooking((p:any)=>({ ...p, shoot_types: p.shoot_types?.includes(t) ? p.shoot_types.filter((x:string)=>x!==t) : [...(p.shoot_types||[]),t] }))}
                            style={{ padding:"5px 12px", borderRadius:20, border:`1px solid ${(selectedBooking.shoot_types||[]).includes(t)?col:C.border}`, background:(selectedBooking.shoot_types||[]).includes(t)?col+"22":"var(--c-card2)", color:(selectedBooking.shoot_types||[]).includes(t)?col:C.textSub, fontSize:12, fontWeight:(selectedBooking.shoot_types||[]).includes(t)?700:400, cursor:"pointer" }}>{t}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* 사용 범위 + 기간 (추가폼과 동일) */}
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr)":"minmax(0,3fr) minmax(0,2fr)", gap:12 }}>
                <MultiCheck label="사용 범위" options={USAGE_SCOPES} value={selectedBooking.usage_scope||[]} onChange={(v:string[])=>setSelectedBooking((p:any)=>({...p,usage_scope:v}))} />
                <div style={{ marginBottom:10 }}>
                  <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:6 }}>사용 기간</label>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {USAGE_PERIODS.map(p=>(
                      <button key={p} type="button" onClick={()=>setSelectedBooking((pp:any)=>({...pp,usage_period: pp.usage_period===p?"":p}))} style={{ padding:"5px 14px", border:`1px solid ${selectedBooking.usage_period===p?C.green:C.border}`, borderRadius:20, fontSize:12, cursor:"pointer", background:selectedBooking.usage_period===p?C.green+"22":"var(--c-card2)", color:selectedBooking.usage_period===p?C.green:C.textSub, fontWeight:selectedBooking.usage_period===p?700:400 }}>{p}</button>
                    ))}
                  </div>
                </div>
              </div>
              {/* 사용 국가 */}
              <div style={{ marginBottom:10 }}>
                <label style={{ fontSize:12, color:C.muted, display:"block", marginBottom:6 }}>사용 국가</label>
                <div style={{ display:"flex", gap:6 }}>
                  {USAGE_REGIONS.map(r=>(
                    <button key={r} type="button" onClick={()=>setSelectedBooking((p:any)=>({ ...p, usage_region:r }))}
                      style={{ padding:"4px 16px", borderRadius:20, border:`1px solid ${(selectedBooking.usage_region||"국내")===r?C.blue:C.border}`, background:(selectedBooking.usage_region||"국내")===r?C.blue+"22":"transparent", color:(selectedBooking.usage_region||"국내")===r?C.blue:C.muted, fontSize:12, fontWeight:(selectedBooking.usage_region||"국내")===r?700:400, cursor:"pointer" }}>{r}</button>
                  ))}
                </div>
              </div>
              {/* 촬영 레퍼런스 편집 */}
              <div style={{ marginTop:10, marginBottom:10 }}>
                <label style={{ fontSize:12, color:C.muted, display:"block", marginBottom:6 }}><Camera size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> 촬영 레퍼런스 (이미지 8장 · 영상 링크 2개)</label>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  {(selectedBooking.reference_images||[]).map((src:string,i:number)=>(
                    <div key={i} style={{ position:"relative" }}>
                      <img src={src} alt="" onClick={()=>setLightboxSrc(src)}
                        style={{ width:48, height:48, objectFit:"cover", borderRadius:6, border:`1px solid ${C.border}`, cursor:"zoom-in", transition:"transform 0.15s", position:"relative" }}
                        onMouseEnter={e=>{e.currentTarget.style.transform="scale(2.2)";e.currentTarget.style.zIndex="60";}}
                        onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)";e.currentTarget.style.zIndex="0";}}
                      />
                      <span onClick={()=>setSelectedBooking((pp:any)=>({ ...pp, reference_images:(pp.reference_images||[]).filter((_:any,x:number)=>x!==i) }))} style={{ position:"absolute", top:-5, right:-5, width:16, height:16, borderRadius:"50%", background:C.red, color:"white", fontSize:10, lineHeight:"16px", textAlign:"center", cursor:"pointer", zIndex:70 }}>×</span>
                    </div>
                  ))}
                  {(selectedBooking.reference_images||[]).length<8&&(
                    <label style={{ width:48, height:48, border:`1px dashed ${C.border}`, borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:C.muted, fontSize:20 }}>
                      +
                      <input type="file" accept="image/*" multiple style={{ display:"none" }} onChange={e=>{ addRefsToSelected(e.target.files); e.target.value=""; }} />
                    </label>
                  )}
                </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:6 }}>
                {(selectedBooking.reference_videos||[]).map((u:string,i:number)=>(
                  <span key={i} style={{ display:"inline-flex", alignItems:"center", gap:5, background:C.purple+"18", border:`1px solid ${C.purple}44`, borderRadius:14, padding:"3px 10px", fontSize:11, color:C.purple, fontWeight:600 }}>
                    <Clapperboard size={11} style={{ flexShrink:0 }}/>
                    <a href={u} target="_blank" rel="noreferrer" style={{ color:C.purple, textDecoration:"none" }}>영상 {i+1}</a>
                    <span onClick={()=>setSelectedBooking((pp:any)=>({ ...pp, reference_videos:(pp.reference_videos||[]).filter((_:any,x:number)=>x!==i) }))} style={{ cursor:"pointer", color:C.muted }}>×</span>
                  </span>
                ))}
                {(selectedBooking.reference_videos||[]).length<2&&(
                  <button type="button" onClick={()=>{ const u=promptVideoUrl(); if(u) setSelectedBooking((pp:any)=>({ ...pp, reference_videos:[...(pp.reference_videos||[]), u] })); }} style={{ background:"transparent", border:`1px dashed ${C.border}`, borderRadius:14, padding:"3px 10px", fontSize:12, color:C.muted, cursor:"pointer" }}>+ 영상 링크</button>
                )}
              </div>
              </div>
            </>
          )}

          {/* 계약금/잔금 — 조회+편집 공통 (잔금 자동계산) */}
          <div style={{ background:C.card2, borderRadius:10, padding:14, marginBottom:14 }}>
            <p style={{ margin:"0 0 10px", fontSize:12, fontWeight:700, color:C.yellow }}><Coins size={12} style={{ verticalAlign:-2, flexShrink:0 }}/> 계약금 / 잔금</p>
            {editingBooking ? (
              /* 편집 모드: 계약총액·계약금 입력 → 잔금 자동계산 */
              <>
                <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr)":"minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)", gap:10, marginBottom:10 }}>
                  <div>
                    <label style={{ fontSize:12, color:C.muted, display:"block", marginBottom:5 }}>계약 총액</label>
                    <div style={{ position:"relative" }}>
                      <input style={{ ...inp, marginBottom:0, paddingRight:24 }} type="number" placeholder="0"
                        value={selectedBooking.shoot_fee||""}
                        onChange={e=>{ const fee=Number(e.target.value)||0; const dep=selectedBooking.deposit_amt||0; setSelectedBooking((p:any)=>({...p, shoot_fee:fee, balance_amt: Math.max(0,fee-dep)})); }}
                      />
                      <span style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", fontSize:12, color:C.muted }}>원</span>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize:12, color:C.muted, display:"block", marginBottom:5 }}>계약금</label>
                    <div style={{ position:"relative" }}>
                      <input style={{ ...inp, marginBottom:0, paddingRight:24 }} type="number" placeholder="0"
                        value={selectedBooking.deposit_amt||""}
                        onChange={e=>{ const dep=Number(e.target.value)||0; const fee=selectedBooking.shoot_fee||0; setSelectedBooking((p:any)=>({...p, deposit_amt:dep, balance_amt: Math.max(0,fee-dep)})); }}
                      />
                      <span style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", fontSize:12, color:C.muted }}>원</span>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize:12, color:C.muted, display:"block", marginBottom:5 }}>잔금 <span style={{ color:C.blue, fontSize:10 }}>(자동계산{overchargeTotal(selectedBooking)>0?", 추가금 포함":""})</span></label>
                    <div style={{ background:"#1a1e2e", border:`1px solid ${C.blue}40`, borderRadius:6, padding:"8px 10px", fontSize:13, fontWeight:700, color:C.blue }}>
                      {clientBalance(selectedBooking).toLocaleString()}원
                    </div>
                  </div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr)":"minmax(0,1fr) minmax(0,1fr)", gap:10 }}>
                  <div><label style={{ fontSize:12, color:C.muted, display:"block", marginBottom:5 }}>계약금 입금 예정일</label>
                    <input style={{ ...inp, marginBottom:0 }} type="date" value={selectedBooking.deposit_due||""} onChange={e=>setSelectedBooking((p:any)=>({...p,deposit_due:e.target.value}))} /></div>
                  <div><label style={{ fontSize:12, color:C.muted, display:"block", marginBottom:5 }}>잔금 입금 예정일</label>
                    <input style={{ ...inp, marginBottom:0 }} type="date" value={selectedBooking.balance_due||""} onChange={e=>setSelectedBooking((p:any)=>({...p,balance_due:e.target.value}))} /></div>
                </div>
              </>
            ) : (
              /* 조회 모드: 계약금/잔금 입금 확인 */
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr)":"minmax(0,1fr) minmax(0,1fr)", gap:10 }}>
                <div>
                  <p style={{ margin:"0 0 4px", color:C.muted, fontSize:11 }}>계약금</p>
                  <p style={{ margin:"0 0 4px", color:C.text, fontWeight:700 }}>{selectedBooking.deposit_amt?selectedBooking.deposit_amt.toLocaleString()+"원":"-"}</p>
                  <p style={{ margin:0, color:C.muted, fontSize:11 }}>예정일: {fmtDate(selectedBooking.deposit_due)||"-"}</p>
                </div>
                <div>
                  <p style={{ margin:"0 0 4px", color:C.muted, fontSize:11 }}>잔금{overchargeTotal(selectedBooking)>0?<span style={{ color:C.orange, fontSize:10 }}> (추가금 포함)</span>:null}</p>
                  <p style={{ margin:"0 0 4px", color:C.text, fontWeight:700 }}>{clientBalance(selectedBooking)>0?clientBalance(selectedBooking).toLocaleString()+"원":"-"}</p>
                  <p style={{ margin:0, color:C.muted, fontSize:11 }}>예정일: {fmtDate(selectedBooking.balance_due)||"-"}</p>
                </div>
              </div>
            )}
            {/* 촬영 당일 추가금(오버차지) — 편집 시 입력, 조회 시 표시 */}
            {BOOKING_TYPES[selectedBooking.booking_type||"SHOOT"]?.hasContract&&(editingBooking||overchargeTotal(selectedBooking)>0)&&(
              <div style={{ marginTop:10, background:C.card, borderRadius:8, padding:12, border:`1px solid ${C.orange}33` }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:(selectedBooking.overcharges||[]).length>0||showBocInput?10:0 }}>
                  <p style={{ margin:0, fontSize:12, fontWeight:700, color:C.orange }}><Coins size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> 촬영 당일 추가금</p>
                  {overchargeTotal(selectedBooking)>0&&<span style={{ fontSize:12, color:C.orange, fontWeight:800 }}>+{overchargeTotal(selectedBooking).toLocaleString()}원</span>}
                </div>
                {(selectedBooking.overcharges||[]).length>0&&(
                  <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:editingBooking?10:0 }}>
                    {(selectedBooking.overcharges||[]).map((oc:any,i:number)=>(
                      <div key={i} style={{ display:"flex", alignItems:"center", gap:8, background:C.card2, borderRadius:6, padding:"7px 10px" }}>
                        <span style={{ flex:1, fontSize:13, color:C.text }}>{oc.reason}</span>
                        <span style={{ fontSize:13, color:C.orange, fontWeight:700 }}>{(oc.amount||0).toLocaleString()}원</span>
                        {editingBooking&&<span onClick={()=>setSelectedBooking((p:any)=>({...p, overcharges:(p.overcharges||[]).filter((_:any,x:number)=>x!==i)}))} style={{ cursor:"pointer", color:C.muted, fontSize:16, lineHeight:1 }}>×</span>}
                      </div>
                    ))}
                  </div>
                )}
                {editingBooking&&(showBocInput?(
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    <div style={{ display:"flex", gap:6 }}>
                      <input value={bocReason} onChange={e=>setBocReason(e.target.value)} placeholder="사유 (예: 시간오버 2h, 영상 추가)"
                        style={{ flex:1, minWidth:0, background:"var(--c-card2)", border:`1px solid ${C.border}`, borderRadius:6, padding:"7px 10px", color:C.text, fontSize:13, outline:"none" }} />
                      <input type="text" value={bocAmount?bocAmount.toLocaleString("ko-KR"):""}
                        onChange={e=>{ const v=e.target.value.replace(/,/g,""); if(!isNaN(Number(v))) setBocAmount(Number(v)); }} placeholder="금액"
                        style={{ width:90, flexShrink:0, background:"var(--c-card2)", border:`1px solid ${C.border}`, borderRadius:6, padding:"7px 10px", color:C.text, fontSize:13, outline:"none", textAlign:"right" }} />
                    </div>
                    <div style={{ display:"flex", gap:6 }}>
                      <button onClick={()=>{ if(!bocReason.trim()||bocAmount<=0) return alert("사유와 금액을 입력하세요"); setSelectedBooking((p:any)=>({...p, overcharges:[...(p.overcharges||[]),{reason:bocReason.trim(),amount:bocAmount}]})); setBocReason(""); setBocAmount(0); setShowBocInput(false); }}
                        style={{ ...btnS(C.orange), flex:1, padding:"7px 0", fontSize:13 }}>추가</button>
                      <button onClick={()=>{ setShowBocInput(false); setBocReason(""); setBocAmount(0); }}
                        style={{ ...btnS("#333"), flex:1, padding:"7px 0", fontSize:13 }}>닫기</button>
                    </div>
                  </div>
                ):(
                  <button onClick={()=>setShowBocInput(true)}
                    style={{ width:"100%", padding:"8px 0", background:"transparent", border:`1px dashed ${C.orange}66`, borderRadius:6, color:C.orange, fontSize:13, fontWeight:600, cursor:"pointer" }}>+ 추가금 입력</button>
                ))}
              </div>
            )}
            {bookingTotal(selectedBooking)>0&&(()=>{
              const mdl = models.find(m=>m.id===selectedBooking.model_id);
              const t = modelTaxType(mdl);
              const taxTxt = t==="foreigner"?`${mdl?.visa_type==="E6"?"E6/3.3%":mdl?.visa_type==="C4"?"C4/20%":`외국인/${foreignerRate(mdl)}%`} 제외`:t==="company"?"소속사·+10% 계산서":"프리랜서·3.3% 제외";
              const sess = bookingSession(selectedBooking);
              const ovr = !!selectedBooking.model_pay_type;
              const pay = payCfg(selectedBooking, mdl);
              const rateTxt = pay.type==="fixed" ? `정액 ${Number(pay.value||0).toLocaleString()}원` : `수수료 ${pay.value||0}%`;
              return (
              <div style={{ marginTop:10, padding:"10px 12px", background:"rgba(201,169,110,0.08)", borderRadius:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
                  <span style={{ color:C.muted, fontSize:12, flex:1, minWidth:0 }}>
                    모델 정산액
                    <span style={{ marginLeft:6, padding:"1px 7px", borderRadius:10, background:sess==="half"?C.purple+"22":C.blue+"22", color:sess==="half"?C.purple:C.blue, fontSize:10, fontWeight:700 }}>{sessionLabel(selectedBooking)}</span>
                    <span style={{ marginLeft:6, padding:"1px 7px", borderRadius:10, background:C.green+"22", color:C.green, fontSize:10, fontWeight:700 }}>{rateTxt}</span>
                    <span style={{ marginLeft:6 }}>({taxTxt}{overchargeTotal(selectedBooking)>0?", 추가금 포함":""}{ovr?", 건별 수정":""})</span>
                  </span>
                  <span style={{ color:"#c9a96e", fontWeight:800, flexShrink:0, whiteSpace:"nowrap" }}>{bookingModelPay(selectedBooking, models).toLocaleString()}원</span>
                </div>
                {/* 모델료(세션) · 매출총이익 */}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:6, paddingTop:6, borderTop:`1px solid ${C.border}` }}>
                  <span style={{ color:C.muted, fontSize:12 }}>모델료 ({sessionLabel(selectedBooking)}) {(()=>{ const f = sess==="half" ? (Number(mdl?.fee_half)||Number(mdl?.fee_day)||0) : (Number(mdl?.fee_day)||0); return <b style={{ color:C.textSub, fontWeight:700 }}>{f>0?f.toLocaleString()+"원":"-"}</b>; })()}</span>
                  <span style={{ color:C.muted, fontSize:12 }}>에이전시 마진 <b style={{ color:C.blue, fontWeight:800, fontSize:13 }}>{bookingAgencyFee(selectedBooking, models).toLocaleString()}원</b></span>
                </div>
                {/* 편집 모드: 모델 지급 정산방식·금액 건별 수정 */}
                {editingBooking&&(
                  <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid ${C.border}` }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                      <span style={{ fontSize:11, color:C.muted, minWidth:54 }}>지급 방식</span>
                      {([["","모델 기본"],["rate","수수료(%)"],["fixed","정액(원)"]] as const).map(([k,l])=>(
                        <button key={k||"def"} type="button" onClick={()=>setSelectedBooking((p:any)=>({...p, model_pay_type:k||null, ...((k===""||k!==(p.model_pay_type||""))?{model_pay_value:null}:{})}))} style={{ padding:"4px 11px", borderRadius:20, border:`1px solid ${(selectedBooking.model_pay_type||"")===k?C.green:C.border}`, background:(selectedBooking.model_pay_type||"")===k?C.green+"22":"transparent", color:(selectedBooking.model_pay_type||"")===k?C.green:C.muted, fontSize:12, fontWeight:(selectedBooking.model_pay_type||"")===k?700:500, cursor:"pointer" }}>{l}</button>
                      ))}
                      {selectedBooking.model_pay_type&&(
                        <span style={{ display:"inline-flex", alignItems:"center", gap:4 }}>
                          <input style={{ ...inp, marginBottom:0, width:120 }} type="text" inputMode="numeric"
                            placeholder={selectedBooking.model_pay_type==="rate"?"수수료":"정액"}
                            value={selectedBooking.model_pay_value!=null&&selectedBooking.model_pay_value!==""?(selectedBooking.model_pay_type==="fixed"?Number(selectedBooking.model_pay_value).toLocaleString("ko-KR"):String(selectedBooking.model_pay_value)):""}
                            onChange={e=>{ const v=e.target.value.replace(/,/g,""); if(v===""||!isNaN(Number(v))) setSelectedBooking((p:any)=>({...p, model_pay_value:v===""?null:Number(v)})); }} />
                          <span style={{ fontSize:13, fontWeight:700, color:C.textSub }}>{selectedBooking.model_pay_type==="rate"?"%":"원"}</span>
                        </span>
                      )}
                    </div>
                    <p style={{ margin:"6px 0 0", fontSize:11, color:C.muted }}>{selectedBooking.model_pay_type?"이 섭외만 지급액을 직접 지정합니다.":`모델 기본값(${sessionLabel(selectedBooking)} 단가)을 따릅니다. 건별로 다르면 수수료/정액을 선택해 입력하세요.`}</p>
                  </div>
                )}
              </div>
              );
            })()}
          </div>

          {/* 촬영 레퍼런스 */}
          {((selectedBooking.reference_images||[]).length>0||(selectedBooking.reference_videos||[]).length>0)&&(
            <div style={{ background:C.card2, borderRadius:10, padding:14, marginBottom:14 }}>
              <p style={{ margin:"0 0 10px", fontSize:12, fontWeight:700, color:C.text }}><Camera size={12} style={{ verticalAlign:-2, flexShrink:0 }}/> 촬영 레퍼런스 ({(selectedBooking.reference_images||[]).length}장)</p>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                {(selectedBooking.reference_images||[]).map((src:string,i:number)=>(
                  <img key={i} src={src} alt="" onClick={()=>setLightboxSrc(src)}
                    style={{ width:64, height:64, objectFit:"cover", borderRadius:8, border:`1px solid ${C.border}`, cursor:"zoom-in", transition:"transform 0.15s", position:"relative" }}
                    onMouseEnter={e=>{e.currentTarget.style.transform="scale(2.4)";e.currentTarget.style.zIndex="100";}}
                    onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)";e.currentTarget.style.zIndex="0";}}
                  />
                ))}
                {(selectedBooking.reference_videos||[]).map((u:string,i:number)=>(
                  <a key={"v"+i} href={u} target="_blank" rel="noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:6, background:C.purple+"18", border:`1px solid ${C.purple}44`, borderRadius:14, padding:"6px 14px", fontSize:12, color:C.purple, fontWeight:700, textDecoration:"none", alignSelf:"center" }}>
                    <Clapperboard size={12} style={{ flexShrink:0 }}/> 영상 {i+1} 보기 →
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* 메시지 이력 */}
          <div style={{ background:C.card2, borderRadius:10, padding:14, marginBottom:14 }}>
            <p style={{ margin:"0 0 10px", fontSize:12, fontWeight:700, color:C.text }}><MessageSquare size={12} style={{ verticalAlign:-2, flexShrink:0 }}/> 메시지 이력</p>
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
                style={{ flex:1, minWidth:0, background:"var(--c-card2)", border:`1px solid ${C.border}`, borderRadius:6, padding:"7px 10px", color:C.text, fontSize:12, outline:"none" }} />
              <button onClick={async()=>{ if(!bMsgText.trim())return; const msg={sender:"에이전시",text:bMsgText,at:new Date().toISOString().slice(0,10)}; const msgs=[...(selectedBooking.messages||[]),msg]; await sb("bookings","PATCH",{messages:msgs},`?id=eq.${selectedBooking.id}`); setBookings(bookings.map(b=>b.id===selectedBooking.id?{...b,messages:msgs}:b)); setSelectedBooking((p:any)=>({...p,messages:msgs})); setBMsgText(""); }} style={{ ...btnS(C.purple), padding:"7px 14px", fontSize:12, whiteSpace:"nowrap", flexShrink:0 }}>기록</button>
            </div>
          </div>
          {selectedBooking.result_drive_url&&(
            <div style={{ marginBottom:14 }}>
              <a href={selectedBooking.result_drive_url} target="_blank" rel="noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:6, background:C.blue+"22", color:C.blue, border:`1px solid ${C.blue}50`, borderRadius:8, padding:"8px 14px", fontSize:13, fontWeight:600, textDecoration:"none" }}>
                <Folder size={13} style={{ verticalAlign:-2, flexShrink:0 }}/> 결과물 구글 드라이브 열기 →
              </a>
            </div>
          )}
          {/* 모델 응답 상태(수락형 흐름) */}
          {["SHOOT","MEETING"].includes(selectedBooking.booking_type||"SHOOT")&&(["CONFIRMED","COMPLETED","SETTLED"].includes(selectedBooking.status)||models.find(x=>x.id===selectedBooking.model_id)?.payout_tax_type==="company")&&!!selectedBooking.shoot_date&&selectedBooking.model_response&&(()=>{
            const map:Record<string,{t:string;c:string}>={ pending:{t:"수락 대기",c:C.orange}, accepted:{t:"✓ 수락됨",c:C.green}, declined:{t:"✕ 거절",c:C.red} };
            const s=map[selectedBooking.model_response]||{t:selectedBooking.model_response,c:C.muted};
            return (
              <div style={{ marginBottom:12, display:"flex", alignItems:"center", gap:8, fontSize:12.5 }}>
                <span style={{ color:C.muted }}>모델 응답</span>
                <span style={{ color:s.c, fontWeight:700, background:s.c+"18", border:`1px solid ${s.c}44`, borderRadius:20, padding:"3px 10px" }}>{s.t}</span>
              </div>
            );
          })()}
          {/* 하단 작업 바 (개선2: 상태/내용과 분리) */}
          {(()=>{
            const _sbModel=models.find(x=>x.id===selectedBooking.model_id); const _isSub=_sbModel?.payout_tax_type==="company";
            // 소속사(편입) 모델은 협의중·HOLD에서도 'A에게 일정 확인 요청'을 보낼 수 있어야 한다(가용 여부 확인 목적).
            const canSend=["SHOOT","MEETING"].includes(selectedBooking.booking_type||"SHOOT")&&!!selectedBooking.shoot_date&&selectedBooking.status!=="CANCELLED"&&(["CONFIRMED","COMPLETED","SETTLED"].includes(selectedBooking.status)||_isSub);
            const canVoucher=!!BOOKING_TYPES[selectedBooking.booking_type||"SHOOT"]?.hasContract&&["CONFIRMED","COMPLETED","SETTLED"].includes(selectedBooking.status);
            if(!editingBooking && !canSend && !canVoucher) return null;
            return (
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:6, paddingTop:14, borderTop:`1px solid ${C.border}` }}>
                {!editingBooking
                  ? <>
                      {canSend&&<button onClick={()=>{ setShowSendMenu(true); (async()=>{ try { const fresh=await sb("bookings","GET",null,`?id=eq.${encodeURIComponent(selectedBooking.id)}&select=gcal_event_id,model_response`); if(Array.isArray(fresh)&&fresh[0]) setSelectedBooking((p:any)=>p&&p.id===selectedBooking.id?{...p,gcal_event_id:fresh[0].gcal_event_id||null,model_response:fresh[0].model_response||p.model_response}:p); } catch {} })(); }} title="모델 캘린더에 일정 전달(구글 동기화·이메일·링크)" style={{ ...btnS(C.green), fontSize:13, flex:1 }}><Calendar size={13} style={{ verticalAlign:-2, flexShrink:0 }}/> 일정 보내기{selectedBooking.gcal_event_id?" ✓":""}</button>}
                      {canVoucher&&<button onClick={()=>issueVoucher(selectedBooking)} style={{ ...btnS(C.blue), fontSize:13, flex:1 }}><ClipboardList size={13} style={{ verticalAlign:-2, flexShrink:0 }}/> 명세서</button>}
                    </>
                  : <>
                      <button onClick={handleSaveBookingEdit} disabled={JSON.stringify(selectedBooking)===bookingBaseline} style={{ ...btnS(C.green, JSON.stringify(selectedBooking)===bookingBaseline), fontSize:13, flex:1 }}><Save size={13} style={{ verticalAlign:-2, flexShrink:0 }}/> 저장</button>
                      <button onClick={()=>setEditingBooking(false)} style={{ ...btnS("#555"), fontSize:13, flex:1 }}>취소</button>
                    </>
                }
              </div>
            );
          })()}
        </Modal>
      )}

      {/* ── 모바일 하단 탭바 ── */}
      {isMobile&&(
        <div style={{ position:"fixed", bottom:0, left:0, right:0, background:C.sidebar, borderTop:`1px solid ${C.border}`, display:"flex", zIndex:300, paddingBottom:"env(safe-area-inset-bottom)" }}>
          {([
            { t:"dashboard", l:"대시보드", I:Home },
            { t:"calendar",  l:"캘린더",   I:Calendar },
            { t:"bookings",  l:"섭외",     I:ClipboardList },
            { t:"models",    l:"모델",     I:User },
          ] as {t:Page;l:string;I:any}[]).map(({t,l,I})=>(
            <button key={t} onClick={()=>setPage(t)} style={{ flex:1, background:"none", border:"none", padding:"8px 0 10px", cursor:"pointer", color:page===t?C.blue:C.muted, display:"flex", flexDirection:"column", alignItems:"center", gap:3, fontSize:10, fontWeight:page===t?700:500 }}>
              <I size={20} strokeWidth={page===t?2.2:1.8} /><span>{l}</span>
            </button>
          ))}
          <button onClick={()=>setShowMoreMenu(true)} style={{ flex:1, background:"none", border:"none", padding:"8px 0 10px", cursor:"pointer", color:["customers","settlement","members","plan"].includes(page)?C.blue:C.muted, display:"flex", flexDirection:"column", alignItems:"center", gap:3, fontSize:10, fontWeight:500 }}>
            <Menu size={20} strokeWidth={1.8} /><span>더보기</span>
          </button>
        </div>
      )}

      {/* ── 모바일 더보기 메뉴 ── */}
      {showMoreMenu&&(
        <Modal onClose={()=>setShowMoreMenu(false)}>
          <h3 style={{ marginTop:0, color:C.text }}>메뉴</h3>
          {([
            { t:"studio" as Page, l:"포트폴리오", I:Camera },
            { t:"packages" as Page, l:"패키지", I:CardStack },
            { t:"customers" as Page, l:"고객사", I:Building2 },
            ...(FEATURE_DISTRIBUTION?[{ t:"distribution" as Page, l:"발송", I:Handshake }]:[]),
            ...(canViewFinance?[{ t:"revenue" as Page, l:"매출 현황", I:TrendingUp },{ t:"settlement" as Page, l:"정산", I:Coins }]:[]),
            ...(myRole==="owner"?[{ t:"members" as Page, l:"담당자", I:Users }]:[]),
            ...(myRole==="owner"?[{ t:"company" as Page, l:"회사정보", I:Building2 }]:[]),
            { t:"plan" as Page, l:"요금제", I:CreditCard },
          ]).map(({t,l,I})=>(
            <button key={t} onClick={()=>{ setPage(t); setShowMoreMenu(false); }} style={{ width:"100%", display:"flex", alignItems:"center", gap:12, padding:"13px 14px", borderRadius:10, border:"none", cursor:"pointer", background:page===t?"var(--c-nav-active)":"transparent", color:page===t?C.text:C.textSub, fontSize:14, fontWeight:page===t?700:500, marginBottom:2, textAlign:"left" }}>
              <I size={18} strokeWidth={1.8} /><span>{l}</span>
            </button>
          ))}
          <a href="https://aimo.kr/search-model?utm_source=modiq&utm_medium=mobile_menu" target="_blank" rel="noreferrer"
            style={{ width:"100%", display:"flex", alignItems:"center", gap:12, padding:"13px 14px", borderRadius:10, textDecoration:"none", color:C.textSub, fontSize:14, fontWeight:500, boxSizing:"border-box" }}>
            <Search size={18} strokeWidth={1.8} /><span style={{ flex:1 }}>Aimo 모델 찾기</span><ExternalLink size={13} style={{ opacity:0.6 }} />
          </a>
          <div style={{ borderTop:`1px solid ${C.border}`, margin:"10px 0", paddingTop:10, display:"flex", gap:8 }}>
            <button onClick={()=>setTheme(t=>t==="dark"?"light":"dark")} style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"10px 0", borderRadius:20, border:`1px solid ${C.border}`, cursor:"pointer", background:"transparent", color:C.muted, fontSize:13, fontWeight:600 }}>
              {theme==="dark"?<Sun size={13}/>:<Moon size={13}/>}<span>{theme==="dark"?"라이트":"다크"}</span>
            </button>
            <button onClick={handleLogout} style={{ flex:1, padding:"10px 0", borderRadius:20, border:`1px solid ${C.border}`, cursor:"pointer", background:"transparent", color:C.red, fontSize:13, fontWeight:600 }}>로그아웃</button>
          </div>
        </Modal>
      )}

      {/* ════ 모달: 프로젝트 섭외 상세 ════ */}
      {selectedProjectId&&(()=>{
        const pbs = bookings.filter(b=>b.project_id===selectedProjectId).sort((a,b)=>(a.start_time||"").localeCompare(b.start_time||""));
        const proj = projects.find(p=>p.id===selectedProjectId);
        const client = customers.find(c=>c.id===pbs[0]?.customer_id);
        const totalFee = pbs.reduce((sum,b)=>sum+bookingTotal(b),0);
        return (
          <Modal onClose={closeDetail} wide>
            <h3 style={{ marginTop:0, color:C.text, paddingRight:48 }}><FolderOpen size={17} style={{ verticalAlign:-2, flexShrink:0 }}/> {proj?.name||pbs[0]?.project_name||"프로젝트"} <span style={{ color:C.textSub, fontWeight:600, fontSize:14 }}>· {client?.name||"?"}</span></h3>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr)":"minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)", gap:12, marginBottom:14 }}>
              <div><p style={{ margin:0, fontSize:12, color:C.muted }}>촬영일</p><p style={{ margin:"3px 0 0", fontSize:13, fontWeight:700, color:C.text }}>{fmtDate(pbs[0]?.shoot_date)}</p></div>
              <div><p style={{ margin:0, fontSize:12, color:C.muted }}>모델</p><p style={{ margin:"3px 0 0", fontSize:13, fontWeight:700, color:C.text }}>{pbs.length}명</p></div>
              <div><p style={{ margin:0, fontSize:12, color:C.muted }}>총 금액</p><p style={{ margin:"3px 0 0", fontSize:13, fontWeight:800, color:C.yellow }}>{totalFee>0?totalFee.toLocaleString()+"원":"-"}</p></div>
            </div>
            <p style={{ margin:"0 0 8px", fontSize:12, fontWeight:700, color:C.textSub }}>모델별 섭외 ({pbs.length}건) — 클릭하면 상세</p>
            <div style={{ display:"grid", gap:8 }}>
              {pbs.map(b=>{
                const m = models.find(mm=>mm.id===b.model_id);
                return (
                  <div key={b.id} onClick={()=>openDetail("booking", b.id)}
                    style={{ display:"flex", alignItems:"center", gap:10, background:C.card2, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 14px", cursor:"pointer", transition:"border-color 0.15s" }}
                    onMouseEnter={e=>(e.currentTarget.style.borderColor=C.blue)}
                    onMouseLeave={e=>(e.currentTarget.style.borderColor=C.border)}
                  >
                    {m?.thumb_url
                      ? <img src={m.thumb_url} alt="" style={{ width:30, height:30, borderRadius:"50%", objectFit:"cover", flexShrink:0 }} />
                      : <div style={{ width:30, height:30, borderRadius:"50%", background:"linear-gradient(135deg,#c9a96e,#8b6a3e)", display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontWeight:800, fontSize:12, flexShrink:0 }}>{(m?.name||"?")[0]}</div>
                    }
                    <p style={{ flex:1, minWidth:0, margin:0, fontSize:13, color:C.textSub, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                      <strong style={{ fontSize:14, fontWeight:700, color:C.text }}>{m?.name||"?"}</strong>
                      {b.start_time?<span> · {fmtTime(b.start_time,b.end_time)}</span>:null}
                      {b.location?<span> · {b.location}</span>:null}
                    </p>
                    {bookingTotal(b)>0&&<span style={{ fontSize:13, fontWeight:700, color:C.yellow, flexShrink:0 }}>{bookingTotal(b).toLocaleString()}원</span>}
                    <Badge code={b.status} type={b.booking_type} />
                  </div>
                );
              })}
            </div>
          </Modal>
        );
      })()}

      {/* ════ 모달: 정산 상세 ════ */}
      {selectedSettlement&&(
        <Modal onClose={closeDetail} wide>
          <div style={{ marginBottom:12, paddingRight:48 }}>
            <h3 style={{ margin:0, color:C.text, fontSize:16 }}><Coins size={16} style={{ verticalAlign:-2, flexShrink:0 }}/> 정산 상세</h3>
          </div>
          {(()=>{
            const mh = models.find(m=>m.id===selectedSettlement.model_id);
            const ch = customers.find(c=>c.id===selectedSettlement.customer_id);
            return (
              <div style={{ display:"flex", alignItems:"center", gap:12, background:C.card2, border:`1px solid ${C.border}`, borderRadius:12, padding:"12px 14px", marginBottom:14 }}>
                {mh?.thumb_url
                  ? <img src={mh.thumb_url} alt="" style={{ width:48, height:48, borderRadius:"50%", objectFit:"cover", flexShrink:0, border:`1px solid ${C.border}` }} />
                  : <div style={{ width:48, height:48, borderRadius:"50%", background:"linear-gradient(135deg,#c9a96e,#8b6a3e)", display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontWeight:800, fontSize:18, flexShrink:0 }}>{(mh?.name||"?")[0]}</div>}
                <div style={{ minWidth:0, flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:7, flexWrap:"wrap", marginBottom:4 }}>
                    <strong style={{ fontSize:16, fontWeight:800, color:C.text }}>{mh?.name||"?"}</strong>
                    <span style={{ fontSize:13, color:C.muted }}>· {ch?.name||"?"}</span>
                    {selectedSettlement.project_name&&<span style={{ display:"inline-flex", alignItems:"center", gap:3, fontSize:13, color:C.blue }}><Folder size={12} style={{ flexShrink:0 }}/> {selectedSettlement.project_name}</span>}
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:12, fontSize:12, color:C.textSub }}>
                    <span style={{ display:"inline-flex", alignItems:"center", gap:4 }}><Calendar size={12} style={{ flexShrink:0 }}/> {fmtDate(selectedSettlement.shoot_date)}</span>
                    {selectedSettlement.manager&&<span style={{ display:"inline-flex", alignItems:"center", gap:4 }}><User size={12} style={{ flexShrink:0 }}/> {selectedSettlement.manager}</span>}
                  </div>
                </div>
              </div>
            );
          })()}
          <p style={{ fontSize:12, color:C.muted, marginBottom:6 }}>촬영비 (원)</p>
          <input style={inp} type="number" placeholder="촬영비 입력" value={editFee} onChange={e=>setEditFee(e.target.value)} />

          {/* ── 오버차지 (촬영 당일 추가 과금) ── */}
          <div style={{ background:C.card2, borderRadius:8, padding:12, marginBottom:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:editOvercharges.length>0||showOcInput?10:0 }}>
              <p style={{ margin:0, fontSize:12, fontWeight:700, color:C.orange }}>촬영 당일 오버차지</p>
              {editOvercharges.length>0&&(
                <span style={{ fontSize:12, color:C.orange, fontWeight:800 }}>+{editOvercharges.reduce((s,o)=>s+o.amount,0).toLocaleString()}원</span>
              )}
            </div>
            {editOvercharges.length>0&&(
              <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:10 }}>
                {editOvercharges.map((oc,i)=>(
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:8, background:C.card, borderRadius:6, padding:"7px 10px" }}>
                    <span style={{ flex:1, fontSize:13, color:C.text }}>{oc.reason}</span>
                    <span style={{ fontSize:13, color:C.orange, fontWeight:700 }}>{oc.amount.toLocaleString()}원</span>
                    <span onClick={()=>setEditOvercharges(prev=>prev.filter((_,x)=>x!==i))} style={{ cursor:"pointer", color:C.muted, fontSize:16, lineHeight:1 }}>×</span>
                  </div>
                ))}
              </div>
            )}
            {showOcInput?(
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                <div style={{ display:"flex", gap:6 }}>
                  <input value={ocReason} onChange={e=>setOcReason(e.target.value)} placeholder="사유 (예: 시간오버 2h, 영상 추가)"
                    style={{ flex:1, background:"var(--c-card)", border:`1px solid ${C.border}`, borderRadius:6, padding:"7px 10px", color:C.text, fontSize:13, outline:"none" }} />
                  <input type="text" value={ocAmount?ocAmount.toLocaleString("ko-KR"):""}
                    onChange={e=>{ const v=e.target.value.replace(/,/g,""); if(!isNaN(Number(v))) setOcAmount(Number(v)); }} placeholder="금액"
                    style={{ width:100, background:"var(--c-card)", border:`1px solid ${C.border}`, borderRadius:6, padding:"7px 10px", color:C.text, fontSize:13, outline:"none", textAlign:"right" }} />
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  <button onClick={()=>{ if(!ocReason.trim()||ocAmount<=0) return alert("사유와 금액을 입력하세요"); setEditOvercharges(prev=>[...prev,{reason:ocReason.trim(),amount:ocAmount}]); setOcReason(""); setOcAmount(0); setShowOcInput(false); }}
                    style={{ ...btnS(C.orange), flex:1, padding:"7px 0", fontSize:13 }}>추가</button>
                  <button onClick={()=>{ setShowOcInput(false); setOcReason(""); setOcAmount(0); }}
                    style={{ ...btnS("#333"), flex:1, padding:"7px 0", fontSize:13 }}>닫기</button>
                </div>
              </div>
            ):(
              <button onClick={()=>setShowOcInput(true)}
                style={{ width:"100%", padding:"8px 0", background:"transparent", border:`1px dashed ${C.orange}66`, borderRadius:6, color:C.orange, fontSize:13, fontWeight:600, cursor:"pointer" }}>
                + 오버차지 추가
              </button>
            )}
          </div>

          {/* ── 정산 요약 (촬영비 + 오버차지) ── */}
          {(()=>{
            const base = Number(editFee)||0;
            const ocTotal = editOvercharges.reduce((s,o)=>s+o.amount,0);
            const finalTotal = base + ocTotal;
            if (finalTotal<=0) return null;
            const mdl = models.find(m=>m.id===selectedSettlement.model_id);
            const bb = { ...selectedSettlement, shoot_fee: base, overcharges: editOvercharges, model_pay_type: editPayType||null, model_pay_value: editPayType?(Number(editPayValue)||0):null };
            const t = modelTaxType(mdl);
            const gross = modelGross(bb, mdl);
            const wh = modelWithholding(bb, mdl);
            const payout = bookingModelPay(bb, models);
            const margin = bookingAgencyFee(bb, models);
            return (
              <div style={{ background:"rgba(201,169,110,0.1)", borderRadius:8, padding:12, marginBottom:10, fontSize:13 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                  <span style={{ color:C.muted }}>촬영비(공급가)</span>
                  <span style={{ color:C.text }}>{base.toLocaleString()}원</span>
                </div>
                {ocTotal>0&&(
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ color:C.muted }}>오버차지</span>
                    <span style={{ color:C.orange }}>+{ocTotal.toLocaleString()}원</span>
                  </div>
                )}
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4, paddingTop:4, borderTop:`1px solid ${C.border}` }}>
                  <span style={{ color:C.text, fontWeight:700 }}>공급가 합계</span>
                  <span style={{ color:C.text, fontWeight:800 }}>{finalTotal.toLocaleString()}원</span>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4, paddingTop:4, borderTop:`1px dashed ${C.border}` }}>
                  <span style={{ color:C.muted }}>모델 정산 기준액(세전)</span>
                  <span style={{ color:C.text }}>{gross.toLocaleString()}원</span>
                </div>
                {t==="freelancer" && (
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ color:C.muted }}>원천징수 (3.3%)</span>
                    <span style={{ color:C.red }}>−{wh.toLocaleString()}원</span>
                  </div>
                )}
                {t==="foreigner" && (
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ color:C.muted }}>원천징수 ({mdl?.visa_type==="E6"?"E6 3.3%":mdl?.visa_type==="C4"?"C4 20%":`${foreignerRate(mdl)}%`})</span>
                    <span style={{ color:C.red }}>−{wh.toLocaleString()}원</span>
                  </div>
                )}
                {t==="company" && (
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ color:C.muted }}>부가세 (10%, 세금계산서)</span>
                    <span style={{ color:C.blue }}>+{Math.round(gross*0.1).toLocaleString()}원</span>
                  </div>
                )}
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                  <span style={{ color:C.text, fontWeight:700 }}>{t==="company"?`A 지급액 ${mdl?.source_agency_name?`(${mdl.source_agency_name})`:"(소속사)"}`:`모델 실지급 ${t==="foreigner"?`(${mdl?.visa_type==="E6"?"E6/3.3%":mdl?.visa_type==="C4"?"C4/20%":`외국인/${foreignerRate(mdl)}%`})`:"(프리랜서)"}`}</span>
                  <span style={{ color:C.green, fontWeight:800 }}>{payout.toLocaleString()}원</span>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between" }}>
                  <span style={{ color:C.muted }}>에이전시 마진</span>
                  <span style={{ color:C.blue }}>{margin.toLocaleString()}원</span>
                </div>
              </div>
            );
          })()}

          {/* ── 고객사 입금 (받을 돈) ── */}
          {(()=>{
            const base = Number(editFee)||0;
            const ocTotal = editOvercharges.reduce((s,o)=>s+o.amount,0);
            const billTotal = base + ocTotal;
            if (billTotal<=0) return null;
            const dep = selectedSettlement.deposit_amt||0;
            const charge = Math.round(billTotal * 1.1); // VAT 10% 포함 청구액
            const bal = Math.max(0, charge - dep);
            return (
              <div style={{ background:"rgba(59,130,246,0.08)", border:`1px solid ${C.blue}33`, borderRadius:8, padding:12, marginBottom:10, fontSize:13 }}>
                <p style={{ margin:"0 0 8px", fontSize:12, fontWeight:700, color:C.blue }}>고객사 입금액 (VAT 포함)</p>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}><span style={{ color:C.muted }}>공급가</span><span style={{ color:C.text }}>{billTotal.toLocaleString()}원</span></div>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}><span style={{ color:C.muted }}>부가세 (10%)</span><span style={{ color:C.text }}>+{(charge-billTotal).toLocaleString()}원</span></div>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4, paddingTop:4, borderTop:`1px solid ${C.border}` }}><span style={{ color:C.text, fontWeight:700 }}>총 청구액</span><span style={{ color:C.text, fontWeight:800 }}>{charge.toLocaleString()}원</span></div>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}><span style={{ color:C.muted }}>계약금</span><span style={{ color:C.text }}>{dep.toLocaleString()}원</span></div>
                <div style={{ display:"flex", justifyContent:"space-between" }}><span style={{ color:C.muted }}>잔금{ocTotal>0?" (추가금 포함)":""}</span><span style={{ color:C.text, fontWeight:700 }}>{bal.toLocaleString()}원</span></div>
              </div>
            );
          })()}

          {/* ── 정산방식 override (이 섭외만) ── */}
          <div style={{ border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 12px", marginBottom:10, background:C.card2 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
              <span style={{ fontSize:11, color:C.muted, minWidth:78 }}>정산 방식</span>
              {([["","모델 기본값"],["rate","수수료(%)"],["fixed","정액(원)"]] as const).map(([k,l])=>(
                <button key={k} type="button" onClick={()=>{ if(k!==editPayType){ setEditPayType(k); setEditPayValue(""); } }} style={{ padding:"5px 12px", borderRadius:20, border:`1px solid ${editPayType===k?C.green:C.border}`, background:editPayType===k?C.green+"22":"transparent", color:editPayType===k?C.green:C.muted, fontSize:12, fontWeight:editPayType===k?700:500, cursor:"pointer" }}>{l}</button>
              ))}
              {editPayType!==""&&(
                <span style={{ display:"inline-flex", alignItems:"center", gap:4 }}>
                  <input style={{ ...inp, marginBottom:0, width:120 }} type="text" inputMode="numeric"
                    placeholder={editPayType==="rate"?"수수료":"정액"}
                    value={editPayValue ? (editPayType==="fixed"?Number(editPayValue).toLocaleString("ko-KR"):editPayValue) : ""}
                    onChange={e=>{ const v=e.target.value.replace(/,/g,""); if(v===""||!isNaN(Number(v))) setEditPayValue(v); }} />
                  <span style={{ fontSize:13, fontWeight:700, color:C.textSub }}>{editPayType==="rate"?"%":"원"}</span>
                </span>
              )}
            </div>
            {editPayType===""&&<p style={{ margin:"6px 0 0", fontSize:11, color:C.muted }}>이 섭외는 모델에 설정된 기본 정산방식을 따릅니다.</p>}
            {/* 실시간 미리보기 (저장 전 즉시 반영) */}
            {(()=>{
              const mdl = models.find(m=>m.id===selectedSettlement.model_id);
              const bb = { ...selectedSettlement, shoot_fee: Number(editFee)||0, overcharges: editOvercharges, model_pay_type: editPayType||null, model_pay_value: editPayType?(Number(editPayValue)||0):null };
              const g = modelGross(bb, mdl); const pay = bookingModelPay(bb, models); const t = modelTaxType(mdl);
              return <p style={{ margin:"8px 0 0", fontSize:12, color:C.text }}>→ 모델 실지급 <strong style={{ color:"#c9a96e", fontSize:14 }}>{pay.toLocaleString()}원</strong> <span style={{ color:C.muted, fontSize:11 }}>({sessionLabel(bb)} · 기준액 {g.toLocaleString()}원 · {t==="foreigner"?`외국인 −${foreignerRate(mdl)}%`:t==="company"?"+10% 계산서":"−3.3%"})</span></p>;
            })()}
          </div>

          {/* ── 정산 단계: 날짜 + 상태 (정산 내역서에 반영) ── */}
          <div style={{ border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 12px", marginBottom:10, background:C.card2 }}>
            <p style={{ margin:"0 0 8px", fontSize:12, fontWeight:700, color:C.text }}>정산 단계 (날짜·상태)</p>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr)":"minmax(0,1fr) minmax(0,1fr)", gap:10 }}>
              {(()=>{ const depAmt = selectedSettlement.deposit_amt||0; const hasDep = depAmt>0; return (
              <div style={{ opacity:hasDep?1:0.5 }}>
                <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:hasDep&&editDepositPaid?C.blue:C.muted, marginBottom:4, cursor:hasDep?"pointer":"not-allowed" }}>
                  <input type="checkbox" disabled={!hasDep} checked={hasDep&&editDepositPaid} onChange={e=>setEditDepositPaid(e.target.checked)} /> 계약금 입금완료 {hasDep?<span style={{ color:C.textSub }}>({depAmt.toLocaleString()}원)</span>:<span style={{ color:C.muted }}>(섭외에 계약금 없음)</span>}
                </label>
                <input style={{ ...inp, marginBottom:0 }} type="date" disabled={!hasDep} value={hasDep?editDepositDate:""} onChange={e=>setEditDepositDate(e.target.value)} />
              </div>
              ); })()}
              <div>
                <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:editBalancePaid?C.blue:C.muted, marginBottom:4, cursor:"pointer" }}>
                  <input type="checkbox" checked={editBalancePaid} onChange={e=>{ setEditBalancePaid(e.target.checked); setEditPaid(e.target.checked); if(e.target.checked&&!editBalanceDate) setEditBalanceDate(new Date().toISOString().slice(0,10)); }} /> 잔금 입금완료
                </label>
                <input style={{ ...inp, marginBottom:0 }} type="date" value={editBalanceDate} onChange={e=>setEditBalanceDate(e.target.value)} />
              </div>
              <div>
                <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:editInvoiceIssued?C.purple:C.muted, marginBottom:4, cursor:"pointer" }}>
                  <input type="checkbox" checked={editInvoiceIssued} onChange={e=>setEditInvoiceIssued(e.target.checked)} /> 계산서 발행완료
                </label>
                <input style={{ ...inp, marginBottom:0 }} type="date" value={editInvoiceDate} onChange={e=>setEditInvoiceDate(e.target.value)} />
              </div>
              <div>
                <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:editModelPaid?"#c9a96e":C.muted, marginBottom:4, cursor:"pointer" }}>
                  <input type="checkbox" checked={editModelPaid} onChange={e=>setEditModelPaid(e.target.checked)} /> 모델 지급완료
                </label>
                <input style={{ ...inp, marginBottom:0 }} type="date" value={editModelPaidDate} onChange={e=>setEditModelPaidDate(e.target.value)} />
              </div>
            </div>
          </div>

          <p style={{ fontSize:12, color:C.muted, marginBottom:6 }}>메모</p>
          <textarea style={{ ...inp, height:70, resize:"none" }} placeholder="정산 메모" value={editMemo} onChange={e=>setEditMemo(e.target.value)} />

          {/* ── 고객사 전체 입금완료 (전체 수금 기준, 매출 인정) ── */}
          <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", padding:"10px 12px", borderRadius:8, border:`1px solid ${editPaid?C.blue:C.border}`, background:editPaid?C.blue+"18":C.card2, margin:"4px 0 14px" }}>
            <input type="checkbox" checked={editPaid} onChange={e=>setEditPaid(e.target.checked)} />
            <span style={{ fontSize:12, fontWeight:700, color:editPaid?C.blue:C.textSub, lineHeight:1.3 }}>고객사 전체 입금완료 (매출 인정) <span style={{ fontWeight:500, color:C.muted }}>· 잔금 입금완료 시 자동 체크</span></span>
          </label>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={()=>openDetail("booking", selectedSettlement.id)} style={{ ...btnS(C.blue), flex:isMobile?1:"0 0 auto", whiteSpace:"nowrap" }}><Folder size={12} style={{ verticalAlign:-2, flexShrink:0 }}/> 섭외 상세 보기 →</button>
            <button onClick={handleSaveSettlement} style={{ ...btnS(C.green), flex:1 }}>저장</button>
          </div>
        </Modal>
      )}

      {/* ════ 모달: 모델 상세 ════ */}
      {selectedModel&&!mEditMode&&(
        <Modal onClose={closeDetail} wide>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16, marginBottom:20, flexWrap:"wrap", paddingRight:isMobile?108:88 }}>
            <div style={{ minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                <h2 style={{ margin:0, color:C.text }}>{selectedModel.name}</h2>
                {(()=>{ const g=selectedModel.gender==="F"?"여성":selectedModel.gender==="M"?"남성":""; const a=selectedModel.birth_year?(new Date().getFullYear()-Number(selectedModel.birth_year)):ageFromSSN6(selectedModel.ssn6); const txt=[g, a!==null?`${a}세`:""].filter(Boolean).join(" · "); return txt?<span style={{ background:C.card2, color:C.textSub, fontSize:12, padding:"3px 9px", borderRadius:10, whiteSpace:"nowrap" }}>{txt}</span>:null; })()}
              </div>
              <p style={{ margin:"4px 0 8px", fontSize:12, color:C.muted }}>ID: {selectedModel.id}</p>
              <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                {selectedModel.category&&<span style={{ background:C.card2, color:C.textSub, fontSize:12, padding:"4px 10px", borderRadius:10, whiteSpace:"nowrap" }}>{selectedModel.category}</span>}
                {selectedModel.is_foreigner&&(()=>{
                  const dday=visaDday(selectedModel.visa_exit);
                  const ddayColor=dday==="만료"?C.red:C.orange;
                  return <span style={{ background:ddayColor+"22", color:ddayColor, border:`1px solid ${ddayColor}50`, fontSize:12, fontWeight:700, padding:"4px 10px", borderRadius:10, whiteSpace:"nowrap" }}><Plane size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> {dday}</span>;
                })()}
              </div>
            </div>
          </div>
          <button type="button" onClick={()=>openEditModel(selectedModel)} aria-label="수정" title="수정" style={{ position:"absolute", top:10, right:isMobile?60:50, width:isMobile?40:32, height:isMobile?40:32, display:"flex", alignItems:"center", justifyContent:"center", borderRadius:"50%", border:`1px solid ${C.purple}`, background:C.card2, color:C.purple, cursor:"pointer", zIndex:60, padding:0 }}><Pencil size={isMobile?18:15}/></button>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr)":"minmax(0,1fr) minmax(0,1fr)", gap:14, marginBottom:16 }}>
            {(()=>{ const imp=!!selectedModel.source_agency_id; const phoneV=imp?selectedModel.agency_phone:selectedModel.phone; const emailV=imp?selectedModel.agency_email:selectedModel.email; return ([
              ["전화번호", phoneV?<a href={`tel:${phoneV}`} style={{ color:C.blue, textDecoration:"none", fontWeight:600 }}>{phoneV}</a>:null],
              ["이메일",   emailV],
              ...(imp?[]:[["기본 단가(참고)", selectedModel.rate ? `${Number(selectedModel.rate).toLocaleString()}원` : "-"]] as [string,any][]),
              ["세무 유형", modelTaxType(selectedModel)==="foreigner"?"외국인 (전액)":modelTaxType(selectedModel)==="company"?"소속사 (계산서 10%)":"프리랜서 (3.3%)"],
              ["정산 방식", selectedModel.payout_pay_value ? (selectedModel.payout_pay_type==="fixed"?`정액 ${Number(selectedModel.payout_pay_value).toLocaleString()}원`:`수수료 ${selectedModel.payout_pay_value}%`) : "-"],
              ...(selectedModel.country?[["국가", selectedModel.country]] as [string,any][]:[]),
            ] as [string,any][]).map(([k,v])=>(
              <div key={String(k)}>
                <p style={{ margin:0, fontSize:11, color:C.muted }}>{k}</p>
                <p style={{ margin:"3px 0 0", fontSize:14, fontWeight:600, color:C.text }}>{v||"-"}</p>
              </div>
            )); })()}
            {selectedModel.is_foreigner&&<>
              <div><p style={{ margin:0, fontSize:11, color:C.muted }}>입국일</p><p style={{ margin:"3px 0 0", fontSize:14, fontWeight:600, color:C.text }}>{fmtDate(selectedModel.visa_entry)}</p></div>
              <div><p style={{ margin:0, fontSize:11, color:C.muted }}>출국일</p><p style={{ margin:"3px 0 0", fontSize:14, fontWeight:600, color:C.yellow }}>{fmtDate(selectedModel.visa_exit)}</p></div>
            </>}
          </div>
          {/* 신체 · 프로필 (컴카드·패키지에 쓰이는 정보) */}
          {(()=>{ const m=selectedModel; const three=[m.bust,m.waist,m.hip].map((v:any)=>{const n=Number(v);return n>0?String(Math.round(n/2.54)):"";}).filter(Boolean).join("-"); const rows:[string,any][]=[
              ...(m.height?[["키",`${m.height}cm`]] as [string,any][]:[]),
              ...(three?[["3사이즈(inch)",three]] as [string,any][]:[]),
              ...(m.shoe?[["신발",`${m.shoe}mm`]] as [string,any][]:[]),
              ...(m.career_years!=null&&m.career_years!==""?[["경력년차",`${m.career_years}년`]] as [string,any][]:[]),
              ...(m.hair_length?[["머리",m.hair_length]] as [string,any][]:[]),
              ...(m.hair_color?[["머리색",m.hair_color]] as [string,any][]:[]),
              ...(m.eye_color?[["눈동자",m.eye_color]] as [string,any][]:[]),
              ["타투", m.tattoo?"있음":"없음"],
              ["언더웨어", m.underwear_ok?"가능":"불가"],
              ...(m.instagram_followers?[["인스타 팔로워",Number(m.instagram_followers).toLocaleString()]] as [string,any][]:[]),
            ];
            const hasAny = rows.length>2 || (Array.isArray(m.fields)&&m.fields.length) || m.specialty || m.career;
            if(!hasAny) return null;
            return (
              <div style={{ background:C.card2, borderRadius:8, padding:"12px 14px", marginBottom:14 }}>
                <p style={{ margin:"0 0 10px", fontSize:12, fontWeight:700, color:C.text }}>신체 · 프로필</p>
                <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr) minmax(0,1fr)":"repeat(4,minmax(0,1fr))", gap:10 }}>
                  {rows.map(([k,v])=>(<div key={k}><p style={{ margin:0, fontSize:11, color:C.muted }}>{k}</p><p style={{ margin:"2px 0 0", fontSize:13.5, fontWeight:600, color:C.text }}>{v}</p></div>))}
                </div>
                {Array.isArray(m.fields)&&m.fields.length>0&&<div style={{ marginTop:10, display:"flex", flexWrap:"wrap", gap:6 }}>{m.fields.map((f:string)=><span key={f} style={{ background:C.card, color:C.textSub, fontSize:11, padding:"3px 9px", borderRadius:10, border:`1px solid ${C.border}` }}>{f}</span>)}</div>}
                {m.specialty&&<p style={{ margin:"8px 0 0", fontSize:12, color:C.textSub }}>특기: {m.specialty}</p>}
                {/* 경력 — 신체·프로필 박스 안에 포함(수정 화면과 동일 위치). 접힘=1줄 미리보기 */}
                {m.career&&(<>
                  <button onClick={()=>setShowCareer(v=>!v)} style={{ display:"flex", alignItems:"center", gap:8, width:"100%", margin:"12px 0 0", padding:0, background:"transparent", border:"none", cursor:"pointer", color:C.muted, fontSize:11, textAlign:"left" }}>
                    <span>활동이력 <span style={{ color:C.muted }}>(작품·활동)</span></span>
                    <span style={{ color:C.blue, fontSize:11 }}>{showCareer?"접기 ▲":"펼치기 ▼"}</span>
                  </button>
                  {showCareer
                    ? <div style={{ whiteSpace:"pre-wrap", fontSize:13, color:C.text, fontWeight:700, lineHeight:1.6, marginTop:6 }}>{m.career}</div>
                    : <div style={{ fontSize:13, color:C.text, fontWeight:700, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", marginTop:6 }}>{m.career}</div>}
                </>)}
              </div>
            );
          })()}
          {/* 링크/연락 — 인스타 · 카톡 · 구글드라이브 · 아이모 · 통장 순 */}
          <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
            {selectedModel.instagram_url&&<a href={selectedModel.instagram_url} target="_blank" rel="noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:6, background:"#E1306C22", color:"#E1306C", border:"1px solid #E1306C50", borderRadius:8, padding:"8px 14px", fontSize:13, fontWeight:600, textDecoration:"none" }}><Camera size={13} style={{ verticalAlign:-2, flexShrink:0 }}/> 인스타그램 →</a>}
            {!selectedModel.source_agency_id&&selectedModel.kakao_id&&<span style={{ display:"inline-flex", alignItems:"center", gap:6, background:"#FEE50022", color:"#3A1D1D", border:"1px solid #FEE50066", borderRadius:8, padding:"8px 14px", fontSize:13, fontWeight:600 }}>💬 카톡 {selectedModel.kakao_id}</span>}
            {!selectedModel.source_agency_id&&selectedModel.drive_url&&<a href={selectedModel.drive_url} target="_blank" rel="noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:6, background:C.blue+"22", color:C.blue, border:`1px solid ${C.blue}50`, borderRadius:8, padding:"8px 14px", fontSize:13, fontWeight:600, textDecoration:"none" }}><Folder size={13} style={{ verticalAlign:-2, flexShrink:0 }}/> 구글 드라이브 →</a>}
            {!selectedModel.source_agency_id&&selectedModel.aimo_url&&<a href={selectedModel.aimo_url} target="_blank" rel="noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:6, background:"linear-gradient(135deg,#4f46e522,#06b6d422)", border:"1px solid #4f46e550", borderRadius:8, padding:"8px 14px", fontSize:13, fontWeight:700, textDecoration:"none", color:"#818cf8" }}><Link2 size={13} style={{ verticalAlign:-2, flexShrink:0 }}/> AIMO 프로필 →</a>}
            {selectedModel.bank_info&&<span style={{ display:"inline-flex", alignItems:"center", gap:6, background:C.card2, color:C.textSub, border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 14px", fontSize:13, fontWeight:600 }}><Banknote size={13} style={{ verticalAlign:-2, flexShrink:0 }}/> {selectedModel.bank_info}</span>}
            {/* 외국인 지급방식 + 지급상세 (Payoneer/Wise/현금 포함) */}
            {selectedModel.is_foreigner && selectedModel.payment_method && (()=>{
              const pm = selectedModel.payment_method; const pd = selectedModel.payment_detail || {};
              const label = pm==="bank"?"국내 계좌이체":pm==="payoneer"?"Payoneer":pm==="wise"?"Wise":pm==="cash"?"현금":pm;
              const detail = pm==="bank" ? [pd.bank, pd.account].filter(Boolean).join(" ")+(pd.holder?` (${pd.holder})`:"")
                : pm==="payoneer" ? (pd.email||"")
                : pm==="wise" ? [pd.holder, pd.account].filter(Boolean).join(" · ")
                : pm==="cash" ? (pd.note||"") : "";
              return <span style={{ display:"inline-flex", alignItems:"center", gap:6, background:C.purple+"18", color:C.purple, border:`1px solid ${C.purple}44`, borderRadius:8, padding:"8px 14px", fontSize:13, fontWeight:600 }}><Banknote size={13} style={{ verticalAlign:-2, flexShrink:0 }}/> 지급: {label}{detail?` · ${detail}`:""}</span>;
            })()}
          </div>
          {selectedModel.memo&&<div style={{ background:C.card2, borderRadius:8, padding:12, marginBottom:14 }}><p style={{ margin:0, fontSize:12, color:C.muted }}>메모</p><p style={{ margin:"4px 0 0", fontSize:13, color:C.text }}>{selectedModel.memo}</p></div>}
          {/* 섭외 이력 + 모델별 정산 요약 */}
          {(()=>{
            const mb = bookings.filter(b=>b.model_id===selectedModel.id).sort((a,b)=>(b.shoot_date||"").localeCompare(a.shoot_date||""));
            const settledAmt = mb.filter(b=>b.status==="SETTLED"||b.is_paid).reduce((s,b)=>s+bookingTotal(b),0);
            const pendingAmt = mb.filter(b=>(b.status==="CONFIRMED"||b.status==="COMPLETED")&&!b.is_paid).reduce((s,b)=>s+bookingTotal(b),0);
            const modelPay = mb.filter(b=>b.status==="SETTLED"||b.is_paid).reduce((s,b)=>s+bookingModelPay(b,models),0);
            const shown = modelHistAll ? mb : mb.slice(0,5);
            return (
            <div>
              <div style={{ background:C.card2, borderRadius:10, padding:"12px 14px", marginBottom:14, display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr)":"minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)", gap:10 }}>
                <div><p style={{ margin:0, fontSize:11, color:C.muted }}>정산 완료(입금)</p><p style={{ margin:"4px 0 0", fontSize:14, fontWeight:800, color:C.green }}>{settledAmt.toLocaleString()}원</p></div>
                <div><p style={{ margin:0, fontSize:11, color:C.muted }}>정산 대기</p><p style={{ margin:"4px 0 0", fontSize:14, fontWeight:800, color:C.yellow }}>{pendingAmt.toLocaleString()}원</p></div>
                <div><p style={{ margin:0, fontSize:11, color:C.muted }}>모델 실지급(정산)</p><p style={{ margin:"4px 0 0", fontSize:14, fontWeight:800, color:"#c9a96e" }}>{modelPay.toLocaleString()}원</p></div>
              </div>
              <p style={{ fontSize:13, fontWeight:700, color:C.text, margin:"0 0 10px" }}>섭외 이력 ({mb.length}건)</p>
              {shown.map(b=>(
                <div key={b.id} onClick={()=>openDetail("booking", b.id)}
                  className="hist-row"
                  style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${C.border}`, cursor:"pointer" }}
                  onMouseEnter={e=>{ const el=e.currentTarget.querySelector(".hist-name") as HTMLElement|null; if(el) el.style.color=C.blue; }}
                  onMouseLeave={e=>{ const el=e.currentTarget.querySelector(".hist-name") as HTMLElement|null; if(el) el.style.color=C.text; }}>
                  <div style={{ minWidth:0, flex:1 }}>
                    <span className="hist-name" style={{ fontSize:13, color:C.text, fontWeight:600, transition:"color 0.15s" }}>{customers.find(c=>c.id===b.customer_id)?.name||"?"}</span>
                    <span style={{ fontSize:12, color:C.textSub, marginLeft:8, fontWeight:700 }}><Calendar size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> {fmtDate(b.shoot_date)}</span>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
                    {bookingTotal(b)>0&&<span style={{ fontSize:12, color:C.yellow, fontWeight:700 }}><Coins size={11} style={{ verticalAlign:-2, flexShrink:0 }}/>{bookingTotal(b).toLocaleString()}원</span>}
                    <Badge code={b.status} type={b.booking_type} />
                  </div>
                </div>
              ))}
              {mb.length===0&&<p style={{ color:C.muted, fontSize:13 }}>섭외 이력이 없습니다.</p>}
              {mb.length>5&&(
                <button onClick={()=>setModelHistAll(v=>!v)} style={{ width:"100%", marginTop:10, padding:"9px", fontSize:12, fontWeight:700, color:C.blue, background:"transparent", border:`1px solid ${C.border}`, borderRadius:8, cursor:"pointer" }}>
                  {modelHistAll ? "접기 ▲" : `더 보기 (${mb.length-5}건 더) ▼`}
                </button>
              )}
            </div>
            );
          })()}
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:6, paddingTop:14, borderTop:`1px solid ${C.border}` }}>
            <button onClick={()=>setCompModel(selectedModel)} disabled={!(Array.isArray(selectedModel.photos)&&selectedModel.photos.length)} title={Array.isArray(selectedModel.photos)&&selectedModel.photos.length?"컴카드 만들기":"포트폴리오에서 사진을 먼저 등록하세요"} style={{ ...btnS(C.green, !(Array.isArray(selectedModel.photos)&&selectedModel.photos.length)), fontSize:13, flex:1 }}><CardCheck size={13} style={{ verticalAlign:-2, flexShrink:0 }}/> 컴카드</button>
            <button onClick={()=>{ setCalInitModel(selectedModel.id); setPage("calendar"); setSelectedModel(null); setModalStack([]); }} style={{ ...btnS(C.blue), fontSize:13, flex:1 }}><Calendar size={13} style={{ verticalAlign:-2, flexShrink:0 }}/> 모델별 캘린더</button>
          </div>
        </Modal>
      )}

      {/* ════ 모달: 고객사 상세 ════ */}
      {selectedCustomer&&!cEditMode&&(
        <Modal onClose={closeDetail} wide>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20, paddingRight:isMobile?108:88 }}>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <h2 style={{ margin:0, color:C.text }}>{selectedCustomer.name}</h2>
                {selectedCustomer.brand&&<span style={{ fontSize:13, color:C.blue, fontWeight:600 }}>· {selectedCustomer.brand}</span>}
                {selectedCustomer.category&&<span style={{ background:C.card2, color:C.textSub, fontSize:12, padding:"3px 10px", borderRadius:10 }}>{selectedCustomer.category}</span>}
              </div>
              <p style={{ margin:"4px 0 0", fontSize:12, color:C.muted }}>ID: {selectedCustomer.id}</p>
            </div>
          </div>
          <button type="button" onClick={()=>openEditCustomer(selectedCustomer)} aria-label="정보 수정" title="정보 수정" style={{ position:"absolute", top:10, right:isMobile?60:50, width:isMobile?40:32, height:isMobile?40:32, display:"flex", alignItems:"center", justifyContent:"center", borderRadius:"50%", border:`1px solid ${C.purple}`, background:C.card2, color:C.purple, cursor:"pointer", zIndex:60, padding:0 }}><Pencil size={isMobile?18:15}/></button>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr)":"minmax(0,1fr) minmax(0,1fr)", gap:14, marginBottom:16 }}>
            {[
              ["대표자 (성명)", selectedCustomer.rep_name],
              ["담당자명", selectedCustomer.manager_name],
              ["전화번호", selectedCustomer.phone?<a href={`tel:${selectedCustomer.phone}`} style={{ color:C.blue, textDecoration:"none", fontWeight:600 }}>{selectedCustomer.phone}</a>:null],
              ["이메일",   selectedCustomer.email],
              ["사업자등록번호", selectedCustomer.biz_no?(()=>{ const n=String(selectedCustomer.biz_no).replace(/[^0-9]/g,""); return n.length===10?`${n.slice(0,3)}-${n.slice(3,5)}-${n.slice(5)}`:selectedCustomer.biz_no; })():null],
              ["사업장 주소", selectedCustomer.address],
              ["업태", selectedCustomer.biz_type],
              ["종목", selectedCustomer.biz_item],
              ["계산서 이메일", selectedCustomer.tax_email],
            ].map(([k,v])=>(
              <div key={String(k)}>
                <p style={{ margin:0, fontSize:11, color:C.muted }}>{k}</p>
                <p style={{ margin:"3px 0 0", fontSize:14, fontWeight:600, color:C.text }}>{v||"-"}</p>
              </div>
            ))}
          </div>
          {selectedCustomer.memo&&<div style={{ background:C.card2, borderRadius:8, padding:12, marginBottom:14 }}><p style={{ margin:0, fontSize:12, color:C.muted }}>메모</p><p style={{ margin:"4px 0 0", fontSize:13, color:C.text }}>{selectedCustomer.memo}</p></div>}
          {(()=>{
            const cb = bookings.filter(b=>b.customer_id===selectedCustomer.id).sort((a,b)=>(b.shoot_date||"").localeCompare(a.shoot_date||""));
            const shown = custHistAll ? cb : cb.slice(0,5);
            return (
            <div>
              <p style={{ fontSize:13, fontWeight:700, color:C.text, margin:"0 0 10px" }}>섭외 이력 ({cb.length}건)</p>
              {cb.length===0&&<p style={{ color:C.muted, fontSize:13 }}>섭외 이력이 없습니다.</p>}
              {shown.map(b=>(
                <div key={b.id} onClick={()=>openDetail("booking", b.id)}
                  className="hist-row"
                  style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${C.border}`, cursor:"pointer", gap:8 }}
                  onMouseEnter={e=>{ const el=e.currentTarget.querySelector(".hist-name") as HTMLElement|null; if(el) el.style.color=C.blue; }}
                  onMouseLeave={e=>{ const el=e.currentTarget.querySelector(".hist-name") as HTMLElement|null; if(el) el.style.color=C.text; }}>
                  <div style={{ minWidth:0, flex:1 }}>
                    <span className="hist-name" style={{ fontSize:13, color:C.text, fontWeight:600, transition:"color 0.15s" }}>{models.find(m=>m.id===b.model_id)?.name||"?"}</span>
                    {b.project_name&&<span style={{ fontSize:12, color:C.blue, marginLeft:8 }}><Folder size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> {b.project_name}</span>}
                    <span style={{ fontSize:12, color:C.textSub, marginLeft:8, fontWeight:700 }}><Calendar size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> {fmtDate(b.shoot_date)}</span>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
                    {bookingTotal(b)>0&&<span style={{ fontSize:12, color:C.yellow, fontWeight:700 }}><Coins size={11} style={{ verticalAlign:-2, flexShrink:0 }}/>{bookingTotal(b).toLocaleString()}원</span>}
                    <Badge code={b.status} type={b.booking_type} />
                  </div>
                </div>
              ))}
              {cb.length>5&&(
                <button onClick={()=>setCustHistAll(v=>!v)} style={{ width:"100%", marginTop:10, padding:"9px", fontSize:12, fontWeight:700, color:C.blue, background:"transparent", border:`1px solid ${C.border}`, borderRadius:8, cursor:"pointer" }}>
                  {custHistAll ? "접기 ▲" : `더 보기 (${cb.length-5}건 더) ▼`}
                </button>
              )}
            </div>
            );
          })()}
        </Modal>
      )}

      {/* ════ 모달: 고객사 수정 ════ */}
      {selectedCustomer&&cEditMode&&(
        <Modal onClose={()=>{setCEditMode(false);setSelectedCustomer(null);resetCustomerForm();setModalStack([]);}} wide>
          <h3 style={{ marginTop:0, color:C.text }}><Building2 size={17} style={{ verticalAlign:-2, flexShrink:0 }}/> 고객사 정보 수정</h3>
          <p style={{ fontSize:11, color:C.muted, marginTop:0 }}>ID: {selectedCustomer.id}</p>
          <BizLicenseUpload onExtracted={applyBizInfo} />
          {/* 사업자등록증 정보 (등록증 업로드 시 자동 입력) */}
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr)":"repeat(3, minmax(0,1fr))", gap:10 }}>
            <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>상호 (고객사명) *</label><input style={inp} value={cName} onChange={e=>setCName(e.target.value)} /></div>
            <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>브랜드명</label><input style={inp} value={cBrand} onChange={e=>setCBrand(e.target.value)} /></div>
            <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>분야</label><CategorySelect value={cCategory} onChange={setCCategory} extra={[...(agency?.client_categories||[]), ...customerCategories]} onAdd={addClientCategory} /></div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr)":"minmax(0,1fr) minmax(0,1fr)", gap:10 }}>
            <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>대표자 (성명)</label><input style={inp} value={cRepName} onChange={e=>setCRepName(e.target.value)} /></div>
            <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>사업자등록번호</label><input style={inp} value={cBizNo} onChange={e=>setCBizNo(e.target.value)} placeholder="000-00-00000" /></div>
          </div>
          <div style={{ marginBottom:10 }}><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>사업장 주소</label><input style={{ ...inp, marginBottom:0 }} value={cAddress} onChange={e=>setCAddress(e.target.value)} /></div>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr)":"minmax(0,1fr) minmax(0,1fr)", gap:10 }}>
            <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>업태</label><input style={inp} value={cBizType} onChange={e=>setCBizType(e.target.value)} /></div>
            <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>종목</label><input style={inp} value={cBizItem} onChange={e=>setCBizItem(e.target.value)} /></div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr)":"minmax(0,1fr) minmax(0,1fr)", gap:10 }}>
            <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>담당자명</label><input style={inp} value={cManager} onChange={e=>setCManager(e.target.value)} /></div>
            <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>전화번호 *</label><input style={inp} type="tel" value={cPhone} onChange={e=>setCPhone(e.target.value)} /></div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr)":"minmax(0,1fr) minmax(0,1fr)", gap:10 }}>
            <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>이메일</label><input style={inp} type="email" value={cEmail} onChange={e=>setCEmail(e.target.value)} /></div>
            <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>계산서 발송 이메일</label><input style={inp} type="email" value={cTaxEmail} onChange={e=>setCTaxEmail(e.target.value)} placeholder="tax@company.com" /></div>
          </div>
          <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>메모</label>
          <textarea style={{ ...inp, height:60, resize:"none" }} value={cMemo} onChange={e=>setCMemo(e.target.value)} placeholder="특이사항" />
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={handleSaveCustomer} disabled={JSON.stringify(buildCustomerData())===customerBaseline} style={{ ...btnS(C.green, JSON.stringify(buildCustomerData())===customerBaseline), flex:1 }}>저장</button>
            <button onClick={handleDeleteCustomer} style={{ ...btnS(C.red), flexShrink:0 }}>삭제</button>
          </div>
        </Modal>
      )}
      {(showModelForm||mEditMode)&&(
        <Modal onClose={()=>{setShowModelForm(false);setMEditMode(false);setSelectedModel(null);resetModelForm();setModalStack([]);}} wide>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"flex-start", gap:8, flexWrap:"wrap", paddingRight:48 }}>
            <h3 style={{ margin:0, color:C.text }}><User size={17} style={{ verticalAlign:-2, flexShrink:0 }}/> {mEditMode?"모델 정보 수정":"모델 추가"}</h3>
          </div>
          {mEditMode&&<p style={{ fontSize:11, color:C.muted, marginTop:4 }}>ID: {selectedModel?.id}</p>}

          {/* 썸네일 업로드 */}
          <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:14 }}>
            <div style={{ position:"relative", flexShrink:0 }}>
              {mThumb
                ? <img src={mThumb} alt="썸네일" style={{ width:64, height:64, borderRadius:"50%", objectFit:"cover", border:`2px solid ${C.border}` }} />
                : <div style={{ width:64, height:64, borderRadius:"50%", background:"linear-gradient(135deg,#c9a96e,#8b6a3e)", display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontWeight:800, fontSize:22 }}>{mName?mName[0]:"?"}</div>
              }
              <label style={{ position:"absolute", bottom:0, right:0, background:C.blue, borderRadius:"50%", width:22, height:22, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", border:"2px solid var(--c-card)" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.5" strokeLinecap="round"/></svg>
                <input type="file" accept="image/*" style={{ display:"none" }} onChange={e=>{
                  const file = e.target.files?.[0]; if(!file) return;
                  compressThumb(file, data => setMThumb(data)); // 업로드 시 자동 축소·압축(20~100KB)
                  e.target.value="";
                }} />
              </label>
            </div>
            <div>
              <p style={{ margin:0, fontSize:12, color:C.text, fontWeight:600 }}>프로필 사진</p>
              <p style={{ margin:"2px 0 0", fontSize:11, color:C.muted }}>자동 압축 저장 · JPG/PNG</p>
              {mThumb&&<button type="button" onClick={()=>setMThumb("")} style={{ marginTop:4, background:"none", border:"none", color:C.red, cursor:"pointer", fontSize:11, padding:0 }}>× 삭제</button>}
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr)":"minmax(0,1fr) minmax(0,1fr)", gap:10 }}>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>모델명 *</label>
              <input style={inp} value={mName} onChange={e=>setMName(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>출생연도(YYYY) *</label>
              <input style={inp} type="text" inputMode="numeric" maxLength={4} placeholder="예: 1998" value={mBirthYear} onChange={e=>setMBirthYear(e.target.value.replace(/[^0-9]/g,"").slice(0,4))} />
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr)":"minmax(0,1fr) minmax(0,1fr)", gap:10 }}>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>전화번호</label>
              <input style={inp} type="tel" value={mPhone} onChange={e=>setMPhone(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>이메일</label>
              <input style={inp} type="email" value={mEmail} onChange={e=>setMEmail(e.target.value)} />
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr) minmax(0,1fr)":"repeat(4,minmax(0,1fr))", gap:10 }}>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>성별 *<span style={{ fontSize:10, color:C.muted }}> · ID 생성</span></label>
              <select style={inp} value={mGender} onChange={e=>setMGender(e.target.value)}>
                <option value="">선택</option>
                {GENDERS.map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>모델 타입</label>
              <select style={inp} value={mCategory} onChange={e=>setMCategory(e.target.value)}>
                <option value="">선택</option>
                {MODEL_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>경력년차 <span style={{ color:C.muted }}>(소수 가능)</span></label>
              <input style={inp} type="text" inputMode="decimal" placeholder="예: 2.5" value={mCareerYears} onChange={e=>setMCareerYears(e.target.value.replace(/[^0-9.]/g,""))} />
            </div>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>국적</label>
              <select style={inp} value={mCountry} onChange={e=>setMCountry(e.target.value)}>
                {COUNTRIES.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          {/* ── 신체 정보 · 프로필 ── */}
          <div style={{ border:`1px solid ${C.border}`, borderRadius:8, padding:"12px 14px", margin:"4px 0 14px", background:C.card2 }}>
            <p style={{ margin:"0 0 10px", fontSize:12, fontWeight:700, color:C.text }}>신체 정보 · 프로필 <span style={{ fontWeight:500, color:C.muted }}>(컴카드·패키지에 표시)</span></p>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr) minmax(0,1fr)":"repeat(2,minmax(0,1fr))", gap:8, marginBottom:8, maxWidth:isMobile?undefined:320 }}>
              <input style={{ ...inp, marginBottom:0 }} type="text" inputMode="numeric" placeholder="키(cm)" value={mHeight} onChange={e=>setMHeight(e.target.value)} />
              <input style={{ ...inp, marginBottom:0 }} type="text" inputMode="numeric" placeholder="신발(mm)" value={mShoe} onChange={e=>setMShoe(e.target.value)} />
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5, flexWrap:"wrap" }}>
              <span style={{ fontSize:11, color:C.muted }}>가슴·허리·엉덩이 단위</span>
              {(["inch","cm"] as const).map(u=>(
                <button key={u} type="button" onClick={()=>switchSizeUnit(u)} style={{ padding:"3px 11px", borderRadius:14, border:`1px solid ${mSizeUnit===u?C.blue:C.border}`, background:mSizeUnit===u?C.blue+"22":"transparent", color:mSizeUnit===u?C.blue:C.muted, fontSize:11, fontWeight:mSizeUnit===u?700:500, cursor:"pointer" }}>{u}</button>
              ))}
              <span style={{ fontSize:10, color:C.muted }}>※ cm 입력 → inch로 자동 변환 표기</span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,minmax(0,1fr))", gap:8, marginBottom:10, maxWidth:isMobile?undefined:480 }}>
              {([[`가슴(${mSizeUnit})`,mBust,setMBust],[`허리(${mSizeUnit})`,mWaist,setMWaist],[`엉덩이(${mSizeUnit})`,mHip,setMHip]] as [string,string,(v:string)=>void][]).map(([ph,val,set])=>(
                <input key={ph} style={{ ...inp, marginBottom:0 }} type="text" inputMode="numeric" placeholder={ph} value={val} onChange={e=>set(e.target.value)} />
              ))}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr) minmax(0,1fr)":"repeat(4,minmax(0,1fr))", gap:8, marginBottom:10 }}>
              <div>
                <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>머리 길이</label>
                <select style={{ ...inp, marginBottom:0 }} value={mHair} onChange={e=>setMHair(e.target.value)}>
                  <option value="">선택</option>
                  {HAIR_LENGTHS.map(h=><option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>머리색</label>
                <input style={{ ...inp, marginBottom:0 }} placeholder="예: 다크블론드" value={mHairColor} onChange={e=>setMHairColor(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>눈동자색</label>
                <select style={{ ...inp, marginBottom:0 }} value={mEye} onChange={e=>setMEye(e.target.value)}>
                  <option value="">선택</option>
                  {EYE_COLORS.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>인스타 팔로워 수</label>
                <input style={{ ...inp, marginBottom:0 }} type="text" placeholder="예: 12500" value={mFollowers} onChange={e=>setMFollowers(e.target.value)} />
              </div>
            </div>
            <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
              <button type="button" onClick={()=>setMTattoo(v=>!v)} style={{ padding:"6px 14px", borderRadius:20, border:`1px solid ${mTattoo?C.purple:C.border}`, background:mTattoo?C.purple+"22":"transparent", color:mTattoo?C.purple:C.muted, fontSize:12, fontWeight:mTattoo?700:500, cursor:"pointer" }}>타투 {mTattoo?"있음":"없음"}</button>
              <button type="button" onClick={()=>setMUnderwear(v=>!v)} style={{ padding:"6px 14px", borderRadius:20, border:`1px solid ${mUnderwear?C.purple:C.border}`, background:mUnderwear?C.purple+"22":"transparent", color:mUnderwear?C.purple:C.muted, fontSize:12, fontWeight:mUnderwear?700:500, cursor:"pointer" }}>언더웨어 촬영 {mUnderwear?"가능":"불가"}</button>
            </div>
            <MultiCheck label="분야 (복수 선택)" options={MODEL_FIELDS} value={mFields} onChange={setMFields} />
            <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>특기 <span style={{ color:C.muted }}>(쉼표로 구분 — 노래, 외국어, 수영, 스키 등)</span></label>
            <input style={{ ...inp, marginBottom:0 }} placeholder="노래, 외국어, 수영" value={mSpecialty} onChange={e=>setMSpecialty(e.target.value)} />
            {/* 경력 — 펼침/접기. 펼치면 입력량에 따라 아래로 커지는 자동확장 입력창 */}
            <button type="button" onClick={()=>setMCareerOpen(v=>!v)} style={{ display:"flex", alignItems:"center", gap:8, width:"100%", margin:"12px 0 5px", padding:0, background:"transparent", border:"none", cursor:"pointer", color:C.muted, fontSize:11, textAlign:"left" }}>
              <span>활동이력 <span style={{ color:C.muted }}>(작품·활동)</span></span>
              <span style={{ color:C.blue, fontSize:11 }}>{mCareerOpen?"접기 ▲":"펼치기 ▼"}</span>
            </button>
            {/* 접힘=1줄 미리보기(내용 있음을 예측), 펼침/클릭=내용만큼 자동확장 */}
            <textarea
              value={mCareer}
              rows={1}
              onFocus={()=>{ if(!mCareerOpen) setMCareerOpen(true); }}
              onChange={e=>{ setMCareer(e.target.value); if(mCareerOpen){ const t=e.currentTarget; t.style.height="auto"; t.style.height=t.scrollHeight+"px"; } }}
              ref={el=>{ if(el){ if(mCareerOpen){ el.style.height="auto"; el.style.height=el.scrollHeight+"px"; } else { el.style.height=""; } } }}
              placeholder=""
              style={{ ...inp, marginTop:6, marginBottom:0, resize:"none", overflow:"hidden", lineHeight:1.5, cursor:"text" }}
            />
          </div>

          {/* 외국인 모델 — 토글 + 비자·정산 팝업 진입 (발송 편입 모델은 소속사 고정이라 숨김) */}
          {!selectedModel?.source_agency_id &&
          <div style={{ border:`1px solid ${mIsForeign?C.blue:C.border}`, borderRadius:8, padding:"12px 14px", marginBottom:14, background:mIsForeign?C.blue+"11":C.card2, display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, flexWrap:"wrap" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <button type="button" onClick={()=>{ const nv=!mIsForeign; setMIsForeign(nv); setMTaxType(nv?"foreigner":"freelancer"); if(nv){ if(!mVisaType) setMVisaType("E6"); setShowForeignModal(true); } }} style={{ padding:"6px 14px", borderRadius:20, border:`1px solid ${mIsForeign?C.blue:C.border}`, background:mIsForeign?C.blue+"22":"transparent", color:mIsForeign?C.blue:C.muted, fontSize:12, fontWeight:mIsForeign?700:500, cursor:"pointer" }}><Plane size={12} style={{ verticalAlign:-2 }}/> 외국인 모델 {mIsForeign?"ON":"OFF"}</button>
              {mIsForeign && <span style={{ fontSize:11, color:C.muted }}>{mVisaType==="E6"?"E-6 (연예흥행) · 원천 3.3%":mVisaType==="C4"?"C-4 (단기취업) · 원천 20%":mVisaType==="OTHER"?"기타 비자 · 원천 20%":"비자 미선택"}{mEntry?` · 입국 ${mEntry}`:""}{mExit?` · 만료 ${mExit}`:""}</span>}
            </div>
            {mIsForeign && <button type="button" onClick={()=>setShowForeignModal(true)} style={{ padding:"6px 14px", borderRadius:7, border:`1px solid ${C.blue}`, background:C.blue, color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer" }}>{mVisaType ? "비자·정산 정보 확인" : "비자·정산 정보 입력"}</button>}
          </div>}

          {/* ── 모델료 (Day / Half day / Hour) ── */}
          <div style={{ border:`1px solid ${C.border}`, borderRadius:8, padding:"12px 14px", margin:"4px 0 10px", background:C.card2 }}>
            <p style={{ margin:"0 0 10px", fontSize:12, fontWeight:700, color:C.text }}>모델료 <span style={{ color:C.red, fontWeight:700 }}>*필수</span> <span style={{ fontWeight:500, color:C.muted }}>(섭외 시간 기준 자동 적용 — 5h까지 Half, 6h~ Day)</span></p>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr)":"minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)", gap:10 }}>
              {([["Day (9h)",mFeeDay,setMFeeDay],["Half day (5h)",mFeeHalf,setMFeeHalf],["Hour (1h)",mFeeHour,setMFeeHour]] as [string,number,(v:number)=>void][]).map(([lab,val,set])=>(
                <div key={lab}>
                  <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>{lab}</label>
                  <span style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <input style={{ ...inp, marginBottom:0, flex:1, minWidth:0 }} type="text" inputMode="numeric" placeholder="0"
                      value={val ? Number(val).toLocaleString("ko-KR") : ""}
                      onChange={e=>{ const v=e.target.value.replace(/,/g,""); if(v===""||!isNaN(Number(v))) set(Number(v)||0); }} />
                    <span style={{ fontSize:11, fontWeight:700, color:C.textSub }}>원</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── 정산 · 세무 ── */}
          <div style={{ border:`1px solid ${C.border}`, borderRadius:8, padding:"12px 14px", margin:"0 0 14px", background:C.card2 }}>
            <p style={{ margin:"0 0 10px", fontSize:12, fontWeight:700, color:C.text }}>정산 · 세무 <span style={{ color:C.red, fontWeight:700 }}>*필수</span></p>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12, flexWrap:"wrap" }}>
              <span style={{ fontSize:11, color:C.muted, minWidth:60 }}>세무 유형</span>
              {selectedModel?.source_agency_id ? (
                <span style={{ padding:"5px 12px", borderRadius:20, border:`1px solid ${C.blue}`, background:C.blue+"22", color:C.blue, fontSize:12, fontWeight:700 }}>🔒 소속사 (계산서 10%) · {selectedModel.source_agency_name||"발송처"} 발송 편입{mIsForeign?" · 외국인":""}</span>
              ) : mIsForeign ? (
                <>
                  <span style={{ padding:"5px 12px", borderRadius:20, border:`1px solid ${C.blue}`, background:C.blue+"22", color:C.blue, fontSize:12, fontWeight:700 }}>{mVisaType==="E6"?"외국인 (E6/3.3%)":mVisaType==="C4"?"외국인 (C4/20%)":mVisaType==="OTHER"?"외국인 (기타/20%)":"외국인 (비자율)"}</span>
                  <span style={{ fontSize:11, color:C.muted }}>🔒 세율·주소·식별번호는 [비자·정산 정보]에서 입력</span>
                </>
              ) : (
                ([["freelancer","프리랜서 (3.3%)"],["company","소속사 (계산서 10%)"]] as const).map(([k,l])=>(
                  <button key={k} type="button" onClick={()=>setMTaxType(k)} style={{ padding:"5px 12px", borderRadius:20, border:`1px solid ${mTaxType===k?C.blue:C.border}`, background:mTaxType===k?C.blue+"22":"transparent", color:mTaxType===k?C.blue:C.muted, fontSize:12, fontWeight:mTaxType===k?700:500, cursor:"pointer" }}>{l}</button>
                ))
              )}
            </div>
            {mTaxType==="company" && (selectedModel?.source_agency_id || !mIsForeign) && (
              <div style={{ border:`1px solid ${C.blue}44`, borderRadius:8, padding:"10px 12px", margin:"0 0 12px", background:C.blue+"0d" }}>
                <p style={{ margin:"0 0 3px", fontSize:11.5, fontWeight:700, color:C.blue }}>소속 에이전시 정보 <span style={{ fontWeight:500, color:C.muted }}>(모델 개인정보 대신, 세금계산서 10%로 정산)</span></p>
                <p style={{ margin:"0 0 9px", fontSize:10.5, color:C.muted }}>{selectedModel?.source_agency_id ? `${selectedModel.source_agency_name||"발송처"}에서 발송받아 자동 편입된 정보입니다. 정산서는 아래 업체 기준으로 발행됩니다.` : "일정·정산 연락은 모델이 아니라 아래 에이전시로 갑니다."}</p>
                <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr)":"minmax(0,1fr) minmax(0,1fr)", gap:10, marginBottom:10 }}>
                  <div>
                    <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>소속 에이전시명</label>
                    <input style={{ ...inp, marginBottom:0 }} value={mAgencyName} onChange={e=>setMAgencyName(e.target.value)} placeholder="예: ○○엔터테인먼트" />
                  </div>
                  <div>
                    <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>사업자등록번호 <span style={{ color:C.muted }}>(세금계산서용)</span></label>
                    <input style={{ ...inp, marginBottom:0 }} value={mAgencyBizNo} onChange={e=>setMAgencyBizNo(e.target.value)} placeholder="000-00-00000" />
                  </div>
                  <div>
                    <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>담당자</label>
                    <input style={{ ...inp, marginBottom:0 }} value={mAgencyContact} onChange={e=>setMAgencyContact(e.target.value)} placeholder="담당자명" />
                  </div>
                  <div>
                    <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>담당자 연락처</label>
                    <input style={{ ...inp, marginBottom:0 }} value={mAgencyPhone} onChange={e=>setMAgencyPhone(e.target.value)} placeholder="010-0000-0000" />
                  </div>
                </div>
                <div style={{ marginBottom:10 }}>
                  <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>주소 <span style={{ color:C.muted }}>(세금계산서 · 사업장 소재지)</span></label>
                  <input style={{ ...inp, marginBottom:0 }} value={mAddress} onChange={e=>setMAddress(e.target.value)} placeholder="사업장 주소" />
                </div>
                <div style={{ marginBottom:10 }}>
                  <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}><Banknote size={11} style={{ verticalAlign:-2 }}/> 정산 입금 계좌 <span style={{ color:C.muted }}>(A에게 지급)</span></label>
                  <div style={{ display:"flex", gap:6 }}>
                    <select style={{ ...inp, width:120, flexShrink:0, marginBottom:0 }} value={mBankName} onChange={e=>{ const n=e.target.value; setMBankName(n); setMBank(`${n} ${mBankAcct}`.trim()); }}>
                      <option value="">은행 선택</option>
                      {["국민","신한","우리","하나","농협","기업","SC제일","씨티","카카오뱅크","토스뱅크","케이뱅크","새마을금고","우체국","수협","부산","대구","경남","광주","전북","제주"].map(b=><option key={b} value={b}>{b}</option>)}
                    </select>
                    <input style={{ ...inp, flex:1, minWidth:0, marginBottom:0 }} placeholder="계좌번호" value={mBankAcct} onChange={e=>{ const a=e.target.value; setMBankAcct(a); setMBank(`${mBankName} ${a}`.trim()); }} />
                  </div>
                </div>
                <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>에이전시 이메일 <span style={{ color:C.muted }}>(일정·정산 연락 — 모델 대신)</span></label>
                <input style={{ ...inp, marginBottom:0 }} type="email" value={mAgencyEmail} onChange={e=>setMAgencyEmail(e.target.value)} placeholder="agency@example.com" />
              </div>
            )}
            {/* 정산방식(수수료/정액) — 발송 편입(소속사) 모델은 숨김(기준액=노출가 고정, 마진은 섭외 공급가로) */}
            {!selectedModel?.source_agency_id && (<>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10, flexWrap:"wrap" }}>
              <span style={{ fontSize:11, color:C.muted, minWidth:60 }}>정산 방식</span>
              {([["rate","수수료(%)"],["fixed","정액(원)"]] as const).map(([k,l])=>(
                <button key={k} type="button" onClick={()=>{ if(k!==mPayType){ setMPayType(k); setMPayValue(0); setMPayDayValue(0); setMPayHalfValue(0); setMPayHourValue(0); } }} style={{ padding:"5px 12px", borderRadius:20, border:`1px solid ${mPayType===k?C.green:C.border}`, background:mPayType===k?C.green+"22":"transparent", color:mPayType===k?C.green:C.muted, fontSize:12, fontWeight:mPayType===k?700:500, cursor:"pointer" }}>{l}</button>
              ))}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr)":"minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)", gap:10 }}>
              {([["Day","Day(9h)",mPayDayValue,setMPayDayValue],["Half","Half day(5h)",mPayHalfValue,setMPayHalfValue],["Hour","Hours(1h)",mPayHourValue,setMPayHourValue]] as [string,string,number,(v:number)=>void][]).map(([key,lab,val,set])=>(
                <div key={key}>
                  <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>{lab}</label>
                  <span style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <input style={{ ...inp, marginBottom:0, flex:1, minWidth:0 }} type="text" inputMode="numeric"
                      placeholder={mPayType==="rate"?"수수료":"정액"}
                      value={val ? (mPayType==="fixed"? Number(val).toLocaleString("ko-KR") : String(val)) : ""}
                      onChange={e=>{ const v=e.target.value.replace(/,/g,""); if(v===""||!isNaN(Number(v))) set(Number(v)||0); }} />
                    <span style={{ fontSize:11, fontWeight:700, color:C.textSub }}>{mPayType==="rate"?"%":"원"}</span>
                  </span>
                </div>
              ))}
            </div>
            </>)}
          </div>

          {/* ── 세무 신고용 정보 (대표·정산권한자 전용) ── 소속사는 원천징수 무관이라 숨김 · 외국인은 [비자·정산 정보] 모달에서 입력 */}
          {canViewFinance && mTaxType!=="company" && !mIsForeign && (()=>{
            const idLabel = "주민등록번호";
            const idPh = "13자리 (- 없이)";
            const masked = selectedModel?.national_id_masked;
            const showInput = !masked || showIdInput || !mEditMode;
            return (
            <div style={{ border:`1px solid ${C.border}`, borderRadius:8, padding:"12px 14px", margin:"0 0 14px", background:C.card2 }}>
              <p style={{ margin:"0 0 3px", fontSize:12, fontWeight:700, color:C.text }}>세무 신고용 정보 <span style={{ fontWeight:500, color:C.muted }}>(원천징수·지급명세서)</span></p>
              <p style={{ margin:"0 0 10px", fontSize:11, color:C.muted }}>🔒 식별번호는 암호화 저장되고 화면엔 마스킹만 표시됩니다 · 대표·정산권한자 전용</p>
              <div style={{ marginBottom:10 }}>
                <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>주소</label>
                <input style={{ ...inp, marginBottom:0 }} value={mAddress} onChange={e=>setMAddress(e.target.value)} placeholder="모델 주소 (지급명세서용)" />
              </div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>{idLabel} <span style={{ color:C.muted }}>(내국인)</span></label>
              {showInput ? (
                <span style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
                  <input style={{ ...inp, marginBottom:0, flex:1, minWidth:160 }} value={mNationalId} onChange={e=>{ const v=e.target.value; setMNationalId(v); const f6=v.replace(/[^0-9]/g,"").slice(0,6); if(f6.length===6) setMSSN(f6); }} placeholder={idPh} autoComplete="off" />
                  {mEditMode && <button type="button" onClick={()=>saveModelNationalId(selectedModel.id)} disabled={!mNationalId.trim()} style={{ ...btnS(C.blue, !mNationalId.trim()), fontSize:12, padding:"8px 14px" }}>저장</button>}
                  {mEditMode && masked && <button type="button" onClick={()=>{ setShowIdInput(false); setMNationalId(""); }} style={{ ...btnS(C.muted), fontSize:12, padding:"8px 12px" }}>취소</button>}
                </span>
              ) : (
                <span style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                  <span style={{ fontFamily:"monospace", fontSize:14, color:C.text, background:C.card, border:`1px solid ${C.border}`, borderRadius:6, padding:"7px 12px" }}>{masked}</span>
                  <button type="button" onClick={()=>{ setShowIdInput(true); setMNationalId(""); }} style={{ ...btnS(C.muted), fontSize:12, padding:"7px 12px" }}>변경</button>
                </span>
              )}
              {!mEditMode && <p style={{ margin:"5px 0 0", fontSize:10, color:C.muted }}>모델 추가 시 함께 암호화 저장됩니다.</p>}
            </div>
            );
          })()}

          {/* 링크 — 브랜드 아이콘 */}
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr)":"minmax(0,1fr) minmax(0,1fr)", gap:10 }}>
            <div>
              <label style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:"#E1306C", marginBottom:5 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" stroke="#E1306C" strokeWidth="2"/><circle cx="12" cy="12" r="4.5" stroke="#E1306C" strokeWidth="2"/><circle cx="17.5" cy="6.5" r="1.5" fill="#E1306C"/></svg>
                인스타그램
              </label>
              <input style={inp} type="text" placeholder="@아이디 또는 URL" value={mInstagram} onChange={e=>setMInstagram(e.target.value)} />
            </div>
            {!selectedModel?.source_agency_id && <div>
              <label style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:"#4285F4", marginBottom:5 }}>
                <svg width="13" height="13" viewBox="0 0 87.3 78" fill="none"><path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 53H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066DA"/><path d="M43.65 25L29.9 1.2C28.55.4 27 0 25.45 0c-1.55 0-3.1.4-4.5 1.2L6.6 11.4C5.25 12.2 4.1 13.3 3.3 14.65L43.65 25z" fill="#00AC47"/><path d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.95 0H25.45c-1.55 0-3.1.4-4.5 1.2L43.65 25z" fill="#EA4335"/><path d="M43.65 53H27.5L13.75 76.8c1.4.8 2.95 1.2 4.5 1.2h50.4c1.55 0 3.1-.4 4.5-1.2L57.4 53H43.65z" fill="#00832D"/><path d="M73.65 25H43.65l13.75 28h16.25l-2.5-4.35L87.3 25H73.65z" fill="#FFBA00"/><path d="M87.3 25H73.65L57.4 53H73.65L87.3 25z" fill="#FF6D00"/></svg>
                구글 드라이브
              </label>
              <input style={inp} type="url" placeholder="https://drive.google.com/..." value={mDrive} onChange={e=>setMDrive(e.target.value)} />
            </div>}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr)":"minmax(0,1fr) minmax(0,1fr)", gap:10 }}>
            {!selectedModel?.source_agency_id && <div>
              <label style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, marginBottom:5, color:"#3A2A00" }}>
                <svg width="14" height="14" viewBox="0 0 24 24"><ellipse cx="12" cy="11" rx="10" ry="8.5" fill="#FEE500"/><circle cx="9" cy="11" r="1.2" fill="#3A1D00"/><circle cx="12" cy="11" r="1.2" fill="#3A1D00"/><circle cx="15" cy="11" r="1.2" fill="#3A1D00"/></svg>
                <span style={{ color:"#c9a000" }}>카카오톡 ID</span>
              </label>
              <input style={inp} placeholder="카카오톡 아이디" value={mKakao} onChange={e=>setMKakao(e.target.value)} />
            </div>}
            {(mTaxType!=="company" || (mIsForeign && !selectedModel?.source_agency_id)) && <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}><Banknote size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> 통장 (은행 · 계좌번호)</label>
              <div style={{ display:"flex", gap:6 }}>
                <select style={{ ...inp, width:120, flexShrink:0 }} value={mBankName} onChange={e=>{ const n=e.target.value; setMBankName(n); setMBank(`${n} ${mBankAcct}`.trim()); }}>
                  <option value="">은행 선택</option>
                  {["국민","신한","우리","하나","농협","기업","SC제일","씨티","카카오뱅크","토스뱅크","케이뱅크","새마을금고","우체국","수협","부산","대구","경남","광주","전북","제주"].map(b=><option key={b} value={b}>{b}</option>)}
                </select>
                <input style={{ ...inp, flex:1, minWidth:0 }} placeholder="계좌번호" value={mBankAcct} onChange={e=>{ const a=e.target.value; setMBankAcct(a); setMBank(`${mBankName} ${a}`.trim()); }} />
              </div>
            </div>}
          </div>

          {/* AIMO 링크 (발송 편입 모델은 숨김) */}
          {!selectedModel?.source_agency_id && <div>
            <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, marginBottom:5 }}>
              <span style={{ background:"linear-gradient(135deg,#4f46e5,#06b6d4)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", fontWeight:800, fontSize:13, letterSpacing:"-0.5px" }}>AIMO</span>
              <span style={{ color:C.muted }}>모델 페이지 링크 (aimo.kr)</span>
            </label>
            <input style={inp} type="url" placeholder="https://aimo.kr/models/..." value={mAimoUrl} onChange={e=>setMAimoUrl(e.target.value)} />
          </div>}

          <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5, marginTop:4 }}>메모</label>
          <textarea style={{ ...inp, height:60, resize:"none" }} placeholder="특이사항" value={mMemo} onChange={e=>setMMemo(e.target.value)} />
          {mEditMode&&selectedModel&&(
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:6, paddingTop:14, borderTop:`1px solid ${C.border}` }}>
              <button type="button" onClick={()=>{ setCalInitModel(selectedModel.id); setPage("calendar"); setShowModelForm(false); setMEditMode(false); setSelectedModel(null); resetModelForm(); setModalStack([]); }} style={{ ...btnS(C.blue), fontSize:13, flex:1 }}><Calendar size={13} style={{ verticalAlign:-2, flexShrink:0 }}/> 모델별 캘린더</button>
              <button type="button" onClick={()=>{ setStudioInitModel(selectedModel.id); setPage("studio"); setShowModelForm(false); setMEditMode(false); setSelectedModel(null); resetModelForm(); setModalStack([]); }} style={{ ...btnS(C.purple), fontSize:13, flex:1 }}><Camera size={13} style={{ verticalAlign:-2, flexShrink:0 }}/> 포트폴리오</button>
            </div>
          )}
          <div style={{ display:"flex", gap:10, marginTop:10 }}>
            <button onClick={mEditMode?handleSaveModel:handleAddModel} disabled={mEditMode && JSON.stringify(buildModelData())===modelBaseline} style={{ ...btnS(C.green, mEditMode && JSON.stringify(buildModelData())===modelBaseline), flex:1 }}>{mEditMode?"저장":"추가"}</button>
            {mEditMode&&<button onClick={handleDeleteModel} style={{ ...btnS(C.red), flexShrink:0 }}>삭제</button>}
          </div>
        </Modal>
      )}
      {/* ════ 모달: 외국인 비자·정산 정보 (모델 폼 위 팝업) ════ */}
      {showForeignModal && (
        <Modal onClose={()=>setShowForeignModal(false)}>
          <h3 style={{ marginTop:0, color:C.text }}><Plane size={17} style={{ verticalAlign:-2, flexShrink:0 }}/> 외국인 비자 · 정산 정보</h3>
          <p style={{ margin:"0 0 14px", fontSize:12, color:C.muted }}>비자 유형을 선택하면 세율·기본 지급방식이 자동 설정됩니다. (세율은 정보용 — 정산 계산은 정산·세무 설정 사용)</p>

          {/* 비자 유형 */}
          <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:6 }}>비자 유형 *</label>
          <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
            {([["E6","E-6 연예흥행","원천 3.3% · 국내계좌"],["C4","C-4 단기취업","원천 20% · 해외송금"],["OTHER","기타 비자","원천 20% · 수기"]] as const).map(([k,l,d])=>(
              <button key={k} type="button" onClick={()=>{
                setMVisaType(k);
                if(k==="E6"){ setMTaxRate(3.3); setMPayMethod(p=>p||"bank"); }
                else if(k==="C4"){ setMTaxRate(20); setMHasAlienCard(false); setMPayMethod(p=>p||"payoneer"); }
                else { setMTaxRate(20); setMPayMethod(p=>p||"bank"); }
              }} style={{ flex:1, minWidth:0, textAlign:"center", padding:"10px 8px", borderRadius:8, border:`1px solid ${mVisaType===k?C.blue:C.border}`, background:mVisaType===k?C.blue+"22":C.card2, color:mVisaType===k?C.blue:C.textSub, cursor:"pointer" }}>
                <div style={{ fontSize:13, fontWeight:700 }}>{l}</div>
                <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{d}</div>
              </button>
            ))}
          </div>

          {/* 입출국 + 세율 */}
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr)":"minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)", gap:10, marginBottom:14 }}>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>입국일</label>
              <input style={{ ...inp, marginBottom:0 }} type="date" value={mEntry} onChange={e=>setMEntry(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>체류 만료일</label>
              <input style={{ ...inp, marginBottom:0 }} type="date" value={mExit} onChange={e=>setMExit(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>원천징수율 (%)</label>
              <input style={{ ...inp, marginBottom:0 }} type="number" step="0.1" value={mTaxRate||""} onChange={e=>setMTaxRate(Number(e.target.value)||0)} />
            </div>
          </div>

          {/* 외국인등록증 — E-6만 */}
          {mVisaType==="E6" && (
            <div style={{ marginBottom:14 }}>
              <button type="button" onClick={()=>setMHasAlienCard(v=>!v)} style={{ padding:"6px 14px", borderRadius:20, border:`1px solid ${mHasAlienCard?C.green:C.border}`, background:mHasAlienCard?C.green+"22":"transparent", color:mHasAlienCard?C.green:C.muted, fontSize:12, fontWeight:mHasAlienCard?700:500, cursor:"pointer" }}>외국인등록증 {mHasAlienCard?"있음":"없음"}</button>
              <span style={{ fontSize:11, color:C.muted, marginLeft:8 }}>등록증 보유 시 국내계좌 정산 가능</span>
            </div>
          )}

          {/* 지급 방식 */}
          <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:6 }}>지급 방식</label>
          <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
            {([["bank","국내 계좌이체"],["payoneer","Payoneer"],["wise","Wise"],["cash","현금"]] as const).map(([k,l])=>(
              <button key={k} type="button" onClick={()=>setMPayMethod(k)} style={{ padding:"6px 14px", borderRadius:20, border:`1px solid ${mPayMethod===k?C.purple:C.border}`, background:mPayMethod===k?C.purple+"22":"transparent", color:mPayMethod===k?C.purple:C.muted, fontSize:12, fontWeight:mPayMethod===k?700:500, cursor:"pointer" }}>{l}</button>
            ))}
          </div>

          {/* 지급 상세 — 방식별 분기 */}
          <div style={{ border:`1px solid ${C.border}`, borderRadius:8, padding:"12px 14px", marginBottom:16, background:C.card2 }}>
            {mPayMethod==="bank" && (
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr)":"minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)", gap:10 }}>
                <div>
                  <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>은행</label>
                  <select style={{ ...inp, marginBottom:0 }} value={mPayDetail.bank||""} onChange={e=>{ const bank=e.target.value; setMPayDetail({ ...mPayDetail, bank }); syncBankInfoFromForeign(bank, mPayDetail.account||""); }}>
                    <option value="">선택</option>
                    {["국민","신한","우리","하나","농협","기업","SC제일","씨티","카카오뱅크","토스뱅크","케이뱅크"].map(b=><option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>계좌번호</label>
                  <input style={{ ...inp, marginBottom:0 }} value={mPayDetail.account||""} onChange={e=>{ const account=e.target.value; setMPayDetail({ ...mPayDetail, account }); syncBankInfoFromForeign(mPayDetail.bank||"", account); }} />
                </div>
                <div>
                  <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>예금주</label>
                  <input style={{ ...inp, marginBottom:0 }} value={mPayDetail.holder||""} onChange={e=>setMPayDetail({ ...mPayDetail, holder:e.target.value })} />
                </div>
              </div>
            )}
            {mPayMethod==="payoneer" && (
              <div>
                <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>Payoneer 등록 이메일</label>
                <input style={{ ...inp, marginBottom:0 }} type="email" placeholder="payee@email.com" value={mPayDetail.email||""} onChange={e=>setMPayDetail({ ...mPayDetail, email:e.target.value })} />
              </div>
            )}
            {mPayMethod==="wise" && (
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr)":"minmax(0,1fr) minmax(0,1fr)", gap:10 }}>
                <div>
                  <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>수취인 이름 (영문)</label>
                  <input style={{ ...inp, marginBottom:0 }} placeholder="Full name" value={mPayDetail.holder||""} onChange={e=>setMPayDetail({ ...mPayDetail, holder:e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>계좌/IBAN 또는 이메일</label>
                  <input style={{ ...inp, marginBottom:0 }} value={mPayDetail.account||""} onChange={e=>setMPayDetail({ ...mPayDetail, account:e.target.value })} />
                </div>
              </div>
            )}
            {mPayMethod==="cash" && (
              <input style={{ ...inp, marginBottom:0 }} placeholder="현금 지급 메모 (선택)" value={mPayDetail.note||""} onChange={e=>setMPayDetail({ ...mPayDetail, note:e.target.value })} />
            )}
            {!mPayMethod && <p style={{ margin:0, fontSize:12, color:C.muted }}>지급 방식을 먼저 선택하세요.</p>}
          </div>

          {/* ── 세무 신고용 정보 (주소 + 외국인등록번호/여권번호) — 비자 정보와 한 화면에서 입력 ── 대표·정산권한자 전용 */}
          {canViewFinance && (()=>{
            const idType = mHasAlienCard ? "arc" : "passport";
            const idLabel = idType==="arc" ? "외국인등록번호" : "여권번호";
            const idPh = idType==="passport" ? "예: M12345678" : "13자리 (- 없이)";
            const masked = selectedModel?.national_id_masked;
            const showInput = !masked || showIdInput || !mEditMode;
            return (
            <div style={{ border:`1px solid ${C.border}`, borderRadius:8, padding:"12px 14px", margin:"0 0 16px", background:C.card2 }}>
              <p style={{ margin:"0 0 3px", fontSize:12, fontWeight:700, color:C.text }}>세무 신고용 정보 <span style={{ fontWeight:500, color:C.muted }}>(원천징수·지급명세서)</span></p>
              <p style={{ margin:"0 0 10px", fontSize:11, color:C.muted }}>🔒 식별번호는 암호화 저장되고 화면엔 마스킹만 표시됩니다 · 대표·정산권한자 전용</p>
              <div style={{ marginBottom:10 }}>
                <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>주소</label>
                <input style={{ ...inp, marginBottom:0 }} value={mAddress} onChange={e=>setMAddress(e.target.value)} placeholder="모델 주소 (지급명세서용)" />
              </div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>{idLabel} <span style={{ color:C.muted }}>({mHasAlienCard?"외국인등록증":"단기체류·여권"})</span></label>
              {showInput ? (
                <span style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
                  <input style={{ ...inp, marginBottom:0, flex:1, minWidth:160 }} value={mNationalId} onChange={e=>{ const v=e.target.value; setMNationalId(v); if(idType!=="passport"){ const f6=v.replace(/[^0-9]/g,"").slice(0,6); if(f6.length===6) setMSSN(f6); } }} placeholder={idPh} autoComplete="off" />
                  {mEditMode && <button type="button" onClick={()=>saveModelNationalId(selectedModel.id)} disabled={!mNationalId.trim()} style={{ ...btnS(C.blue, !mNationalId.trim()), fontSize:12, padding:"8px 14px" }}>저장</button>}
                  {mEditMode && masked && <button type="button" onClick={()=>{ setShowIdInput(false); setMNationalId(""); }} style={{ ...btnS(C.muted), fontSize:12, padding:"8px 12px" }}>취소</button>}
                </span>
              ) : (
                <span style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                  <span style={{ fontFamily:"monospace", fontSize:14, color:C.text, background:C.card, border:`1px solid ${C.border}`, borderRadius:6, padding:"7px 12px" }}>{masked}</span>
                  <button type="button" onClick={()=>{ setShowIdInput(true); setMNationalId(""); }} style={{ ...btnS(C.muted), fontSize:12, padding:"7px 12px" }}>변경</button>
                </span>
              )}
              {!mEditMode && <p style={{ margin:"5px 0 0", fontSize:10, color:C.muted }}>모델 추가 시 함께 암호화 저장됩니다.</p>}
            </div>
            );
          })()}

          <div style={{ display:"flex", gap:10 }}>
            <button onClick={()=>setShowForeignModal(false)} style={{ ...btnS(C.green), flex:1 }}>저장</button>
          </div>
        </Modal>
      )}
      {/* ════ 모달: 고객사 추가 ════ */}
      {showCustomerForm&&(
        <Modal onClose={()=>{setShowCustomerForm(false);resetCustomerForm();}} wide>
          <h3 style={{ marginTop:0, color:C.text }}><Building2 size={17} style={{ verticalAlign:-2, flexShrink:0 }}/> 고객사 추가</h3>
          <BizLicenseUpload onExtracted={applyBizInfo} />
          {/* 사업자등록증 정보 (등록증 업로드 시 자동 입력) */}
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr)":"repeat(3, minmax(0,1fr))", gap:10 }}>
            <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>상호 (고객사명) *</label><input style={inp} value={cName} onChange={e=>setCName(e.target.value)} /></div>
            <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>브랜드명</label><input style={inp} value={cBrand} onChange={e=>setCBrand(e.target.value)} /></div>
            <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>분야</label><CategorySelect value={cCategory} onChange={setCCategory} extra={[...(agency?.client_categories||[]), ...customerCategories]} onAdd={addClientCategory} /></div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr)":"minmax(0,1fr) minmax(0,1fr)", gap:10 }}>
            <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>대표자 (성명)</label><input style={inp} value={cRepName} onChange={e=>setCRepName(e.target.value)} /></div>
            <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>사업자등록번호</label><input style={inp} value={cBizNo} onChange={e=>setCBizNo(e.target.value)} placeholder="000-00-00000" /></div>
          </div>
          <div style={{ marginBottom:10 }}><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>사업장 주소</label><input style={{ ...inp, marginBottom:0 }} value={cAddress} onChange={e=>setCAddress(e.target.value)} /></div>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr)":"minmax(0,1fr) minmax(0,1fr)", gap:10 }}>
            <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>업태</label><input style={inp} value={cBizType} onChange={e=>setCBizType(e.target.value)} /></div>
            <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>종목</label><input style={inp} value={cBizItem} onChange={e=>setCBizItem(e.target.value)} /></div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr)":"minmax(0,1fr) minmax(0,1fr)", gap:10 }}>
            <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>담당자명</label><input style={inp} value={cManager} onChange={e=>setCManager(e.target.value)} /></div>
            <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>전화번호 *</label><input style={inp} type="tel" value={cPhone} onChange={e=>setCPhone(e.target.value)} /></div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr)":"minmax(0,1fr) minmax(0,1fr)", gap:10 }}>
            <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>이메일</label><input style={inp} type="email" value={cEmail} onChange={e=>setCEmail(e.target.value)} /></div>
            <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>계산서 발송 이메일</label><input style={inp} type="email" value={cTaxEmail} onChange={e=>setCTaxEmail(e.target.value)} placeholder="tax@company.com" /></div>
          </div>
          <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>메모</label>
          <textarea style={{ ...inp, height:60, resize:"none" }} value={cMemo} onChange={e=>setCMemo(e.target.value)} placeholder="특이사항" />
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={handleAddCustomer} style={{ ...btnS(C.green), flex:1 }}>추가</button>
          </div>
        </Modal>
      )}

      {/* ════ 모달: 정산 내역서 (월별/기간별 + 엑셀) ════ */}
      {showStatement && (
        <SettlementStatementModal bookings={bookings} models={models} customers={customers} agency={agency} canViewFinance={canViewFinance} isMobile={isMobile} onClose={()=>setShowStatement(false)} />
      )}

      {/* ════ 모달: 컴카드 (모델 DB 상세에서 열기) ════ */}
      {compModel && (
        <CompCardModal model={compModel} agency={agency} onClose={()=>setCompModel(null)}
          onSave={async (compcard)=>{
            await sb("models","PATCH",{ compcard }, `?id=eq.${compModel.id}`);
            setModels(models.map(m=>m.id===compModel.id?{...m,compcard}:m));
            setCompModel((c:any)=>c?{...c,compcard}:c);
          }} />
      )}

      {/* ════ 모달: 대량 등록 (모델·고객사 공용) ════ */}
      {bulkEntity && (
        <BulkUploadModal
          entity={bulkEntity}
          isMobile={isMobile}
          existingKeys={new Map((bulkEntity==="model"?models:customers).map((x:any)=>[
            bulkEntity==="model"
              ? makeModelId(x.name||"", x.ssn6||"")
              : makeClientId(x.name||"", String(x.phone||"").replace(/[^0-9]/g,"").slice(-4)),
            x.id,
          ]))}
          onClose={()=>setBulkEntity(null)}
          onCommit={(items)=>handleBulkCommit(bulkEntity, items)}
        />
      )}


      {/* ════ 모달: 프로젝트 섭외 추가 ════ */}
      {showProjectForm&&(
        <Modal onClose={()=>{ setShowProjectForm(false); resetProjectForm(); }} wide>
          <h3 style={{ marginTop:0, color:C.text }}><FolderOpen size={17} style={{ verticalAlign:-2, flexShrink:0 }}/> 프로젝트 섭외 추가</h3>
          <p style={{ margin:"0 0 14px", fontSize:12, color:C.muted }}>공통 촬영 정보를 입력하고, 모델별 개별 금액을 설정합니다.</p>

          {/* 모델 (첫 항목) */}
          <div style={{ background:C.card2, border:`1px solid ${C.blue}40`, borderRadius:10, padding:14, marginBottom:14 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <p style={{ margin:0, fontWeight:700, fontSize:13, color:C.blue }}><Users size={12} style={{ verticalAlign:-2, flexShrink:0 }}/> 섭외 모델 ({pModelLines.length}명)</p>
              {pModelLines.length>0 ? <span style={{ fontSize:11, color:C.muted }}>모델별 개별 금액 설정</span> : null}
            </div>

            {/* 모델 검색 */}
            <div style={{ marginBottom: pModelLines.length>0 ? 12 : 0 }}>
              <input style={{ ...inp, marginBottom:0 }} placeholder="모델 검색 후 클릭으로 추가..." value={pModelSearch} onChange={e=>setPModelSearch(e.target.value)} />
              {pModelSearch ? (
                <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, maxHeight:150, overflowY:"auto", marginTop:2 }}>
                  {models.filter(m=>m.name.toLowerCase().includes(pModelSearch.toLowerCase())&&!pModelLines.find(l=>l.modelId===m.id)).length===0
                    ? <div onClick={async()=>{ const id=await quickAddModel(pModelSearch); if(id){ addProjectModelLine(id); setPModelSearch(""); } }} style={{ padding:"9px 14px", cursor:"pointer", color:C.blue, fontSize:13, fontWeight:700 }}>+ "{pModelSearch.trim()}" 새 모델 등록 후 추가</div>
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
                          {m.is_foreigner ? <span style={{ fontSize:11, color:C.yellow, marginLeft:6 }}><Plane size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> {visaDday(m.visa_exit)}</span> : null}
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
                      {/* 모델별 일정·장소 (기본=프로젝트 공통, 개별 변경 가능) */}
                      <div style={{ background:C.card2, borderRadius:8, padding:"8px 10px", marginBottom:bt.hasContract?10:0 }}>
                        <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr)":"minmax(0,1fr) minmax(0,1fr)", gap:8, marginBottom:8 }}>
                          <div>
                            <label style={{ fontSize:10, color:C.muted, display:"block", marginBottom:3 }}>촬영일</label>
                            <input type="date" style={{ ...inp, marginBottom:0, padding:"5px 8px", fontSize:12 }} value={line.date} onChange={e=>updateProjectModelLine(line.modelId,"date",e.target.value)} />
                          </div>
                          <div>
                            <label style={{ fontSize:10, color:C.muted, display:"block", marginBottom:3 }}>촬영 장소</label>
                            <input style={{ ...inp, marginBottom:0, padding:"5px 8px", fontSize:12 }} value={line.location} onChange={e=>updateProjectModelLine(line.modelId,"location",e.target.value)} placeholder="예: 스튜디오 A" />
                          </div>
                        </div>
                        <div style={{ display:"flex", alignItems:"flex-end", gap:12, flexWrap:"wrap" }}>
                          <TimePicker label="시작" value={line.start} onChange={v=>updateProjectModelLine(line.modelId,"start",v)} />
                          <span style={{ color:C.muted, fontSize:12, paddingBottom:6 }}>~</span>
                          <TimePicker label="종료" value={line.end} onChange={v=>updateProjectModelLine(line.modelId,"end",v)} />
                        </div>
                      </div>
                      {bt.hasContract ? (
                        <MoneyInput label="계약 총액 (이 모델)" value={line.fee} onChange={v=>updateProjectModelLine(line.modelId,"fee",v)} />
                      ) : null}
                    </div>
                  );
                })}
                {BOOKING_TYPES[pBookingType]?.hasContract ? (()=>{
                  const totalFee=pModelLines.reduce((s,l)=>s+l.fee,0);
                  const bal=Math.max(0,totalFee-pDeposit);
                  return (
                  <div style={{ background:C.card2, borderRadius:8, padding:"12px 14px" }}>
                    <p style={{ margin:"0 0 10px", fontSize:12, fontWeight:700, color:C.yellow }}><Coins size={12} style={{ verticalAlign:-2, flexShrink:0 }}/> 계약금 / 잔금 (프로젝트 전체)</p>
                    <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr)":"minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)", gap:10 }}>
                      <div>
                        <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>총 계약 (자동)</label>
                        <div style={{ ...inp, marginBottom:0, display:"flex", alignItems:"center", color:"#c9a96e", fontWeight:700 }}>{totalFee.toLocaleString()}원</div>
                      </div>
                      <MoneyInput label="계약금" value={pDeposit} onChange={setPDeposit} />
                      <div>
                        <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>잔금 (자동)</label>
                        <div style={{ ...inp, marginBottom:0, display:"flex", alignItems:"center", color:C.text, fontWeight:700 }}>{bal.toLocaleString()}원</div>
                      </div>
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr)":"minmax(0,1fr) minmax(0,1fr)", gap:10, marginTop:4 }}>
                      <div>
                        <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>계약금 입금 예정일</label>
                        <input style={inp} type="date" value={pDepositDue} onChange={e=>setPDepositDue(e.target.value)} />
                      </div>
                      <div>
                        <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>잔금 입금 예정일</label>
                        <input style={inp} type="date" value={pBalanceDue} onChange={e=>setPBalanceDue(e.target.value)} />
                      </div>
                    </div>
                  </div>
                  );
                })() : null}
              </div>
            ) : (
              <p style={{ textAlign:"center", color:C.muted, fontSize:12, margin:"12px 0 0", padding:"12px 0", borderTop:`1px dashed ${C.border}` }}>
                위 검색창에서 모델을 추가하세요
              </p>
            )}
          </div>

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
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr)":"minmax(0,1fr) minmax(0,1fr)", gap:10, marginBottom:10 }}>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>프로젝트명 *</label>
              <input style={inp} placeholder="예) 2026 SS 룩북" value={pName} onChange={e=>setPName(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>고객사 * {pCustomer ? <span style={{ color:C.green }}>✓</span> : null}</label>
              <input style={inp} placeholder="고객사 검색..." value={pCustSearch} onChange={e=>{ setPCustSearch(e.target.value); setPCustomer(""); }} />
              {pCustSearch&&!pCustomer&&(
                <div style={{ background:C.card2, border:`1px solid ${C.border}`, borderRadius:8, maxHeight:130, overflowY:"auto", marginTop:-8 }}>
                  {customers.filter(c=>c.name.toLowerCase().includes(pCustSearch.toLowerCase())).length===0
                    ? <div onClick={async()=>{ const id=await quickAddCustomer(pCustSearch); if(id){ setPCustomer(id); setPCustSearch(pCustSearch.trim()); } }} style={{ padding:"8px 12px", cursor:"pointer", fontSize:13, color:C.blue, fontWeight:700 }}>+ "{pCustSearch.trim()}" 새 고객사 등록</div>
                    : customers.filter(c=>c.name.toLowerCase().includes(pCustSearch.toLowerCase())).map(c=>(
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

          {/* 담당자 + 상태 (장소·일정은 모델별로 설정) */}
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr)":"minmax(0,1fr) minmax(0,1fr)", gap:10, marginBottom:10 }}>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>담당자</label>
              <select style={inp} value={pManager} onChange={e=>setPManager(e.target.value)}>
                <option value="">선택</option>
                {members.map(m=><option key={m.id} value={m.name}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>초기 상태</label>
              <select style={inp} value={pStatus} onChange={e=>setPStatus(e.target.value)}>
                {statusOptionsForType(pBookingType).filter(([k])=>!["COMPLETED","SETTLED","CANCELLED"].includes(k)).map(([k,l])=>(
                  <option key={k} value={k}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 촬영 유형: 1차 사진/영상 → 2차 세부 (단일 폼과 동일) */}
          {pBookingType==="SHOOT" ? (
            <div style={{ marginBottom:10 }}>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:6 }}>촬영 유형 (복수 선택 가능)</label>
              <div style={{ display:"flex", gap:6, marginBottom:pMedia.length>0?8:0 }}>
                {[{ k:"사진", I:Camera, col:C.blue, opts:SHOOT_TYPES_PHOTO },{ k:"영상", I:Clapperboard, col:C.purple, opts:SHOOT_TYPES_VIDEO }].map(({k,I,col,opts})=>(
                  <button key={k} type="button" onClick={()=>{
                    if (pMedia.includes(k)) { setPMedia(pMedia.filter(v=>v!==k)); setPShootTypes(pShootTypes.filter(t=>!opts.includes(t))); }
                    else setPMedia([...pMedia, k]);
                  }} style={{ padding:"6px 16px", border:`1px solid ${pMedia.includes(k)?col:C.border}`, borderRadius:8, fontSize:12, cursor:"pointer", background:pMedia.includes(k)?col+"22":"var(--c-card2)", color:pMedia.includes(k)?col:C.textSub, fontWeight:pMedia.includes(k)?700:500 }}>
                    <I size={12} style={{ verticalAlign:-2, flexShrink:0 }}/> {k}
                  </button>
                ))}
              </div>
              {pMedia.includes("사진")&&(
                <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:pMedia.includes("영상")?6:0 }}>
                  {SHOOT_TYPES_PHOTO.map(opt=>(
                    <button key={opt} type="button" onClick={()=>setPShootTypes(prev=>prev.includes(opt)?prev.filter(x=>x!==opt):[...prev,opt])} style={{ padding:"5px 12px", border:`1px solid ${pShootTypes.includes(opt)?C.blue:C.border}`, borderRadius:20, fontSize:12, cursor:"pointer", background:pShootTypes.includes(opt)?C.blue+"22":"var(--c-card2)", color:pShootTypes.includes(opt)?C.blue:C.textSub, fontWeight:pShootTypes.includes(opt)?700:400 }}>{opt}</button>
                  ))}
                </div>
              )}
              {pMedia.includes("영상")&&(
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  {SHOOT_TYPES_VIDEO.map(opt=>(
                    <button key={opt} type="button" onClick={()=>setPShootTypes(prev=>prev.includes(opt)?prev.filter(x=>x!==opt):[...prev,opt])} style={{ padding:"5px 12px", border:`1px solid ${pShootTypes.includes(opt)?C.purple:C.border}`, borderRadius:20, fontSize:12, cursor:"pointer", background:pShootTypes.includes(opt)?C.purple+"22":"var(--c-card2)", color:pShootTypes.includes(opt)?C.purple:C.textSub, fontWeight:pShootTypes.includes(opt)?700:400 }}>{opt}</button>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {/* 사용 범위 + 기간 (단일 폼과 동일) */}
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr)":"minmax(0,3fr) minmax(0,2fr)", gap:12 }}>
            <MultiCheck label="사용 범위" options={USAGE_SCOPES} value={pUsageScope} onChange={setPUsageScope} />
            <div style={{ marginBottom:10 }}>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:6 }}>사용 기간</label>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {USAGE_PERIODS.map(pp=>(
                  <button key={pp} type="button" onClick={()=>setPUsagePeriod(pUsagePeriod===pp?"":pp)} style={{ padding:"5px 14px", border:`1px solid ${pUsagePeriod===pp?C.green:C.border}`, borderRadius:20, fontSize:12, cursor:"pointer", background:pUsagePeriod===pp?C.green+"22":"var(--c-card2)", color:pUsagePeriod===pp?C.green:C.textSub, fontWeight:pUsagePeriod===pp?700:400 }}>{pp}</button>
                ))}
              </div>
            </div>
          </div>
          {/* 사용 국가 */}
          <div style={{ marginBottom:10 }}>
            <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:6 }}>사용 국가</label>
            <div style={{ display:"flex", gap:6 }}>
              {USAGE_REGIONS.map(r=>(
                <button key={r} type="button" onClick={()=>setPUsageRegion(r)} style={{ padding:"5px 18px", border:`1px solid ${pUsageRegion===r?C.blue:C.border}`, borderRadius:20, fontSize:12, cursor:"pointer", background:pUsageRegion===r?C.blue+"22":"var(--c-card2)", color:pUsageRegion===r?C.blue:C.textSub, fontWeight:pUsageRegion===r?700:400 }}>{r}</button>
              ))}
            </div>
          </div>

          {/* 촬영 레퍼런스 (프로젝트 전체 공통 적용) */}
          <div style={{ marginBottom:10 }}>
            <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:6 }}><Camera size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> 촬영 레퍼런스 (이미지 8장 · 영상 링크 2개 · 모든 모델 공통)</label>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {pRefImages.map((src,i)=>(
                <div key={i} style={{ position:"relative" }}>
                  <img src={src} alt="" onClick={()=>setLightboxSrc(src)}
                    style={{ width:42, height:42, objectFit:"cover", borderRadius:6, border:`1px solid ${C.border}`, cursor:"zoom-in", transition:"transform 0.15s", position:"relative" }}
                    onMouseEnter={e=>{e.currentTarget.style.transform="scale(2.2)";e.currentTarget.style.zIndex="60";}}
                    onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)";e.currentTarget.style.zIndex="0";}}
                  />
                  <span onClick={()=>setPRefImages(pRefImages.filter((_,x)=>x!==i))} style={{ position:"absolute", top:-5, right:-5, width:15, height:15, borderRadius:"50%", background:C.red, color:"white", fontSize:10, lineHeight:"15px", textAlign:"center", cursor:"pointer", zIndex:70 }}>×</span>
                </div>
              ))}
              {pRefImages.length<8&&(
                <label style={{ width:42, height:42, border:`1px dashed ${C.border}`, borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:C.muted, fontSize:18 }}>
                  +
                  <input type="file" accept="image/*" multiple style={{ display:"none" }} onChange={e=>{ addRefsToProject(e.target.files); e.target.value=""; }} />
                </label>
              )}
            </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:6 }}>
                {pRefVideos.map((u,i)=>(
                  <span key={i} style={{ display:"inline-flex", alignItems:"center", gap:5, background:C.purple+"18", border:`1px solid ${C.purple}44`, borderRadius:14, padding:"3px 10px", fontSize:11, color:C.purple, fontWeight:600 }}>
                    <Clapperboard size={11} style={{ flexShrink:0 }}/>
                    <a href={u} target="_blank" rel="noreferrer" style={{ color:C.purple, textDecoration:"none" }}>영상 {i+1}</a>
                    <span onClick={()=>setPRefVideos(pRefVideos.filter((_,x)=>x!==i))} style={{ cursor:"pointer", color:C.muted }}>×</span>
                  </span>
                ))}
                {pRefVideos.length<2&&(
                  <button type="button" onClick={()=>{ const u=promptVideoUrl(); if(u) setPRefVideos([...pRefVideos, u]); }} style={{ background:"transparent", border:`1px dashed ${C.border}`, borderRadius:14, padding:"3px 10px", fontSize:11, color:C.muted, cursor:"pointer" }}>+ 영상 링크</button>
                )}
              </div>
          </div>

          {/* 메모 */}
          <div style={{ marginBottom:10 }}>
            <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>메모</label>
            <textarea style={{ ...inp, minHeight:56, resize:"vertical" as const }} placeholder="특이사항, 요청사항..." value={pMemo} onChange={e=>setPMemo(e.target.value)} />
          </div>


          <div style={{ display:"flex", gap:10 }}>
            <button onClick={handleAddProject} style={{ ...btnS(C.green), flex:2, fontWeight:800 }}>
              <FolderOpen size={13} style={{ verticalAlign:-2, flexShrink:0 }}/> 프로젝트 등록 {pModelLines.length>0 ? `(모델 ${pModelLines.length}명)` : ""}
            </button>
          </div>
        </Modal>
      )}


      {/* ════ 모달: 섭외 추가 방식 선택 ════ */}
      {showAddPicker&&(
        <Modal onClose={()=>setShowAddPicker(false)}>
          <h3 style={{ marginTop:0, color:C.text }}>섭외 추가</h3>
          <p style={{ margin:"0 0 16px", fontSize:12, color:C.muted }}>추가할 섭외 유형을 선택하세요.{addPrefill.date?` (${fmtDate(addPrefill.date)})`:""}</p>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr)":"minmax(0,1fr) minmax(0,1fr)", gap:12 }}>
            <button onClick={()=>{
              resetBookingForm();
              if(addPrefill.model){ const m=models.find(mm=>mm.id===addPrefill.model); setBModel(addPrefill.model); setBModelSearch(m?.name||""); }
              if(addPrefill.date) setBDate(addPrefill.date);
              setShowAddPicker(false); setShowBookingForm(true);
            }} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8, padding:"22px 14px", borderRadius:12, border:`1px solid ${C.border}`, background:C.card2, color:C.text, cursor:"pointer", transition:"border-color 0.15s" }}
              onMouseEnter={e=>(e.currentTarget.style.borderColor=C.blue)} onMouseLeave={e=>(e.currentTarget.style.borderColor=C.border)}>
              <ClipboardList size={26} color={C.blue} strokeWidth={1.8} />
              <span style={{ fontSize:14, fontWeight:700 }}>단일 섭외</span>
              <span style={{ fontSize:11, color:C.muted }}>모델 1명</span>
            </button>
            <button onClick={()=>{
              resetProjectForm();
              if(addPrefill.date) setPDate(addPrefill.date);
              setShowAddPicker(false); setShowProjectForm(true);
            }} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8, padding:"22px 14px", borderRadius:12, border:`1px solid ${C.border}`, background:C.card2, color:C.text, cursor:"pointer", transition:"border-color 0.15s" }}
              onMouseEnter={e=>(e.currentTarget.style.borderColor=C.green)} onMouseLeave={e=>(e.currentTarget.style.borderColor=C.border)}>
              <FolderOpen size={26} color={C.green} strokeWidth={1.8} />
              <span style={{ fontSize:14, fontWeight:700 }}>프로젝트 섭외</span>
              <span style={{ fontSize:11, color:C.muted }}>모델 여러 명</span>
            </button>
          </div>
        </Modal>
      )}

      {/* ════ 모달: 단일 섭외 추가 ════ */}
      {showBookingForm&&(
        <Modal onClose={()=>{setShowBookingForm(false);resetBookingForm();}} wide>
          <h3 style={{ marginTop:0, color:C.text }}><ClipboardList size={17} style={{ verticalAlign:-2, flexShrink:0 }}/> 단일 섭외 추가</h3>

          {/* 모델 (첫 항목) */}
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
                <input style={inp} placeholder="모델 이름 검색..." value={bModelSearch} onChange={e=>{ setBModelSearch(e.target.value); setBModel(""); }} />
                {bModelSearch&&(
                  <div style={{ background:C.card2, border:`1px solid ${C.border}`, borderRadius:8, maxHeight:160, overflowY:"auto", marginTop:-8, marginBottom:10 }}>
                    {models.filter(m=>m.name.toLowerCase().includes(bModelSearch.toLowerCase())).length===0
                      ? <div onClick={async()=>{ const id=await quickAddModel(bModelSearch); if(id){ setBModel(id); setBModelSearch(bModelSearch.trim()); } }} style={{ padding:"10px 14px", cursor:"pointer", color:C.blue, fontSize:13, fontWeight:700 }}>+ "{bModelSearch.trim()}" 새 모델 등록</div>
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
          {/* 프로젝트명 + 고객사 (프로젝트 폼과 동일) */}
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr)":"minmax(0,1fr) minmax(0,1fr)", gap:10 }}>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>프로젝트명</label>
              <input style={inp} value={bProject} onChange={e=>setBProject(e.target.value)} />
            </div>
            <div>
            <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>고객사 * {bCustomer&&<span style={{ color:C.green }}>✓ {customers.find(c=>c.id===bCustomer)?.name}</span>}</label>
            <input style={inp} placeholder="고객사 이름 검색..." value={bCustomerSearch} onChange={e=>{ setBCustomerSearch(e.target.value); setBCustomer(""); }} />
            {bCustomerSearch&&!bCustomer&&(
              <div style={{ background:C.card2, border:`1px solid ${C.border}`, borderRadius:8, maxHeight:160, overflowY:"auto", marginTop:-8, marginBottom:10 }}>
                {customers.filter(c=>c.name.toLowerCase().includes(bCustomerSearch.toLowerCase())||c.brand?.toLowerCase().includes(bCustomerSearch.toLowerCase())).length===0
                  ? <div onClick={async()=>{ const id=await quickAddCustomer(bCustomerSearch); if(id){ setBCustomer(id); setBCustomerSearch(bCustomerSearch.trim()); } }} style={{ padding:"10px 14px", cursor:"pointer", color:C.blue, fontSize:13, fontWeight:700 }}>+ "{bCustomerSearch.trim()}" 새 고객사 등록</div>
                  : customers.filter(c=>c.name.toLowerCase().includes(bCustomerSearch.toLowerCase())||c.brand?.toLowerCase().includes(bCustomerSearch.toLowerCase())).map(c=>(
                    <div key={c.id} onClick={()=>{ setBCustomer(c.id); setBCustomerSearch(c.name); }} style={{ padding:"10px 14px", cursor:"pointer", display:"flex", alignItems:"center", gap:8, borderBottom:`1px solid ${C.border}` }}
                      onMouseEnter={e=>(e.currentTarget.style.background=C.sideHover)}
                      onMouseLeave={e=>(e.currentTarget.style.background="transparent")}
                    >
                      <span style={{ fontWeight:700, color:C.text }}>{c.name}</span>
                      {c.brand&&<span style={{ fontSize:11, color:C.muted }}>{c.brand}</span>}
                      {c.category&&<span style={{ fontSize:11, color:C.muted }}>{c.category}</span>}
                    </div>
                  ))
                }
              </div>
            )}
            </div>
          </div>

          {/* 날짜 + 시간 */}
          <div style={{ background:C.card2, borderRadius:8, padding:"10px 12px", marginBottom:10 }}>
            <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:6 }}><Calendar size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> 촬영 일정</label>
            <input style={{ ...inp, marginBottom:8, padding:"6px 10px", fontSize:12 }} type="date" value={bDate} onChange={e=>setBDate(e.target.value)} />
            {(()=>{ const _vi = (bModel && bDate) ? visaViolation(models.find(m=>m.id===bModel), bDate) : null; return _vi ? (
              <div style={{ background:C.red+"14", border:`1px solid ${C.red}55`, borderRadius:8, padding:"8px 10px", marginBottom:8, fontSize:12, color:C.red, lineHeight:1.45 }}>
                <strong style={{ fontWeight:800 }}>🚫 비자 만료 — 이 날짜에는 섭외할 수 없습니다</strong><br/>{_vi}
              </div>
            ) : null; })()}
            <div style={{ display:"flex", alignItems:"flex-end", gap:16, flexWrap:"wrap" }}>
              <TimePicker label="시작" value={bStart} onChange={setBStart} />
              <span style={{ color:C.muted, fontSize:13, paddingBottom:6 }}>~</span>
              <TimePicker label="종료" value={bEnd}   onChange={setBEnd}   />
            </div>
          </div>

          {/* 장소 + 담당자 + 상태 (프로젝트 폼과 동일) */}
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr)":"minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)", gap:10 }}>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>촬영 장소</label>
              <input style={inp} value={bLocation} onChange={e=>setBLocation(e.target.value)} placeholder="예: 스튜디오 A" />
            </div>
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
                {statusOptionsForType(bBookingType, bStatus).map(([k,l])=>(
                  <option key={k} value={k}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 촬영 유형: 1차 사진/영상 → 2차 세부 */}
          <div style={{ marginBottom:10 }}>
            <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:6 }}>촬영 유형 (복수 선택 가능)</label>
            <div style={{ display:"flex", gap:6, marginBottom:bMedia.length>0?8:0 }}>
              {[{ k:"사진", I:Camera, col:C.blue, opts:SHOOT_TYPES_PHOTO },{ k:"영상", I:Clapperboard, col:C.purple, opts:SHOOT_TYPES_VIDEO }].map(({k,I,col,opts})=>(
                <button key={k} type="button" onClick={()=>{
                  if (bMedia.includes(k)) { setBMedia(bMedia.filter(v=>v!==k)); setBShootTypes(bShootTypes.filter(t=>!opts.includes(t))); }
                  else setBMedia([...bMedia, k]);
                }} style={{ padding:"6px 16px", border:`1px solid ${bMedia.includes(k)?col:C.border}`, borderRadius:8, fontSize:12, cursor:"pointer", background:bMedia.includes(k)?col+"22":"var(--c-card2)", color:bMedia.includes(k)?col:C.textSub, fontWeight:bMedia.includes(k)?700:500 }}>
                  <I size={12} style={{ verticalAlign:-2, flexShrink:0 }}/> {k}
                </button>
              ))}
            </div>
            {bMedia.includes("사진")&&(
              <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:bMedia.includes("영상")?6:0 }}>
                {SHOOT_TYPES_PHOTO.map(opt=>(
                  <button key={opt} type="button" onClick={()=>{const next=bShootTypes.includes(opt)?bShootTypes.filter(v=>v!==opt):[...bShootTypes,opt];setBShootTypes(next);}} style={{ padding:"5px 12px", border:`1px solid ${bShootTypes.includes(opt)?C.blue:C.border}`, borderRadius:20, fontSize:12, cursor:"pointer", background:bShootTypes.includes(opt)?C.blue+"22":"var(--c-card2)", color:bShootTypes.includes(opt)?C.blue:C.textSub, fontWeight:bShootTypes.includes(opt)?700:400 }}>{opt}</button>
                ))}
              </div>
            )}
            {bMedia.includes("영상")&&(
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {SHOOT_TYPES_VIDEO.map(opt=>(
                  <button key={opt} type="button" onClick={()=>{const next=bShootTypes.includes(opt)?bShootTypes.filter(v=>v!==opt):[...bShootTypes,opt];setBShootTypes(next);}} style={{ padding:"5px 12px", border:`1px solid ${bShootTypes.includes(opt)?C.purple:C.border}`, borderRadius:20, fontSize:12, cursor:"pointer", background:bShootTypes.includes(opt)?C.purple+"22":"var(--c-card2)", color:bShootTypes.includes(opt)?C.purple:C.textSub, fontWeight:bShootTypes.includes(opt)?700:400 }}>{opt}</button>
                ))}
              </div>
            )}
          </div>

          {/* 사용 범위 + 기간 (2열) */}
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr)":"minmax(0,3fr) minmax(0,2fr)", gap:12 }}>
            <MultiCheck label="사용 범위" options={USAGE_SCOPES} value={bUsageScope} onChange={setBUsageScope} />
            <div style={{ marginBottom:10 }}>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:6 }}>사용 기간</label>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {USAGE_PERIODS.map(p=>(
                  <button key={p} type="button" onClick={()=>setBUsagePeriod(bUsagePeriod===p?"":p)} style={{ padding:"5px 14px", border:`1px solid ${bUsagePeriod===p?C.green:C.border}`, borderRadius:20, fontSize:12, cursor:"pointer", background:bUsagePeriod===p?C.green+"22":"var(--c-card2)", color:bUsagePeriod===p?C.green:C.textSub, fontWeight:bUsagePeriod===p?700:400 }}>{p}</button>
                ))}
              </div>
            </div>
          </div>
          {/* 사용 국가 */}
          <div style={{ marginBottom:10 }}>
            <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:6 }}>사용 국가</label>
            <div style={{ display:"flex", gap:6 }}>
              {USAGE_REGIONS.map(r=>(
                <button key={r} type="button" onClick={()=>setBUsageRegion(r)} style={{ padding:"5px 18px", border:`1px solid ${bUsageRegion===r?C.blue:C.border}`, borderRadius:20, fontSize:12, cursor:"pointer", background:bUsageRegion===r?C.blue+"22":"var(--c-card2)", color:bUsageRegion===r?C.blue:C.textSub, fontWeight:bUsageRegion===r?700:400 }}>{r}</button>
              ))}
            </div>
          </div>

          {/* 촬영 레퍼런스 (프로젝트 폼과 동일 위치) */}
          <div style={{ marginBottom:10 }}>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}><Camera size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> 촬영 레퍼런스 (이미지 8장 · 영상 링크 2개)</label>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {bRefImages.map((src,i)=>(
                  <div key={i} style={{ position:"relative" }}>
                    <img src={src} alt="" onClick={()=>setLightboxSrc(src)}
                      style={{ width:42, height:42, objectFit:"cover", borderRadius:6, border:`1px solid ${C.border}`, cursor:"zoom-in", transition:"transform 0.15s", position:"relative" }}
                      onMouseEnter={e=>{e.currentTarget.style.transform="scale(2.2)";e.currentTarget.style.zIndex="60";}}
                      onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)";e.currentTarget.style.zIndex="0";}}
                    />
                    <span onClick={()=>setBRefImages(bRefImages.filter((_,x)=>x!==i))} style={{ position:"absolute", top:-5, right:-5, width:15, height:15, borderRadius:"50%", background:C.red, color:"white", fontSize:10, lineHeight:"15px", textAlign:"center", cursor:"pointer", zIndex:70 }}>×</span>
                  </div>
                ))}
                {bRefImages.length<8&&(
                  <label style={{ width:42, height:42, border:`1px dashed ${C.border}`, borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:C.muted, fontSize:18 }}>
                    +
                    <input type="file" accept="image/*" multiple style={{ display:"none" }} onChange={e=>{ addRefImages(e.target.files); e.target.value=""; }} />
                  </label>
                )}
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:6 }}>
                {bRefVideos.map((u,i)=>(
                  <span key={i} style={{ display:"inline-flex", alignItems:"center", gap:5, background:C.purple+"18", border:`1px solid ${C.purple}44`, borderRadius:14, padding:"3px 10px", fontSize:11, color:C.purple, fontWeight:600 }}>
                    <Clapperboard size={11} style={{ flexShrink:0 }}/>
                    <a href={u} target="_blank" rel="noreferrer" style={{ color:C.purple, textDecoration:"none" }}>영상 {i+1}</a>
                    <span onClick={()=>setBRefVideos(bRefVideos.filter((_,x)=>x!==i))} style={{ cursor:"pointer", color:C.muted }}>×</span>
                  </span>
                ))}
                {bRefVideos.length<2&&(
                  <button type="button" onClick={()=>{ const u=promptVideoUrl(); if(u) setBRefVideos([...bRefVideos, u]); }} style={{ background:"transparent", border:`1px dashed ${C.border}`, borderRadius:14, padding:"3px 10px", fontSize:11, color:C.muted, cursor:"pointer" }}>+ 영상 링크</button>
                )}
              </div>
          </div>

          {/* 메모 */}
          <div style={{ marginBottom:10 }}>
            <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>메모</label>
            <textarea style={{ ...inp, height:60, resize:"none", marginBottom:0 }} placeholder="특이사항" value={bMemo} onChange={e=>setBMemo(e.target.value)} />
          </div>

          {/* 금액 — 촬영 타입만 표시 */}
          {BOOKING_TYPES[bBookingType]?.hasContract&&(
          <div style={{ background:C.card2, borderRadius:8, padding:14, marginBottom:10 }}>
            {(()=>{ const m=models.find(mm=>mm.id===bModel); if(!m) return null; const f=(v:any)=>Number(v)>0?Number(v).toLocaleString("ko-KR")+"원":"-"; return (
              <div style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap", marginBottom:12, padding:"8px 12px", background:C.card, borderRadius:6, border:`1px solid ${C.border}`, fontSize:12 }}>
                <span style={{ color:"#c9a96e", fontWeight:800 }}>모델료</span>
                <span style={{ color:C.muted }}>Day <b style={{ color:C.text, fontWeight:700 }}>{f(m.fee_day)}</b></span>
                <span style={{ color:C.muted }}>Half day <b style={{ color:C.text, fontWeight:700 }}>{f(m.fee_half)}</b></span>
                <span style={{ color:C.muted }}>Hour <b style={{ color:C.text, fontWeight:700 }}>{f(m.fee_hour)}</b></span>
              </div>
            ); })()}
            <p style={{ margin:"0 0 12px", fontSize:12, fontWeight:700, color:C.yellow }}><Coins size={12} style={{ verticalAlign:-2, flexShrink:0 }}/> 계약 금액</p>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr)":"minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)", gap:10, alignItems:"end" }}>
              <MoneyInput label="계약 총액" value={bBudget}  onChange={v=>{ setBBudget(v);  setBBalance(Math.max(0, v - bDeposit)); }} />
              <MoneyInput label="계약금"    value={bDeposit} onChange={v=>{ setBDeposit(v); setBBalance(Math.max(0, bBudget - v)); }} />
              <div style={{ marginBottom:10 }}>
                <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>잔금 <span style={{ color:C.blue, fontSize:10 }}>(자동계산)</span></label>
                <div style={{ background:"#1a1e2e", border:`1px solid ${C.blue}40`, borderRadius:6, padding:"9px 10px", fontSize:13, fontWeight:700, color:C.blue }}>
                  {Math.max(0, bBudget - bDeposit).toLocaleString()}원
                </div>
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"minmax(0,1fr)":"minmax(0,1fr) minmax(0,1fr)", gap:10, marginTop:4 }}>
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


          <div style={{ display:"flex", gap:10 }}>
            {(()=>{ const _vi = (bModel && bDate) ? visaViolation(models.find(m=>m.id===bModel), bDate) : null; return (
              <button onClick={handleAddBooking} disabled={!!_vi} title={_vi||""} style={{ ...btnS(C.green, !!_vi), flex:1 }}>{_vi ? "비자 만료 — 섭외 불가" : "추가"}</button>
            ); })()}
          </div>
        </Modal>
      )}

      {/* ════ 모달: 담당자 추가 ════ */}
      {showMemberForm&&(
        <Modal onClose={()=>setShowMemberForm(false)}>
          <h3 style={{ marginTop:0, color:C.text }}><Users size={17} style={{ verticalAlign:-2, flexShrink:0 }}/> 담당자 추가</h3>
          <p style={{ fontSize:12, color:C.muted, marginTop:0 }}><strong style={{ color:C.text }}>{agency.name}</strong> 소속으로 추가됩니다.</p>
          <input style={inp} type="text"     placeholder="이름 *"                   value={memName}  onChange={e=>setMemName(e.target.value)}  />
          <input style={inp} type="text"     placeholder="직위 (예: 매니저)"          value={memPos}   onChange={e=>setMemPos(e.target.value)}   />
          <input style={inp} type="tel"      placeholder="전화번호"                  value={memPhone} onChange={e=>setMemPhone(e.target.value)} />
          <input style={inp} type="email"    placeholder="이메일 *"                  value={memEmail} onChange={e=>setMemEmail(e.target.value)} />
          <input style={inp} type="password" placeholder="초기 비밀번호 (6자 이상) *" value={memPw}    onChange={e=>setMemPw(e.target.value)}    />
          <p style={{ fontSize:11, color:C.muted, margin:"-4px 0 12px" }}><Lightbulb size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> 비밀번호는 담당자에게 별도 전달하세요</p>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={handleAddMember} style={{ ...btnS(C.green), flex:1 }}>추가</button>
            <button onClick={()=>setShowMemberForm(false)} style={{ ...btnS("#333"), flex:1 }}>취소</button>
          </div>
        </Modal>
      )}

      {/* ════ 라이트박스 (레퍼런스 확대) ════ */}
      {lightboxSrc&&(
        <div onClick={()=>setLightboxSrc(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.88)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:2000, cursor:"zoom-out" }}>
          <CloseButton onClose={()=>setLightboxSrc(null)} fixed />
          <img src={lightboxSrc} alt="" style={{ maxWidth:"min(900px, 92vw)", maxHeight:"min(900px, 92vh)", borderRadius:10, boxShadow:"0 20px 60px rgba(0,0,0,0.5)" }} />
        </div>
      )}
    </div>
  );
}
