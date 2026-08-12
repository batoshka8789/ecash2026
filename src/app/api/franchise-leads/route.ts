import { NextResponse } from 'next/server';
import { db } from '@/server/db/client';
import { franchiseLeads } from '@/server/db/schema';
import { submitFranchise } from '@/server/ecash/endpoints/franchise';
import { checkOrigin, rateLimited } from '@/server/api/guard';
import { body, fail, ok } from '@/server/api/respond';
import { franchiseLeadBody, type FranchiseLeadBody } from '@/shared/schemas';

/**
 * Заявка на франшизу с лендинга. Публичный, но с rate-limit от спама.
 * Основной получатель — Ecash (POST /mobile/franchise): успех ответа
 * определяется успехом upstream-запроса. Локальная запись в franchise_leads
 * остаётся страховкой, чтобы заявки не терялись и были видны админу, —
 * в том числе при недоступном Ecash (тогда с пометкой в tags).
 */

/**
 * Пишем лид локально. businessDescription кладём в колонку experience
 * (свободный текст «про бизнес» — ближайшая по смыслу; отдельной колонки
 * нет, а миграции ради упрощённой анкеты не заводим). Колонки city/funds
 * остаются пустыми — схему таблицы не ломаем.
 */
async function insertLead(parsed: FranchiseLeadBody, tags: string[]) {
  const [row] = await db
    .insert(franchiseLeads)
    .values({
      name: parsed.fullName,
      phone: parsed.phoneNumber,
      experience: parsed.businessDescription ?? '',
      tags,
    })
    .returning();
  return row;
}

export async function POST(req: Request) {
  const originErr = checkOrigin(req);
  if (originErr) return originErr;
  if (rateLimited(req, 'lead', 5, 60_000)) return fail('errors.tooManyRequests', 429);

  const parsed = await body(req, franchiseLeadBody);
  if (parsed instanceof NextResponse) return parsed;

  let ecashDown = false;
  try {
    await submitFranchise({
      fullName: parsed.fullName,
      phoneNumber: parsed.phoneNumber,
      businessDescription: parsed.businessDescription,
      amount: parsed.amount,
      comment: parsed.comment,
    });
  } catch (e) {
    console.warn('[franchise] upstream недоступен, лид сохраняем локально с пометкой', e);
    ecashDown = true;
  }

  // Страховочная запись делается в любом случае; её падение логируем, но
  // клиенту не показываем — заявку Ecash уже принял, терять успех нельзя.
  let row: Awaited<ReturnType<typeof insertLead>> | null = null;
  try {
    row = await insertLead(parsed, ecashDown ? ['ecash_failed'] : []);
  } catch (e) {
    console.error('[franchise] локальная запись лида не удалась', e);
  }

  if (ecashDown) return fail('errors.serverError', 502);

  return ok(
    { lead: row ? { id: row.id, createdAt: row.createdAt.toISOString() } : null },
    { status: 201 },
  );
}
