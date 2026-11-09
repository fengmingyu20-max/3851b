# Azure App Service

The GitHub workflow builds both portals, runs unit tests, and transfers a tar archive
so hidden build manifests survive the artifact upload. It excludes environment files
and local runtime data. The deployed `coolcare/` directory is the application root.
Its `npm start` runs the production launcher without `.env.local`, Docker, rebuilding,
or a development server.

Production workflow runs share a concurrency group. A new push waits for the active
publish to finish instead of starting another OneDeploy upload against the same
app (which can fail with HTTP 409). The active run is never cancelled; GitHub keeps
the latest pending run if several newer pushes arrive. Avoid starting a separate
manual Azure deployment while this workflow is publishing.

## App Service settings

Use Node.js 22 LTS on Linux and startup command `npm start`. Enable HTTPS Only.
In Environment variables, configure these application settings (values remain in
Azure, never in GitHub source or workflow output):

| Setting | Value |
| --- | --- |
| `NODE_ENV` | `production` (also enforced by the launcher) |
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | `false`; GitHub Actions already builds and packages the application |
| `WEB_ORIGIN` | `https://coolcare-web-3851-hbdrdshsc9gjdbee.eastasia-01.azurewebsites.net` |
| `DB_HOST` | Reachable MySQL server hostname; localhost on your laptop is not reachable from Azure |
| `DB_PORT` | MySQL port, normally `3306` |
| `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Existing MySQL application credentials/database |
| `SESSION_SECRET` | A securely generated random value of at least 32 characters |
| `DB_SSL` | `true` for a MySQL service requiring TLS; certificate validation remains enabled |
| `DB_SSL_CA` | Optional PEM CA certificate for a private MySQL CA |

`WEB_ORIGIN` can be omitted when App Service supplies `WEBSITE_HOSTNAME`; HTTPS is
inferred. Set it explicitly for a custom domain, which becomes the single allowed
application origin. Do not include a path. The platform supplies `PORT`; the fallback
is `8080`. Optional internal `WEB_PORT`/`API_PORT` default to `3000`/`3001` and must
differ from `PORT` and each other. They bind only to loopback. Do not expose them or
put localhost URLs into browser build variables. Both browser builds use `/api`.

Configure the database firewall/network to allow the App Service connection and
apply the existing reviewed database schema/migrations to that database before use.
The launcher does not seed, reset or migrate business data automatically. Existing
local Docker setup/migration scripts remain local tools.

To append coursework examples to an already populated hosted database, use the
explicit preview/dry-run/apply steps in [COURSEWORK-DATA.md](COURSEWORK-DATA.md).
This separate tool preserves existing records and records a replay-safe batch
receipt. It is never invoked by GitHub deployment or the production launcher.

Keep one App Service instance for the current in-memory session store. A restart
signs users out. Multiple instances require a shared session store before scaling.
The gateway trusts only the configured host and replaces forwarding headers; HTTPS
session cookies, existing origin checks, CSRF and role/ownership checks remain enabled.
For consistent rate limiting it uses the immediate upstream address rather than
trusting arbitrary client-supplied forwarding chains.

If email is needed, configure the existing `MAIL_MODE`, `MAIL_FROM` and SMTP settings
for a reachable SMTP service; the local Mailpit service is not a cloud mail server.
Report signatures/photos use `/home/coolcare-data/` automatically on App Service,
outside the replaced deployment directory. `COOLCARE_DATA_DIR` can select another
absolute private persistent directory; local development still uses `.local/`.
At API startup existing ordinary media files in `.local/service-photos` and
`.local/report-signatures` are copied without overwriting or deleting originals.
Conflicting files stop startup for investigation. No public static media route is
added: existing authenticated ownership checks continue to protect every image.
Ensure persistent `/home` storage is enabled (including App Service storage for
custom containers) and back up runtime media separately from deployments. This
setting cannot be verified from GitHub alone; the Azure operator must confirm it.

## Verify

1. Push to `main` and check both GitHub Actions jobs complete.
2. In Log stream, look for `CoolCare production listener: 0.0.0.0:<port>` and the API
   and vinext production startup messages. Missing configuration logs only setting
   names, never secret values.
3. `/healthz` checks the gateway process only. `/api/health` must return
   `{"ready":true}` to confirm MySQL and the existing schema are reachable.
4. Open `/`, `/customer`, `/admin/orders` and `/technician/index.html`, sign in and
   verify an authenticated read. API calls must use the same HTTPS origin.

Local development is unchanged from the repository root: `npm start`. Inside
`coolcare/`, use `npm run start:local`. To run production locally, first build and
provide the same environment variables, then run root `npm run start:production`;
use an HTTPS reverse proxy with the configured origin for secure browser sessions.

## Remove the optional 2026-11-04 DEMO order batch

This maintenance task is never run by startup, migration or deployment. From the
deployed application directory, `node scripts/cleanup-demo-orders.mjs` previews only.
The explicitly requested `--apply` removes exactly 300 orders belonging to exactly
60 customers whose numbered DEMO names and `customerN@cc-demo-20261104.invalid`
emails both match. Accounts and other orders remain. It refuses a different batch
size, unknown/cyclic/shared dependencies, triggers, or stock/payment/reward/annual
visit records that require additional reconciliation. It never disables foreign keys.

Before deletion it writes a private, parent-first SQL restore backup under
`/home/demo-order-backups/`. Deletes run in one transaction and compare all retained
booking rows before committing. A failed check rolls back the entire operation.
Keep this backup private; it contains the removed business data. If restoration is
needed, use a MySQL administrative client on the same database while application
writes are paused, and import the generated SQL file. Existing matching IDs must
not have been recreated. Media files are retained; only their selected database
references are removed. No application credentials are included in this backup.
## Rotating exposed presentation passwords

The login page has no demo shortcuts. Account emails and passwords are entered
manually; removing these buttons does not modify any account credentials. Changing their actual
database passwords is a separate, explicitly run maintenance action.
After deploying the current API, use `node scripts/rotate-account-passwords.mjs`
from `coolcare/` with `--origin=https://your-site` and
`--input=C:/absolute/private-accounts.json`. The private input contains an
`accounts` array with `email`, `currentPassword` and `expectedRole` per account.
The default is a local validation plan; add `--apply` to perform the changes.
Never commit this file or paste passwords into chat or Actions output.

