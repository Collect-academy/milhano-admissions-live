// One event only; fixed UTC offset for America/Merida on 2026-11-27.
const start = Date.parse("2026-11-27T06:00:00-06:00");
const end = Date.parse("2026-11-27T16:00:00-06:00");
const step = 30 * 60 * 1000;
export function nextRefresh(now: number): number | null{if(now>=end)return null;if(now<start)return start;const next=start+(Math.floor((now-start)/step)+1)*step;return next<end?next:null;}
export function isOpenHouseRefreshWindow(now: number): boolean { return now >= start && now < end; }
