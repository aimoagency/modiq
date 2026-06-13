import React from "react";
import { useState, useEffect, useMemo } from "react";
import { C, inp, btnS } from "./theme";
import {
  APP_VERSION, SESSION_KEY, STATUS, BOOKING_TYPES,
  PLAN_FEATURES, PLANS, getTotalMemberLimit,
  MODEL_CATEGORIES, MODEL_FIELDS, HAIR_LENGTHS, EYE_COLORS, CLIENT_INDUSTRIES, SHOOT_TYPES_PHOTO, SHOOT_TYPES_VIDEO,
  USAGE_SCOPES, USAGE_PERIODS, USAGE_REGIONS, COUNTRIES, HOURS, MINS, statusOptionsForType,
} from "./constants";
import type { AuthMode, Page } from "./constants";
import { sb, sbAuth, setAuthTokens, getAuthTokens, refreshSession, setOnAuthFail } from "./lib/supabase";
import {
  fmt, fmtNum, parseNum, pad, fmtDate, fmt12, fmtTime,
  toHHMM, parseHHMM, toMin, scheduleConflict, visaViolation,
  makeModelId, makeClientId, normalizeInstagram, visaDday, getTrialDaysLeft, ageFromSSN6, validateBizNo,
  bookingTotal, overchargeTotal, clientBalance, bookingAgencyFee, bookingModelPay,
  modelTaxType, modelGross, modelWithholding, clientCharge,
} from "./lib/utils";
import Badge from "./components/Badge";
import TypeIcon from "./components/TypeIcon";
import Modal from "./components/Modal";
import TimePicker from "./components/TimePicker";
import MultiCheck from "./components/MultiCheck";
import MoneyInput from "./components/MoneyInput";
import CalendarView from "./views/CalendarView";
import { Home, Calendar, ClipboardList, User, Users, Building2, Store, Coins, CreditCard, Pencil, Save, Folder, FolderOpen, Plane, Link2, Banknote, MessageSquare, Crown, PartyPopper, AlertTriangle, Ban, Camera, Clapperboard, Lightbulb, Sun, Moon, Menu, Search, ExternalLink, TrendingUp, Gauge, CalendarCheck, ClipboardCheck, Mannequin, Building, BarChart, CoinStack, Agents, CardCheck, CardStack, Settings, AimoMark } from "./components/icons";
import { useIsMobile } from "./lib/useIsMobile";
import { sendAlimtalkBoth } from "./lib/alimtalk";
import DashboardView from "./views/DashboardView";
import BookingsView from "./views/BookingsView";
import ModelsView from "./views/ModelsView";
import CustomersView from "./views/CustomersView";
import SettlementView from "./views/SettlementView";
import MembersView from "./views/MembersView";
import PlanView from "./views/PlanView";
import RevenueView from "./views/RevenueView";
import CompanyView from "./views/CompanyView";
import PackagesView from "./views/PackagesView";
import ModelStudioView from "./views/ModelStudioView";
import PackagePublicView from "./views/PackagePublicView";
import type { Pkg } from "./lib/packages";
import BulkUploadModal from "./components/BulkUploadModal";
import CompCardModal from "./components/CompCardModal";
import SettlementStatementModal from "./components/SettlementStatementModal";

// ── 프리텐다드 폰트 로드 ──
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
  style.textContent = `*, *::before, *::after { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', sans-serif !important; }\nhtml, body { margin: 0; padding: 0; background: var(--c-bg); }
:root { --c-bg:#0f1117; --c-card:#1a1d27; --c-card2:#22263a; --c-border:#2a2d3e; --c-text:#ffffff; --c-text-sub:#c8ccd8; --c-muted:#6b7280; --c-sidebar:#111318; --c-side-hover:#1e2128; --c-nav-active:#23262e; }
@media (max-width: 767px) { input, select, textarea { font-size: 16px !important; } }
html.light { --c-bg:#f7f8fa; --c-card:#ffffff; --c-card2:#f1f3f5; --c-border:#e2e5ea; --c-text:#111827; --c-text-sub:#3f4754; --c-muted:#737a85; --c-sidebar:#fbfbfc; --c-side-hover:#eef0f3; --c-nav-active:#e9ecef; }\n#root { min-height: 100vh; }`;
  if (!document.getElementById("pretendard-global")) document.head.appendChild(style);
})();

