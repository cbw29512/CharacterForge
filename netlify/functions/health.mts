import { getDatabase } from '@netlify/database';
import type { Config } from '@netlify/functions';

const REQUIRED_TABLE_COUNT = 5;

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export default async function health(request: Request): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
  }

  try {
    const connectionString = process.env.NETLIFY_DB_URL;
    const db = getDatabase(connectionString ? { connectionString } : undefined);
    const rows = await db.sql<{ table_count: number }>`
      SELECT COUNT(*)::int AS table_count
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'users',
          'campaigns',
          'campaign_memberships',
          'character_templates',
          'characters'
        )
    `;

    const schemaReady = rows[0]?.table_count === REQUIRED_TABLE_COUNT;
    if (!schemaReady) {
      return jsonResponse(
        { ok: false, service: 'characterforge', database: 'schema_not_ready' },
        503,
      );
    }

    return jsonResponse({
      ok: true,
      service: 'characterforge',
      database: 'reachable',
      schema: 1,
    });
  } catch (error) {
    console.error('CharacterForge database health check failed', error instanceof Error ? error.name : 'unknown_error');
    return jsonResponse(
      { ok: false, service: 'characterforge', database: 'unavailable' },
      503,
    );
  }
}

export const config: Config = {
  path: '/api/health',
};
