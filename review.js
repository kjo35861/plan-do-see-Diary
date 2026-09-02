import {
  supabase, $, el, clearChildren, todayKST,
  fetchActivePlans, getSelectedPlanId,
} from "./shared.js";

let reviewSnapshot = null;

async function init() {
  const plans = await fetchActivePlans();
  const sel = $("review-plan-select");
  clearChildren(sel);
  for (const p of plans) {
    sel.appendChild(el("option", { text: p.title, attrs: { value: p.id } }));
  }
  const preferred = getSelectedPlanId();
  if (preferred && plans.some((p) => p.id === preferred)) sel.value = preferred;
  if (plans.length > 0) await runReview();
}

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
  alert("다음 계획으로 넘길 메모를 저장했습니다. '계획' 화면에서 새 계획을 만들면 자동으로 반영됩니다.");
});

init();
