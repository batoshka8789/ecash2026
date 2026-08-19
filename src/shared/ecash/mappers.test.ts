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

  /**
   * Суммы: ядро хранит value в валюте, amount в тенге при любом направлении
   * (текст его ошибки AMOUNT_MISMATCH, замер 19.08.2026). Домен — value:
   * что отдаёт клиент, amount: что получает.
   */
  it('отдаю тенге: value/amount ядра разворачиваются в доменные', () => {
    // живая заявка №6766: клиент отдал 100 000 ₸, получает 216.22 $
    const r = mapRequest({
      ...base,
      currencyFrom: 'KZT',
      currencyTo: 'USD',
      value: '216.22',
      rate: '462.5',
      amount: 100000,
    });
    expect(r.value).toBe(100000); // отдаёт: тенге
    expect(r.amount).toBe(216.22); // получает: валюта
    expect(r.actionType).toBe('sell');
  });

  it('отдаю валюту: поля совпадают с ядром, разворота нет', () => {
    const r = mapRequest(base); // USD → KZT: value 1000 $, amount 512 400 ₸
    expect(r.value).toBe(1000);
    expect(r.amount).toBe(512400);
  });

  it('историческая запись прежнего формата (тенге в value) не разворачивается', () => {
    // №6713 и ранее: наш старый код слал value в тенге, amount — в валюте;
    // у таких value × rate на порядки больше amount — семантика не ядровая
    const r = mapRequest({
      ...base,
      currencyFrom: 'KZT',
      currencyTo: 'USD',
      value: '100000000',
      rate: '466.7',
      amount: 214270,
    });
    expect(r.value).toBe(100000000);
    expect(r.amount).toBe(214270);
  });

  it('нулевой курс не приводит к развороту', () => {
    const r = mapRequest({
      ...base,
      currencyFrom: 'KZT',
      currencyTo: 'USD',
      value: '100',
      rate: '0',
      amount: 0,
    });
    expect(r.value).toBe(100);
    expect(r.amount).toBe(0);
  });

  /**
   * Ядро ставит статус 8 «Забронирована» сразу при создании, до ответа
   * казначея (вопреки своей документации). Фаза held — только после
   * настоящего подтверждения, иначе все заявки «зелёные» с первой секунды.
   */
  it('статус 8 без ответа казначея — это ещё pending', () => {
    // реальная заявка №6781: создана, казначей не отвечал
    const r = mapRequest({
      ...base,
      status: 8,
      reservedAt: null,
      reservedUntil: null,
      reserveMinutes: null,
      acceptStatus: 0,
      treasurerLogin: null,
      accepts: [
        { acceptId: 571, actionType: 1, status: 0, statusName: 'Заведена', answeredAt: null },
      ],
    });
    expect(r.treasurerConfirmed).toBe(false);
    expect(r.phase).toBe('pending');
  });

  it('казначей подтвердил (accept 2 + окно брони) — фаза held', () => {
    // реальная заявка №6774: подтверждена живым казначеем 19.08.2026
    const r = mapRequest({
      ...base,
      status: 8,
      reservedAt: '2026-08-19T07:17:37.335029Z',
      reservedUntil: '2026-08-19T08:17:37.335029Z',
      reserveMinutes: 60,
      acceptStatus: 2,
      accepts: [
        {
          acceptId: 564,
          actionType: 1,
          status: 2,
          statusName: 'Подтверждена',
          rate: 463.5,
          answeredAt: '2026-08-19T07:17:37.335029Z',
        },
      ],
    });
    expect(r.treasurerConfirmed).toBe(true);
    expect(r.phase).toBe('held');
  });

  it('подтверждение видно и по одному окну брони, без accepts в ответе', () => {
    // в списке /mobile/operations accepts может не быть — достаточно reservedUntil
    const r = mapRequest({ ...base, status: 8, accepts: null });
    expect(r.treasurerConfirmed).toBe(true);
    expect(r.phase).toBe('held');
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
