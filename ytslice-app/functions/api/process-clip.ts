export interface Env {
  INVIDIOUS_INSTANCE?: string;
}

interface ClipRequest {
  videoUrl: string;
  clip: {
    id: string;
    startTime: number;
    endTime: number;
    quality: string;
    format: 'video' | 'audio';
  };
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
      const body = await request.json() as ClipRequest;
      const { videoUrl, clip } = body;
      
      if (!videoUrl || !clip) {
        return new Response(JSON.stringify({ error: 'Video URL and clip info required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const videoId = extractVideoId(videoUrl);
      if (!videoId) {
        return new Response(JSON.stringify({ error: 'Invalid YouTube URL' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const instance = env.INVIDIOUS_INSTANCE || 'https://yewtu.be';
      
      const infoResponse = await fetch(`${instance}/api/v1/videos/${videoId}`);
      if (!infoResponse.ok) {
        throw new Error('Failed to fetch video info');
      }
      
      const info = await infoResponse.json();
      const title = info.title || `YouTube video ${videoId}`.replace(/[^\w\s-]/g, '').trim();
      
      const formats = info.adaptiveFormats || [];
      let selectedFormat = formats.find((f: any) => 
        f.url && 
        f.mimeType?.includes(clip.format === 'video' ? 'video' : 'audio') &&
        (f.qualityLabel === clip.quality || clip.quality === 'source')
      );
      
      if (!selectedFormat) {
        selectedFormat = formats.find((f: any) => 
          f.url && f.mimeType?.includes(clip.format === 'video' ? 'video' : 'audio')
        );
      }
      
      if (!selectedFormat) {
        return new Response(JSON.stringify({ error: 'No suitable format found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const extension = clip.format === 'audio' ? 'mp3' : 'mp4';
      const filename = `${title} [${formatTime(clip.startTime)}-${formatTime(clip.endTime)}].${extension}`
        .replace(/[^\w\s.-]/g, '')
        .slice(0, 200);

      const processedClip = {
        id: clip.id,
        url: selectedFormat.url,
        filename,
        format: clip.format,
      };

      return new Response(JSON.stringify({ success: true, data: processedClip }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Process clip error:', error);
      return new Response(JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to process clip' 
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

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${h}-${m}-${s}`;
}