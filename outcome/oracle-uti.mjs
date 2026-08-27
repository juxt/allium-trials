// Hidden ground truth for Trial F fidelity scoring: the CPMI-IOSCO Table 1 routing
// function. A total function from the 12 boolean facts to one of 9 terminal outcomes,
// transcribed verbatim from the decision table (steps 1-13, including the graph jumps:
// step 4 -> 10, several steps -> 7/11, confirmation reachable from steps 6 and 12).
// The drafting loop never sees this; it is used only to score whether a drafted spec
// routes every one of the 4096 condition-combinations to the same outcome as the table.

// Canonical condition keys (predicate names the model is told to use, argument stripped).
export const CONDITIONS = [
  "ccp_is_counterparty",      // step 1
  "is_clearing_member",       // step 2
  "executed_on_platform",     // step 3
  "cross_jurisdictional",     // step 4
  "both_have_obligations",    // step 5
  "confirmation_available",   // steps 6 and 12
  "status_based_approach",    // step 7
  "same_regulatory_status",   // step 8
  "rules_assign_entity",      // step 9
  "sooner_deadline",          // step 10
  "counterparties_agree",     // step 11
  "single_tr_available",      // step 13
];

// Canonical outcome (action) names the model is told to use, one per terminal outcome.
export const OUTCOMES = [
  "generate_ccp",
  "generate_clearing_member",
  "generate_trading_platform",
  "generate_confirmation_platform",
  "generate_sooner_jurisdiction",
  "generate_assigned_entity",
  "generate_agreed_entity",
  "generate_tr",
  "generate_counterparty_sort",
];

// The table as a decision procedure. `a` is an object keyed by CONDITIONS -> bool.
export function route(a) {
  if (a.ccp_is_counterparty) return "generate_ccp";                       // step 1
  if (a.is_clearing_member) return "generate_clearing_member";            // step 2
  if (a.executed_on_platform) return "generate_trading_platform";         // step 3
  // step 4
  if (a.cross_jurisdictional) {
    // step 10
    if (a.sooner_deadline) return "generate_sooner_jurisdiction";
    return step11(a);
  }
  // step 5
  if (a.both_have_obligations) {
    // step 6
    if (a.confirmation_available) return "generate_confirmation_platform";
    return step7(a);
  }
  return step7(a);
}

function step7(a) {
  if (a.status_based_approach) {
    // step 8
    if (a.same_regulatory_status) return step11(a);
    // step 9
    if (a.rules_assign_entity) return "generate_assigned_entity";
    return step12(a);
  }
  return step11(a);
}

function step11(a) {
  if (a.counterparties_agree) return "generate_agreed_entity";
  return step12(a);
}

function step12(a) {
  if (a.confirmation_available) return "generate_confirmation_platform";
  // step 13
  if (a.single_tr_available) return "generate_tr";
  return "generate_counterparty_sort";
}
