// ==========================================================
// 설정 — 실제 배포 전 반드시 확인/교체하세요
// ==========================================================
export const CONFIG = {
  // true 이면 실제 API 호출 없이 데모 데이터로 동작.
  //   ⚠ 현재 화면의 기업/개인/통관 내역은 모두 가상의 데모 샘플이며 실제 통관 기록이 아닙니다.
  USE_MOCK: true,

  // 데이터 출처 표기 (화면 하단/헤더에 노출)
  DATA_SOURCE: "관세청·식품의약품안전처 수입식품정보 (data.go.kr)",

  // data.go.kr 에서 발급받은 서비스 키 (실 데이터 연동 시 입력)
  //   ⚠ 공개 저장소에 키를 커밋하지 마세요. 배포 시 본인 프록시/서버 환경변수로 주입 권장.
  SERVICE_KEY: "YOUR_SERVICE_KEY_HERE",

  // 실제 오픈 API 엔드포인트 (관세청/식약처 문서에서 확인 후 교체)
  //   예) 식약처 수입식품 정보:  https://apis.data.go.kr/1471000/...
  //   ⚠ 아래 URL과 파라미터 이름은 예시입니다.
  API_BASE: "https://apis.data.go.kr/OPEN_API_PATH",

  // 브라우저 CORS 제약 회피용 프록시.
  //   ⚠ 공개 프록시는 신뢰성/보안 이슈가 있으니 가급적 본인 프록시 사용 권장.
  CORS_PROXY: "", // 예: "https://your-proxy.example.com/?url="

  PAGE_SIZE: 50,
};

// 국가 코드 → 국기 이모지 매핑 (필요시 확장)
export const FLAGS = {
  "중국": "🇨🇳", "미국": "🇺🇸", "일본": "🇯🇵", "베트남": "🇻🇳",
  "태국": "🇹🇭", "이탈리아": "🇮🇹", "프랑스": "🇫🇷", "호주": "🇦🇺",
  "독일": "🇩🇪", "스페인": "🇪🇸", "기타": "🏳️",
};

// 지역 → 지리정보(위경도) + 관할 세관 + 대표 반입항 + 주소.
// 세관/항만은 실제 공개 정보 기반이며, 지도(Leaflet)의 마커 위치로 사용됩니다.
export const REGION_GEO = {
  "서울": { lat: 37.5665, lng: 126.9780, customs: "서울본부세관", port: "인천항(관할)",   addr: "서울특별시 강남구 언주로 721" },
  "인천": { lat: 37.4563, lng: 126.7052, customs: "인천본부세관", port: "인천항·인천공항", addr: "인천광역시 중구 서해대로 339" },
  "경기": { lat: 36.9905, lng: 126.8227, customs: "평택직할세관", port: "평택항",         addr: "경기도 평택시 포승읍 평택항만길" },
  "부산": { lat: 35.1028, lng: 129.0403, customs: "부산본부세관", port: "부산항",         addr: "부산광역시 중구 충장대로 20" },
  "충남": { lat: 36.5184, lng: 126.8000, customs: "대전세관",     port: "대산항",         addr: "대전광역시 대덕구 문평동" },
  "경남": { lat: 35.2280, lng: 128.6811, customs: "창원세관",     port: "김해공항",       addr: "경상남도 창원시 성산구" },
  "전남": { lat: 34.9407, lng: 127.6959, customs: "광양세관",     port: "광양항",         addr: "전라남도 광양시 항만대로" },
  "대구": { lat: 35.8714, lng: 128.6014, customs: "대구본부세관", port: "대구공항",       addr: "대구광역시 동구 첨단로" },
  "제주": { lat: 33.4996, lng: 126.5312, customs: "제주세관",     port: "제주항",         addr: "제주특별자치도 제주시 임항로" },
};

