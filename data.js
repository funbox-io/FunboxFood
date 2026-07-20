/* data.js — 검사연보 기반 집계 통계 + 데모 샘플 데이터 풀/레코드 생성기
   (개별 레코드는 가상의 데모 샘플이며 실제 통관 기록이 아님) */

/* ═══════════ 데이터 (집계 통계는 식약처 2025년 발표 기준 웹 검증, 개별 레코드는 데모 샘플) ═══════════ */
// 연간(annual) 표기는 식약처가 공표한 범위만 기재 — 개별국 비중 미공표 국가는 "—"
const ORIGINS = [
  {c:"미국",     f:"🇺🇸", annual:"상위3국 합산 55.2%", items:["밀","옥수수","대두","냉동 돼지고기"]},
  {c:"중국",     f:"🇨🇳", annual:"상위3국 합산 55.2%", items:["김치","정제소금","신선채소","기구·용기"]},
  {c:"호주",     f:"🇦🇺", annual:"상위3국 합산 55.2%", items:["밀","정제용 식품원료","소고기"]},
  {c:"태국",     f:"🇹🇭", annual:"수입량 4위 · 106.2만t", items:["냉동새우","가공식품","쌀"]},
  {c:"브라질",   f:"🇧🇷", annual:"수입량 5위", items:["닭고기","대두","원당"]},
  {c:"베트남",   f:"🇻🇳", annual:"—", items:["냉동수산물","냉동과일","커피"]},
  {c:"이탈리아", f:"🇮🇹", annual:"—", items:["포도주","치즈","파스타"]},
  {c:"일본",     f:"🇯🇵", annual:"—", items:["소스류","가공식품","맥주"]},
  {c:"프랑스",   f:"🇫🇷", annual:"—", items:["포도주","유제품","제과"]},
  {c:"독일",     f:"🇩🇪", annual:"—", items:["돼지고기","맥주","가공육"]},
];
// 2025년 품목군별 수입 중량 비중 (식약처 발표: 농·임산물 866.8만t 등 / 기타는 잔여분 산출)
const TYPES = [
  {t:"농·임산물",     v:44.8, col:"#5aa7ff"},
  {t:"가공식품",      v:35.0, col:"#3ddc97"},
  {t:"축산물",        v:9.8,  col:"#ffb547"},
  {t:"수산물",        v:4.9,  col:"#c792ea"},
  {t:"기타(건기식 등)", v:5.5,  col:"#8fa1b8"},
];
// 데모 샘플 풀 (가상)
const REGIONS = ["부산항","인천항","평택항","인천공항","광양항","김해공항","울산항"];
const COMPANIES = [
  {n:"(주)글로벌푸드", loc:"서울 강남구", addr:"서울 강남구 테헤란로 152, 10층", biz:"120-81-34**7", tel:"02-555-01**"},
  {n:"대명무역",       loc:"인천 중구",   addr:"인천 중구 서해대로 366, 항동7가", biz:"214-86-77**2", tel:"032-888-23**"},
  {n:"신정푸드(주)",   loc:"경기 파주시", addr:"경기 파주시 문산읍 돈유2로 27",   biz:"135-81-90**4", tel:"031-940-55**"},
  {n:"제일인터내셔널", loc:"부산 동구",   addr:"부산 동구 충장대로 206, 5층",     biz:"605-81-12**8", tel:"051-463-77**"},
  {n:"아시아유통",     loc:"경기 평택시", addr:"경기 평택시 포승읍 평택항로 98",  biz:"125-86-45**1", tel:"031-686-90**"},
  {n:"동북아로지스",   loc:"인천 연수구", addr:"인천 연수구 인천신항대로 892",    biz:"131-86-23**6", tel:"032-830-44**"},
  {n:"오션푸드(주)",   loc:"부산 사하구", addr:"부산 사하구 다대로 172, 수산가공단지", biz:"602-81-56**3", tel:"051-262-88**"},
  {n:"그린식품(주)",   loc:"충남 천안시", addr:"충남 천안시 서북구 2공단로 118",  biz:"312-81-67**9", tel:"041-566-12**"},
  {n:"한울무역",       loc:"서울 송파구", addr:"서울 송파구 법원로 128, 문정법조단지", biz:"215-87-89**5", tel:"02-404-33**"},
  {n:"제주오션(주)",   loc:"제주 제주시", addr:"제주 제주시 임항로 68, 수협빌딩 3층", biz:"616-81-01**2", tel:"064-751-66**"},
  {n:"김수입 (개인)",  loc:"경기 성남시", addr:"경기 성남시 분당구 판교로 235",   biz:"개인사업자 129-**-***45", tel:"031-705-98**"},
  {n:"이통상 (개인)",  loc:"대구 달서구", addr:"대구 달서구 성서공단로 205",      biz:"개인사업자 514-**-***81", tel:"053-582-34**"},
];
// 국내 유통/구매처 풀 — 레코드마다 1~3곳 연결 (구매자 다수 정보)
//   ⚠ 상호·주소 전부 가상 (실존 기업·매장과 무관)
const DISTRIBUTORS = [
  {n:"한빛마트 성수점",         addr:"서울 성동구 한빛로 12"},
  {n:"미래로마트 서울역점",     addr:"서울 중구 미래로 45"},
  {n:"늘푸른마트 센텀점",       addr:"부산 해운대구 늘푸른로 8"},
  {n:"새벽프레시 이천물류센터", addr:"경기 이천시 새벽로 77"},
  {n:"들녘마트 양재점",         addr:"서울 서초구 들녘길 23"},
  {n:"대양홀세일 광명점",       addr:"경기 광명시 대양로 51"},
  {n:"백년식자재마트",          addr:"대구 달서구 백년상가길 11"},
  {n:"남도식자재 도매",         addr:"광주 서구 남도길 53"},
  {n:"남항수산 도매센터",       addr:"부산 서구 남항로 20"},
  {n:"강원종합식품 도매센터",   addr:"강원 원주시 들목길 30"},
];
const OVERSEAS = ["QINGDAO FOODS","AUSTRALIAN MEAT CO.","VIET FRUIT LTD.","NIKKO SAUCE CO.","SEAFOOD VN CO.","SPICE CHINA","HEALTH BIO LLC.","EURO DAIRY GmbH"];
const ITEMS = [
  {n:"냉동 소고기(갈비)", t:"축산물", q:"24,000 kg"}, {n:"김치(절임배추)", t:"가공식품", q:"18,500 kg"},
  {n:"냉동 흰다리새우",   t:"수산물", q:"12,000 kg"}, {n:"신선당근",       t:"농산물",  q:"48,000 kg"},
  {n:"레드와인",          t:"주류",   q:"2,500 L"},   {n:"체다치즈",       t:"유제품",  q:"1,845 kg"},
  {n:"건강기능식품(비타민C)",t:"건기식",q:"850 kg"},  {n:"혼합간장(소스류)",t:"가공식품",q:"3,200 kg"},
  {n:"냉동 망고 다이스",  t:"농산물", q:"5,000 kg"},  {n:"플라스틱 밀폐용기",t:"기구·용기",q:"20,000 개"},
];
const FAILS = [
  "잔류농약(클로티아니딘) 기준 초과","중금속(납) 기준 초과 검출","동물용의약품(옥시테트라사이클린) 검출",
  "식품사용금지원료 함유","대장균군 양성","보존료(소브산) 부적합","곰팡이독소(아플라톡신) 초과","표시기준 위반(원재료명 누락)",
];
const pick = a => a[Math.floor(Math.random()*a.length)];
const pickN = (a,n) => {const c=[...a],out=[];while(n-->0&&c.length)out.push(c.splice(Math.floor(Math.random()*c.length),1)[0]);return out;};
const pad = n => String(n).padStart(2,"0");
// 로컬(KST) 기준 날짜 문자열 — toISOString은 UTC라 날짜 필터가 어긋나므로 사용 금지
const dayStr = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const fmtDT = d => `${dayStr(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

let seq = 5000;
function makeRecord(dateObj){
  const r = Math.random();
  const status = r>0.85 ? "부적합" : (r>0.6 ? "검토중" : "통관허용");
  const o = pick(ORIGINS), it = pick(ITEMS), co = pick(COMPANIES);
  return {
    id:"IMP-"+(seq++),
    dt:dateObj, date:fmtDT(dateObj), day:dayStr(dateObj),
    c:o.c, f:o.f, region:pick(REGIONS),
    item:it.n, type:it.t, qty:it.q,
    co:pick(OVERSEAS), buyer:co.n, buyerLoc:co.loc,
    dist:pickN(DISTRIBUTORS, 1+Math.floor(Math.random()*3)), // 국내 유통/구매처 1~3곳
    status, reason: status==="부적합"?pick(FAILS):(status==="검토중"?"현장 정밀검사 대기중":"정밀/서류 검사 적합"),
    isNew:false,
  };
}

// 초기 시드: 최근 60일 ~ 오늘, 다양한 날짜
let DATA = [];
for(let i=0;i<48;i++){
  const d=new Date(); d.setDate(d.getDate()-Math.floor(Math.random()**1.5*60));
  d.setHours(Math.floor(Math.random()*24),Math.floor(Math.random()*60),Math.floor(Math.random()*60));
  DATA.push(makeRecord(d));
}
DATA.sort((a,b)=>b.dt-a.dt);
