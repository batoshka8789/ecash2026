import { describe, expect, it } from 'vitest';
import { mapDepartmentInfo, mapRateStat, mapRequest, phaseOf, sideOf } from './mappers';

describe('sideOf — правило направления из документации', () => {
  it('currencyFrom ≠ KZT → покупка у клиента', () => {
    expect(sideOf('USD')).toBe('buy');
    expect(sideOf('GOLD5')).toBe('buy');
  });
  it('currencyFrom = KZT → продажа', () => {
    expect(sideOf('KZT')).toBe('sell');
  });
});

describe('phaseOf', () => {
  it.each([
    [0, 'pending'],
    [8, 'held'],
    [1, 'done'],
    [3, 'cancelled'],
  ] as const)('статус %i → %s', (status, phase) => {
    expect(phaseOf(status)).toBe(phase);
  });
});

describe('mapRequest', () => {
  const base = {
    requestId: 10432,
    status: 8,
    statusName: 'Забронирована',
    clientId: 5512,
    currencyFrom: 'USD',
    currencyTo: 'KZT',
    value: '1000',
    rate: '512.40',
    amount: 512400,
    depId: 42,
    kassaId: 77,
    isReserve: true,
    isIndividual: false,
    reserveMinutes: 60,
    reservedAt: '2026-07-23T09:15:00Z',
    reservedUntil: '2026-07-23T10:15:00Z',
    isExpired: false,
    acceptStatus: 2,
    treasurerLogin: 'kaznachey01',
    createdAt: '2026-07-23T09:10:00',
    updatedAt: '2026-07-23T09:15:00Z',
  };

  it('карточка из документации разбирается полностью', () => {
    const r = mapRequest(base);
    expect(r.requestId).toBe(10432);
    expect(r.phase).toBe('held');
    expect(r.value).toBe(1000);
    expect(r.rate).toBe(512.4);
    expect(r.actionType).toBe('buy');
    // дата без Z получила таймзону
    expect(r.createdAt).toBe('2026-07-23T09:10:00Z');
  });

  it('needsClientConfirmation: индивидуальная заявка в статусе 0 с подтверждённым acceptом типа 2', () => {
    const r = mapRequest({
      ...base,
      status: 0,
      isIndividual: true,
      accepts: [{ acceptId: 1, actionType: 2, status: 2, statusName: 'Подтверждена' }],
    });
    expect(r.needsClientConfirmation).toBe(true);
    expect(r.phase).toBe('pending');
  });

  it('обычная заявка в статусе 0 подтверждения не требует', () => {
    const r = mapRequest({ ...base, status: 0, accepts: [] });
    expect(r.needsClientConfirmation).toBe(false);
  });

  it('после согласия клиента (появился accept брони) повторного подтверждения не требует', () => {
    // раздел 5, шаг 3 контракта: confirm автоматически создаёт запрос брони
    // казначею — accept типа 1; заявка при этом остаётся в статусе 0
    const r = mapRequest({
      ...base,
      status: 0,
      isIndividual: true,
      accepts: [
        { acceptId: 1, actionType: 2, status: 2, statusName: 'Подтверждена' },
        { acceptId: 2, actionType: 1, status: 0, statusName: 'Заведена' },
      ],
    });
    expect(r.needsClientConfirmation).toBe(false);
    expect(r.bookingRequested).toBe(true);
    expect(r.phase).toBe('pending');
  });
});

describe('mapRateStat', () => {
  it('строки → числа, дубли дат в history убраны, сортировка по дате', () => {
    const s = mapRateStat({
      currencyCode: 'USD',
      currencyName: 'Доллар США',
      buy: '502.00',
      sell: '507.00',
      change: '0.00',
      history: [
        { date: '2026-07-22', buy: '502.00', sell: '507.00' },
        { date: '2026-07-20', buy: '502.00', sell: '507.00' },
        { date: '2026-07-20', buy: '502.00', sell: '507.00' }, // дубль — реальный ответ API
      ],
    });
    expect(s.buy).toBe(502);
    expect(s.history).toHaveLength(2);
    expect(s.history[0].date).toBe('2026-07-20');
  });
});

describe('mapDepartmentInfo', () => {
  it('нормализует перепутанные координаты и разбирает timetable', () => {
    const d = mapDepartmentInfo({
      depId: 10,
      code: 'Сарыарка',
      name: 'Сарыарка Exchange',
      address: 'ТЦ Сарыарка',
      city: 'Астана',
      lat: '71.410372',
      lon: '51.138198',
      timetable: { openTime: '09:00', closeTime: '23:59' },
      ratesUpdatedAt: null,
      currencyList: [
        {
          currCode: 'USD',
          currDescr: 'Доллар США',
          buy: 521.5,
          sale: 526.4,
          buyDiff: 521.5,
          buyDiffDir: '+',
          saleDiff: 526.4,
          saleDiffDir: '+',
          currImage: 'https://ecash.kz/assets/images/Flags/USD.png',
        },
      ],
    });
    expect(d.coords).toEqual({ lat: 51.138198, lon: 71.410372 });
    expect(d.timetable?.openTime).toBe('09:00');
    expect(d.currencies[0].sell).toBe(526.4);
    expect(d.currencies[0].flagUrl).toContain('USD.png');
  });
});
