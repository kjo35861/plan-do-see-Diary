import { supabase, todayKST } from "./shared.js";

document.getElementById("export-btn").addEventListener("click", async () => {
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
