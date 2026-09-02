import {
  supabase, $, el, clearChildren, fmtKST, todayKST,
  renderSelectedPlanBadge,
} from "./shared.js";

let planId = null;
let selectedTodoId = null;

async function init() {
  const plan = await renderSelectedPlanBadge($("plan-badge"), {
    onNoPlan: () => { $("section-logs").classList.add("hidden"); },
  });
  if (!plan) return;
  planId = plan.id;
  await loadTodoOptions();
}

async function loadTodoOptions() {
  const { data, error } = await supabase
    .from("todos")
    .select("*")
    .eq("plan_id", planId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false });
  if (error) return console.error(error);

  const sel = $("log-todo-select");
  clearChildren(sel);
  if (data.length === 0) {
    sel.appendChild(el("option", { text: "먼저 할 일 화면에서 할 일을 만드세요", attrs: { value: "" } }));
    return;
  }
  for (const t of data) {
    sel.appendChild(el("option", { text: `${t.title} (${t.status === "done" ? "완료" : "진행 중"})`, attrs: { value: t.id } }));
  }
  selectedTodoId = sel.value;
  await loadLogs();
}
$("log-todo-select").addEventListener("change", () => {
  selectedTodoId = $("log-todo-select").value;
  loadLogs();
});

async function loadLogs() {
  const tbody = $("log-tbody");
  clearChildren(tbody);
  if (!selectedTodoId) return;
  const { data, error } = await supabase
    .from("execution_logs")
    .select("*")
    .eq("todo_id", selectedTodoId)
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
  if (!selectedTodoId) return alert("먼저 대상 할 일을 선택하세요.");
  const payload = {
    todo_id: selectedTodoId,
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
  if (!selectedTodoId) return alert("먼저 대상 할 일을 선택하세요.");
  await supabase.rpc("fn_complete_todo", { p_todo_id: selectedTodoId });
  await supabase.rpc("fn_complete_todo", { p_todo_id: selectedTodoId }); // 연달아 두 번
  const { data, error } = await supabase
    .from("completion_events")
    .select("id")
    .eq("todo_id", selectedTodoId);
  if (error) return console.error(error);
  $("dedupe-result").textContent = `완료 이벤트 기록 수: ${data.length}건 (연타해도 1건이면 정상)`;
  await loadTodoOptions();
});

init();
