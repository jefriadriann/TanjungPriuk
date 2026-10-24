# Login melalui link email

The app uses Supabase Auth PKCE magic links; it does not read the user's Gmail inbox or require a Gmail password. Financial storage remains the existing local/Redis implementation. Auth configuration is required even in browser-storage mode.

## Provider and Vercel setup

1. Create a Supabase project and enable the Email provider. Disable public signups. Provision each approved user through the Supabase dashboard and include their email in `AUTH_ALLOWED_EMAILS`. The app sends OTP requests with `create_user: false`; it cannot register users itself.
2. Configure production SMTP with a verified sending domain in Supabase Auth. The default Supabase mail service is limited and should not be assumed to deliver to arbitrary team addresses. Gmail is the receiving mailbox; notification delivery depends on the recipient's Gmail settings. Never put SMTP credentials in the repository or chat.
3. Set Site URL to `https://tanjung-priuk.vercel.app`. Add the exact Redirect URL `https://tanjung-priuk.vercel.app/api/index?action=auth-callback`. Keep the provider's magic-link template using `{{ .ConfirmationURL }}` so Supabase verifies the link and returns a PKCE code. Set email OTP expiry to 600 seconds and retain provider rate limits.
4. In Vercel environment settings configure `APP_ORIGIN=https://tanjung-priuk.vercel.app`, `SUPABASE_URL=https://<project-ref>.supabase.co`, the project's **publishable key** as `SUPABASE_PUBLISHABLE_KEY`, and a comma-separated `AUTH_ALLOWED_EMAILS`. Do not use a service-role/secret key. Do not commit the actual approved email list. Redeploy after setting the variables.
5. For local development use a private ignored `.env.local`, set `APP_ORIGIN=http://127.0.0.1:3100`, and add its exact callback URL to the provider's allowed redirects. Start with `node --env-file=.env.local server.mjs`. A magic link must open in the browser that requested it because the PKCE verifier is stored in an HttpOnly cookie. Gmail's embedded browser may need “open in browser.” Starting a new login replaces the outstanding verifier in that browser.
6. If outbound networking is restricted, allow the project's exact Supabase hostname. Authentication requests originate on the server. SMTP credentials belong in Supabase, not this app. Configure Upstash separately when shared storage is needed.

## Validation before production data

Run `npm test` and `npm run build`. Without configuration, `/api/index?action=status` reports `authenticated: false, configured: false`; state reads/writes must fail. With configuration and no session, reads/writes must return 401. Verify an approved user receives a real email, can follow the link in the same browser, and sees their workspace; an unapproved address must receive no link. Retry a used and an expired link and verify both fail. Check logout blocks subsequent API reads. Test Gmail delivery and desktop/mobile UI against the actual provider before calling production login ready.

Sessions use Secure, HttpOnly, SameSite=Lax cookies on HTTPS and expire after at most one hour, without automatic refresh. Every API request checks the provider's current user and the current allowlist. Removing an address revokes app access on its next API request. Logout clears this browser's cookies; it does not revoke a copied token elsewhere or erase previously downloaded browser data. All approved users have equal read/write access. Application assets are public; private financial records must stay out of public/, dist/, Git, and test fixtures.

No Supabase project, SMTP setup, real email delivery, or production deployment is created by adding this code. The provider settings and real end-to-end login remain required activation steps.
