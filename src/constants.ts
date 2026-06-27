export const APP_VERSION = "1.2.0";
export const SESSION_KEY = "modiq_session_v6";
export const DATA_CACHE_KEY = "modiq_data_cache_v1";
export type AuthMode = "login"|"signup";
export type Page = "dashboard"|"bookings"|"models"|"customers"|"settlement"|"revenue"|"members"|"plan"|"calendar"|"company"|"packages"|"studio"|"distribution";

// ── 기능 플래그 ────────────────────────────────────────────────
// 발송(Distribution): 에이전시 간 모델 자료 단방향 발송. 문제 시 false로 즉시 비활성화
// (메뉴/페이지/라우팅이 모두 이 플래그로 감싸져 있어 코드 롤백 없이 끌 수 있다).
export const FEATURE_DISTRIBUTION = true;

// ── 요금제 ─────────────────────────────────────────────────────
export const PLAN_FEATURES: Record<string, { baseMembers: number; additionalPrice: number; alimtalk: boolean }> = {
  trial:    { baseMembers: 1,  additionalPrice: 0,     alimtalk: false },
  starter:  { baseMembers: 2,  additionalPrice: 20000, alimtalk: false },
  standard: { baseMembers: 5,  additionalPrice: 15000, alimtalk: true  },
  pro:      { baseMembers: 10, additionalPrice: 15000, alimtalk: true  },
};
export const PLANS = [
  { id:"starter",  name:"Starter",  price:79000,  priceYearly:57000,  storage:"10GB",  color:"#4A90D9", popular:false,
    features:["모델 등록 무제한","고객사 등록 무제한","섭외 관리 무제한","기본 담당자 2명","스토리지 10GB","정산 관리","일정 충돌 감지"] },
  { id:"standard", name:"Standard", price:149000, priceYearly:107000, storage:"50GB",  color:"#7B68EE", popular:true,
    features:["Starter 모든 기능","기본 담당자 5명","스토리지 50GB","카카오 알림톡 포함","프로젝트별 정산","월별/담당자별 리포트","우선 고객 지원"] },
  { id:"pro",      name:"Pro",      price:249000, priceYearly:179000, storage:"200GB", color:"#2ECC71", popular:false,
    features:["Standard 모든 기능","기본 담당자 10명","스토리지 200GB","자체 카카오 채널","외국인 모델 비자 관리","전담 고객 매니저","API 연동 지원"] },
];
export const getTotalMemberLimit = (plan: string, extra = 0) => (PLAN_FEATURES[plan]?.baseMembers || 1) + extra;

// ── 상수 ──────────────────────────────────────────────────────
export const GENDERS: [string,string][] = [["F","여성"],["M","남성"]]; // 성별 코드(F/M)+라벨
export const MODEL_CATEGORIES = ["키즈","주니어","성인","시니어","플러스사이즈"]; // 모델 타입(성별과 분리)
export const MODEL_FIELDS = ["모델","배우","가수","댄서","성우","개그맨","스포츠","사회자","홈쇼핑","유투버","인플루언서","크리에이터"]; // 활동분야(복수 선택)
export const HAIR_LENGTHS = ["숏","단발","미디엄","롱"];
export const EYE_COLORS = ["검정","갈색","그레이","블루","그린","기타"];
export const CLIENT_INDUSTRIES = ["광고대행사","마케팅에이전시","프로덕션","패션브랜드","뷰티","홈쇼핑","매거진/미디어","온라인플랫폼","웨딩/이벤트","브랜드(종합)","기타"];
// 고객사 분야(마케팅 분류) — 드롭다운 기본값. 직접 입력으로 추가 가능(기존 고객사 값과 합쳐 노출)
export const CLIENT_CATEGORIES = ["패션브랜드","뷰티","아웃도어","언더웨어","가방","주얼리","리빙","식품","광고대행사","프로덕션","이커머스"];
export const SHOOT_TYPES_PHOTO = ["광고사진","화보","카탈로그","SNS콘텐츠","룩북","제품사진"];
export const USAGE_REGIONS = ["국내","해외"]; // 콘텐츠 사용 국가 범위
// 모델 국적 — 대한민국 기본(맨 위) · 나머지는 가나다순 · '기타'는 맨 아래
const COUNTRIES_RAW = [
  "대한민국","미국","중국","일본","러시아","우크라이나","영국","프랑스","독일","이탈리아",
  "스페인","포르투갈","네덜란드","벨기에","스위스","오스트리아","스웨덴","노르웨이","덴마크","핀란드",
  "아이슬란드","아일랜드","폴란드","체코","슬로바키아","헝가리","루마니아","불가리아","그리스","크로아티아",
  "세르비아","슬로베니아","리투아니아","라트비아","에스토니아","벨라루스","몰도바",
  "캐나다","멕시코","브라질","아르헨티나","칠레","페루","콜롬비아","베네수엘라","에콰도르","볼리비아",
  "파라과이","우루과이","쿠바","코스타리카","파나마",
  "호주","뉴질랜드",
  "인도","파키스탄","방글라데시","스리랑카","네팔",
  "태국","베트남","필리핀","인도네시아","말레이시아","싱가포르","미얀마","캄보디아","라오스","몽골",
  "대만","홍콩","마카오","북한",
  "카자흐스탄","우즈베키스탄","키르기스스탄","타지키스탄","투르크메니스탄","조지아","아르메니아","아제르바이잔",
  "터키","이스라엘","사우디아라비아","아랍에미리트","카타르","쿠웨이트","바레인","오만","요르단","레바논",
  "이라크","이란","시리아","예멘",
  "이집트","모로코","튀니지","알제리","리비아","남아프리카공화국","나이지리아","케냐","에티오피아","가나",
  "탄자니아","우간다","세네갈","코트디부아르","카메룬","앙골라","모잠비크","짐바브웨",
];
export const COUNTRIES = ["대한민국", ...COUNTRIES_RAW.filter(c => c !== "대한민국").sort((a, b) => a.localeCompare(b, "ko")), "기타"];
export const SHOOT_TYPES_VIDEO = ["CF/TVC","바이럴영상","SNS영상","홈쇼핑","유튜브","브랜드필름","방송"];
export const USAGE_SCOPES = ["온라인","스폰서애드","잡지","옥외광고","인쇄물","홈쇼핑","TVC"];
export const USAGE_PERIODS = ["6개월","12개월","24개월","기타"];
export const HOURS = [1,2,3,4,5,6,7,8,9,10,11,12];
export const MINS  = [0,10,20,30,40,50];