// ═══════════════
export default function App() {

  const [authMode,    setAuthMode]    = useState<AuthMode>("login");
  const [session,     setSession]     = useState<any>(null);
  const [agency,      setAgency]      = useState<any>(null);
  const [myRole,      setMyRole]      = useState<"owner"|"member">("member");
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [agencyName,  setAgencyName]  = useState("");
  const [bizNo,       setBizNo]       = useState("");
  const [authError,   setAuthError]   = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [models,    setModels]    = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [bookings,  setBookings]  = useState<any[]>([]);
  const [projects,  setProjects]  = useState<any[]>([]);
  const [holidays,    setHolidays]    = useState<any[]>([]); // 수동 휴무일
  const [packages,    setPackages]    = useState<Pkg[]>([]); // 모델 사진 패키지
  const [selectedProjectId, setSelectedProjectId] = useState<string|null>(null); // 프로젝트 상세
  const isMobile = useIsMobile();
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [theme, setTheme] = useState<string>(()=>{ try { return localStorage.getItem("modiq_theme")||"dark"; } catch { return "dark"; } });
  useEffect(()=>{ document.documentElement.classList.toggle("light", theme==="light"); try { localStorage.setItem("modiq_theme", theme); } catch {} }, [theme]);
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
  const [bookingMonthF,   setBookingMonthF]   = useState("ALL");
  const [settlementTab,     setSettlementTab]     = useState<"PENDING"|"SETTLED"|"UNPAID">("PENDING");
  const [settlementMonth,   setSettlementMonth]   = useState("ALL");
  const [settlementModel,   setSettlementModel]   = useState("ALL");
  const [settlementMgr,     setSettlementMgr]     = useState("ALL");
  const [settlementProject, setSettlementProject] = useState("ALL");

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
        const lDate=l.date||pDate;
        const ms=bookings.filter(b=>b.model_id===l.modelId&&b.shoot_date===lDate&&b.status!=="CANCELLED"&&!BOOKING_TYPES[b.booking_type||"SHOOT"]?.hasContract);
        ms.forEach(b=>{ if(b.status!=="HOLD") meetingsToHold.push(b.id); });
        if (ms.length>0) { const nm=models.find(m=>m.id===l.modelId)?.name||"모델"; const lb=[...new Set(ms.map(b=>BOOKING_TYPES[b.booking_type||"SHOOT"]?.label))].join(", "); warns.push(`· ${nm} — ${fmtDate(lDate)} ${lb}`); }
      }
      if (warns.length>0) {
        const ok = window.confirm(`⚠️ 아래 모델은 촬영일과 같은 날 미팅 일정이 있습니다.\n${warns.join("\n")}\n\n촬영이 우선이라 해당 미팅은 HOLD로 변경됩니다.\n[확인] 촬영 등록 + 미팅 HOLD (고객사와 일정 조율 필요)\n[취소] 등록 중단`);
        if (!ok) return;
      }
    }

    const projId = `PRJ_${Date.now()}`;
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
        const c = scheduleConflict(lStart, lEnd, b.start_time, b.end_time, pBookingType, b.booking_type);
        if (c.conflict) { autoHold = true; holdReason = c.reason; break; }
      }
      const finalStatus = autoHold ? "HOLD" : pStatus;
      const nb = {
        id:`B_${Date.now()}_${i}`, project_id: projId, model_id: line.modelId,
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
  const [selectedCustomer,   setSelectedCustomer]   = useState<any>(null); // 고객사 상세
  const [selectedSettlement, setSelectedSettlement] = useState<any>(null);
  const [modalStack, setModalStack] = useState<{type:string; id:string}[]>([]); // 모달 백스택: 닫으면 직전 상세로 복귀
  const [navHover, setNavHover] = useState(false); // 좌측 메뉴 호버 시 펼침
  const [mEditMode, setMEditMode] = useState(false);
  const [modelHistAll, setModelHistAll] = useState(false);
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
  const [mCountry,     setMCountry]     = useState("대한민국");
  const [mEntry,       setMEntry]       = useState("");
  const [mExit,        setMExit]        = useState("");
  const [mInstagram,   setMInstagram]   = useState("");
  const [mDrive,       setMDrive]       = useState("");
  const [mKakao,       setMKakao]       = useState("");
  const [mBank,        setMBank]        = useState("");
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
  const [mFollowers,   setMFollowers]   = useState("");
  const [mHairColor,   setMHairColor]   = useState("");
  const [mSizeUnit,    setMSizeUnit]    = useState<"cm"|"inch">("cm"); // 3사이즈 입력 단위(저장은 항상 cm)
  // 정산 세무: 유형 + 기본 정산방식(섭외에서 미지정 시 사용)
  const [mTaxType,  setMTaxType]  = useState<"foreigner"|"freelancer"|"company">("freelancer");
  const [mPayType,  setMPayType]  = useState<"rate"|"fixed">("rate");
  const [mPayValue, setMPayValue] = useState(0);

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
    setOnAuthFail(()=>{ localStorage.removeItem(SESSION_KEY); window.location.reload(); });
    const saved = localStorage.getItem(SESSION_KEY);
    if (!saved) return;
    (async () => {
      try {
        const { user, agencyData, role, tokens } = JSON.parse(saved);
        if (!tokens?.refresh_token) { localStorage.removeItem(SESSION_KEY); return; } // 구버전 세션 → 재로그인
        setAuthTokens(tokens.access_token||null, tokens.refresh_token);
        const fresh = await refreshSession(); // 서버 검증 + 토큰 갱신
        if (!fresh) { localStorage.removeItem(SESSION_KEY); return; }
        setSession(user); setAgency(agencyData); setMyRole(role);
        localStorage.setItem(SESSION_KEY, JSON.stringify({ user, agencyData, role, tokens:getAuthTokens() }));
        loadData(agencyData.id);
      } catch { localStorage.removeItem(SESSION_KEY); }
    })();
  }, []);

  const saveSession = (u: any, ag: any, role: "owner"|"member") =>
    localStorage.setItem(SESSION_KEY, JSON.stringify({ user:u, agencyData:ag, role, tokens:getAuthTokens() }));

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
    try {
      const h = await sb("holidays","GET",null,`?agency_id=eq.${agencyId}`);
      setHolidays(h||[]);
    } catch { setHolidays([]); } // holidays 테이블 미생성 시 무시
    try {
      const pk = await sb("packages","GET",null,`?agency_id=eq.${agencyId}&order=created_at.desc`);
      setPackages(pk||[]);
    } catch { setPackages([]); } // packages 테이블 미생성 시 무시
  };

  // ── 인증 ──
  const handleSignup = async () => {
    if (!email||!password||!agencyName||!bizNo) return setAuthError("모든 항목을 입력하세요");
    if (password.length < 6) return setAuthError("비밀번호 6자 이상");
    const bizNoNorm = bizNo.replace(/[^0-9]/g,"");
    if (!validateBizNo(bizNoNorm)) return setAuthError("올바른 사업자등록번호가 아닙니다 (10자리·체크섬 확인)");
    setAuthLoading(true); setAuthError("");
    try {
      const authRes = await sbAuth("signup", { email, password });
      setAuthTokens(authRes.access_token||null, authRes.refresh_token||null);
      const user = authRes.user;
      const agId = `AGY_${Date.now()}`;
      const trialEnd = new Date(Date.now() + 14*24*60*60*1000).toISOString();
      const agencyData = { id:agId, name:agencyName, biz_no:bizNoNorm, owner_id:user.id, owner_email:email, plan:"trial", additional_members:0, trial_ends_at:trialEnd, created_at:new Date().toISOString() };
      await sb("agencies","POST",agencyData);
      await sb("agency_members","POST",{ id:`MEM_${user.id}`, agency_id:agId, user_id:user.id, email, name:agencyName+" 대표", position:"대표", phone:"", role:"owner", created_at:new Date().toISOString() });
      setSession(user); setAgency(agencyData); setMyRole("owner");
      saveSession(user, agencyData, "owner");
      await loadData(agId);
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
    setAuthTokens(null, null);
    setSession(null); setAgency(null); setMyRole("member");
    setEmail(""); setPassword(""); setAgencyName("");
    setModels([]); setCustomers([]); setBookings([]); setMembers([]); setPackages([]);
    setPage("dashboard");
  };

  // ── 모델 추가 ──
  const resetModelForm = () => { setMName(""); setMSSN(""); setMPhone(""); setMEmail(""); setMCategory(""); setMRate(0); setMEntry(""); setMExit(""); setMInstagram(""); setMDrive(""); setMKakao(""); setMBank(""); setMThumb(""); setMAimoUrl(""); setMMemo(""); setMCountry("대한민국"); setMTaxType("freelancer"); setMPayType("rate"); setMPayValue(0); setMHeight(""); setMShoe(""); setMBust(""); setMWaist(""); setMHip(""); setMHair(""); setMEye(""); setMTattoo(false); setMUnderwear(false); setMFields([]); setMSpecialty(""); setMFollowers(""); setMHairColor(""); setMSizeUnit("cm"); };
  // 사이즈 단위 변환 (저장은 항상 cm)
  const sizeToCm = (v: string) => (mSizeUnit === "inch" && v && !isNaN(Number(v)) ? String(Math.round(Number(v) * 2.54)) : v);
  const convSizeVal = (v: string, to: "cm"|"inch") => (v === "" || isNaN(Number(v)) ? v : to === "inch" ? String(Math.round(Number(v) / 2.54 * 10) / 10) : String(Math.round(Number(v) * 2.54)));
  const switchSizeUnit = (u: "cm"|"inch") => { if (u === mSizeUnit) return; setMBust(b => convSizeVal(b, u)); setMWaist(w => convSizeVal(w, u)); setMHip(h => convSizeVal(h, u)); setMSizeUnit(u); };
  const handleAddModel = async () => {
    if (!mName||!mSSN) return alert("모델명과 주민번호 앞 6자리 필수");
    const isFgn = mTaxType==="foreigner";
    const nm = { id:makeModelId(mName,mSSN), name:mName, ssn6:mSSN, phone:mPhone, email:mEmail, category:mCategory, rate:mRate, is_foreigner:isFgn, country:mCountry, visa_entry:isFgn?mEntry:null, visa_exit:isFgn?mExit:null, instagram_url:normalizeInstagram(mInstagram), drive_url:mDrive, kakao_id:mKakao, bank_info:mBank, thumb_url:mThumb, aimo_url:mAimoUrl, memo:mMemo, payout_tax_type:mTaxType, payout_pay_type:mPayType, payout_pay_value:mPayValue, height:mHeight, shoe:mShoe, bust:sizeToCm(mBust), waist:sizeToCm(mWaist), hip:sizeToCm(mHip), hair_length:mHair, hair_color:mHairColor, eye_color:mEye, tattoo:mTattoo, underwear_ok:mUnderwear, fields:mFields, specialty:mSpecialty, instagram_followers:mFollowers, agency_id:agency.id };
    try {
      await sb("models","POST",nm);
      setModels([nm,...models]);
      resetModelForm(); setShowModelForm(false);
    } catch (e) { alert("모델 추가 실패: "+String(e)); }
  };

  const openEditModel = (m: any) => {
    setSelectedModel(m);
    setMName(m.name||""); setMSSN(m.ssn6||""); setMPhone(m.phone||""); setMEmail(m.email||"");
    setMCategory(m.category||""); setMRate(m.rate||0);
    setMCountry(m.country||"대한민국"); setMEntry(m.visa_entry||""); setMExit(m.visa_exit||"");
    setMInstagram(m.instagram_url||""); setMDrive(m.drive_url||"");
    setMKakao(m.kakao_id||""); setMBank(m.bank_info||""); setMThumb(m.thumb_url||""); setMAimoUrl(m.aimo_url||""); setMMemo(m.memo||"");
    setMHeight(m.height||""); setMShoe(m.shoe||""); setMBust(m.bust||""); setMWaist(m.waist||""); setMHip(m.hip||""); setMHair(m.hair_length||""); setMHairColor(m.hair_color||""); setMEye(m.eye_color||""); setMTattoo(!!m.tattoo); setMUnderwear(!!m.underwear_ok); setMFields(Array.isArray(m.fields)?m.fields:[]); setMSpecialty(m.specialty||""); setMFollowers(m.instagram_followers||""); setMSizeUnit("cm");
    setMTaxType(m.payout_tax_type==="company"?"company":(m.payout_tax_type==="foreigner"||m.is_foreigner)?"foreigner":"freelancer"); setMPayType(m.payout_pay_type==="fixed"?"fixed":"rate"); setMPayValue(m.payout_pay_value||0);
    setMEditMode(true);
  };

  const handleSaveModel = async () => {
    if (!mName) return alert("모델명 필수");
    const isFgn = mTaxType==="foreigner";
    const updated = { name:mName, ssn6:mSSN, phone:mPhone, email:mEmail, category:mCategory, rate:mRate, is_foreigner:isFgn, country:mCountry, visa_entry:isFgn?mEntry:null, visa_exit:isFgn?mExit:null, instagram_url:normalizeInstagram(mInstagram), drive_url:mDrive, kakao_id:mKakao, bank_info:mBank, thumb_url:mThumb, aimo_url:mAimoUrl, memo:mMemo, payout_tax_type:mTaxType, payout_pay_type:mPayType, payout_pay_value:mPayValue, height:mHeight, shoe:mShoe, bust:sizeToCm(mBust), waist:sizeToCm(mWaist), hip:sizeToCm(mHip), hair_length:mHair, hair_color:mHairColor, eye_color:mEye, tattoo:mTattoo, underwear_ok:mUnderwear, fields:mFields, specialty:mSpecialty, instagram_followers:mFollowers };
    try {
      await sb("models","PATCH",updated,`?id=eq.${selectedModel.id}`);
      setModels(models.map(m => m.id===selectedModel.id ? {...m,...updated} : m));
      setMEditMode(false); setSelectedModel(null); resetModelForm();
      alert("저장되었습니다.");
    } catch (e) { alert("수정 실패: "+String(e)); }
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
  const resetCustomerForm = () => { setCName(""); setCBrand(""); setCManager(""); setCPhone(""); setCEmail(""); setCIndustry(""); setCBizNo(""); setCTaxEmail(""); setCMemo(""); };
  const handleAddCustomer = async () => {
    if (!cName||!cPhone) return alert("고객사명과 전화번호 필수");
    const bn = cBizNo.replace(/[^0-9]/g,"");
    if (bn && !validateBizNo(bn)) return alert("올바른 사업자등록번호가 아닙니다 (10자리·체크섬 확인)");
    const nc = { id:makeClientId(cName,cPhone.slice(-4)), name:cName, brand:cBrand, manager_name:cManager, phone:cPhone, email:cEmail, industry:cIndustry, biz_no:bn, tax_email:cTaxEmail, memo:cMemo, agency_id:agency.id };
    try {
      await sb("customers","POST",nc);
      setCustomers([nc,...customers]);
      resetCustomerForm(); setShowCustomerForm(false);
    } catch (e) { alert("고객사 추가 실패: "+String(e)); }
  };

  const openEditCustomer = (c: any) => {
    setSelectedCustomer(c);
    setCName(c.name||""); setCBrand(c.brand||""); setCManager(c.manager_name||"");
    setCPhone(c.phone||""); setCEmail(c.email||""); setCIndustry(c.industry||"");
    setCBizNo(c.biz_no||""); setCTaxEmail(c.tax_email||""); setCMemo(c.memo||"");
    setCEditMode(true);
  };

  const handleSaveCustomer = async () => {
    if (!cName) return alert("고객사명 필수");
    const bn = cBizNo.replace(/[^0-9]/g,"");
    if (bn && !validateBizNo(bn)) return alert("올바른 사업자등록번호가 아닙니다 (10자리·체크섬 확인)");
    const updated = { name:cName, brand:cBrand, manager_name:cManager, phone:cPhone, email:cEmail, industry:cIndustry, biz_no:bn, tax_email:cTaxEmail, memo:cMemo };
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
    const inserts = items.filter(i=>i.mode==="insert").map(i=>({ ...i.record, id:i.id, agency_id:agency.id }));
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
      const tS=!!BOOKING_TYPES[t.booking_type||"SHOOT"]?.hasContract, bS=!!BOOKING_TYPES[b.booking_type||"SHOOT"]?.hasContract;
      if (tS!==bS) return !tS && bS; // 비촬영인데 같은날 촬영 있으면 보류
      return scheduleConflict(t.start_time,t.end_time,b.start_time,b.end_time,t.booking_type,b.booking_type).conflict;
    });
    const eIsShoot = !!BOOKING_TYPES[selectedBooking.booking_type||"SHOOT"]?.hasContract;
    const eInactive = selectedBooking.status==="CANCELLED"; // 취소 건은 일정에서 빠지므로 충돌 무관
    const eHold = !eInactive && blocks(selectedBooking, othersSameDay);
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

    // 우선순위 충돌 처리: 촬영 > 미팅/피팅/오디션
    const sameDay = bookings.filter(b=>b.model_id===bModel&&b.shoot_date===bDate&&b.status!=="CANCELLED");
    const newIsShoot = bBookingType==="SHOOT";
    let autoHold = false; let holdReason = "";
    const meetingsToHold:string[]=[];
    for (const b of sameDay) {
      const bIsShoot = !!BOOKING_TYPES[b.booking_type||"SHOOT"]?.hasContract;
      if (newIsShoot && !bIsShoot) {
        // 촬영 vs 기존 미팅(같은 날): 미팅을 HOLD (촬영은 그대로)
        if (b.status!=="HOLD") meetingsToHold.push(b.id);
      } else {
        // 동급 또는 미팅 vs 기존 촬영: 시간 겹치면 새 건 HOLD
        const c = scheduleConflict(bStart, bEnd, b.start_time, b.end_time, bBookingType, b.booking_type);
        if (c.conflict) { autoHold = true; holdReason = c.reason; }
      }
    }
    // 촬영이 기존 미팅과 겹치면 확인 (확인 시 미팅 HOLD 처리)
    if (meetingsToHold.length>0) {
      const labels = [...new Set(sameDay.filter(b=>meetingsToHold.includes(b.id)).map(b=>BOOKING_TYPES[b.booking_type||"SHOOT"]?.label))].join(", ");
      const ok = window.confirm(`⚠️ ${model?.name} 모델은 같은 날(${fmtDate(bDate)}) ${labels} 일정이 있습니다.\n촬영이 우선이라 그 ${labels}은(는) HOLD로 변경됩니다.\n\n[확인] 촬영 등록 + 미팅 HOLD (고객사와 일정 조율 필요)\n[취소] 등록 중단`);
      if (!ok) return;
    }
    const finalStatus = autoHold ? "HOLD" : bStatus;
    const nb = { id:`B_${Date.now()}`, model_id:bModel, customer_id:bCustomer, booking_type:bBookingType, shoot_date:bDate, start_time:bStart, end_time:bEnd, manager:bManager, status:finalStatus, project_name:bProject, location:bLocation, shoot_types:bShootTypes, usage_scope:bUsageScope, usage_period:bUsagePeriod, usage_region:bUsageRegion, shoot_fee:bBudget, deposit_amt:bDeposit, deposit_due:bDepositDue, balance_amt:bBalance, balance_due:bBalanceDue, result_drive_url:bResultDrive, memo:bMemo, commission_rate:15, is_paid:false, settlement_memo:"", messages:[], agency_id:agency.id, ...(bRefImages.length>0?{reference_images:bRefImages}:{}), ...(bRefVideos.length>0?{reference_videos:bRefVideos}:{}) };
    try {
      await sb("bookings","POST",nb);
      let list=[nb,...bookings];
      for (const mid of meetingsToHold) { await sb("bookings","PATCH",{status:"HOLD"},`?id=eq.${mid}`); list=list.map(b=>b.id===mid?{...b,status:"HOLD"}:b); }
      setBookings(list);
      resetBookingForm(); setShowBookingForm(false);
      if (autoHold) alert(`⚠️ HOLD 처리됨\n사유: ${holdReason}\n같은 날 동일 모델 섭외와 시간이 충돌합니다.`);
      else if (meetingsToHold.length>0) alert(`✅ 촬영 등록 완료\n겹치는 미팅 ${meetingsToHold.length}건이 HOLD로 변경됐습니다. 고객사와 일정을 조율하세요.`);
    } catch(e) { alert("섭외 추가 실패: "+String(e)); }
  };

  // ── 휴무일 ──
  const handleAddHoliday = async (date: string, label = "휴무일") => {
    if (!date) return alert("날짜를 선택하세요");
    const nh = { id:`H_${Date.now()}`, agency_id: agency.id, date, label: label||"휴무일" };
    try { await sb("holidays","POST",nh); setHolidays([...holidays, nh]); }
    catch(e) { alert("휴무일 저장 실패 — Supabase에 holidays 테이블이 필요합니다.\n(README.md의 SQL 참고)\n"+String(e)); }
  };
  const handleDeleteHoliday = async (id: string) => {
    if (!confirm("이 휴무일을 해제할까요?")) return;
    try { await sb("holidays","DELETE",null,`?id=eq.${id}`); setHolidays(holidays.filter(h=>h.id!==id)); }
    catch(e) { alert("휴무일 해제 실패: "+String(e)); }
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
          const still = peers.some(b=>scheduleConflict(hb.start_time,hb.end_time,b.start_time,b.end_time,hb.booking_type,b.booking_type).conflict);
          if (!still) {
            await sb("bookings","PATCH",{status:"CHECKING"},`?id=eq.${hb.id}`);
            updatedList = updatedList.map(b=>b.id===hb.id?{...b,status:"CHECKING"}:b);
          }
        }
      }
      setBookings(updatedList);
      setSelectedBooking((prev:any)=>prev?{...prev,status}:null);
      // ── 알림톡: 확정/취소 시 모델+고객사에 발송 ──
      if (status==="CONFIRMED"||status==="CANCELLED") {
        const tb = updatedList.find(b=>b.id===id);
        if (tb) {
          const tm = models.find(m=>m.id===tb.model_id);
          const tc = customers.find(c=>c.id===tb.customer_id);
          sendAlimtalkBoth(tm?.phone||"", tc?.phone||"", status==="CONFIRMED"?"CONFIRM":"CANCEL", { modelName:tm?.name||"모델", booking:tb, clientName:tc?.name||"고객사", managerName:tb.manager||"담당자", senderLabel:agency?.name||"에이전시", contactPhone:agency?.contact_phone||agency?.rep_phone||"" });
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

  const handleTransferOwner = async (target: any) => {
    if (!agency || !target) return;
    if (!confirm(`소유권을 ${target.name}님에게 넘기시겠어요?\n넘기면 본인은 일반 담당자가 되어 일부 권한을 잃습니다.`)) return;
    try {
      const me = members.find(m=>m.user_id===session?.id);
      await sb("agency_members","PATCH",{role:"owner"},`?id=eq.${target.id}`);
      if (me) await sb("agency_members","PATCH",{role:"member"},`?id=eq.${me.id}`);
      await sb("agencies","PATCH",{owner_id:target.user_id, owner_email:target.email},`?id=eq.${agency.id}`);
      const newMembers = members.map(m=> m.id===target.id ? {...m,role:"owner"} : (me&&m.id===me.id ? {...m,role:"member"} : m));
      setMembers(newMembers);
      const updatedAg = { ...agency, owner_id:target.user_id, owner_email:target.email };
      setAgency(updatedAg); setMyRole("member"); saveSession(session, updatedAg, "member");
      setPage("dashboard");
      alert(`소유권이 ${target.name}님에게 이전되었습니다.`);
    } catch (e) { alert("소유권 이전 실패: "+String(e)); }
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
    setSelectedSettlement(null); setSelectedModel(null); setModelHistAll(false); setSelectedCustomer(null); setSelectedProjectId(null);
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
.top{display:flex;justify-content:space-between;align-items:flex-start;padding:26px 30px;background:#ffffff;color:#1f2430;border-bottom:3px solid #c9a96e}
.hd{display:flex;align-items:center;gap:14px}
.logo{height:54px;width:auto;max-width:170px;object-fit:contain;flex-shrink:0}
.brand{font-size:13px;letter-spacing:.5px;color:#a8842c;font-weight:800}
.ttl{font-size:23px;font-weight:800;margin-top:4px;color:#1f2430}
.sub{font-size:12px;color:#8a92a0;margin-top:6px}
.tag{display:inline-block;padding:2px 9px;border-radius:6px;font-weight:800;font-size:11px;margin-right:7px;vertical-align:1px}
.tag.ok{background:#1c8f5a;color:#fff}.tag.prov{background:#d9822b;color:#fff}
.meta{text-align:right;font-size:12px;color:#8a92a0;line-height:1.7}
.meta b{color:#1f2430;font-size:13px}
.body{padding:24px 30px 30px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px}
.box{border:1px solid #e6e9ef;border-radius:10px;padding:14px 16px;background:#fafbfc}
.box h4{font-size:11px;color:#c9a96e;font-weight:800;letter-spacing:.4px;margin-bottom:9px;text-transform:uppercase}
.r{display:flex;gap:10px;font-size:13px;padding:3px 0}
.r .l{color:#7c8595;min-width:74px;flex-shrink:0}
.r .v{color:#1f2430;font-weight:600;word-break:keep-all;overflow-wrap:break-word}
.modelbar{display:flex;align-items:center;gap:12px;background:#1c2330;color:#fff;border-radius:10px;padding:14px 18px;margin-bottom:18px}
.modelbar .lab{font-size:11px;color:#c9a96e;font-weight:800}
.modelbar .nm{font-size:20px;font-weight:800}
.sec{font-size:11px;color:#7c8595;font-weight:800;letter-spacing:.4px;margin:0 0 8px;text-transform:uppercase}
table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:18px}
td{padding:10px 12px;border-bottom:1px solid #eef1f5}
td.num{text-align:right;font-weight:700;font-variant-numeric:tabular-nums}
tr.tot td{background:#fbf7ef;border-top:2px solid #c9a96e;border-bottom:none;font-size:15px;font-weight:800;color:#8a6d2f}
tr.due td{color:#5a6373;font-size:12px}
.notice{font-size:10.5px;color:#6b7280;line-height:1.75;background:#f6f8fa;border-radius:8px;padding:12px 14px;margin-bottom:18px}
.sign{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.sigbox{border:1px solid #e6e9ef;border-radius:10px;padding:14px 16px;min-height:96px;position:relative}
.sigbox .who{font-size:12px;color:#7c8595;font-weight:700}
.sigbox .nm{font-size:14px;font-weight:800;margin-top:4px;color:#1f2430}
.sigbox .seal{position:absolute;right:14px;bottom:12px;font-size:11px;color:#b8bfca}
.foot{text-align:center;font-size:10px;color:#9aa2af;margin-top:16px;line-height:1.7}
.bar{display:flex;gap:10px;justify-content:center;max-width:760px;margin:0 auto;padding:18px 0 4px}
.bb{flex:1 1 0;max-width:300px;border:none;border-radius:10px;padding:15px 16px;font-size:16px;font-weight:800;cursor:pointer;color:#fff;background:#3a4350}
.bb.share{background:#2f6fed}.bb.print{background:#1c8f5a}
.topbar{max-width:760px;margin:0 auto 10px;display:flex;justify-content:flex-end}
.xbtn{display:inline-flex;align-items:center;gap:6px;background:rgba(31,36,48,.88);color:#fff;border:none;border-radius:9px;padding:10px 16px;font-size:14px;font-weight:700;cursor:pointer}
@media print{.topbar{display:none}}
@media print{body{background:#fff;padding:0}.sheet{border:none;box-shadow:none;border-radius:0;max-width:none}.bar{display:none}}
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
    const total = filteredSettlement.reduce((s,b)=>s+bookingTotal(b),0);
    // 수수료·모델지급은 모델별 수수료율로 건별 계산 후 합산
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

  const filteredModels    = models.filter(m=>{
    if (!modelQ.trim()) return true;
    const q = modelQ.trim().toLowerCase();
    if (m.name?.toLowerCase().includes(q)||m.phone?.includes(q)||m.email?.toLowerCase().includes(q)) return true;
    // 섭외 이력(과거+진행중)의 고객사명/브랜드명으로도 검색
    return bookings.some(b=>{
      if (b.model_id!==m.id) return false;
      const c = customers.find(cc=>cc.id===b.customer_id);
      return !!c&&(c.name?.toLowerCase().includes(q)||c.brand?.toLowerCase().includes(q));
    });
  });
  const filteredCustomers = customers.filter(c=>{
    if (!customerQ.trim()) return true;
    const q = customerQ.trim().toLowerCase();
    return c.name?.toLowerCase().includes(q)||c.phone?.includes(q)||c.brand?.toLowerCase().includes(q)||c.manager_name?.toLowerCase().includes(q)||c.email?.toLowerCase().includes(q);
  });
  const filteredBookings  = bookings.filter(b=>{
    const mn=models.find(m=>m.id===b.model_id)?.name||"";
    const cn=customers.find(c=>c.id===b.customer_id)?.name||"";
    const matchQ=mn.includes(bookingQ)||cn.includes(bookingQ)||(b.project_name||"").includes(bookingQ);
    const matchSt=bookingStatusF==="ALL"||b.status===bookingStatusF;
    const matchMg=bookingManagerF==="ALL"||b.manager===bookingManagerF;
    const matchMo=bookingMonthF==="ALL"||(b.shoot_date||"").startsWith(bookingMonthF);
    // 취소 건은 기본 숨김 — '취소' 상태를 직접 선택했을 때만 표시
    const matchCancel = bookingStatusF==="CANCELLED" || b.status!=="CANCELLED";
    return matchQ&&matchSt&&matchMg&&matchMo&&matchCancel;
  });
  const bookingMonths = Array.from(new Set(bookings.filter(b=>b.shoot_date).map(b=>b.shoot_date.slice(0,7)))).sort().reverse();

  const maxMembers  = getTotalMemberLimit(agency?.plan||"trial", agency?.additional_members||0);
  const memberNames = members.map(m=>m.name);
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
  if (pkgToken) return <PackagePublicView token={pkgToken} />;

  // ══════════════════════════════════════════════
  // 로그인 화면
  // ══════════════════════════════════════════════
  if (!session||!agency) {
    return (
      <div style={{ minHeight:"100vh", width:"100vw", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:40, width:"90%", maxWidth:400 }}>
          <div style={{ textAlign:"center", marginBottom:22 }}>
            <h1 style={{ color:C.text, fontSize:30, margin:"0 0 5px", fontWeight:800, letterSpacing:"-1px" }}><span style={{ color:"#A8FF00" }}>m</span>odiq</h1>
            <p style={{ color:"#A8FF00", fontSize:11, margin:0, fontWeight:700, letterSpacing:"2.5px", textTransform:"uppercase" }}>talent agency OS</p>
            <p style={{ color:C.muted, fontSize:10, margin:"4px 0 0" }}>v{APP_VERSION}</p>
          </div>
          <div style={{ display:"flex", background:"var(--c-bg)", borderRadius:8, padding:4, marginBottom:22 }}>
            {(["login","signup"] as AuthMode[]).map(mode=>(
              <button key={mode} onClick={()=>{setAuthMode(mode);setAuthError("");}} style={{ flex:1, padding:"8px 0", border:"none", borderRadius:6, cursor:"pointer", fontWeight:600, fontSize:14, background:authMode===mode?C.blue:"transparent", color:authMode===mode?"white":C.muted, transition:"all 0.2s" }}>
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
          <p style={{ margin:"0 0 14px" }}><Ban size={40} color={C.red} /></p>
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
    { target:"dashboard"  as Page, label:"대시보드", icon:Gauge },
    { target:"calendar"   as Page, label:"캘린더",   icon:CalendarCheck },
    { target:"bookings"   as Page, label:"섭외",     icon:ClipboardCheck },
    { target:"models"     as Page, label:"모델",     icon:User },
    { target:"studio"     as Page, label:"스튜디오", icon:Camera },
    { target:"packages"   as Page, label:"패키지",   icon:CardStack },
    { target:"customers"  as Page, label:"고객사",   icon:Building },
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
    <div style={{ display:"flex", minHeight:"100vh", width:"100vw", background:C.bg, color:C.text }}>

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
      <div style={{ flex:1, marginLeft:isMobile?0:64, marginTop:isMobile?0:52, padding:isMobile?"68px 14px 88px":"32px 44px", overflowY:"auto", minHeight:isMobile?"100vh":"calc(100vh - 52px)" }}>
      <div style={{ maxWidth:1560, margin:"0 auto" }}>

        {/* ════ 대시보드 ════ */}
        {page==="dashboard" && <DashboardView bookings={bookings} models={models} customers={customers} projects={projects} setPage={setPage} setSelectedBooking={openBookingFresh} onSelectProject={openProjectFresh} isMobile={isMobile} canViewFinance={canViewFinance} />}

        {/* ════ 캘린더 ════ */}
        {page==="calendar" && (
          <CalendarView
            isMobile={isMobile}
            holidays={holidays}
            onAddHoliday={handleAddHoliday}
            onDeleteHoliday={handleDeleteHoliday}
            bookings={bookings}
            models={models}
            customers={customers}
            onSelectBooking={openBookingFresh}
            initModelId={calInitModel}
            onAddBooking={(preModel, preDate)=>{ setAddPrefill({ date:preDate, model:preModel }); setShowAddPicker(true); }}
          />
        )}


        {/* ════ 섭외 ════ */}
        {page==="bookings" && <BookingsView filteredBookings={filteredBookings} bookingQ={bookingQ} setBookingQ={setBookingQ} bookingStatusF={bookingStatusF} setBookingStatusF={setBookingStatusF} bookingManagerF={bookingManagerF} setBookingManagerF={setBookingManagerF} bookingMonthF={bookingMonthF} setBookingMonthF={setBookingMonthF} bookingMonths={bookingMonths} memberNames={memberNames} models={models} customers={customers} openAddPicker={()=>{ setAddPrefill({}); setShowAddPicker(true); }} setSelectedBooking={openBookingFresh} isMobile={isMobile} />}

        {/* ════ 모델 ════ */}
        {page==="models" && <ModelsView filteredModels={filteredModels} modelQ={modelQ} setModelQ={setModelQ} setShowModelForm={setShowModelForm} setSelectedModel={openModelFresh} setMEditMode={setMEditMode} bookings={bookings} isMobile={isMobile} onBulkAdd={()=>setBulkEntity("model")} />}

        {page==="packages" && <PackagesView packages={packages} setPackages={setPackages} models={models} customers={customers} agency={agency} isMobile={isMobile} />}

        {page==="studio" && <ModelStudioView models={models} setModels={setModels} setPackages={setPackages} agency={agency} isMobile={isMobile} />}

        {/* ════ 고객사 ════ */}
        {page==="customers" && <CustomersView filteredCustomers={filteredCustomers} customerQ={customerQ} setCustomerQ={setCustomerQ} setShowCustomerForm={setShowCustomerForm} setSelectedCustomer={openCustomerFresh} setCEditMode={setCEditMode} bookings={bookings} isMobile={isMobile} onBulkAdd={()=>setBulkEntity("customer")} />}

        {/* ════ 정산 ════ */}
        {page==="revenue" && canViewFinance && <RevenueView bookings={bookings} models={models} customers={customers} isMobile={isMobile} onSelectBooking={openBookingFresh} />}
        {page==="settlement" && canViewFinance && <SettlementView settlementTab={settlementTab} setSettlementTab={setSettlementTab} settlementMonth={settlementMonth} setSettlementMonth={setSettlementMonth} settlementMonths={settlementMonths} settlementModel={settlementModel} setSettlementModel={setSettlementModel} settlementMgr={settlementMgr} setSettlementMgr={setSettlementMgr} settlementProject={settlementProject} setSettlementProject={setSettlementProject} settlementProjects={settlementProjects} settlementSummary={settlementSummary} filteredSettlement={filteredSettlement} models={models} customers={customers} memberNames={memberNames} openSettlement={openSettlementFresh} onOpenStatement={()=>setShowStatement(true)} isMobile={isMobile} />}

        {/* ════ 담당자 ════ */}
        {page==="members"&&myRole==="owner"&&<MembersView members={members} maxMembers={maxMembers} memberPct={memberPct} setShowMemberForm={setShowMemberForm} handleDeleteMember={handleDeleteMember} handleUpdateMember={handleUpdateMember} />}
        {page==="company"&&myRole==="owner"&&<CompanyView agency={agency} members={members} session={session} onSave={handleSaveCompany} onTransferOwner={handleTransferOwner} />}

        {/* ════ 요금제 ════ */}
        {page==="plan"&&<PlanView agency={agency} myRole={myRole} planBilling={planBilling} setPlanBilling={setPlanBilling} handleChangePlan={handleChangePlan} />}
      </div>
      </div>

      {/* ════ 모달: 섭외 상세 ════ */}
      {selectedBooking&&(
        <Modal onClose={closeDetail} wide>
          {/* 헤더 */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <h3 style={{ margin:0, color:C.text }}><ClipboardList size={17} style={{ verticalAlign:-2, flexShrink:0 }}/> 섭외 상세</h3>
            <div style={{ display:"flex", gap:8 }}>
              {!editingBooking
                ? <>
                    {BOOKING_TYPES[selectedBooking.booking_type||"SHOOT"]?.hasContract&&["CONFIRMED","COMPLETED","SETTLED"].includes(selectedBooking.status)&&<button onClick={()=>issueVoucher(selectedBooking)} style={{ ...btnS(C.blue), fontSize:12 }}><ClipboardList size={12} style={{ verticalAlign:-2, flexShrink:0 }}/> 명세서</button>}
                    <button onClick={()=>setEditingBooking(true)} style={{ ...btnS(C.purple), fontSize:12 }}><Pencil size={12} style={{ verticalAlign:-2, flexShrink:0 }}/> 수정</button>
                  </>
                : <>
                    <button onClick={handleSaveBookingEdit} style={{ ...btnS(C.green), fontSize:12 }}><Save size={12} style={{ verticalAlign:-2, flexShrink:0 }}/> 저장</button>
                    <button onClick={()=>setEditingBooking(false)} style={{ ...btnS("#555"), fontSize:12 }}>취소</button>
                  </>
              }
            </div>
          </div>

          {/* 상태 (보기=배지 / 편집=선택) */}
          <div style={{ marginBottom:16 }}>
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
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12, marginBottom:14 }}>
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
                  ["사용국가",selectedBooking.usage_region],
                ].filter(([,v])=>v).map(([k,v])=>(
                  <div key={String(k)}>
                    <p style={{ margin:0, fontSize:12, color:C.muted }}>{k}</p>
                    <p style={{ margin:"3px 0 0", fontSize:14, fontWeight:600, color:C.text }}>{v}</p>
                  </div>
                ))}
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
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10, marginBottom:10 }}>
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
                <div style={{ display:"flex", alignItems:"flex-end", gap:16, flexWrap:"wrap" }}>
                  <TimePicker label="시작" value={selectedBooking.start_time||""} onChange={v=>setSelectedBooking((p:any)=>({...p,start_time:v}))} />
                  <span style={{ color:C.muted, fontSize:13, paddingBottom:6 }}>~</span>
                  <TimePicker label="종료" value={selectedBooking.end_time||""} onChange={v=>setSelectedBooking((p:any)=>({...p,end_time:v}))} />
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr", gap:10, marginBottom:10 }}>
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
                    <div key={grp} style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", marginBottom:6 }}>
                      <span style={{ fontSize:11, color:col, fontWeight:700, minWidth:30 }}>{grp}</span>
                      {opts.map(t=>(
                        <button key={t} type="button"
                          onClick={()=>setSelectedBooking((p:any)=>({ ...p, shoot_types: p.shoot_types?.includes(t) ? p.shoot_types.filter((x:string)=>x!==t) : [...(p.shoot_types||[]),t] }))}
                          style={{ padding:"5px 12px", borderRadius:20, border:`1px solid ${(selectedBooking.shoot_types||[]).includes(t)?col:C.border}`, background:(selectedBooking.shoot_types||[]).includes(t)?col+"22":"var(--c-card2)", color:(selectedBooking.shoot_types||[]).includes(t)?col:C.textSub, fontSize:12, fontWeight:(selectedBooking.shoot_types||[]).includes(t)?700:400, cursor:"pointer" }}>{t}</button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              {/* 사용 범위 + 기간 (추가폼과 동일) */}
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"3fr 2fr", gap:12 }}>
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
                <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr", gap:10, marginBottom:10 }}>
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
                <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
                  <div><label style={{ fontSize:12, color:C.muted, display:"block", marginBottom:5 }}>계약금 입금 예정일</label>
                    <input style={{ ...inp, marginBottom:0 }} type="date" value={selectedBooking.deposit_due||""} onChange={e=>setSelectedBooking((p:any)=>({...p,deposit_due:e.target.value}))} /></div>
                  <div><label style={{ fontSize:12, color:C.muted, display:"block", marginBottom:5 }}>잔금 입금 예정일</label>
                    <input style={{ ...inp, marginBottom:0 }} type="date" value={selectedBooking.balance_due||""} onChange={e=>setSelectedBooking((p:any)=>({...p,balance_due:e.target.value}))} /></div>
                </div>
              </>
            ) : (
              /* 조회 모드: 계약금/잔금 입금 확인 */
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
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
                        style={{ flex:1, background:"var(--c-card2)", border:`1px solid ${C.border}`, borderRadius:6, padding:"7px 10px", color:C.text, fontSize:13, outline:"none" }} />
                      <input type="text" value={bocAmount?bocAmount.toLocaleString("ko-KR"):""}
                        onChange={e=>{ const v=e.target.value.replace(/,/g,""); if(!isNaN(Number(v))) setBocAmount(Number(v)); }} placeholder="금액"
                        style={{ width:100, background:"var(--c-card2)", border:`1px solid ${C.border}`, borderRadius:6, padding:"7px 10px", color:C.text, fontSize:13, outline:"none", textAlign:"right" }} />
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
            {bookingTotal(selectedBooking)>0&&(
              <div style={{ marginTop:10, padding:"8px 12px", background:"rgba(201,169,110,0.08)", borderRadius:8, display:"flex", justifyContent:"space-between" }}>
                <span style={{ color:C.muted, fontSize:12 }}>모델 정산액 ({(()=>{ const t=modelTaxType(models.find(m=>m.id===selectedBooking.model_id)); return t==="foreigner"?"외국인·전액":t==="company"?"소속사·+10% 계산서":"프리랜서·3.3% 제외"; })()}{overchargeTotal(selectedBooking)>0?", 추가금 포함":""})</span>
                <span style={{ color:"#c9a96e", fontWeight:800 }}>{bookingModelPay(selectedBooking, models).toLocaleString()}원</span>
              </div>
            )}
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
                style={{ flex:1, background:"var(--c-card2)", border:`1px solid ${C.border}`, borderRadius:6, padding:"7px 10px", color:C.text, fontSize:12, outline:"none" }} />
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
          <button onClick={closeDetail} style={{ ...btnS(C.muted), width:"100%" }}>닫기</button>
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
            { t:"customers" as Page, l:"고객사", I:Building2 },
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
            <h3 style={{ marginTop:0, color:C.text }}><FolderOpen size={17} style={{ verticalAlign:-2, flexShrink:0 }}/> {proj?.name||pbs[0]?.project_name||"프로젝트"} <span style={{ color:C.textSub, fontWeight:600, fontSize:14 }}>· {client?.name||"?"}</span></h3>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr", gap:12, marginBottom:14 }}>
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
                    <p style={{ flex:1, margin:0, fontSize:13, color:C.textSub, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
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
            <button onClick={closeDetail} style={{ ...btnS(C.muted), width:"100%", marginTop:16 }}>닫기</button>
          </Modal>
        );
      })()}

      {/* ════ 모달: 정산 상세 ════ */}
      {selectedSettlement&&(
        <Modal onClose={closeDetail}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, marginBottom:12 }}>
            <h3 style={{ margin:0, color:C.text, fontSize:16 }}><Coins size={16} style={{ verticalAlign:-2, flexShrink:0 }}/> 정산 상세</h3>
            <button onClick={()=>openDetail("booking", selectedSettlement.id)}
              style={{ flexShrink:0, display:"inline-flex", alignItems:"center", gap:5, background:C.blue+"18", color:C.blue, border:`1px solid ${C.blue}44`, borderRadius:8, padding:"6px 12px", fontSize:12, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" }}>
              <Folder size={12} style={{ flexShrink:0 }}/> 섭외 상세 보기 →
            </button>
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
                {t==="company" && (
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ color:C.muted }}>부가세 (10%, 세금계산서)</span>
                    <span style={{ color:C.blue }}>+{Math.round(gross*0.1).toLocaleString()}원</span>
                  </div>
                )}
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                  <span style={{ color:C.text, fontWeight:700 }}>모델 실지급 {t==="foreigner"?"(외국인·전액)":t==="company"?"(소속사)":"(프리랜서)"}</span>
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
              {([["","모델 기본값"],["rate","비율(%)"],["fixed","정액(원)"]] as const).map(([k,l])=>(
                <button key={k} type="button" onClick={()=>setEditPayType(k)} style={{ padding:"5px 12px", borderRadius:20, border:`1px solid ${editPayType===k?C.green:C.border}`, background:editPayType===k?C.green+"22":"transparent", color:editPayType===k?C.green:C.muted, fontSize:12, fontWeight:editPayType===k?700:500, cursor:"pointer" }}>{l}</button>
              ))}
              {editPayType!==""&&(
                <span style={{ display:"inline-flex", alignItems:"center", gap:4 }}>
                  <input style={{ ...inp, marginBottom:0, width:120 }} type="text" inputMode="numeric"
                    placeholder={editPayType==="rate"?"모델 몫":"정액"}
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
              return <p style={{ margin:"8px 0 0", fontSize:12, color:C.text }}>→ 모델 실지급 <strong style={{ color:"#c9a96e", fontSize:14 }}>{pay.toLocaleString()}원</strong> <span style={{ color:C.muted, fontSize:11 }}>(기준액 {g.toLocaleString()}원 · {t==="foreigner"?"외국인 전액":t==="company"?"+10% 계산서":"−3.3%"})</span></p>;
            })()}
          </div>

          {/* ── 정산 단계: 날짜 + 상태 (정산 내역서에 반영) ── */}
          <div style={{ border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 12px", marginBottom:10, background:C.card2 }}>
            <p style={{ margin:"0 0 8px", fontSize:12, fontWeight:700, color:C.text }}>정산 단계 (날짜·상태)</p>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
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
            <button onClick={handleSaveSettlement} style={{ ...btnS(C.green), flex:1 }}>저장</button>
            <button onClick={closeDetail} style={{ ...btnS("#333"), flex:1 }}>취소</button>
          </div>
        </Modal>
      )}

      {/* ════ 모달: 모델 상세 ════ */}
      {selectedModel&&!mEditMode&&(
        <Modal onClose={closeDetail} wide>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <h2 style={{ margin:0, color:C.text }}>{selectedModel.name}</h2>
                {selectedModel.category&&<span style={{ background:C.card2, color:C.textSub, fontSize:12, padding:"3px 10px", borderRadius:10 }}>{selectedModel.category}{ageFromSSN6(selectedModel.ssn6)!==null?` · ${ageFromSSN6(selectedModel.ssn6)}세`:""}</span>}
                {selectedModel.is_foreigner&&(()=>{
                  const dday=visaDday(selectedModel.visa_exit);
                  const ddayColor=dday==="만료"?C.red:C.orange;
                  return <span style={{ background:ddayColor+"22", color:ddayColor, border:`1px solid ${ddayColor}50`, fontSize:12, fontWeight:700, padding:"3px 10px", borderRadius:10 }}><Plane size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> {dday}</span>;
                })()}
              </div>
              <p style={{ margin:"4px 0 0", fontSize:12, color:C.muted }}>ID: {selectedModel.id}</p>
            </div>
            <div style={{ display:"flex", gap:8, flexShrink:0 }}>
              <button onClick={()=>openEditModel(selectedModel)} style={{ ...btnS(C.purple), fontSize:12 }}><Pencil size={12} style={{ verticalAlign:-2, flexShrink:0 }}/> 정보 수정</button>
              <button onClick={()=>setCompModel(selectedModel)} disabled={!(Array.isArray(selectedModel.photos)&&selectedModel.photos.length)} title={Array.isArray(selectedModel.photos)&&selectedModel.photos.length?"컴카드 만들기":"스튜디오에서 사진을 먼저 등록하세요"} style={{ ...btnS(C.green, !(Array.isArray(selectedModel.photos)&&selectedModel.photos.length)), fontSize:12 }}><CardCheck size={12} style={{ verticalAlign:-2, flexShrink:0 }}/> 컴카드</button>
              <button onClick={()=>{ setCalInitModel(selectedModel.id); setPage("calendar"); setSelectedModel(null); setModalStack([]); }} style={{ ...btnS(C.blue), fontSize:12 }}><Calendar size={12} style={{ verticalAlign:-2, flexShrink:0 }}/> 캘린더 보기</button>
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:14, marginBottom:16 }}>
            {[
              ["전화번호", selectedModel.phone?<a href={`tel:${selectedModel.phone}`} style={{ color:C.blue, textDecoration:"none", fontWeight:600 }}>{selectedModel.phone}</a>:null],
              ["이메일",   selectedModel.email],
              ["기본 단가(참고)", selectedModel.rate ? `${Number(selectedModel.rate).toLocaleString()}원` : "-"],
              ["세무 유형", modelTaxType(selectedModel)==="foreigner"?"외국인 (전액)":modelTaxType(selectedModel)==="company"?"소속사 (계산서 10%)":"프리랜서 (3.3%)"],
              ["정산 방식", selectedModel.payout_pay_value ? (selectedModel.payout_pay_type==="fixed"?`정액 ${Number(selectedModel.payout_pay_value).toLocaleString()}원`:`비율 ${selectedModel.payout_pay_value}%`) : "-"],
              ...(selectedModel.country?[["국가", selectedModel.country]] as [string,any][]:[]),
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
            {selectedModel.instagram_url&&<a href={selectedModel.instagram_url} target="_blank" rel="noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:6, background:"#E1306C22", color:"#E1306C", border:"1px solid #E1306C50", borderRadius:8, padding:"8px 14px", fontSize:13, fontWeight:600, textDecoration:"none" }}><Camera size={13} style={{ verticalAlign:-2, flexShrink:0 }}/> 인스타그램 열기 →</a>}
            {selectedModel.drive_url&&<a href={selectedModel.drive_url} target="_blank" rel="noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:6, background:C.blue+"22", color:C.blue, border:`1px solid ${C.blue}50`, borderRadius:8, padding:"8px 14px", fontSize:13, fontWeight:600, textDecoration:"none" }}><Folder size={13} style={{ verticalAlign:-2, flexShrink:0 }}/> 구글 드라이브 열기 →</a>}
            {selectedModel.aimo_url&&<a href={selectedModel.aimo_url} target="_blank" rel="noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:6, background:"linear-gradient(135deg,#4f46e522,#06b6d422)", border:"1px solid #4f46e550", borderRadius:8, padding:"8px 14px", fontSize:13, fontWeight:700, textDecoration:"none", color:"#818cf8" }}><Link2 size={13} style={{ verticalAlign:-2, flexShrink:0 }}/> AIMO 프로필 열기 →</a>}
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
              <div style={{ background:C.card2, borderRadius:10, padding:"12px 14px", marginBottom:14, display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr", gap:10 }}>
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
          <button onClick={closeDetail} style={{ ...btnS(C.muted), width:"100%", marginTop:16 }}>닫기</button>
        </Modal>
      )}

      {/* ════ 모달: 고객사 상세 ════ */}
      {selectedCustomer&&!cEditMode&&(
        <Modal onClose={closeDetail} wide>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <h2 style={{ margin:0, color:C.text }}>{selectedCustomer.name}</h2>
                {selectedCustomer.brand&&<span style={{ fontSize:13, color:C.blue, fontWeight:600 }}>· {selectedCustomer.brand}</span>}
                {selectedCustomer.industry&&<span style={{ background:C.card2, color:C.textSub, fontSize:12, padding:"3px 10px", borderRadius:10 }}>{selectedCustomer.industry}</span>}
              </div>
              <p style={{ margin:"4px 0 0", fontSize:12, color:C.muted }}>ID: {selectedCustomer.id}</p>
            </div>
            <button onClick={()=>openEditCustomer(selectedCustomer)} style={{ ...btnS(C.purple), fontSize:12 }}><Pencil size={12} style={{ verticalAlign:-2, flexShrink:0 }}/> 정보 수정</button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:14, marginBottom:16 }}>
            {[
              ["담당자명", selectedCustomer.manager_name],
              ["전화번호", selectedCustomer.phone?<a href={`tel:${selectedCustomer.phone}`} style={{ color:C.blue, textDecoration:"none", fontWeight:600 }}>{selectedCustomer.phone}</a>:null],
              ["이메일",   selectedCustomer.email],
              ["업종",     selectedCustomer.industry],
              ["사업자등록번호", selectedCustomer.biz_no?(()=>{ const n=String(selectedCustomer.biz_no).replace(/[^0-9]/g,""); return n.length===10?`${n.slice(0,3)}-${n.slice(3,5)}-${n.slice(5)}`:selectedCustomer.biz_no; })():null],
              ["계산서 이메일", selectedCustomer.tax_email],
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
                  <span style={{ fontSize:12, color:C.muted, marginLeft:8 }}><Calendar size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> {fmtDate(b.shoot_date)}</span>
                </div>
                <Badge code={b.status} type={b.booking_type} />
              </div>
            ))}
          </div>
          <button onClick={closeDetail} style={{ ...btnS(C.muted), width:"100%", marginTop:16 }}>닫기</button>
        </Modal>
      )}

      {/* ════ 모달: 고객사 수정 ════ */}
      {selectedCustomer&&cEditMode&&(
        <Modal onClose={()=>{setCEditMode(false);setSelectedCustomer(null);resetCustomerForm();setModalStack([]);}}>
          <h3 style={{ marginTop:0, color:C.text }}><Building2 size={17} style={{ verticalAlign:-2, flexShrink:0 }}/> 고객사 정보 수정</h3>
          <p style={{ fontSize:11, color:C.muted, marginTop:0 }}>ID: {selectedCustomer.id}</p>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
            <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>고객사명 *</label><input style={inp} value={cName} onChange={e=>setCName(e.target.value)} /></div>
            <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>브랜드명</label><input style={inp} value={cBrand} onChange={e=>setCBrand(e.target.value)} /></div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
            <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>담당자명</label><input style={inp} value={cManager} onChange={e=>setCManager(e.target.value)} /></div>
            <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>전화번호</label><input style={inp} type="tel" value={cPhone} onChange={e=>setCPhone(e.target.value)} /></div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
            <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>이메일</label><input style={inp} type="email" value={cEmail} onChange={e=>setCEmail(e.target.value)} /></div>
            <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>업종</label>
              <select style={inp} value={cIndustry} onChange={e=>setCIndustry(e.target.value)}>
                <option value="">선택</option>
                {CLIENT_INDUSTRIES.map(i=><option key={i} value={i}>{i}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
            <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>사업자등록번호</label><input style={inp} value={cBizNo} onChange={e=>setCBizNo(e.target.value)} placeholder="000-00-00000" /></div>
            <div><label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>계산서 발송 이메일</label><input style={inp} type="email" value={cTaxEmail} onChange={e=>setCTaxEmail(e.target.value)} placeholder="tax@company.com" /></div>
          </div>
          <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>메모</label>
          <textarea style={{ ...inp, height:60, resize:"none" }} value={cMemo} onChange={e=>setCMemo(e.target.value)} />
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={handleDeleteCustomer} style={{ ...btnS(C.red), flexShrink:0 }}>삭제</button>
            <button onClick={handleSaveCustomer} style={{ ...btnS(C.green), flex:1 }}>저장</button>
            <button onClick={()=>{setCEditMode(false);setSelectedCustomer(null);resetCustomerForm();setModalStack([]);}} style={{ ...btnS("#333"), flex:1 }}>취소</button>
          </div>
        </Modal>
      )}
      {(showModelForm||mEditMode)&&(
        <Modal onClose={()=>{setShowModelForm(false);setMEditMode(false);setSelectedModel(null);resetModelForm();setModalStack([]);}}>
          <h3 style={{ marginTop:0, color:C.text }}><User size={17} style={{ verticalAlign:-2, flexShrink:0 }}/> {mEditMode?"모델 정보 수정":"모델 추가"}</h3>
          {mEditMode&&<p style={{ fontSize:11, color:C.muted, marginTop:0 }}>ID: {selectedModel?.id}</p>}

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

          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>모델명 *</label>
              <input style={inp} value={mName} onChange={e=>setMName(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>주민번호 앞 6자리 *</label>
              <input style={inp} value={mSSN} onChange={e=>setMSSN(e.target.value)} />
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>전화번호</label>
              <input style={inp} type="tel" value={mPhone} onChange={e=>setMPhone(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>이메일</label>
              <input style={inp} type="email" value={mEmail} onChange={e=>setMEmail(e.target.value)} />
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr", gap:10 }}>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>카테고리</label>
              <select style={inp} value={mCategory} onChange={e=>setMCategory(e.target.value)}>
                <option value="">선택</option>
                {MODEL_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>국적</label>
              <select style={inp} value={mCountry} onChange={e=>setMCountry(e.target.value)}>
                {COUNTRIES.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>기본 단가 (원) <span style={{ color:C.muted, fontSize:10 }}>· 참고용</span></label>
              <input style={inp} type="text" placeholder="0"
                value={mRate ? Number(mRate).toLocaleString("ko-KR") : ""}
                onChange={e=>{ const v=e.target.value.replace(/,/g,""); if(!isNaN(Number(v))) setMRate(Number(v)); }} />
            </div>
          </div>
          {/* ── 신체 정보 · 프로필 ── */}
          <div style={{ border:`1px solid ${C.border}`, borderRadius:8, padding:"12px 14px", margin:"4px 0 14px", background:C.card2 }}>
            <p style={{ margin:"0 0 10px", fontSize:12, fontWeight:700, color:C.text }}>신체 정보 · 프로필 <span style={{ fontWeight:500, color:C.muted }}>(컴카드·패키지에 표시)</span></p>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(2, 1fr)", gap:8, marginBottom:8, maxWidth:isMobile?undefined:320 }}>
              <input style={{ ...inp, marginBottom:0 }} type="text" inputMode="numeric" placeholder="키(cm)" value={mHeight} onChange={e=>setMHeight(e.target.value)} />
              <input style={{ ...inp, marginBottom:0 }} type="text" inputMode="numeric" placeholder="신발(mm)" value={mShoe} onChange={e=>setMShoe(e.target.value)} />
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5, flexWrap:"wrap" }}>
              <span style={{ fontSize:11, color:C.muted }}>가슴·허리·엉덩이 단위</span>
              {(["cm","inch"] as const).map(u=>(
                <button key={u} type="button" onClick={()=>switchSizeUnit(u)} style={{ padding:"3px 11px", borderRadius:14, border:`1px solid ${mSizeUnit===u?C.blue:C.border}`, background:mSizeUnit===u?C.blue+"22":"transparent", color:mSizeUnit===u?C.blue:C.muted, fontSize:11, fontWeight:mSizeUnit===u?700:500, cursor:"pointer" }}>{u}</button>
              ))}
              <span style={{ fontSize:10, color:C.muted }}>{mSizeUnit==="inch"?"※ 저장 시 cm로 자동 변환":"cm로 저장·표시"}</span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:8, marginBottom:10, maxWidth:isMobile?undefined:480 }}>
              {([[`가슴(${mSizeUnit})`,mBust,setMBust],[`허리(${mSizeUnit})`,mWaist,setMWaist],[`엉덩이(${mSizeUnit})`,mHip,setMHip]] as [string,string,(v:string)=>void][]).map(([ph,val,set])=>(
                <input key={ph} style={{ ...inp, marginBottom:0 }} type="text" inputMode="numeric" placeholder={ph} value={val} onChange={e=>set(e.target.value)} />
              ))}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4, 1fr)", gap:8, marginBottom:10 }}>
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
                <label style={{ fontSize:11, color:"#E1306C", display:"block", marginBottom:5 }}>인스타 팔로워 수</label>
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
          </div>

          {/* ── 정산 세무 ── */}
          <div style={{ border:`1px solid ${C.border}`, borderRadius:8, padding:"12px 14px", margin:"4px 0 14px", background:C.card2 }}>
            <p style={{ margin:"0 0 8px", fontSize:12, fontWeight:700, color:C.text }}>정산 · 세무 <span style={{ fontWeight:500, color:C.muted }}>(섭외에서 미지정 시 이 기본값 사용)</span></p>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10, flexWrap:"wrap" }}>
              <span style={{ fontSize:11, color:C.muted, minWidth:60 }}>세무 유형</span>
              {([["foreigner","외국인 (전액)"],["freelancer","프리랜서 (3.3%)"],["company","소속사 (계산서 10%)"]] as const).map(([k,l])=>(
                <button key={k} type="button" onClick={()=>setMTaxType(k)} style={{ padding:"5px 12px", borderRadius:20, border:`1px solid ${mTaxType===k?C.blue:C.border}`, background:mTaxType===k?C.blue+"22":"transparent", color:mTaxType===k?C.blue:C.muted, fontSize:12, fontWeight:mTaxType===k?700:500, cursor:"pointer" }}>{l}</button>
              ))}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
              <span style={{ fontSize:11, color:C.muted, minWidth:60 }}>정산 방식</span>
              {([["rate","비율(%)"],["fixed","정액(원)"]] as const).map(([k,l])=>(
                <button key={k} type="button" onClick={()=>setMPayType(k)} style={{ padding:"5px 12px", borderRadius:20, border:`1px solid ${mPayType===k?C.green:C.border}`, background:mPayType===k?C.green+"22":"transparent", color:mPayType===k?C.green:C.muted, fontSize:12, fontWeight:mPayType===k?700:500, cursor:"pointer" }}>{l}</button>
              ))}
              <span style={{ display:"inline-flex", alignItems:"center", gap:4 }}>
                <input style={{ ...inp, marginBottom:0, width:130 }} type="text" inputMode="numeric"
                  placeholder={mPayType==="rate"?"모델 몫":"정액"}
                  value={mPayValue ? (mPayType==="fixed"? Number(mPayValue).toLocaleString("ko-KR") : String(mPayValue)) : ""}
                  onChange={e=>{ const v=e.target.value.replace(/,/g,""); if(v===""||!isNaN(Number(v))) setMPayValue(Number(v)); }} />
                <span style={{ fontSize:13, fontWeight:700, color:C.textSub }}>{mPayType==="rate"?"%":"원"}</span>
              </span>
              <span style={{ fontSize:11, color:C.muted }}>{mPayType==="rate"?"계약금액(공급가)의 모델 몫":"건당 모델 정산액(부가세 제외)"}</span>
            </div>
            <p style={{ margin:"8px 0 0", fontSize:11, color:C.muted }}>
              {mTaxType==="foreigner" ? "지급: 정산 기준액 전액 (원천징수·부가세 없음)"
                : mTaxType==="company" ? "지급: 정산 기준액 + 10% (세금계산서 수취)"
                : "지급: 정산 기준액 − 3.3% (소득세 3% + 지방세 0.3% 원천징수)"}
            </p>
          </div>

          {/* 외국인 선택 시: 비자 입출국일 (국적은 위 국적 셀렉트) */}
          {mTaxType==="foreigner" && (
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
              <div>
                <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}><Plane size={11} style={{ verticalAlign:-2 }}/> 입국일</label>
                <input style={inp} type="date" value={mEntry} onChange={e=>setMEntry(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>출국일</label>
                <input style={inp} type="date" value={mExit} onChange={e=>setMExit(e.target.value)} />
              </div>
            </div>
          )}

          {/* 링크 — 브랜드 아이콘 */}
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
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
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
            <div>
              <label style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, marginBottom:5, color:"#3A2A00" }}>
                <svg width="14" height="14" viewBox="0 0 24 24"><ellipse cx="12" cy="11" rx="10" ry="8.5" fill="#FEE500"/><circle cx="9" cy="11" r="1.2" fill="#3A1D00"/><circle cx="12" cy="11" r="1.2" fill="#3A1D00"/><circle cx="15" cy="11" r="1.2" fill="#3A1D00"/></svg>
                <span style={{ color:"#c9a000" }}>카카오톡 ID</span>
              </label>
              <input style={inp} placeholder="카카오톡 아이디" value={mKakao} onChange={e=>setMKakao(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}><Banknote size={11} style={{ verticalAlign:-2, flexShrink:0 }}/> 통장 정보</label>
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
            {mEditMode&&<button onClick={handleDeleteModel} style={{ ...btnS(C.red), flexShrink:0 }}>삭제</button>}
            <button onClick={mEditMode?handleSaveModel:handleAddModel} style={{ ...btnS(C.green), flex:1 }}>{mEditMode?"저장":"추가"}</button>
            <button onClick={()=>{setShowModelForm(false);setMEditMode(false);setSelectedModel(null);resetModelForm();setModalStack([]);}} style={{ ...btnS("#333"), flex:1 }}>취소</button>
          </div>
        </Modal>
      )}
      {/* ════ 모달: 고객사 추가 ════ */}
      {showCustomerForm&&(
        <Modal onClose={()=>{setShowCustomerForm(false);resetCustomerForm();}}>
          <h3 style={{ marginTop:0, color:C.text }}><Building2 size={17} style={{ verticalAlign:-2, flexShrink:0 }}/> 고객사 추가</h3>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>고객사명 *</label>
              <input style={inp} value={cName} onChange={e=>setCName(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>브랜드명</label>
              <input style={inp} value={cBrand} onChange={e=>setCBrand(e.target.value)} />
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>담당자명</label>
              <input style={inp} value={cManager} onChange={e=>setCManager(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>전화번호 *</label>
              <input style={inp} type="tel" value={cPhone} onChange={e=>setCPhone(e.target.value)} />
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
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
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>사업자등록번호</label>
              <input style={inp} value={cBizNo} onChange={e=>setCBizNo(e.target.value)} placeholder="000-00-00000" />
            </div>
            <div>
              <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>계산서 발송 이메일</label>
              <input style={inp} type="email" value={cTaxEmail} onChange={e=>setCTaxEmail(e.target.value)} placeholder="tax@company.com" />
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

      {/* ════ 모달: 정산 내역서 (월별/기간별 + 엑셀) ════ */}
      {showStatement && (
        <SettlementStatementModal bookings={bookings} models={models} customers={customers} isMobile={isMobile} onClose={()=>setShowStatement(false)} />
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
          existingIds={new Set((bulkEntity==="model"?models:customers).map((x:any)=>x.id))}
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
                        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:8, marginBottom:8 }}>
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
                        <MoneyInput label="계약 총액 (이 모델 몫)" value={line.fee} onChange={v=>updateProjectModelLine(line.modelId,"fee",v)} />
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
                    <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr", gap:10 }}>
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
                    <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10, marginTop:4 }}>
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
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10, marginBottom:10 }}>
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
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10, marginBottom:10 }}>
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
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"3fr 2fr", gap:12 }}>
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
            <button onClick={()=>{ setShowProjectForm(false); resetProjectForm(); }} style={{ ...btnS("#333"), flex:1 }}>취소</button>
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
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12 }}>
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
        <Modal onClose={()=>{setShowBookingForm(false);resetBookingForm();}} wide maxW={780}>
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
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
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
                      {c.industry&&<span style={{ fontSize:11, color:C.muted }}>{c.industry}</span>}
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
            <div style={{ display:"flex", alignItems:"flex-end", gap:16, flexWrap:"wrap" }}>
              <TimePicker label="시작" value={bStart} onChange={setBStart} />
              <span style={{ color:C.muted, fontSize:13, paddingBottom:6 }}>~</span>
              <TimePicker label="종료" value={bEnd}   onChange={setBEnd}   />
            </div>
          </div>

          {/* 장소 + 담당자 + 상태 (프로젝트 폼과 동일) */}
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr", gap:10 }}>
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
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"3fr 2fr", gap:12 }}>
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
            <p style={{ margin:"0 0 12px", fontSize:12, fontWeight:700, color:C.yellow }}><Coins size={12} style={{ verticalAlign:-2, flexShrink:0 }}/> 계약 금액</p>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr", gap:10, alignItems:"end" }}>
              <MoneyInput label="계약 총액" value={bBudget}  onChange={v=>{ setBBudget(v);  setBBalance(Math.max(0, v - bDeposit)); }} />
              <MoneyInput label="계약금"    value={bDeposit} onChange={v=>{ setBDeposit(v); setBBalance(Math.max(0, bBudget - v)); }} />
              <div style={{ marginBottom:10 }}>
                <label style={{ fontSize:11, color:C.muted, display:"block", marginBottom:5 }}>잔금 <span style={{ color:C.blue, fontSize:10 }}>(자동계산)</span></label>
                <div style={{ background:"#1a1e2e", border:`1px solid ${C.blue}40`, borderRadius:6, padding:"9px 10px", fontSize:13, fontWeight:700, color:C.blue }}>
                  {Math.max(0, bBudget - bDeposit).toLocaleString()}원
                </div>
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10, marginTop:4 }}>
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
            <button onClick={handleAddBooking} style={{ ...btnS(C.green), flex:1 }}>추가</button>
            <button onClick={()=>{setShowBookingForm(false);resetBookingForm();}} style={{ ...btnS("#333"), flex:1 }}>취소</button>
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
          <img src={lightboxSrc} alt="" style={{ maxWidth:"min(900px, 92vw)", maxHeight:"min(900px, 92vh)", borderRadius:10, boxShadow:"0 20px 60px rgba(0,0,0,0.5)" }} />
        </div>
      )}
    </div>
  );
}
