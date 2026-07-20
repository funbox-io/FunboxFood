/* app.js — 대시보드 기능 로직: 필터·렌더·드릴다운·모달·CSV·실시간 폴링 */

/* ═══════════ 상태 & 헬퍼 ═══════════ */
const $=id=>document.getElementById(id);
const ts=()=>new Date().toLocaleTimeString("ko-KR",{hour12:false});
let filter={country:"all",status:"all",q:"",start:"",end:""};
let selCountry=null, sessionFail=0, sessionNew=0;
let polling=true, timer=null, countdown=5;

function log(html){const f=$("feed"),d=document.createElement("div");d.innerHTML=`<span class="t">[${ts()}]</span> ${html}`;f.appendChild(d);while(f.children.length>80)f.removeChild(f.firstChild);f.scrollTop=f.scrollHeight;}

function applyFilter(){
  const q=filter.q.toLowerCase();
  return DATA.filter(d=>{
    if(filter.country!=="all"&&d.c!==filter.country)return false;
    if(filter.status!=="all"&&d.status!==filter.status)return false;
    if(filter.start&&d.day<filter.start)return false;
    if(filter.end&&d.day>filter.end)return false;
    if(q&&![d.buyer,d.item,d.region,d.c,d.co,d.reason,d.buyerLoc].join(" ").toLowerCase().includes(q))return false;
    return true;
  });
}

/* ═══════════ 렌더 ═══════════ */
// 수집 데이터 단일 순회 통계 (국가별 건수/부적합 + 전체 부적합) — 렌더마다 1회만 계산
function computeStats(){
  const cnt={}, fail={}; let totalFail=0;
  for(const d of DATA){
    cnt[d.c]=(cnt[d.c]||0)+1;
    if(d.status==="부적합"){fail[d.c]=(fail[d.c]||0)+1; totalFail++;}
  }
  return {cnt, fail, totalFail, total:DATA.length||1};
}
let stats = null; // renderAll 시 갱신, openDetail/updateKpi에서 재사용

function renderOrigins(){
  const {cnt,total}=stats;
  // 수집 비중 내림차순 정렬 (실시간 순위)
  const rows=[...ORIGINS].sort((a,b)=>(cnt[b.c]||0)-(cnt[a.c]||0));
  $("originBody").innerHTML = rows.map((o,rank)=>{
    const n=cnt[o.c]||0, share=(n/total*100).toFixed(1);
    return `<tr data-c="${o.c}" class="${o.c===selCountry?'sel':''}" onclick="openDetail('${o.c}')">
      <td class="num" style="color:var(--ink-dim)">${rank+1}</td>
      <td><span class="flag">${o.f}</span>${o.c}${n?`<span class="co-badge">건 ${n}</span>`:""}</td>
      <td>${o.items.map(it=>`<span class="item-chip">${it}</span>`).join("")}</td>
      <td class="num"><b style="color:var(--sky)">${share}%</b><div class="sub" style="margin-top:2px">연간: ${o.annual}</div></td></tr>`;
  }).join("");
}
function renderTypes(){
  const max=Math.max(...TYPES.map(t=>t.v));
  $("typesBox").innerHTML=TYPES.map(t=>
    `<div class="type-row"><span>${t.t}</span>
      <div class="type-bar-bg"><div class="type-bar" style="width:${(t.v/max*100).toFixed(1)}%;background:${t.col}"></div></div>
      <span class="cnt" style="color:${t.col}">${t.v.toFixed(1)}%</span></div>`).join("");
}
let newFlagTimer=null; // isNew 해제 타이머 중첩 방지
function renderTable(){
  const rows=applyFilter();
  $("shownN").textContent=rows.length;
  $("liveBody").innerHTML = rows.length ? rows.map(d=>`
    <tr class="${d.isNew?'new-row':''}" onclick="openRec('${d.id}')">
      <td><div class="time">${d.day}</div><div class="sub">${d.date.slice(11)} · ${d.id}</div></td>
      <td style="white-space:nowrap"><span class="flag">${d.f}</span>${d.c}</td>
      <td><div style="font-weight:600">${d.item}</div><div class="sub">${d.qty} · ${d.type}</div></td>
      <td><div class="co-name">${d.co}</div><div class="sub loc">📍 ${d.region} 통관</div></td>
      <td><div style="font-weight:600;font-size:12px">${d.buyer}</div><div class="sub">${d.buyerLoc} · 유통 ${d.dist.length}곳</div></td>
      <td><span class="status s-${d.status}">${d.status}</span></td>
      <td><div class="reason ${d.status==='부적합'?'fail':''}">${d.status==='부적합'?'⚠ ':''}${d.reason}</div></td>
    </tr>`).join("") : `<tr><td colspan="7" class="empty">조건에 일치하는 데이터가 없습니다.</td></tr>`;
  clearTimeout(newFlagTimer);
  newFlagTimer=setTimeout(()=>DATA.forEach(d=>d.isNew=false),3000);
}
function renderAll(){stats=computeStats();renderOrigins();renderTable();renderTrend();}

