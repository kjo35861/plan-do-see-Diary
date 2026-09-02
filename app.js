import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// ---------- 공통 유틸 ----------
const $ = (id) => document.getElementById(id);

function todayKST() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

function fmtKST(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", hour12: false });
}

function clearChildren(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function el(tag, opts = {}) {
  const node = document.createElement(tag);
  if (opts.text !== undefined) node.textContent = opts.text; // XSS 안전: textContent만 사용
  if (opts.class) node.className = opts.class;
  if (opts.attrs) for (const [k, v] of Object.entries(opts.attrs)) node.setAttribute(k, v);
  if (opts.onClick) node.addEventListener("click", opts.onClick);
  return node;
}

const PRIORITY_RANK = { "높음": 0, "중간": 1, "낮음": 2 };

// ---------- 상태 ----------
let plans = [];
let selectedTodoPlanId = null;
let selectedLogTodoId = null;
let currentTodos = [];
let reviewSnapshot = null; // 마지막 돌아보기 집계 결과 (드릴다운용)

// ==================================================
// 1. 계획
// ==================================================
async function loadPlans() {
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("is_deleted", false)
    .order("created_at", { ascending: false });
  if (error) return console.error(error);
  plans = data;
  renderPlanList();
  fillPlanSelects();
  await checkPendingCarryover();
}

function renderPlanList() {
  const list = $("plan-list");
  clearChildren(list);
  for (const p of plans) {
    const li = el("li");
    const top = el("div", { class: "plan-top" });
    top.appendChild(el("strong", { text: p.title }));
    top.appendChild(el("span", { text: `${p.priority} · 예상 ${p.estimated_minutes}분` }));
    li.appendChild(top);
    li.appendChild(el("div", {
      class: "plan-meta",
      text: `기간 ${p.period_start} ~ ${p.period_end} | 성공 기준: ${p.success_criteria}`,
    }));

    const actions = el("div", { class: "plan-actions" });
    actions.appendChild(el("button", { text: "수정", onClick: () => startEditPlan(p) }));
    actions.appendChild(el("button", { text: "이력 보기", onClick: () => toggleRevisions(li, p.id) }));
    actions.appendChild(el("button", { text: "삭제", onClick: () => deletePlan(p.id) }));
    li.appendChild(actions);

    list.appendChild(li);
  }
}

async function toggleRevisions(li, planId) {
  const existing = li.querySelector(".revision-list");
  if (existing) { existing.remove(); return; }
  const { data, error } = await supabase
    .from("plan_revisions")
    .select("*")
    .eq("plan_id", planId)
    .order("revised_at", { ascending: true });
  if (error) return console.error(error);
  const ul = el("ul", { class: "revision-list" });
  if (data.length === 0) {
    ul.appendChild(el("li", { text: "아직 수정 이력이 없습니다." }));
  } else {
    for (const rev of data) {
      const s = rev.snapshot;
      ul.appendChild(el("li", {
        text: `[${fmtKST(rev.revised_at)}] 고치기 전: "${s.title}" / ${s.period_start}~${s.period_end} / ${s.priority} / 예상 ${s.estimated_minutes}분`,
      }));
    }
  }
  li.appendChild(ul);
}

function startEditPlan(p) {
  $("plan-edit-id").value = p.id;
  $("plan-title").value = p.title;
  $("plan-period-start").value = p.period_start;
  $("plan-period-end").value = p.period_end;
  $("plan-priority").value = p.priority;
  $("plan-success").value = p.success_criteria;
  $("plan-estimate").value = p.estimated_minutes;
  $("plan-submit-btn").textContent = "계획 수정 저장";
  $("plan-cancel-edit").classList.remove("hidden");
  window.scrollTo({ top: $("section-plans").offsetTop - 10, behavior: "smooth" });
}

function resetPlanForm() {
  $("plan-form").reset();
  $("plan-edit-id").value = "";
  $("plan-submit-btn").textContent = "계획 만들기";
  $("plan-cancel-edit").classList.add("hidden");
}

$("plan-cancel-edit").addEventListener("click", resetPlanForm);

$("plan-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const editId = $("plan-edit-id").value;
  const payload = {
    title: $("plan-title").value,
    period_start: $("plan-period-start").value,
    period_end: $("plan-period-end").value,
    priority: $("plan-priority").value,
    success_criteria: $("plan-success").value,
    estimated_minutes: Number($("plan-estimate").value),
  };

  if (editId) {
    // UPDATE -> DB 트리거가 자동으로 plan_revisions에 고치기 전 값을 저장함
    const { error } = await supabase.from("plans").update(payload).eq("id", editId);
    if (error) return console.error(error);
  } else {
    const { data, error } = await supabase.from("plans").insert(payload).select().single();
    if (error) return console.error(error);
    await applyPendingCarryoverTo(data.id);
  }
  resetPlanForm();
  await loadPlans();
});

