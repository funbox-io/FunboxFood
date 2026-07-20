#!/usr/bin/env python3
"""식약처 수입식품 회수·판매중지(부적합) 오픈API → data/latest.json 변환.

- MFDS_API_KEY 미설정 시: 아무것도 하지 않고 정상 종료 (대시보드는 데모 모드 유지)
- MFDS_API_URL(선택): data.go.kr 활용신청 상세페이지의 정확한 요청주소로 기본값 덮어쓰기
- 응답 필드명이 API 버전에 따라 다를 수 있어 후보 키를 순차 탐색(defensive mapping)
"""
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone, timedelta

# Windows 콘솔(cp949) 대비 — 출력 인코딩을 UTF-8로 고정
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

KST = timezone(timedelta(hours=9))
KEY = os.environ.get("MFDS_API_KEY", "").strip()
BASE = os.environ.get("MFDS_API_URL", "").strip() or (
    "http://apis.data.go.kr/1471000/IprtFoodReclSaleStopPrdtStusService"
    "/getIprtFoodReclSaleStopPrdtStusInq"
)
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "latest.json")
NUM_ROWS = 100


def pick(d: dict, *keys: str) -> str:
    """후보 키 목록에서 첫 번째 유효값 반환 (대소문자 무시)."""
    lower = {str(k).lower(): v for k, v in d.items()}
    for k in keys:
        v = lower.get(k.lower())
        if v not in (None, "", "null", "-"):
            return str(v).strip()
    return ""


def norm_day(s: str) -> str:
    """YYYYMMDD / YYYY-MM-DD / 타임스탬프 문자열 → YYYY-MM-DD."""
    digits = re.sub(r"\D", "", s)[:8]
    if len(digits) == 8:
        return f"{digits[:4]}-{digits[4:6]}-{digits[6:8]}"
    return datetime.now(KST).strftime("%Y-%m-%d")


def normalize(item: dict, i: int) -> dict:
    day = norm_day(pick(item, "RTRVL_CMND_DT", "CRET_DTM", "REGIST_DT", "LAST_UPDT_DTM", "cretDtm"))
    return {
        "id": "MFDS-" + (pick(item, "RTRVL_NO", "SEQ", "PRDT_NO", "ROW_NUM") or f"{day}-{i}"),
        "date": f"{day} 00:00:00",
        "day": day,
        "c": pick(item, "MUFC_NTN_NM", "NTN_NM", "ORPLC_NM", "MNF_NTN_NM") or "기타",
        "region": pick(item, "ENTRPS_ADRES", "SITE_ADRES") or "-",
        "item": pick(item, "PRDT_NM", "PRDLST_NM", "prdtNm") or "(품명 미기재)",
        "type": pick(item, "PRDLST_NM", "INDUTY_NM", "PRDT_TYPE_NM") or "수입식품",
        "qty": pick(item, "PACKNG_UNIT", "CAPACITY", "packngUnit") or "-",
        "co": pick(item, "OVSMNFST_NM", "MUFC_NM", "MAKER_NM") or "-",
        "buyer": pick(item, "BSSH_NM", "ENTRPS_NM", "bsshNm") or "-",
        "buyerLoc": pick(item, "ADRES", "ENTRPS_ADRES", "SITE_ADRES", "addr") or "-",
        "status": "부적합",
        "reason": pick(item, "RTRVL_RESN", "RET_RESN", "rtrvlResn") or "회수·판매중지",
        "dist": [],
    }


def extract_items(data):
    """응답 구조 후보를 순차 탐색해 항목 리스트 반환."""
    for path in (
        lambda d: d["response"]["body"]["items"]["item"],
        lambda d: d["response"]["body"]["items"],
        lambda d: d["body"]["items"],
        lambda d: d["items"],
        lambda d: d["data"],
    ):
        try:
            items = path(data)
            if isinstance(items, dict):
                items = [items]
            if isinstance(items, list) and items:
                return items
        except (KeyError, TypeError):
            continue
    return []


def main() -> int:
    if not KEY:
        print("MFDS_API_KEY 미설정 — 데모 모드 유지 (정상 종료)")
        return 0

    params = urllib.parse.urlencode({
        "serviceKey": KEY,
        "numOfRows": NUM_ROWS,
        "pageNo": 1,
        "type": "json",
    }, safe="%")  # 이미 인코딩된 키 이중 인코딩 방지
    url = f"{BASE}?{params}"
    print(f"요청: {BASE} (rows={NUM_ROWS})")

    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as res:
        raw = res.read().decode("utf-8", "replace")

    if raw.lstrip().startswith("<"):
        # XML 에러 응답(키 오류·트래픽 초과 등) — 원문 일부를 로그로 남기고 실패 처리
        print("JSON이 아닌 응답 수신(키/쿼터/오퍼레이션명 확인 필요):", raw[:300], file=sys.stderr)
        return 1

    data = json.loads(raw)
    items = extract_items(data)
    if not items:
        print("항목 0건 — 응답 최상위 키:", list(data)[:8], file=sys.stderr)
        return 1

    records = [normalize(it, i) for i, it in enumerate(items)]
    # 최신순 정렬 + id 중복 제거
    seen, uniq = set(), []
    for r in sorted(records, key=lambda r: r["day"], reverse=True):
        if r["id"] not in seen:
            seen.add(r["id"])
            uniq.append(r)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({
            "updated": datetime.now(KST).isoformat(timespec="seconds"),
            "source": "식약처 수입식품 회수·판매중지 정보 (data.go.kr)",
            "records": uniq,
        }, f, ensure_ascii=False, indent=1)
    print(f"저장 완료: {len(uniq)}건 → data/latest.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
