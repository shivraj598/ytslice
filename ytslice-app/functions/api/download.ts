export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      const { url } = await request.json();
      
      if (!url) {
        return new Response(JSON.stringify({ error: 'URL is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Range': 'bytes=0-',
        },
      });

      if (!response.ok && response.status !== 206) {
        throw new Error(`Failed to fetch video: ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      const contentLength = response.headers.get('content-length');
      
      return new Response(response.body, {
        headers: {
          'Content-Type': contentType,
          'Content-Length': contentLength || '',
          'Content-Disposition': 'attachment',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    } catch (error) {
      console.error('Download error:', error);
      return new Response(JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Download failed' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};

interface Env {}