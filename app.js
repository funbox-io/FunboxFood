import { fetchRecords } from "./api.js";
import { Store } from "./store.js";
import { UI } from "./ui.js";

const POLL_INTERVAL = 60_000; // 60초 (60~300초 사이 조정 가능)
const store = new Store();
let lastNewIds = new Set();
let timer = null;
let polling = true;

function render() {
  const all = store.all();
  UI.renderCountryBar(all);
  UI.renderTable(all, lastNewIds);
}

async function poll() {
  try {
    UI.setStatus("live", "데이터 수신 중…");
    const batch = await fetchRecords();
    const newIds = store.ingest(batch);
    lastNewIds = new Set(newIds);
    render();
    UI.setStatus("live", "실시간");
    UI.setLastUpdated(new Date());
    // 애니메이션 종료 후 신규 표시 해제
    setTimeout(() => { lastNewIds = new Set(); }, 3000);
  } catch (err) {
    console.error(err);
    UI.setStatus("error", `오류: ${err.message}`);
  }
}

function startPolling() {
  poll();
  timer = setInterval(poll, POLL_INTERVAL);
}

function togglePoll() {
  polling = !polling;
  UI.setPollBtn(polling);
  if (polling) startPolling();
  else { clearInterval(timer); UI.setStatus("idle", "일시정지됨"); }
}

UI.init({
  onRowClick: (r) => {
    const all = store.all();
    const same = all.filter(x => x.country === r.country);
    UI.openModal(r, {
      countryTotal: same.length,
      countryFail: same.filter(x => x.status === "fail").length,
    });
  },
  onCountryFilter: render,
  onSearch: render,
  onTogglePoll: togglePoll,
});

startPolling();
