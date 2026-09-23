# Reporting and analytics

All reports belong to an organization/event and require fresh authorization at request, job execution and download. Files live in private storage with short retention (proposed 24 hours). Audit export requester, filters, row count, format and timestamp; sanitize spreadsheet formula cells.

| Metric                      | Definition                                                                          |
| --------------------------- | ----------------------------------------------------------------------------------- |
| Invitations issued          | Invitations with issuance history; show currently active separately                 |
| Expected maximum people     | Sum configured capacity of active invitations; show override allowance separately   |
| RSVP confirmed invitations  | Count confirmed responses                                                           |
| RSVP expected people        | Sum expected quantities from confirmed responses                                    |
| Checked-in people           | Sum net initial admissions A; gross original entries and corrections also available |
| Estimated inside            | Sum P; never claim exact occupancy when exits are optional                          |
| Recorded exits / re-entries | Sum movement quantities, label inferred missed-exit movements separately            |
| Not-arrived invitations     | Invitations with A=0, excluding cancelled as configured                             |
| Unused person slots         | Sum max(C+O−A,0); not equivalent to confirmed no-shows                              |
| Utilization                 | A/(C+O), denominator and scope shown; zero denominator → not applicable             |
| Rejected scans              | Count rejected scan attempts, not people                                            |
| Overrides                   | Count authorized exception commands plus affected quantities                        |
| Offline pending/conflict    | Known unsynced device totals and unresolved server claims; freshness shown          |

Reports: guest master list; attendance; no-show; arrival and late arrival; invitation utilization/capacity; entry/exit/re-entry; usher/gate activity; supervisor overrides; rejected/revoked attempts; RSVP; table/category/custom-group attendance; offline conflicts. Full phone fields are omitted unless the exporting admin explicitly selects authorized contact columns. No-show report distinguishes zero-arrival invitations, confirmed expected persons and unused slots; anonymous identities cannot be inferred.

Filters: event-local date/time converted to UTC, gate, actor, category, table, section/group, RSVP, invitation status and transaction type. “Late” uses an organizer-set threshold. Provide CSV/XLSX for tabular analysis and PDF summaries with totals, filters, units, timezone, generated timestamp and offline uncertainty. Generate all formats from the same authorized query definitions. First build core attendance/movement/override reports, then remaining catalog before MVP release.

Operational analytics record request latency, accepted/rejected command counts, retry recovery, sync conflicts and aggregate flow completion. Exclude guest tokens and personal attributes from telemetry. Initial dashboard polls authorized aggregate endpoints; no raw guest stream to platform administrators.
