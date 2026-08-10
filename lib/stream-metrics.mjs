// Pure, unit-tested extraction of run metrics from a `claude -p --output-format
// stream-json --verbose` transcript. Kept separate from run.mjs so the parsing
// — which underpins every trial's headline numbers, including the new
// peak-orchestrator-context metric — can be regression-tested hermetically.
//
// The stream is newline-delimited JSON events. Assistant messages carry a
// per-turn `message.usage`; a subagent's messages are tagged with
// `parent_tool_use_id`, which is how we split orchestrator context from
// subagent context. The final `type:"result"` event carries the session
// aggregate (usage, total_cost_usd, num_turns) — the only reliable total when
// work is delegated (subagent tokens don't roll up into the usage breakdown).

// context processed on a single turn = fresh input + cache read + cache created
export function turnContext(usage) {
  if (!usage) return 0;
  return (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
}

export function parseStreamEvents(text) {
  const events = [];
  for (const line of String(text ?? "").split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try { events.push(JSON.parse(t)); } catch { /* partial/!json line */ }
  }
  return events;
}

// Accepts the raw stream text (or a pre-parsed event array) and returns the
// metrics run.mjs records. Subagent spawns are counted from orchestrator-level
// tool_use blocks named Task/Agent (the two subagent-spawning tool names).
export function streamMetrics(streamOrEvents) {
  const events = Array.isArray(streamOrEvents) ? streamOrEvents : parseStreamEvents(streamOrEvents);
  const result = [...events].reverse().find((e) => e.type === "result") ?? null;

  let peakOrchestratorCtx = 0, peakSubagentCtx = 0, orchestratorTurns = 0, subagentTurns = 0;
  const subagents = [];
  const orchestratorCtxSeries = [];
  for (const e of events) {
    if (e.type !== "assistant") continue;
    const isSub = !!(e.parent_tool_use_id ?? e.parentToolUseId);
    const ctx = turnContext(e.message?.usage);
    if (isSub) { peakSubagentCtx = Math.max(peakSubagentCtx, ctx); subagentTurns++; }
    else { peakOrchestratorCtx = Math.max(peakOrchestratorCtx, ctx); orchestratorTurns++; orchestratorCtxSeries.push(ctx); }
    if (isSub) continue; // only count spawns the orchestrator itself makes
    for (const b of e.message?.content ?? []) {
      if (b.type === "tool_use" && (b.name === "Task" || b.name === "Agent"))
        subagents.push({ subagent_type: b.input?.subagent_type ?? null, description: (b.input?.description ?? "").slice(0, 80) });
    }
  }

  const u = result?.usage ?? {};
  return {
    result,
    ok: result?.subtype === "success",
    subtype: result?.subtype ?? null,
    num_turns: result?.num_turns ?? null,        // main-thread only; unreliable under delegation
    cost_usd: result?.total_cost_usd ?? null,    // the reliable aggregate
    duration_api_ms: result?.duration_api_ms ?? null,
    tokens: {
      input: u.input_tokens ?? null,
      cache_creation: u.cache_creation_input_tokens ?? null,
      cache_read: u.cache_read_input_tokens ?? null,
      output: u.output_tokens ?? null,
    },
    peak_orchestrator_ctx: peakOrchestratorCtx,
    peak_subagent_ctx: peakSubagentCtx,
    orchestrator_turns: orchestratorTurns,
    subagent_turns: subagentTurns,
    subagent_spawns: subagents.length,
    subagents,
    orchestrator_ctx_series: orchestratorCtxSeries,
  };
}