The tool saves generated passwords to an ignored, access-restricted local
manifest before making changes. Keep that manifest; it is the recovery record.
If interrupted, use the same input and `--resume=C:/absolute/manifest.json --apply`.
Resume verifies the saved credential first instead of blindly repeating a change.
The tool verifies the account identity and role and checks the new login. It does
not print passwords or cookies, follow redirects, or change business records.

`POST /api/public/account/password` accepts `currentPassword`, `newPassword`,
`confirmPassword`, and optional `expectedUserId`. It requires an authenticated
session and CSRF token, verifies the current password, and changes only the
signed-in account. Success returns `{ success: true, signInRequired: true }` and
revokes that account's sessions. Passwords are bcrypt-hashed; per-request
credential checks also invalidate sessions on another running API instance.
The technician profile uses the same password rules and signs out after success.

## Azure Email API

After deploying API support, configure App Service application settings:

- `MAIL_MODE=smtp` (existing external-delivery queue mode, retained for schema compatibility)
- `MAIL_PROVIDER=azure` (uses HTTPS Azure Email API instead of SMTP)
- `AZURE_COMMUNICATION_CONNECTION_STRING` from the connected Communication Service's Keys page
- `MAIL_FROM` equal to the bare verified sender address shown by the connected domain

Keep connection strings private in App Service settings, never frontend variables,
source, logs or screenshots. No Entra app registration or SMTP username is needed
for connection-string authentication. The existing local Mailpit and SMTP modes
remain available; omit MAIL_PROVIDER or use smtp for the old SMTP provider.
No database migration is needed. Local/disabled queued messages are not replayed.
Review any existing external (`smtp`) pending messages before enabling this provider,
because they share the external-delivery queue. Provider success means acceptance,
not proof of inbox delivery. An ambiguous network failure can cause duplicate mail
when the outbox retries. Credentials/provider transcripts are never logged.

Notification scope includes technician assignment/confirmation, staff invites and
booking changes documented below.
Register a test customer using your own real inbox, create a fresh booking and assign
it through Admin, then check Admin email status and the inbox/spam folder. These
configuration changes alone do not add cancellation/completion mail or an arbitrary
Admin compose action. Do not send a historical demo backlog to external recipients.


## Registration email verification

New public Customer registration requires a six-digit emailed code. Click Send
verification code, check the inbox/spam folder and submit Verify Email & Create
Account. Codes expire after ten minutes, are bound to the normalized email and
issuing browser session, and work once. Editing the email clears its challenge;
a resend replaces the earlier code. After a refresh request another code following
the cooldown. Five wrong guesses invalidate a code. Sending is limited to once per
minute and five per address/hour, plus five requests per IP per fifteen minutes.
Existing accounts/passwords and staff invitation activation are unchanged.

POST /api/public/register/email-code takes {email}, returning only verificationId,
expiresIn and resendAfter. POST /api/public/register also requires verificationId
and emailCode. Both require the standard CSRF cookie/header. Account/profile inserts
and code consumption commit atomically; wrong guesses commit their attempt count.
Only HMAC digests are persisted. Codes are sent directly via the configured mail
transport, never stored in booking_email_outbox. Provider acceptance is not proof
of inbox delivery. Disabled/unconfigured mail fails closed. Expired challenge rows
older than a day are pruned in bounded batches on successful code requests.

Local: npm run db:up applies additive migration 38 and least-privilege grants.
MAIL_MODE=local captures codes at http://localhost:8025. Production uses the existing
MAIL_MODE=smtp, MAIL_PROVIDER=azure, MAIL_FROM and private
AZURE_COMMUNICATION_CONNECTION_STRING settings.

After deployment apply the migration once in App Service SSH:

```sh
cd /home/site/wwwroot
node scripts/migrate-registration-email.mjs --apply
```