/* ═══════════ 일별 수집 추이 라인 차트 (최근 14일, SVG + hover) ═══════════ */
function renderTrend(){
  const box=$("trendBox");
  const days=[], now=new Date();
  for(let i=13;i>=0;i--){const d=new Date(now);d.setDate(now.getDate()-i);days.push(dayStr(d));}
  const idx=new Map(days.map((d,i)=>[d,i]));
  const tot=Array(14).fill(0), fl=Array(14).fill(0);
  for(const d of DATA){const i=idx.get(d.day);if(i!==undefined){tot[i]++;if(d.status==="부적합")fl[i]++;}}

  const W=560,H=190,ml=28,mr=10,mt=12,mb=22,iw=W-ml-mr,ih=H-mt-mb;
  const yMax=Math.max(5,Math.ceil(Math.max(...tot)/5)*5);
  const x=i=>ml+iw*i/13, y=v=>mt+ih-(v/yMax)*ih;
  let grid="",xl="";
  for(let k=0;k<=4;k++){const v=yMax/4*k,gy=y(v);
    grid+=`<line x1="${ml}" y1="${gy}" x2="${W-mr}" y2="${gy}" stroke="var(--line)" stroke-width="1" opacity=".6"/>`
        +`<text x="${ml-5}" y="${gy+3}" text-anchor="end" font-size="9" fill="var(--ink-dim)">${v}</text>`;}
  for(let i=0;i<14;i+=3) xl+=`<text x="${x(i)}" y="${H-6}" text-anchor="middle" font-size="9" fill="var(--ink-dim)">${days[i].slice(5)}</text>`;
  const path=a=>a.map((v,i)=>`${i?"L":"M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const dots=(a,c)=>a.map((v,i)=>`<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="2.5" fill="${c}"/>`).join("");
  box.innerHTML=`<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block">
    ${grid}${xl}
    <path d="${path(tot)}" fill="none" stroke="var(--sky)" stroke-width="2" stroke-linejoin="round"/>
    <path d="${path(fl)}" fill="none" stroke="var(--coral)" stroke-width="2" stroke-linejoin="round"/>
    ${dots(tot,"var(--sky)")}${dots(fl,"var(--coral)")}
    <line id="tCross" y1="${mt}" y2="${mt+ih}" stroke="var(--ink-dim)" stroke-width="1" stroke-dasharray="3 3" style="display:none"/>
    <rect id="tHit" x="${ml}" y="${mt}" width="${iw}" height="${ih}" fill="transparent" style="cursor:crosshair"/></svg>
    <div id="tTip" style="position:absolute;display:none;pointer-events:none;background:var(--panel-2);border:1px solid var(--line);border-radius:6px;padding:5px 8px;font-size:11px;font-family:var(--mono);white-space:nowrap;transform:translate(-50%,-110%);z-index:5"></div>`;
  const svg=box.querySelector("svg"),hit=$("tHit"),cross=$("tCross"),tip=$("tTip");
  hit.onmousemove=e=>{
    const r=svg.getBoundingClientRect();
    let i=Math.round(((e.clientX-r.left)*(W/r.width)-ml)/iw*13); i=Math.max(0,Math.min(13,i));
    cross.setAttribute("x1",x(i));cross.setAttribute("x2",x(i));cross.style.display="block";
    tip.style.display="block";tip.style.left=(x(i)/W*r.width)+"px";tip.style.top=(mt/H*r.height+4)+"px";
    tip.innerHTML=`${days[i].slice(5)} · <span style="color:var(--sky)">수집 ${tot[i]}</span> · <span style="color:var(--coral)">부적합 ${fl[i]}</span>`;
  };
  hit.onmouseleave=()=>{cross.style.display="none";tip.style.display="none";};
}

/* 국가 상세 드릴다운 */
// 패널 내용 렌더 (열기/스크롤과 분리 — 폴링 시 열린 패널 자동 갱신에 재사용)
function renderDetail(country){
  const o=ORIGINS.find(x=>x.c===country);
  if(!o) return;
  if(!stats) stats=computeStats();
  const recs=DATA.filter(d=>d.c===country);
  const fails=stats.fail[country]||0;
  const share=((stats.cnt[country]||0)/stats.total*100).toFixed(1);
  $("dFlag").textContent=o.f; $("dName").textContent=country;
  $("dStats").innerHTML=`수집 비중 <b>${share}%</b> · 연간(2025): <b>${o.annual}</b> · 수집 레코드 <b>${recs.length}</b>건 · 부적합 <b>${fails}</b>건`;
  // 품목 집계
  const byItem={}; recs.forEach(d=>byItem[d.item]=(byItem[d.item]||0)+1);
  const items=Object.entries(byItem).sort((a,b)=>b[1]-a[1]);
  $("foodList").innerHTML = items.length ? items.map(([n,c])=>
    `<div class="food-row"><span>${n}</span><span class="fcnt">${c}건</span></div>`).join("")
    : `<div class="sub" style="padding:8px">주요 품목: ${o.items.join(", ")}</div>`;
  // 업체 집계
  const byCo={}; recs.forEach(d=>{(byCo[d.buyer]=byCo[d.buyer]||{loc:d.buyerLoc,n:0}).n++;});
  const cos=Object.entries(byCo).sort((a,b)=>b[1].n-a[1].n);
  $("coList").innerHTML = cos.length ? cos.map(([name,v])=>
    `<div class="co-row"><a href="#" onclick="openBuyer('${name}');return false" class="co-name" style="text-decoration:underline">${name} ↗</a> <span class="loc">📍 ${v.loc}</span>
      <div class="sub">수집 통관 ${v.n}건 · 클릭 시 구매자 상세(주소·유통처)</div></div>`).join("")
    : `<div class="sub" style="padding:8px">해당 국가의 수집 업체 데이터가 없습니다.</div>`;
}
window.openDetail=function(country){
  const o=ORIGINS.find(x=>x.c===country);
  if(!o) return;
  selCountry=country;
  filter.country=country; $("fCountry").value=country;
  renderAll(); // stats 갱신 후 renderDetail이 재사용
  renderDetail(country);
  $("detail").classList.add("open");
  $("detail").scrollIntoView({behavior:"smooth",block:"nearest"});
  log(`<span class="sys">${o.f} ${country}</span> 상세 드릴다운 조회`);
};
$("btnClose").onclick=()=>{selCountry=null;$("detail").classList.remove("open");renderOrigins();};

/* KPI (세션 부적합) */
function updateKpi(){
  if(!stats) stats=computeStats();
  $("kpiFail").textContent=sessionFail;
  $("kpiFailRate").textContent=(stats.totalFail/stats.total*100).toFixed(1);
  $("newN").textContent=sessionNew;
}

/* ═══════════ 이벤트 ═══════════ */
let qTimer=null; // 검색 디바운스(150ms) — 타이핑마다 전체 테이블 재렌더 방지
$("q").oninput=e=>{clearTimeout(qTimer);qTimer=setTimeout(()=>{filter.q=e.target.value;renderTable();},150);};
$("fCountry").onchange=e=>{filter.country=e.target.value;if(e.target.value==="all"){selCountry=null;$("detail").classList.remove("open");}renderAll();};
$("startDate").onchange=e=>{filter.start=e.target.value;renderTable();};
$("endDate").onchange=e=>{filter.end=e.target.value;renderTable();};
const statusBtns=document.querySelectorAll("#statusFilters .fbtn");
statusBtns.forEach(b=>b.onclick=()=>{
  statusBtns.forEach(x=>x.classList.remove("on"));
  b.classList.add("on"); filter.status=b.dataset.s; renderTable();
});

/* 신고 건 상세 모달 */
const rmRow=(k,v)=>`<div class="rm-row"><span class="k">${k}</span><span class="v">${v}</span></div>`;
const buyerLink=name=>`<a href="#" onclick="openBuyer('${name}');return false" style="color:var(--sky);font-weight:600">${name} ↗</a>`;

window.openRec=function(id){
  const d=DATA.find(x=>x.id===id); if(!d)return;
  const comp=COMPANIES.find(c=>c.n===d.buyer);
  $("rmTitle").innerHTML=`${d.f} ${d.item} <span class="status s-${d.status}" style="font-size:11px">${d.status}</span>`;
  $("rmBody").innerHTML=
    rmRow("신고번호",d.id)+rmRow("신고 일시",d.date)+
    rmRow("원산지",`${d.f} ${d.c}`)+rmRow("반입 지역",`📍 ${d.region}`)+
    rmRow("품목",`${d.item} <span class="item-chip">${d.type}</span>`)+rmRow("수량",d.qty)+
    rmRow("해외 제조/수출",`<span class="co-name">${d.co}</span>`)+
    rmRow("국내 구매자",buyerLink(d.buyer))+
    rmRow("구매자 주소",comp?comp.addr:d.buyerLoc)+
    rmRow("검사 사유 / 검출",`<span class="${d.status==='부적합'?'reason fail':''}">${d.status==='부적합'?'⚠ ':''}${d.reason}</span>`)+
    `<div style="margin:14px 0 4px;font-size:12px;font-weight:600;color:var(--ink-dim)">🏪 국내 유통/구매처 (${d.dist.length}곳)</div>`+
    d.dist.map(x=>rmRow(x.n,`<span class="sub" style="margin:0">${x.addr}</span>`)).join("");
  $("recModal").classList.add("open");
};

/* 구매자(기업/개인) 상세 모달 — 소재지·사업자정보·수집 이력·거래 유통처 */
window.openBuyer=function(name){
  const comp=COMPANIES.find(c=>c.n===name); if(!comp)return;
  const recs=DATA.filter(d=>d.buyer===name);
  const fails=recs.filter(d=>d.status==="부적합").length;
  // 수입 품목 집계
  const byItem={}; recs.forEach(d=>byItem[d.item]=(byItem[d.item]||0)+1);
  const items=Object.entries(byItem).sort((a,b)=>b[1]-a[1]);
  // 거래 유통처 집계 (중복 제거)
  const distMap=new Map(); recs.forEach(d=>d.dist.forEach(x=>distMap.set(x.n,x)));
  $("rmTitle").innerHTML=`🏢 ${name}`;
  $("rmBody").innerHTML=
    rmRow("소재지",comp.addr)+
    rmRow("사업자등록번호",comp.biz)+
    rmRow("대표번호",comp.tel)+
    rmRow("수집 통관",`${recs.length}건 · <span style="color:var(--coral)">부적합 ${fails}건</span>`)+
    `<div style="margin:14px 0 4px;font-size:12px;font-weight:600;color:var(--ink-dim)">🍱 수입 품목 (${items.length}종)</div>`+
    (items.map(([n,c])=>rmRow(n,`${c}건`)).join("")||`<div class="sub" style="padding:6px 2px">수집된 품목 없음</div>`)+
    `<div style="margin:14px 0 4px;font-size:12px;font-weight:600;color:var(--ink-dim)">🏪 거래 유통/구매처 (${distMap.size}곳)</div>`+
    ([...distMap.values()].map(x=>rmRow(x.n,`<span class="sub" style="margin:0">${x.addr}</span>`)).join("")||`<div class="sub" style="padding:6px 2px">거래처 정보 없음</div>`);
  $("recModal").classList.add("open");
};
$("rmClose").onclick=()=>$("recModal").classList.remove("open");
$("recModal").onclick=e=>{if(e.target.id==="recModal")$("recModal").classList.remove("open");};
document.addEventListener("keydown",e=>{if(e.key==="Escape")$("recModal").classList.remove("open");});

/* CSV 내보내기 (현재 필터 결과, Excel 한글 호환 BOM) */
$("btnCsv").onclick=()=>{
  const rows=applyFilter();
  const esc=v=>`"${String(v).replace(/"/g,'""')}"`;
  const head=["신고번호","신고일시","원산지","반입지역","품목","품목군","수량","해외기업","국내구매자","소재지","유통처","상태","사유"];
  const csv=String.fromCharCode(0xFEFF)+[head.join(","),  // BOM: Excel 한글 호환
    ...rows.map(d=>[d.id,d.date,d.c,d.region,d.item,d.type,d.qty,d.co,d.buyer,d.buyerLoc,d.dist.map(x=>x.n).join(" / "),d.status,d.reason].map(esc).join(","))
  ].join("\r\n");
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  a.download=`import-monitor-${dayStr(new Date())}.csv`;
  a.click(); URL.revokeObjectURL(a.href);
  log(`<span class="sys">CSV 내보내기</span> · ${rows.length}건`);
};