// ----------------------------------------------------------
// 응답 파싱: 실제 스키마에 맞게 매핑 함수를 수정하세요.
// 표준화된 레코드 형태:
//   { id, date, country, port, category, itemName, weight,
//     importer, manufacturer, status, hazard }
// status: "pass" | "review" | "fail"
// ----------------------------------------------------------
function normalize(raw) {
  return {
    id:           String(raw.id ?? raw.declNo ?? crypto.randomUUID()),
    date:         raw.date ?? raw.declDate ?? "",
    country:      raw.country ?? raw.orgnCd ?? "기타",
    port:         raw.port ?? raw.entryPort ?? "",
    category:     raw.category ?? raw.prductClass ?? "",
    itemName:     raw.itemName ?? raw.prductNm ?? "",
    weight:       raw.weight ?? raw.wght ?? "",
    importer:     raw.importer ?? raw.bsnmNm ?? "",
    region:       raw.region ?? raw.bsnmRegn ?? "",
    manufacturer: raw.manufacturer ?? raw.ovsMnftrNm ?? "",
    status:       mapStatus(raw.status ?? raw.processSttus),
    hazard:       raw.hazard ?? raw.hrmflChmcl ?? "",
  };
}

function mapStatus(s) {
  if (!s) return "review";
  const v = String(s);
  if (/부적합|불합격|fail/i.test(v)) return "fail";
  if (/허용|적합|수리|pass/i.test(v)) return "pass";
  return "review";
}

// ----------------------------------------------------------
// 메인 fetch 함수
// ----------------------------------------------------------
export async function fetchRecords() {
  if (CONFIG.USE_MOCK) return mockFetch();

  const params = new URLSearchParams({
    serviceKey: CONFIG.SERVICE_KEY,
    numOfRows: CONFIG.PAGE_SIZE,
    pageNo: 1,
    type: "json",
  });
  let url = `${CONFIG.API_BASE}?${params.toString()}`;
  if (CONFIG.CORS_PROXY) url = CONFIG.CORS_PROXY + encodeURIComponent(url);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();

  // ⚠ 실제 응답 경로(items 위치)에 맞게 수정
  const items = data?.response?.body?.items?.item ?? data?.items ?? [];
  return (Array.isArray(items) ? items : [items]).map(normalize);
}

// ----------------------------------------------------------
// 목업 데이터 생성기 (테스트/데모용)
// ----------------------------------------------------------
// 고정 수입자(기업/개인) 풀 — 반복 등장하여 수입자·지역 집계가 의미를 갖도록 함
const IMPORTERS = [
  { name: "㈜한울무역",       region: "서울" },
  { name: "글로벌푸드코리아㈜", region: "경기" },
  { name: "부산종합식품㈜",    region: "부산" },
  { name: "대양수산㈜",        region: "부산" },
  { name: "인천항만유통㈜",    region: "인천" },
  { name: "충청농산㈜",        region: "충남" },
  { name: "영남물산㈜",        region: "경남" },
  { name: "호남식자재㈜",      region: "전남" },
  { name: "㈜서울델리마트",    region: "서울" },
  { name: "제주오션㈜",        region: "제주" },
  { name: "김수입 (개인)",     region: "경기" },
  { name: "이통상 (개인)",     region: "대구" },
];

const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// 최근 N일 이내의 임의 신고일(YYYY-MM-DD) — 최근 쪽으로 편향
function recentDate() {
  const daysAgo = Math.floor(Math.random() ** 2 * 30); // 0~29일, 오늘 쪽 편향
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

let mockSeq = 1000;
function mockFetch() {
  const countries = Object.keys(FLAGS).filter(c => c !== "기타");
  const ports = ["인천항", "부산항", "평택항", "인천공항", "김해공항"];
  const items = [
    ["가공식품", "냉동만두"], ["농산물", "건고추"], ["수산물", "냉동새우"],
    ["주류", "레드와인"], ["과자류", "초콜릿"], ["유제품", "체다치즈"],
  ];
  const statuses = ["pass", "pass", "pass", "review", "fail"];
  const hazards = ["잔류농약 초과(클로르피리포스)", "식중독균 검출(리스테리아)", "중금속(납) 기준초과"];

  const n = 3 + Math.floor(Math.random() * 4);
  const out = [];
  for (let i = 0; i < n; i++) {
    const st = pick(statuses);
    const [cat, name] = pick(items);
    const imp = pick(IMPORTERS);
    out.push({
      id: String(mockSeq++),
      date: recentDate(),
      country: pick(countries),
      port: pick(ports),
      category: cat,
      itemName: name,
      weight: `${(Math.random() * 5000).toFixed(0)} kg`,
      importer: imp.name,
      region: imp.region,
      manufacturer: `Overseas Foods Co. #${Math.floor(Math.random() * 900 + 100)}`,
      status: st,
      hazard: st === "fail" ? pick(hazards) : "",
    });
  }
  return new Promise(r => setTimeout(() => r(out.map(normalize)), 300));
}