async function deletePlan(id) {
  if (!confirm("이 계획을 삭제할까요? (딸린 할 일은 그대로 남습니다)")) return;
  const { error } = await supabase.from("plans").update({ is_deleted: true }).eq("id", id);
  if (error) return console.error(error);
  await loadPlans();
}

function fillPlanSelects() {
  for (const selectId of ["todo-plan-select", "review-plan-select"]) {
    const sel = $(selectId);
    const prev = sel.value;
    clearChildren(sel);
    for (const p of plans) {
      sel.appendChild(el("option", { text: p.title, attrs: { value: p.id } }));
    }
    if (prev && plans.some((p) => p.id === prev)) sel.value = prev;
  }
  if (plans.length > 0) {
    selectedTodoPlanId = $("todo-plan-select").value;
    loadTodos();
  }
}

// ---------- 다음 계획 이관(carryover) ----------
async function checkPendingCarryover() {
  const { data, error } = await supabase
    .from("carryover_notes")
    .select("*")
    .is("applied_to_plan_id", null)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) return console.error(error);
  const banner = $("carryover-banner");
  clearChildren(banner);
  if (data.length === 0) { banner.classList.add("hidden"); return; }
  banner.classList.remove("hidden");
  banner.appendChild(el("strong", { text: "지난 돌아보기에서 넘어온 메모: " }));
  banner.appendChild(document.createTextNode(data[0].note));
  banner.appendChild(el("div", { text: "새 계획을 만들면 이 메모가 성공 기준 앞에 자동으로 붙습니다." }));
}

async function applyPendingCarryoverTo(newPlanId) {
  const { data } = await supabase
    .from("carryover_notes")
    .select("*")
    .is("applied_to_plan_id", null)
    .order("created_at", { ascending: false })
    .limit(1);
  if (!data || data.length === 0) return;
  const note = data[0];
  await supabase.from("carryover_notes").update({ applied_to_plan_id: newPlanId }).eq("id", note.id);
  const { data: plan } = await supabase.from("plans").select("success_criteria").eq("id", newPlanId).single();
  if (plan) {
    await supabase.from("plans")
      .update({ success_criteria: `[이전 메모: ${note.note}] ${plan.success_criteria}` })
      .eq("id", newPlanId);
  }
}

// ==================================================
// 2. 할 일
// ==================================================
$("todo-plan-select").addEventListener("change", () => {
  selectedTodoPlanId = $("todo-plan-select").value;
  loadTodos();
});
$("todo-search").addEventListener("input", debounce(loadTodos, 300));
$("todo-filter-status").addEventListener("change", loadTodos);
$("todo-filter-priority").addEventListener("change", loadTodos);
$("todo-sort").addEventListener("change", () => {
  const sort = $("todo-sort").value;
  const notes = {
    "due_date.asc": "정렬 기준: 마감일 빠른 순 (같으면 최근 등록 순)",
    "due_date.desc": "정렬 기준: 마감일 늦은 순 (같으면 최근 등록 순)",
    "priority.custom": "정렬 기준: 우선순위 높은 순 (높음 > 중간 > 낮음, 같으면 마감일 빠른 순)",
    "created_at.desc": "정렬 기준: 최근 등록 순",
  };
  $("sort-note").textContent = notes[sort];
  loadTodos();
});

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

async function loadTodos() {
  if (!selectedTodoPlanId) return;
  let query = supabase.from("todos").select("*").eq("plan_id", selectedTodoPlanId).eq("is_deleted", false);

  const search = $("todo-search").value.trim();
  if (search) query = query.ilike("title", `%${search}%`);

  const status = $("todo-filter-status").value;
  if (status !== "all") query = query.eq("status", status);

  const priority = $("todo-filter-priority").value;
  if (priority !== "all") query = query.eq("priority", priority);

  const sort = $("todo-sort").value;
  if (sort === "due_date.asc") query = query.order("due_date", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });
  else if (sort === "due_date.desc") query = query.order("due_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
  else if (sort === "created_at.desc") query = query.order("created_at", { ascending: false });
  else query = query.order("created_at", { ascending: false }); // priority.custom은 아래서 클라이언트 정렬

  const { data, error } = await query;
  if (error) return console.error(error);

  let rows = data;
  if (sort === "priority.custom") {
    rows = [...rows].sort((a, b) => {
      const r = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (r !== 0) return r;
      return (a.due_date || "9999").localeCompare(b.due_date || "9999");
    });
  }

  currentTodos = rows;
  renderTodoTable(rows);
  fillLogTodoSelect(rows);
}

