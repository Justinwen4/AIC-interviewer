# Embedding the AIC Member Insights interviewer

## URL pattern

- **Base path:** `/interview`
- **Event context:** pass a slug that exists in the `events` table, e.g. `/interview?event=general`

The app resolves `event` to an `events.slug` value and stores `event_id` on the session. The default migration seeds `general` for “General / AIC”.

## From another site

1. **Link** — add a normal link or button to your deployed origin:

   `https://YOUR_DOMAIN/interview?event=YOUR_EVENT_SLUG`

2. **Iframe (optional)** — embed the route in a full-height iframe:

   ```html
   <iframe
     title="AIC member insights"
     src="https://YOUR_DOMAIN/interview?event=YOUR_EVENT_SLUG"
     style="width:100%;min-height:640px;border:0;border-radius:12px"
   ></iframe>
   ```

   Ensure your deployment sets appropriate `Content-Security-Policy` / `X-Frame-Options` if you need to allow embedding only on specific origins.

3. **New tab** — opening the interviewer in a new tab avoids iframe cookie quirks and is often the most reliable for MVP.

## Cookies

The interview uses an **httpOnly** cookie (`aic_session_id`) scoped to your app origin. The host page must be on the **same origin** as the Next.js app, or you need a reverse proxy that serves the app under your public domain.

## Admin

Internal review UI: `/admin` (password from `ADMIN_PASSWORD`). Not intended for public embedding.
