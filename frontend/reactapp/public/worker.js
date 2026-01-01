// frontend/reactapp/worker.js (or worker/index.js)
export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const pathname = url.pathname;

        // List of static file extensions and paths
        const staticExtensions = [
            '.js', '.css', '.json', '.png', '.jpg', '.jpeg', '.gif', '.svg',
            '.ico', '.woff', '.woff2', '.ttf', '.eot', '.webm', '.mp4',
            '.webmanifest', '.txt', '.xml', '.html'
        ];

        const isStaticAsset =
            staticExtensions.some(ext => pathname.endsWith(ext)) ||
            pathname.startsWith('/assets/') ||
            pathname.startsWith('/logos/') ||
            pathname === '/index.html' ||
            pathname === '/sw.js' ||
            pathname === '/registerSW.js' ||
            pathname === '/manifest.webmanifest';

        // If it's a static asset, try to fetch it
        if (isStaticAsset) {
            const asset = await env.ASSETS.fetch(request);
            if (asset && asset.status !== 404) {
                return asset;
            }
        }

        // For all other routes (like /playground, /home, etc.), serve index.html
        // This allows React Router to handle client-side routing
        const indexRequest = new Request(new URL('/index.html', request.url), request);
        const indexResponse = await env.ASSETS.fetch(indexRequest);

        if (indexResponse && indexResponse.status !== 404) {
            return new Response(indexResponse.body, {
                status: 200,
                headers: {
                    'Content-Type': 'text/html; charset=utf-8',
                    ...Object.fromEntries(indexResponse.headers),
                },
            });
        }

        // Fallback 404
        return new Response('Not Found', { status: 404 });
    }
};