// ── 섭외 상태 ────────────────────────────────────────────────────
export const STATUS: Record<string, { label: string; color: string; bg: string }> = {
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
export const BOOKING_TYPES: Record<string, { label: string; icon: string; color: string; hasContract: boolean }> = {
  SHOOT:    { label:"촬영",      icon:"📷", color:"#3b82f6", hasContract:true  },
  MEETING:  { label:"실물 미팅", icon:"🤝", color:"#8b5cf6", hasContract:false },
  FITTING:  { label:"피팅",      icon:"👗", color:"#ec4899", hasContract:false },
  AUDITION: { label:"오디션",    icon:"🎬", color:"#f59e0b", hasContract:false },
};

// ── 한국 국경일 (2025~2027, 대체공휴일 포함) ──────────────────
// ⚠️ 매년 정부 발표에 따라 달라질 수 있음 — 필요 시 여기서 직접 수정
export const KR_HOLIDAYS: Record<string, string> = {
  // 2025
  "2025-01-01":"신정", "2025-01-27":"임시공휴일", "2025-01-28":"설연휴", "2025-01-29":"설날", "2025-01-30":"설연휴",
  "2025-03-01":"삼일절", "2025-03-03":"대체공휴일", "2025-05-05":"어린이날·부처님오신날", "2025-05-06":"대체공휴일",
  "2025-06-06":"현충일", "2025-08-15":"광복절", "2025-10-03":"개천절",
  "2025-10-05":"추석연휴", "2025-10-06":"추석", "2025-10-07":"추석연휴", "2025-10-08":"대체공휴일",
  "2025-10-09":"한글날", "2025-12-25":"성탄절",
  // 2026
  "2026-01-01":"신정", "2026-02-16":"설연휴", "2026-02-17":"설날", "2026-02-18":"설연휴",
  "2026-03-01":"삼일절", "2026-03-02":"대체공휴일", "2026-05-05":"어린이날", "2026-05-24":"부처님오신날", "2026-05-25":"대체공휴일",
  "2026-06-03":"지방선거일", "2026-06-06":"현충일", "2026-08-15":"광복절", "2026-08-17":"대체공휴일",
  "2026-09-24":"추석연휴", "2026-09-25":"추석", "2026-09-26":"추석연휴",
  "2026-10-03":"개천절", "2026-10-05":"대체공휴일", "2026-10-09":"한글날", "2026-12-25":"성탄절",
  // 2027
  "2027-01-01":"신정", "2027-02-06":"설연휴", "2027-02-07":"설날", "2027-02-08":"설연휴", "2027-02-09":"대체공휴일",
  "2027-03-01":"삼일절", "2027-05-05":"어린이날", "2027-05-13":"부처님오신날",
  "2027-06-06":"현충일", "2027-08-15":"광복절", "2027-08-16":"대체공휴일",
  "2027-09-14":"추석연휴", "2027-09-15":"추석", "2027-09-16":"추석연휴",
  "2027-10-03":"개천절", "2027-10-04":"대체공휴일", "2027-10-09":"한글날", "2027-10-11":"대체공휴일", "2027-12-25":"성탄절",
};

// 타입별 상태: 비촬영(미팅·피팅·오디션)은 요청→확정→완료 3단계
export const statusLabelForType = (type: string|undefined, code: string): string => {
  const nonShoot = !!type && !BOOKING_TYPES[type]?.hasContract;
  const ML: Record<string,string> = { INQUIRY:"요청", CONFIRMED:"확정", COMPLETED:"완료" };
  if (nonShoot && ML[code]) return ML[code];
  return STATUS[code]?.label || code;
};
export const statusOptionsForType = (type: string|undefined, current?: string): [string,string][] => {
  const nonShoot = !!type && !BOOKING_TYPES[type]?.hasContract;
  if (!nonShoot) return Object.entries(STATUS).map(([k,v])=>[k,v.label] as [string,string]);
  const base: [string,string][] = [["INQUIRY","요청"],["CONFIRMED","확정"],["COMPLETED","완료"],["CANCELLED","취소"]];
  if (current==="HOLD") base.splice(3,0,["HOLD","HOLD"]);
  return base;
};