function renderTodoTable(rows) {
  const tbody = $("todo-tbody");
  clearChildren(tbody);
  for (const t of rows) {
    const tr = el("tr");
    tr.appendChild(el("td", { text: t.status === "done" ? "완료" : "진행 중", class: t.status === "done" ? "status-done" : "status-active" }));
    tr.appendChild(el("td", { text: t.title }));
    tr.appendChild(el("td", { text: t.due_date || "-" }));
    tr.appendChild(el("td", { text: t.priority }));
    tr.appendChild(el("td", { text: (t.tags || []).join(", ") }));
    tr.appendChild(el("td", { text: String(t.estimated_minutes) }));

    const actionsTd = el("td", { class: "actions" });
    actionsTd.appendChild(el("button", { text: "수정", onClick: () => startEditTodo(t) }));
    if (t.status === "active") {
      actionsTd.appendChild(el("button", { text: "완료", onClick: () => completeTodo(t.id) }));
    } else {
      actionsTd.appendChild(el("button", { text: "되돌리기", onClick: () => reopenTodo(t.id) }));
    }
    actionsTd.appendChild(el("button", { text: "삭제", onClick: () => deleteTodo(t.id) }));
    tr.appendChild(actionsTd);

    tbody.appendChild(tr);
  }
}

function startEditTodo(t) {
  $("todo-edit-id").value = t.id;
  $("todo-title").value = t.title;
  $("todo-due").value = t.due_date || "";
  $("todo-priority").value = t.priority;
  $("todo-tags").value = (t.tags || []).join(",");
  $("todo-estimate").value = t.estimated_minutes;
  $("todo-submit-btn").textContent = "할 일 수정 저장";
  $("todo-cancel-edit").classList.remove("hidden");
  window.scrollTo({ top: $("section-todos").offsetTop - 10, behavior: "smooth" });
}

function resetTodoForm() {
  $("todo-form").reset();
  $("todo-edit-id").value = "";
  $("todo-submit-btn").textContent = "할 일 만들기";
  $("todo-cancel-edit").classList.add("hidden");
}
$("todo-cancel-edit").addEventListener("click", resetTodoForm);

$("todo-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const editId = $("todo-edit-id").value;
  const tags = $("todo-tags").value.split(",").map((s) => s.trim()).filter(Boolean);
  const payload = {
    plan_id: selectedTodoPlanId,
    title: $("todo-title").value,
    due_date: $("todo-due").value || null,
    priority: $("todo-priority").value,
    tags,
    estimated_minutes: Number($("todo-estimate").value),
    updated_at: new Date().toISOString(),
  };
  if (editId) {
    const { error } = await supabase.from("todos").update(payload).eq("id", editId);
    if (error) return console.error(error);
  } else {
    const { error } = await supabase.from("todos").insert(payload);
    if (error) return console.error(error);
  }
  resetTodoForm();
  await loadTodos();
});

async function completeTodo(id) {
  const { error } = await supabase.rpc("fn_complete_todo", { p_todo_id: id });
  if (error) return console.error(error);
  await loadTodos();
}
async function reopenTodo(id) {
  const { error } = await supabase.rpc("fn_reopen_todo", { p_todo_id: id });
  if (error) return console.error(error);
  await loadTodos();
}
async function deleteTodo(id) {
  if (!confirm("이 할 일을 삭제할까요?")) return;
  const { error } = await supabase.from("todos").update({ is_deleted: true }).eq("id", id);
  if (error) return console.error(error);
  await loadTodos();
}

// ==================================================
// 3. 실행 기록
// ==================================================
function fillLogTodoSelect(todos) {
  const sel = $("log-todo-select");
  const prev = sel.value;
  clearChildren(sel);
  for (const t of todos) {
    sel.appendChild(el("option", { text: t.title, attrs: { value: t.id } }));
  }
  if (prev && todos.some((t) => t.id === prev)) sel.value = prev;
  selectedLogTodoId = sel.value || null;
  loadLogs();
}
$("log-todo-select").addEventListener("change", () => {
  selectedLogTodoId = $("log-todo-select").value;
  loadLogs();
});

async function loadLogs() {
  const tbody = $("log-tbody");
  clearChildren(tbody);
  if (!selectedLogTodoId) return;
  const { data, error } = await supabase
    .from("execution_logs")
    .select("*")
    .eq("todo_id", selectedLogTodoId)
    .order("started_at", { ascending: false });
  if (error) return console.error(error);
  for (const l of data) {
    const tr = el("tr");
    tr.appendChild(el("td", { text: fmtKST(l.started_at) }));
    tr.appendChild(el("td", { text: fmtKST(l.ended_at) }));
    tr.appendChild(el("td", { text: String(l.actual_minutes) }));
    tr.appendChild(el("td", { text: l.blocker_reason || "-" }));
    tbody.appendChild(tr);
  }
}

