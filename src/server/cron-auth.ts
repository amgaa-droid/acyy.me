import "server-only";

import { timingSafeEqual } from "node:crypto";

import { env } from "@/env";

/** Cron routes are called by the host crontab with `Authorization: Bearer $CRON_SECRET`. */
export function isCronRequest(req: Request): boolean {
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${env().CRON_SECRET}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
