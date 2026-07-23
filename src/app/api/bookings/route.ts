import { db, MARKET, newId } from '@/server/db';
import { currentUser } from '@/server/session';
import { body, fail, isPhone, ok } from '@/server/http';
import type { Booking, BookingType, CurrencyCode } from '@/lib/types';

const HOLD_MS = 30 * 60_000; // «Бронь · 30мин» из макета

export async function GET() {
  const user = await currentUser();
  const list = db.bookings.filter((b) => b.userId === (user?.id ?? null) || b.userId === user?.id);
  return ok({ bookings: list.sort((a, b) => b.createdAt - a.createdAt) });
}

/** Создаёт бронь или заявку на индивидуальный курс. */
export async function POST(req: Request) {
  const data = await body<{
    type?: BookingType;
    from?: CurrencyCode;
    to?: CurrencyCode;
    amount?: number;
    banknotes?: 'small' | 'large' | null;
    branchId?: string;
    side?: 'buy' | 'sell';
    phone?: string;
    name?: string;
  }>(req);

  const phone = data?.phone?.trim() ?? '';
  if (!isPhone(phone)) return fail('errors.phoneRequired', 400, 'phone');

  const amount = Number(data?.amount);
  if (!Number.isFinite(amount) || amount <= 0) return fail('errors.amountRequired', 400, 'amount');

  const branchId = data?.branchId ?? db.branches[0].id;
  if (!db.branches.some((b) => b.id === branchId)) return fail('errors.branchUnknown', 400, 'branchId');

  const user = await currentUser();
  const type: BookingType = data?.type === 'individual' ? 'individual' : 'booking';
  const now = Date.now();

  const booking: Booking = {
    id: newId(),
    userId: user?.id ?? null,
    type,
    status: type === 'individual' ? 'review' : 'active',
    from: data?.from ?? 'KZT',
    to: data?.to ?? 'USD',
    amount,
    result: type === 'individual' ? null : Number((amount / MARKET).toFixed(2)),
    rate: MARKET,
    banknotes: data?.banknotes ?? null,
    branchId,
    side: data?.side === 'sell' ? 'sell' : 'buy',
    phone,
    name: data?.name?.trim() ?? '',
    maskedNumber: `7 704 *** ** ${String(Math.floor(10 + Math.random() * 89))}`,
    createdAt: now,
    expiresAt: type === 'individual' ? null : now + HOLD_MS,
  };

  db.bookings.unshift(booking);

  if (user) {
    db.notifications.unshift({
      id: newId(),
      userId: user.id,
      badges: type === 'individual' ? ['individual', 'number'] : ['booking30', 'number'],
      titleKey: type === 'individual' ? 'offerSent' : 'bookedPair',
      createdAt: now,
      read: false,
      archived: false,
      side: booking.side,
      amount: `${amount} (₸) : ${booking.result ?? '—'} ($)`,
      address: db.branches.find((b) => b.id === branchId)?.address,
      bookingId: booking.id,
      actions: [],
    });
  }

  return ok({ booking }, { status: 201 });
}
