# Google sign-in activation

Users do not register a separate password. They choose an approved Google account on first sign-in, and use the same Google button on subsequent visits. The application checks the provider-verified email against AUTH_ALLOWED_EMAILS for every protected API request. Creating a Supabase Auth identity alone does not grant app access. Never commit the actual email allowlist or client secrets.

## One-time Google setup

Create a Web application OAuth client in Google Cloud / Google Auth Platform. Configure the consent screen; if the app remains in testing, add both approved team addresses as test users. The JavaScript origin is https://tanjung-priuk.vercel.app. The authorized redirect URI must be exactly:

```
https://qxenxmmisllqckjjvjzu.supabase.co/auth/v1/callback
```

The Google redirect goes to Supabase, which subsequently returns the PKCE code to the app. Do not confuse it with the application's callback:

```
https://tanjung-priuk.vercel.app/api/index?action=auth-callback
```

Supply GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET securely in this task's environment settings. The secret is needed only to configure Supabase via api.supabase.com; it must not be copied into client assets or chat. The Supabase publishable key is not a Google OAuth credential.

## Activation sequence

1. Save Google provider client ID/secret in Supabase Auth and enable the Google provider. Keep the app callback in Supabase's allowed redirect URLs and the production Site URL correct. For first-time OAuth identity provisioning, Supabase signups may need enabling; the app allowlist and database policies must already deny access to unapproved accounts. Do not describe signup availability as authorization to the financial workspace.
2. Prepare the initial dataset policies before locking down the website: revoke anonymous SELECT on public.tp_public_import and replace its public policy with SELECT for authenticated approved emails only, preserving the approved account list outside Git. Do not grant anonymous writes. The protected initial-data endpoint forwards the verified session JWT and publishable key; it does not require a service-role key.
3. Set AUTH_GOOGLE_ENABLED=1 and REQUIRE_EMAIL_LOGIN=1 in Vercel Production, then redeploy. Keep PUBLIC_EXCEL_IMPORT=1 when authenticated users should initialize browser data from the existing dataset. The initial-data route is protected by the same login gate.
4. Verify an actual allowed Google account completes sign-in and can initialize its workspace; verify another account is denied by the app and RLS. Check logout, cancelled Google login, and existing browser data. Until verified, do not call Google login fully active.

The code supports PKCE, a same-origin login start, an HttpOnly verifier cookie, a fixed callback and provider-confirmed email checks. A Google login attempt does not send an email or require SMTP. Existing sessions expire after at most one hour and currently require re-login; automatic long-lived session refresh is not implemented. Do not promise indefinite sessions. Data already downloaded to a browser and previously published data cannot be recalled by changing access policies.

The Google provider was not configured when this feature was prepared. Production remains in its existing public/browser mode until the OAuth credentials and full activation steps are complete.

## Nonblocking sign-in test

Google provider credentials have been applied while preserving the existing Supabase signup restriction. Before enforcing authentication, deploy AUTH_GOOGLE_ENABLED=1 and test `/?login=google` with an actual approved account. The normal homepage stays in its existing public/browser mode during this test. Public status distinguishes `sessionAuthenticated` from the existing open-mode `authenticated` flag; neither the test login button nor a successful test session alone makes the dataset private. Do not revoke anonymous dataset access or set REQUIRE_EMAIL_LOGIN=1 until a real Google callback has been confirmed. If a pre-provisioned account cannot link because of signup policy, diagnose the provider error instead of opening unrestricted registration silently.
