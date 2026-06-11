// Built-in sensitive-domain blocklist (banks, payment gateways, government, brokers).
//
// TimePrice never runs on these domains even when globally enabled — a hard gate that
// the user cannot override. Entries are registrable domains (see `domain.ts`).
//
// Structure only for now; task 09 populates the actual list and wires it into the
// blocklist UI. Keep this an empty export so `isActiveForHost` can rely on it today.
//
// TODO(task-09): fill with sensitive domains (banks, payment gateways, gov, brokers).
export const BUILTIN_BLOCKLIST: readonly string[] = [];
