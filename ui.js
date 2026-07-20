import { FLAGS } from "./api.js";

const statusLabel = { pass: "통관허용", review: "검토중", fail: "부적합" };
const statusClass = { pass: "status-pass", review: "status-review", fail: "status-fail" };

export const UI = {
  els: {},
  filterCountry: null,
  searchTerm: "",
  onRowClick: null,
  onCountryFilter: null,

  init({ onRowClick, onCountryFilter, onSearch, onTogglePoll }) {
    this.els = {
      body: document.getElementById("table-body"),
      countryBar: document.getElementById("country-bar"),
      search: document.getElementById("search"),
      countTotal: document.getElementById("count-total"),
      countNew: document.getElementById("count-new"),
      statusDot: document.getElementById("status-dot"),
      statusText: document.getElementById("status-text"),
      lastUpdated: document.getElementById("last-updated"),
      togglePoll: document.getElementById("toggle-poll"),
      modal: document.getElementById("modal"),
      modalTitle: document.getElementById("modal-title"),
      modalBody: document.getElementById("modal-body"),
      modalClose: document.getElementById("modal-close"),
    };
    this.onRowClick = onRowClick;
    this.onCountryFilter = onCountryFilter;

    this.els.search.addEventListener("input", e => {
      this.searchTerm = e.target.value.trim().toLowerCase();
      onSearch();
    });
    this.els.togglePoll.addEventListener("click", onTogglePoll);
    this.els.modalClose.addEventListener("click", () => this.closeModal());
    this.els.modal.addEventListener("click", e => {
      if (e.target === this.els.modal) this.closeModal();
    });
  },

  setStatus(state, text) {
    const colors = { live: "bg-green-500", error: "bg-red-500", idle: "bg-gray-400" };
    this.els.statusDot.className =
      `inline-block w-2.5 h-2.5 rounded-full ${colors[state] || colors.idle}`;
    this.els.statusText.textContent = text;
  },

  setLastUpdated(d) {
    this.els.lastUpdated.textContent = `업데이트 ${d.toLocaleTimeString("ko-KR")}`;
  },

  renderCountryBar(records) {
    const counts = {};
    records.forEach(r => counts[r.country] = (counts[r.country] || 0) + 1);
    const countries = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);

    this.els.countryBar.innerHTML = "";
    const makeBtn = (label, key, count) => {
      const b = document.createElement("button");
      const active = this.filterCountry === key;
      b.className = `px-3 py-1 rounded-full text-sm border ${
        active ? "bg-slate-800 text-white border-slate-800" : "bg-white border-slate-300"}`;
      b.textContent = count == null ? label : `${label} ${count}`;
      b.onclick = () => {
        this.filterCountry = active ? null : key;
        this.onCountryFilter();
      };
      return b;
    };
    this.els.countryBar.appendChild(makeBtn("전체", null, null));
    countries.forEach(c =>
      this.els.countryBar.appendChild(makeBtn(`${FLAGS[c] || "🏳️"} ${c}`, c, counts[c])));
  },

  applyFilters(records) {
    return records.filter(r => {
      if (this.filterCountry && r.country !== this.filterCountry) return false;
      if (this.searchTerm) {
        const hay = `${r.itemName} ${r.importer} ${r.manufacturer} ${r.category}`.toLowerCase();
        if (!hay.includes(this.searchTerm)) return false;
      }
      return true;
    });
  },

  renderTable(records, newIds) {
    const filtered = this.applyFilters(records);
    this.els.body.innerHTML = "";

    for (const r of filtered) {
      const tr = document.createElement("tr");
      tr.className = "border-t hover:bg-slate-50 cursor-pointer";
      if (newIds.has(r.id)) tr.classList.add("row-new");
      tr.onclick = () => this.onRowClick(r);

      tr.innerHTML = `
        <td class="px-3 py-2 whitespace-nowrap">${esc(r.date)}</td>
        <td class="px-3 py-2 whitespace-nowrap">
          ${FLAGS[r.country] || "🏳️"} ${esc(r.country)}
          <div class="text-xs text-slate-400">${esc(r.port)}</div>
        </td>
        <td class="px-3 py-2">
          <div class="font-medium">${esc(r.itemName)}</div>
          <div class="text-xs text-slate-400">${esc(r.category)} · ${esc(r.weight)}</div>
        </td>
        <td class="px-3 py-2">
          <div>${esc(r.importer)}</div>
          <div class="text-xs text-slate-400">${esc(r.manufacturer)}</div>
        </td>
        <td class="px-3 py-2 whitespace-nowrap">
          <span class="px-2 py-0.5 rounded-full text-xs font-medium ${statusClass[r.status]}">
            ${statusLabel[r.status]}
          </span>
          ${r.status === "fail" && r.hazard
            ? `<div class="text-xs text-red-600 mt-1 font-medium">⚠ ${esc(r.hazard)}</div>` : ""}
        </td>`;
      this.els.body.appendChild(tr);
    }

    this.els.countTotal.textContent = filtered.length;
    this.els.countNew.textContent = newIds.size;
  },

  openModal(r, stats) {
    this.els.modalTitle.textContent = `${r.itemName} (${r.country})`;
    const row = (k, v) => `<div class="flex justify-between border-b py-1">
      <span class="text-slate-500">${k}</span><span class="font-medium text-right">${esc(v) || "-"}</span></div>`;
    this.els.modalBody.innerHTML =
      row("신고/수리일", r.date) +
      row("수입국", `${FLAGS[r.country] || ""} ${r.country}`) +
      row("반입항", r.port) +
      row("품목분류", r.category) +
      row("품목명", r.itemName) +
      row("중량", r.weight) +
      row("수입자", r.importer) +
      row("해외제조사", r.manufacturer) +
      row("처리상태", statusLabel[r.status]) +
      (r.status === "fail" ? row("유해물질/사유", r.hazard) : "") +
      `<div class="mt-3 pt-2 text-xs text-slate-500">
        📊 동일 국가 총 ${stats.countryTotal}건 · 부적합 ${stats.countryFail}건</div>`;
    this.els.modal.classList.remove("hidden");
    this.els.modal.classList.add("flex");
  },

  closeModal() {
    this.els.modal.classList.add("hidden");
    this.els.modal.classList.remove("flex");
  },

  setPollBtn(running) {
    this.els.togglePoll.textContent = running ? "일시정지" : "재개";
  },
};

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g,
    m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
}
