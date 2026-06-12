/* Coconut Cove — Worker entry (static assets + /api/events)
   ----------------------------------------------------------------
   This site is a Cloudflare Worker with static assets. Static files
   (HTML/CSS/JS/images) are served directly by the assets layer and
   never reach this Worker. This Worker only runs for paths with no
   matching static file — which is exactly where we put the dynamic
   /api/events endpoint (server-side Google Calendar fetch + 12h
   edge cache; see worker/events-core.js).

   Anything else that falls through (e.g. an unknown path) is handed
   back to the assets binding, which serves the file or returns 404. */

import { handleEvents } from './events-core.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/events') {
      return handleEvents(request, ctx);
    }

    // Not an API route → let the static-assets layer handle it.
    return env.ASSETS.fetch(request);
  }
};
