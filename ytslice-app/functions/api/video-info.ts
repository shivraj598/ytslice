export interface Env {
  INVIDIOUS_INSTANCE?: string;
}

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

      const videoId = extractVideoId(url);
      if (!videoId) {
        return new Response(JSON.stringify({ error: 'Invalid YouTube URL' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const instance = env.INVIDIOUS_INSTANCE || 'https://yewtu.be';
      
      const infoResponse = await fetch(`${instance}/api/v1/videos/${videoId}`);
      if (!infoResponse.ok) {
        throw new Error('Failed to fetch video info from Invidious');
      }
      
      const info = await infoResponse.json();

      const formats = info.adaptiveFormats
        ?.filter((f: any) => f.url && (f.mimeType?.includes('video') || f.mimeType?.includes('audio')))
        ?.map((f: any) => ({
          quality: f.qualityLabel || f.quality || 'unknown',
          formatId: f.itag?.toString() || '',
          ext: f.mimeType?.split('/')[1]?.split(';')[0] || 'mp4',
          filesize: f.contentLength ? parseInt(f.contentLength) : undefined,
          vcodec: f.mimeType?.includes('video') ? 'avc1' : 'none',
          acodec: f.mimeType?.includes('audio') ? 'mp4a' : 'none',
          url: f.url,
        })) || [];

      const videoInfo = {
        id: videoId,
        title: info.title || `YouTube video ${videoId}`,
        thumbnail: info.thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        duration: info.lengthSeconds || 0,
        formats,
      };

      return new Response(JSON.stringify({ success: true, data: videoInfo }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Video info error:', error);
      return new Response(JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to fetch video info' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};

function extractVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtu.be')) {
      return parsed.pathname.slice(1).split('/')[0];
    }
    if (parsed.hostname.includes('youtube.com')) {
      return parsed.searchParams.get('v') || parsed.pathname.split('/').pop() || null;
    }
  } catch {
    return null;
  }
  return null;
}