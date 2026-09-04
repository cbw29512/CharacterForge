import type { Config, Context } from "@netlify/functions";

const payload = Object.freeze({
  ok: true,
  service: "characterforge-api",
  runtime: "netlify",
  version: 1,
});

export default async function health(_request: Request, _context: Context): Promise<Response> {
  return Response.json(payload, {
    status: 200,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export const config: Config = {
  path: "/api/health",
};
