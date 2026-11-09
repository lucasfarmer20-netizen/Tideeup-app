# Weekly email correction

Base: deployed production 3e6ffb282868c24b19602ef0ac4c8ce540ffbe93.
Branch: fix/weekly-email-correctness. Separate worktree; no P4J application or migrations imported.

Confirmed baseline defects: footer Unsubscribe points at planUrl; paid-user query ignores email_status; streak badge uses stored current_streak without week validation; progress query takes the newest plan regardless of week. Available UX-review branch retains the broken footer. P4J's replacement depends on its private schema, so it was not transplanted.

Changes:
- Signed, purpose-separated opt-out link using existing CRON_SECRET. GET shows confirmation without mutation; POST updates only the signed user's email_status. No login needed. Invalid links fail; storage failures do not claim success. No new secret or migration.
- Weekly selection excludes unsubscribed users and checks preference again immediately before send; lookup failures suppress delivery. Welcome-event recording cannot overwrite an unsubscribed preference.
- Progress selects the immediately preceding UTC week (existing scheduler convention), newest plan within that week. Failed completion queries omit the statistic. Streak badge requires a matching last_completed_week and positive observed completion; no historical counters are rewritten.
- Vitest alias uses an absolute project path so route mocks resolve to the intended modules.

Verification on final code: 194 tests pass across 9 files, including 11 new mocked regression cases; tsc passes; production build passes with synthetic local database config and the environment's existing HTTPS proxy/CA. No email or hosted database access in tests. Targeted ESLint using the existing recovery installation/config passes with zero errors and two pre-existing unused-variable warnings (Zone and _appUrl). Native npm run lint cannot complete because the baseline lacks ESLint configuration and prompts for setup. Initial build attempts failed on Google Fonts DNS/proxy trust; retaining the supplied proxy and CA resolved them without disabling certificate validation. git diff --check passes.

Not run: real email delivery, hosted preference mutation, browser/email-client rendering, cron execution. No push, PR, deployment, migrations or provider changes.

Publication: review this isolated commit; with later approval, push this branch/open a draft PR against production main, recheck the deployed base and merge only this patch, then deploy with existing production settings. No migration or new credential setup. Do not invoke the production cron as a smoke test: it sends real mail. Existing November 8 links still point at a plan; only newly generated email gets the correction. CRON_SECRET rotation invalidates existing signed opt-out links. An email already handed to the provider cannot be recalled; the final preference check minimizes but cannot eliminate the send/update race. Subscription status and saved plans are not changed by opt-out.
