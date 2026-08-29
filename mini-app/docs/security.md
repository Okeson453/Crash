# Mini App security decisions

- Telegram `initData` is authenticated by the backend with HMAC-SHA256. The frontend never treats `initDataUnsafe` as an authorization signal.
- The Mini App uses the server-issued role only for presentation; every operator/admin API remains protected by backend RBAC.
- Access/refresh tokens are centralized through `src/lib/storage.ts`. This remains browser-readable storage; migrating to an HttpOnly SameSite cookie requires a coordinated backend/API change.
- Requests include a non-secret session correlation ID through `X-Session-Id`.
- Production nginx sends CSP, frame, MIME-sniffing, referrer, permissions, and HSTS headers. Update `connect-src` for the real API/WS origins before deployment.
- User-supplied URLs must pass `src/utils/url.ts` before external navigation.
- No `dangerouslySetInnerHTML` is used.