$("log-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!selectedLogTodoId) return alert("먼저 대상 할 일을 선택하세요.");
  const payload = {
    todo_id: selectedLogTodoId,
    started_at: new Date($("log-start").value).toISOString(),
    ended_at: new Date($("log-end").value).toISOString(),
    actual_minutes: Number($("log-actual").value),
    blocker_reason: $("log-blocker").value || null,
  };
  const { error } = await supabase.from("execution_logs").insert(payload);
  if (error) return console.error(error);
  $("log-form").reset();
  await loadLogs();
});

$("dedupe-test-btn").addEventListener("click", async () => {
  if (!selectedLogTodoId) return alert("먼저 대상 할 일을 선택하세요.");
  await supabase.rpc("fn_complete_todo", { p_todo_id: selectedLogTodoId });
  await supabase.rpc("fn_complete_todo", { p_todo_id: selectedLogTodoId }); // 연달아 두 번
  const { data, error } = await supabase
    .from("completion_events")
    .select("id", { count: "exact" })
    .eq("todo_id", selectedLogTodoId);
  if (error) return console.error(error);
  $("dedupe-result").textContent = `완료 이벤트 기록 수: ${data.length}건 (연타해도 1건이면 정상)`;
  await loadTodos();
});

// ==================================================
// 4. 돌아보기
// ==================================================
$("review-run-btn").addEventListener("click", runReview);

async function runReview() {
  const planId = $("review-plan-select").value;
  if (!planId) return;

  const { data: todos, error } = await supabase.from("todos").select("*").eq("plan_id", planId).eq("is_deleted", false);
  if (error) return console.error(error);

  const ids = todos.map((t) => t.id);
  let logs = [];
  if (ids.length > 0) {
    const { data: logData, error: logErr } = await supabase.from("execution_logs").select("*").in("todo_id", ids);
    if (logErr) return console.error(logErr);
    logs = logData;
  }

  const today = todayKST();
  const doneList = todos.filter((t) => t.status === "done");
  const overdueList = todos.filter((t) => t.status !== "done" && t.due_date && t.due_date < today);
  const blockedTodoIds = new Set(logs.filter((l) => l.blocker_reason && l.blocker_reason.trim() !== "").map((l) => l.todo_id));
  const blockedList = todos.filter((t) => blockedTodoIds.has(t.id));

  const estimatedTotal = todos.reduce((sum, t) => sum + Number(t.estimated_minutes || 0), 0);
  const actualTotal = logs.reduce((sum, l) => sum + Number(l.actual_minutes || 0), 0);
  const diff = actualTotal - estimatedTotal;

  $("stat-planned").textContent = todos.length;
  $("stat-done").textContent = doneList.length;
  $("stat-overdue").textContent = overdueList.length;
  $("stat-blocked").textContent = blockedList.length;
  $("stat-estimated").textContent = estimatedTotal;
  $("stat-actual").textContent = actualTotal;
  $("stat-diff").textContent = (diff >= 0 ? "+" : "") + diff;

  reviewSnapshot = {
    planned: { title: "계획 수(할 일) — 목록", items: todos.map((t) => `${t.title} (${t.status === "done" ? "완료" : "진행 중"})`) },
    done: { title: "완료 수 — 목록", items: doneList.map((t) => t.title) },
    overdue: { title: "지연 수 — 목록", items: overdueList.map((t) => `${t.title} (마감 ${t.due_date})`) },
    blocked: { title: "막힘 수 — 목록", items: blockedList.map((t) => t.title) },
  };
  $("drilldown").classList.add("hidden");
}

document.querySelectorAll(".stat[data-key]").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!reviewSnapshot) return;
    const snap = reviewSnapshot[btn.dataset.key];
    $("drilldown-title").textContent = snap.title;
    const list = $("drilldown-list");
    clearChildren(list);
    if (snap.items.length === 0) {
      list.appendChild(el("li", { text: "해당하는 기록이 없습니다." }));
    } else {
      for (const item of snap.items) list.appendChild(el("li", { text: item }));
    }
    $("drilldown").classList.remove("hidden");
  });
});

$("carryover-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const planId = $("review-plan-select").value;
  const note = $("carryover-note").value;
  const { error } = await supabase.from("carryover_notes").insert({ source_plan_id: planId, note });
  if (error) return console.error(error);
  $("carryover-form").reset();
  alert("다음 계획으로 넘길 메모를 저장했습니다. 새 계획을 만들면 자동으로 반영됩니다.");
  await checkPendingCarryover();
});

// ==================================================
// 5. 내보내기
// ==================================================
$("export-btn").addEventListener("click", async () => {
  const tables = ["plans", "plan_revisions", "todos", "execution_logs", "completion_events", "carryover_notes"];
  const result = {};
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select("*");
    if (error) return console.error(error);
    result[t] = data;
  }
  result.exported_at = new Date().toISOString();

  const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `plandusy-diary-export-${todayKST()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

// ---------- 초기 로드 ----------
loadPlans();
