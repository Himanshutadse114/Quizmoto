# Microsoft Entra SSO setup

LMSGEN uses the Microsoft identity platform authorization-code flow with PKCE for browser-based Staff, Learner and Campaign sign-in.

## Entra application registration

In Microsoft Entra admin centre, open **App registrations > your application > Authentication** and add the callback URL shown in LMSGEN Authentication & SSO under the **Single-page application (SPA)** platform.

Use the exact LMSGEN callback URL. Staff and learner callbacks are configured separately.

The legacy **Implicit grant and hybrid flows > ID tokens** setting is not required and should not be enabled just for LMSGEN.

LMSGEN requests `openid profile email`, exchanges the authorization code in the browser using PKCE and then sends the returned ID token to the LMSGEN backend for tenant, audience, domain and membership verification.