This reads the existing private DB settings with verified TLS. No passwords are
pasted into commands or uploaded. Only the separate challenge table is created;
existing accounts/orders are preserved. If DB_USER lacks CREATE permission, a DB
administrator must apply database/38-registration-email.sql to the configured DB
and grant SELECT/INSERT/UPDATE/DELETE on that table to the app user. Until migration,
new registration fails closed; existing sign-in still works.

Test only with an inbox you control: request a code, enter it, create a fresh
Customer account and sign in. Incorrect/expired codes must not create an account.
Do not include codes in logs or screenshots. CI runs concurrent registration and
failure tests against a disposable MySQL DB with injected mail; no external emails
are sent by the test suite.


## Forgotten password setup

After deploying, run this once in App Service SSH:

```sh
cd /home/site/wwwroot
node scripts/migrate-password-reset.mjs --apply
```

Migration 39 only creates password_reset_token and does not reset any existing
credentials or orders. Local npm run db:up applies it and grants the app user
SELECT/INSERT/UPDATE/DELETE. If the cloud user lacks CREATE, have a DB administrator
apply database/39-password-reset.sql and grant those table privileges.
Existing Azure mail settings are reused; no new service or secret is needed.

POST /api/public/account/forgot-password accepts {email}. Eligible active accounts
receive a link valid for thirty minutes. Every well-formed address gets the same
response, including unknown/inactive/throttled/failed requests. Background delivery
avoids exposing provider timing to the public response. Resends are limited to one
per minute and five per account/hour; IP request limits also apply. A resend replaces
the old token. The mail adapter is shared with registration/booking mail.
Raw reset tokens are never persisted in the database or booking outbox, logged,
or returned by the API. Delivery runs in memory after the request commits; if the
app restarts during delivery, request a new link after the cooldown. Delivery failure
is logged without email addresses, tokens, passwords or provider transcripts.

POST /api/public/account/reset-password accepts {token,newPassword,confirmPassword}.
Both endpoints require the standard CSRF cookie/header. The opaque token digest is
locked during password update and consumption in one transaction. The token is
invalid after expiry, reuse, resend, password/email change or account deactivation.
Passwords use the existing bcrypt rules; existing credentials remain unchanged
until valid completion. Old sessions are revoked and credential fingerprints also
reject stale sessions on other running instances; no automatic sign-in follows.
Links use configured WEB_ORIGIN, never the incoming Host header. Tokens are placed
in URL fragments (not server/access-log request URLs), then removed from the address
bar when the page opens. Refresh requires reopening the original email link.

Test with your own active account and real inbox, or Mailpit locally. Requesting or
opening the link must leave the old password working. After valid reset, the old
password/sessions must fail, the new password must work and the link must fail on
reuse. CI tests use a disposable MySQL database and captured mail, never real emails.


## Booking change mail

Existing Azure mail settings and booking_email_outbox are reused. No new database
migration or secret is needed. Only new successful actions queue these messages:

- Customer cancellation: cancellation of this booking appointment, not an entire plan.
- Customer/admin reschedule: original and new appointment, with pending confirmation
  or awaiting-dispatch wording matching the committed state.
- Admin rejection: public rejection reason; a later actual public-reason edit sends
  a separately identified update. No-op reason edits send nothing.
- Annual visit rebooking: preserved booking reference, previous/new dates and awaiting
  confirmation; no claim that a cancelled plan or refunded payment was restored.
- Return invite: asks the customer to choose a date; no appointment is confirmed.
- Return requested: receipt of the customer's chosen date/time, still pending Admin.
- Return scheduled: the final confirmed date/time after Admin dispatch, including
  its actual service duration. Re-invites and changed selections get their own events.

All messages go to the booking customer's account email, using English date labels
and Singapore time. The snapshot is saved with the business transaction. The worker
only reads committed rows. Application request retries/no-op saves do not create
another email; separate real changes do. Delivery failure preserves committed order
state and retries the same message. Provider/network ambiguity can still cause
redelivery; neither SMTP nor the Azure adapter promises exactly-once inbox delivery.
Admin order email history and retry controls include all the above types. No historic
changes are backfilled and no local/disabled backlog is converted to external mail.
Tests capture transport calls against a disposable MySQL DB and send no real mail.

## Day-before appointment reminders

The API checks for tomorrow's assigned visits every minute and on startup, from 09:00 Singapore time. Existing Azure mail configuration is reused; no new environment variables or migration are needed. The outbox worker verifies the current date, status, recipient, time and address again before sending or retrying a reminder. Cancelled, changed or overdue reminder snapshots are retained as disabled (REMINDER_SUPERSEDED), rather than sent late. Admin order email history includes these reminders.

Keep App Service running for this background task: in coolcare-web-3851, open Settings > Configuration > General settings and enable Always On if the plan supports it. Do not change the service plan automatically. Without Always On, App Service may unload an idle application after 20 minutes, so this in-process schedule cannot promise delivery while the application is stopped. On restart it catches up only while it is still the day before the appointment. See https://learn.microsoft.com/azure/app-service/configure-common for the platform setting.
