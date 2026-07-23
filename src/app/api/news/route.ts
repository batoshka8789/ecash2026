import { db } from '@/server/db';
import { ok } from '@/server/http';

export async function GET() {
  return ok({ posts: [...db.news].sort((a, b) => b.publishedAt - a.publishedAt) });
}
