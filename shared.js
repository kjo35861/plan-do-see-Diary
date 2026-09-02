import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// ---------- DOM 유틸 ----------
export const $ = (id) => document.getElementById(id);

export function clearChildren(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function el(tag, opts = {}) {
  const node = document.createElement(tag);
  if (opts.text !== undefined) node.textContent = opts.text; // XSS 안전: textContent만 사용
  if (opts.class) node.className = opts.class;
  if (opts.attrs) for (const [k, v] of Object.entries(opts.attrs)) node.setAttribute(k, v);
  if (opts.onClick) node.addEventListener("click", opts.onClick);
  return node;
}

export function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ---------- 시간/날짜 ----------
export function todayKST() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}
export function fmtKST(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", hour12: false });
}

export const PRIORITY_RANK = { "높음": 0, "중간": 1, "낮음": 2 };

// ---------- 페이지 간 선택 상태 (localStorage, UI 상태일 뿐 실제 데이터는 항상 서버 DB) ----------
const SELECTED_PLAN_KEY = "pds_selected_plan_id";
const SELECTED_TODO_KEY = "pds_selected_todo_id";

export function getSelectedPlanId() { return localStorage.getItem(SELECTED_PLAN_KEY); }
export function setSelectedPlanId(id) { localStorage.setItem(SELECTED_PLAN_KEY, id); }
export function getSelectedTodoId() { return localStorage.getItem(SELECTED_TODO_KEY); }
export function setSelectedTodoId(id) { localStorage.setItem(SELECTED_TODO_KEY, id); }

// ---------- 자주 쓰는 조회 ----------
export async function fetchActivePlans() {
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("is_deleted", false)
    .order("created_at", { ascending: false });
  if (error) { console.error(error); return []; }
  return data;
}

export async function fetchPlanById(id) {
  if (!id) return null;
  const { data, error } = await supabase.from("plans").select("*").eq("id", id).eq("is_deleted", false).single();
  if (error) return null;
  return data;
}

// 현재 선택된 계획 이름을 페이지 상단 배지에 표시하는 공통 로직
export async function renderSelectedPlanBadge(badgeEl, { onNoPlan } = {}) {
  const planId = getSelectedPlanId();
  clearChildren(badgeEl);
  if (!planId) {
    badgeEl.appendChild(el("span", { text: "선택된 계획이 없습니다. 계획 화면에서 먼저 계획을 선택하세요." }));
    badgeEl.classList.add("no-plan");
    if (onNoPlan) onNoPlan();
    return null;
  }
  const plan = await fetchPlanById(planId);
  if (!plan) {
    badgeEl.appendChild(el("span", { text: "선택된 계획을 찾을 수 없습니다. 계획 화면에서 다시 선택하세요." }));
    badgeEl.classList.add("no-plan");
    if (onNoPlan) onNoPlan();
    return null;
  }
  badgeEl.classList.remove("no-plan");
  badgeEl.appendChild(el("span", { text: "현재 계획: " }));
  badgeEl.appendChild(el("strong", { text: plan.title }));
  return plan;
}
