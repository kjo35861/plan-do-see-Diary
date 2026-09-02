import {
  supabase, $, el, clearChildren, fmtKST,
  getSelectedPlanId, setSelectedPlanId,
} from "./shared.js";

let plans = [];

async function loadPlans() {
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("is_deleted", false)
    .order("created_at", { ascending: false });
  if (error) return console.error(error);
  plans = data;
  renderPlanList();
  await checkPendingCarryover();
}

function renderPlanList() {
  const list = $("plan-list");
  clearChildren(list);
  const selectedId = getSelectedPlanId();

  for (const p of plans) {
    const li = el("li", { class: p.id === selectedId ? "is-selected" : "" });
    const top = el("div", { class: "plan-top" });
    top.appendChild(el("strong", { text: p.title }));
    top.appendChild(el("span", { text: `${p.priority} · 예상 ${p.estimated_minutes}분` }));
    li.appendChild(top);
    li.appendChild(el("div", {
      class: "plan-meta",
      text: `기간 ${p.period_start} ~ ${p.period_end} | 성공 기준: ${p.success_criteria}`,
    }));

    const actions = el("div", { class: "plan-actions" });
    actions.appendChild(el("button", {
      text: p.id === selectedId ? "선택됨" : "이 계획 선택",
      class: "select-btn",
      onClick: () => { setSelectedPlanId(p.id); renderPlanList(); },
    }));
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
  window.scrollTo({ top: 0, behavior: "smooth" });
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
    setSelectedPlanId(data.id);
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

loadPlans();
