# Engine invariants

1. `project.flick.json` is canonical. Generated render commands and UI state are not.
2. Timeline time is integer frame ticks with rational frame rate.
3. Mutations are immutable and return a diff, checkpoint, warnings, affected frame ranges, and intent receipt.
4. Semantic locks are enforced by the mutation engine, not merely mentioned in prompts.
5. Original source media is never overwritten.
6. Branch edits do not mutate their parent branch.
7. Conflicting Video Git merges fail explicitly.
8. Agents never receive arbitrary shell execution through FlickSmith MCP tools.
9. Generated motion code is denied filesystem, process, network, dynamic-eval, and native-module capabilities.
10. Unknown media rights never become “probably okay” automatically.
11. Rendering and QC failures are surfaced as errors or localized issues, never silently marked successful.