/* ═══════════ 폴링 ═══════════ */
function poll(){
  const rec=makeRecord(new Date()); rec.isNew=true;
  DATA.unshift(rec); if(DATA.length>300)DATA.pop();
  sessionNew++; if(rec.status==="부적합")sessionFail++;
  $("lastSync").textContent=ts();
  const cls=rec.status==="부적합"?"warn":(rec.status==="검토중"?"sys":"ok");
  log(`<span class="co">${rec.f} ${rec.buyer}</span> · ${rec.item} → <span class="${cls}">${rec.status}</span>`);
  renderAll(); updateKpi();
  if(selCountry) renderDetail(selCountry); // 열린 국가 상세 패널도 실시간 갱신
}
function tick(){
  if(!polling)return;
  countdown--; $("countdown").textContent=countdown+"s";
  if(countdown<=0){poll();countdown=5;}
}
function startTimer(){clearInterval(timer);timer=setInterval(tick,1000);}
$("togglePoll").onclick=()=>{
  polling=!polling;
  const b=$("togglePoll");
  if(polling){b.textContent="■ 수집 정지";b.classList.remove("off");$("liveDot").classList.remove("off");$("liveTxt").textContent="실시간 수집중";$("feedTag").textContent="POLLING ACTIVE";countdown=5;startTimer();log(`<span class="sys">실시간 수집 재개</span>`);}
  else{clearInterval(timer);b.textContent="▶ 수집 재개";b.classList.add("off");$("liveDot").classList.add("off");$("liveTxt").textContent="수집 정지됨";$("countdown").textContent="—";$("feedTag").textContent="PAUSED";log(`<span class="warn">실시간 수집 정지</span>`);}
};

/* ═══════════ 초기화 ═══════════ */
ORIGINS.forEach(o=>{const op=document.createElement("option");op.value=o.c;op.textContent=`${o.f} ${o.c}`;$("fCountry").appendChild(op);});
$("trendLegend").innerHTML=
  `<span class="legend-chip"><i style="background:var(--sky)"></i><span>수집</span></span>`+
  `<span class="legend-chip"><i style="background:var(--coral)"></i><span>부적합</span></span>`;
$("endDate").value=dayStr(new Date()); // 로컬 기준 오늘
$("lastSync").textContent=ts();
// sessionFail은 0에서 시작 — '세션(접속 이후)' 신규 부적합만 집계
renderTypes(); renderAll(); updateKpi();
log(`<span class="sys">대시보드 초기화 완료</span> · 시드 데이터 ${DATA.length}건 로드`);
startTimer();
