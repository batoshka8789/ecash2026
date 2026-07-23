import { db } from '@/server/db';
import { fail, ok } from '@/server/http';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const booking = db.bookings.find((b) => b.id === id);
  if (!booking) return fail('errors.notFound', 404);
  return ok({ booking });
}

/** Снятие с брони — состояние «Снято с брони» из макета. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const booking = db.bookings.find((b) => b.id === id);
  if (!booking) return fail('errors.notFound', 404);

  booking.status = 'cancelled';
  booking.expiresAt = null;
  return ok({ booking });
}
