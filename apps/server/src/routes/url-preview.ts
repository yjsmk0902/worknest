import type { Database } from '@worknest/db';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Auth } from '../lib/auth';
import { createRequireAuth } from '../middleware/auth';

// ── Constants ──────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 6_000;
const MAX_HTML_BYTES = 512_000; // 500 KB is enough for <head>
const USER_AGENT =
  'Mozilla/5.0 (compatible; WorknestBot/1.0; +https://worknest.dev)';

// ── Schemas ────────────────────────────────────────────────────────────

const previewQuery = z.object({
  url: z.string().url(),
});

interface UrlPreview {
  url: string;
  siteName: string | null;
  title: string | null;
  description: string | null;
  image: string | null;
  favicon: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────

function extractMeta(html: string, url: URL): UrlPreview {
  const head = html.split(/<\/head>/i)[0] ?? html;

  const metaRe =
    /<meta\s+(?:[^>]*?\s+)?(?:property|name)=["']([^"']+)["'][^>]*?content=["']([^"']*)["'][^>]*>/gi;
  const metaContentFirstRe =
    /<meta\s+(?:[^>]*?\s+)?content=["']([^"']*)["'][^>]*?(?:property|name)=["']([^"']+)["'][^>]*>/gi;

  const meta = new Map<string, string>();
  const add = (key: string, val: string) => {
    const k = key.toLowerCase();
    if (!meta.has(k)) meta.set(k, val);
  };

  for (const m of head.matchAll(metaRe)) add(m[1]!, m[2]!);
  for (const m of head.matchAll(metaContentFirstRe)) add(m[2]!, m[1]!);

  // <title>
  const titleMatch = /<title[^>]*>([^<]+)<\/title>/i.exec(head);
  const docTitle = titleMatch?.[1]?.trim() ?? null;

  // favicon
  const linkRe =
    /<link\s+(?:[^>]*?\s+)?rel=["']([^"']+)["'][^>]*?href=["']([^"']+)["'][^>]*>/gi;
  const linkHrefFirstRe =
    /<link\s+(?:[^>]*?\s+)?href=["']([^"']+)["'][^>]*?rel=["']([^"']+)["'][^>]*>/gi;
  let favicon: string | null = null;
  const faviconRelPriorities = ['apple-touch-icon', 'icon', 'shortcut icon'];
  const iconByRel = new Map<string, string>();
  for (const m of head.matchAll(linkRe)) {
    const rels = (m[1] ?? '').toLowerCase().split(/\s+/);
    for (const r of rels) {
      if (!iconByRel.has(r)) iconByRel.set(r, m[2]!);
    }
  }
  for (const m of head.matchAll(linkHrefFirstRe)) {
    const rels = (m[2] ?? '').toLowerCase().split(/\s+/);
    for (const r of rels) {
      if (!iconByRel.has(r)) iconByRel.set(r, m[1]!);
    }
  }
  for (const key of faviconRelPriorities) {
    const v = iconByRel.get(key);
    if (v) {
      favicon = v;
      break;
    }
  }
  favicon ??= `${url.origin}/favicon.ico`;

  const resolveUrl = (value: string | null | undefined): string | null => {
    if (!value) return null;
    try {
      return new URL(value, url).toString();
    } catch {
      return null;
    }
  };

  return {
    url: url.toString(),
    siteName: meta.get('og:site_name') ?? null,
    title:
      meta.get('og:title') ??
      meta.get('twitter:title') ??
      docTitle ??
      null,
    description:
      meta.get('og:description') ??
      meta.get('twitter:description') ??
      meta.get('description') ??
      null,
    image:
      resolveUrl(meta.get('og:image') ?? meta.get('twitter:image') ?? null) ??
      null,
    favicon: resolveUrl(favicon),
  };
}

async function fetchPreview(rawUrl: string): Promise<UrlPreview> {
  const target = new URL(rawUrl);

  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    throw new Error('Only http and https URLs are supported');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(target, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) {
      return {
        url: target.toString(),
        siteName: null,
        title: null,
        description: null,
        image: null,
        favicon: `${target.origin}/favicon.ico`,
      };
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) {
      return {
        url: target.toString(),
        siteName: null,
        title: null,
        description: null,
        image: null,
        favicon: `${target.origin}/favicon.ico`,
      };
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder('utf-8');
    let received = 0;
    let html = '';
    while (received < MAX_HTML_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      html += decoder.decode(value, { stream: true });
      if (/<\/head>/i.test(html)) break;
    }
    try {
      await reader.cancel();
    } catch {
      // ignore
    }

    return extractMeta(html, target);
  } finally {
    clearTimeout(timer);
  }
}

// ── Routes ─────────────────────────────────────────────────────────────

export async function urlPreviewRoutes(
  app: FastifyInstance,
  opts: { auth: Auth; db: Database },
): Promise<void> {
  const { auth } = opts;
  const requireAuth = createRequireAuth(auth);

  app.get(
    '/api/v1/url-preview',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Utilities'],
        summary: 'Fetch OG/Twitter metadata for a URL (used for bookmarks)',
      },
    },
    async (request, reply) => {
      const { url } = previewQuery.parse(request.query);
      try {
        const preview = await fetchPreview(url);
        return reply.status(200).send(preview);
      } catch (err) {
        request.log.warn({ err, url }, 'url-preview fetch failed');
        return reply.status(200).send({
          url,
          siteName: null,
          title: null,
          description: null,
          image: null,
          favicon: null,
        } satisfies UrlPreview);
      }
    },
  );
}
