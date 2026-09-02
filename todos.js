import {
  supabase, $, el, clearChildren, debounce,
  PRIORITY_RANK, getSelectedPlanId, renderSelectedPlanBadge,
} from "./shared.js";

let planId = null;
let currentTodos = [];

async function init() {
  const plan = await renderSelectedPlanBadge($("plan-badge"), {
    onNoPlan: () => { $("section-todos").classList.add("hidden"); },
  });
  if (!plan) return;
  planId = plan.id;
  await loadTodos();
}

async function loadTodos() {
  if (!planId) return;
  let query = supabase.from("todos").select("*").eq("plan_id", planId).eq("is_deleted", false);

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
  else query = query.order("created_at", { ascending: false }); // priority.custom은 클라이언트 정렬

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
  window.scrollTo({ top: 0, behavior: "smooth" });
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
  if (!planId) return;
  const editId = $("todo-edit-id").value;
  const tags = $("todo-tags").value.split(",").map((s) => s.trim()).filter(Boolean);
  const payload = {
    plan_id: planId,
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

init();
