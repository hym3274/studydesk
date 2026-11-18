const value = process.env.VITE_ROOMS_URL?.trim() || process.env.RENDER_EXTERNAL_URL?.trim();
const url = value && URL.canParse(value) ? new URL(value) : null;
if (!url || url.protocol !== 'https:' || url.href !== url.origin + '/') {
  throw new Error('Set VITE_ROOMS_URL or RENDER_EXTERNAL_URL to the public HTTPS origin of the room server');
}

process.env.VITE_ROOMS_URL = url.origin;
await import('./build-rooms.mjs');
await import('./build-standalone.mjs');
