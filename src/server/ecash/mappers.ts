import 'server-only';
import type {
  AcceptActionType,
  AcceptStatus,
  BestRate,
  Department,
  DepartmentCurrency,
  DepartmentInfo,
  ExchangeRequest,
  OperationsPage,
  OperationSide,
  RateStat,
  RequestAccept,
  RequestHistoryEntry,
  RequestPhase,
  RequestStatus,
} from '@/lib/domain';
import { int, iso, normalizeCoords, num, str } from './coerce';

/** Правило направления из документации: currencyFrom ≠ KZT → покупка у клиента. */
export function sideOf(currencyFrom: string): OperationSide {
  return currencyFrom !== 'KZT' ? 'buy' : 'sell';
}

const asStatus = (v: unknown): RequestStatus => {
  const n = int(v);
  return n === 1 || n === 3 || n === 8 ? n : 0;
};

const asAcceptStatus = (v: unknown): AcceptStatus | null => {
  const n = int(v);
  return n === 0 || n === 1 || n === 2 || n === 3 ? n : null;
};

/** Единственное место, где числовой статус превращается в фазу UI. */
export function phaseOf(status: RequestStatus): RequestPhase {
  switch (status) {
    case 8:
      return 'held';
    case 1:
      return 'done';
    case 3:
      return 'cancelled';
    default:
      return 'pending';
  }
}

// --------------------------------------------------------------- отделения

type RawDep = { depId?: unknown; address?: unknown; code?: unknown };

export function mapDepartment(raw: RawDep): Department {
  return {
    depId: int(raw.depId) ?? 0,
    address: str(raw.address),
    code: str(raw.code),
  };
}

type RawCurrency = {
  currCode?: unknown;
  currDescr?: unknown;
  buy?: unknown;
  sale?: unknown;
  buyDiff?: unknown;
  buyDiffDir?: unknown;
  saleDiff?: unknown;
  saleDiffDir?: unknown;
  currImage?: unknown;
};

function mapDepartmentCurrency(raw: RawCurrency): DepartmentCurrency {
  return {
    code: str(raw.currCode),
    name: str(raw.currDescr),
    buy: num(raw.buy),
    sell: num(raw.sale),
    buyDiff: num(raw.buyDiff),
    buyDiffDir: raw.buyDiffDir === '-' ? '-' : '+',
    sellDiff: num(raw.saleDiff),
    sellDiffDir: raw.saleDiffDir === '-' ? '-' : '+',
    flagUrl: str(raw.currImage) || null,
  };
}

type RawDepInfo = RawDep & {
  name?: unknown;
  city?: unknown;
  lat?: unknown;
  lon?: unknown;
  timetable?: { openTime?: unknown; closeTime?: unknown } | null;
  ratesUpdatedAt?: unknown;
  currencyList?: RawCurrency[] | null;
};

export function mapDepartmentInfo(raw: RawDepInfo): DepartmentInfo {
  const depId = int(raw.depId) ?? 0;
  return {
    ...mapDepartment(raw),
    name: str(raw.name),
    city: str(raw.city),
    coords: normalizeCoords(raw.lat, raw.lon, depId),
    timetable: raw.timetable
      ? { openTime: str(raw.timetable.openTime), closeTime: str(raw.timetable.closeTime) }
      : null,
    ratesUpdatedAt: iso(raw.ratesUpdatedAt),
    currencies: (raw.currencyList ?? []).map(mapDepartmentCurrency),
  };
}

// -------------------------------------------------------------------- курсы

type RawStat = {
  currencyCode?: unknown;
  currencyName?: unknown;
  buy?: unknown;
  sell?: unknown;
  change?: unknown;
  history?: { date?: unknown; buy?: unknown; sell?: unknown }[] | null;
};

export function mapRateStat(raw: RawStat): RateStat {
  // history приходит с дублями (проверено: depId 1 содержит одну дату дважды) — дедуплицируем
  const seen = new Set<string>();
  const history = (raw.history ?? [])
    .map((h) => ({ date: str(h.date), buy: num(h.buy), sell: num(h.sell) }))
    .filter((h) => {
      if (!h.date || seen.has(h.date)) return false;
      seen.add(h.date);
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    currencyCode: str(raw.currencyCode),
    currencyName: str(raw.currencyName),
    buy: num(raw.buy),
    sell: num(raw.sell),
    change: num(raw.change),
    history,
  };
}

type RawBest = {
  city?: unknown;
  currencyCode?: unknown;
  bestBuy?: { depId?: unknown; address?: unknown; rate?: unknown } | null;
  bestSale?: { depId?: unknown; address?: unknown; rate?: unknown } | null;
};

export function mapBestRate(raw: RawBest): BestRate {
  const side = (s: RawBest['bestBuy']) =>
    s ? { depId: int(s.depId) ?? 0, address: str(s.address), rate: num(s.rate) } : null;
  return {
    city: str(raw.city) || null,
    currencyCode: str(raw.currencyCode),
    bestBuy: side(raw.bestBuy),
    bestSale: side(raw.bestSale),
  };
}

// ------------------------------------------------------------------- заявки

type RawAccept = {
  acceptId?: unknown;
  actionType?: unknown;
  actionTypeName?: unknown;
  status?: unknown;
  statusName?: unknown;
  rate?: unknown;
  amount?: unknown;
  value?: unknown;
  createdAt?: unknown;
  answeredAt?: unknown;
};

function mapAccept(raw: RawAccept): RequestAccept {
  return {
    acceptId: int(raw.acceptId) ?? 0,
    actionType: (int(raw.actionType) === 2 ? 2 : 1) as AcceptActionType,
    actionTypeName: str(raw.actionTypeName),
    status: asAcceptStatus(raw.status) ?? 0,
    statusName: str(raw.statusName),
    rate: raw.rate == null ? null : num(raw.rate),
    amount: raw.amount == null ? null : num(raw.amount),
    value: raw.value == null ? null : num(raw.value),
    createdAt: iso(raw.createdAt),
    answeredAt: iso(raw.answeredAt),
  };
}

type RawHistory = {
  updatedAt?: unknown;
  oldStatus?: unknown;
  oldStatusName?: unknown;
  status?: unknown;
  statusName?: unknown;
  action?: unknown;
  rate?: unknown;
  value?: unknown;
  amount?: unknown;
};

function mapHistory(raw: RawHistory): RequestHistoryEntry {
  return {
    updatedAt: iso(raw.updatedAt),
    oldStatus: asStatus(raw.oldStatus),
    oldStatusName: str(raw.oldStatusName),
    status: asStatus(raw.status),
    statusName: str(raw.statusName),
    action: str(raw.action),
    rate: raw.rate == null ? null : num(raw.rate),
    value: raw.value == null ? null : num(raw.value),
    amount: raw.amount == null ? null : num(raw.amount),
  };
}

export type RawRequest = {
  requestId?: unknown;
  status?: unknown;
  statusName?: unknown;
  clientId?: unknown;
  currencyFrom?: unknown;
  currencyTo?: unknown;
  value?: unknown;
  rate?: unknown;
  amount?: unknown;
  actionType?: unknown;
  depId?: unknown;
  kassaId?: unknown;
  isReserve?: unknown;
  isIndividual?: unknown;
  reserveMinutes?: unknown;
  reservedAt?: unknown;
  reservedUntil?: unknown;
  isExpired?: unknown;
  acceptStatus?: unknown;
  acceptComment?: unknown;
  comment?: unknown;
  treasurerLogin?: unknown;
  printedTicket?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  accepts?: RawAccept[] | null;
  history?: RawHistory[] | null;
};

export function mapRequest(raw: RawRequest): ExchangeRequest {
  const status = asStatus(raw.status);
  const currencyFrom = str(raw.currencyFrom);
  const accepts = (raw.accepts ?? []).map(mapAccept);
  const isIndividual = raw.isIndividual === true;

  // индивидуальный курс согласован казначеем (accept типа 2 подтверждён),
  // заявка ещё в статусе 0 → ждём решения клиента, окно 60 минут
  const needsClientConfirmation =
    status === 0 && isIndividual && accepts.some((a) => a.actionType === 2 && a.status === 2);

  return {
    requestId: int(raw.requestId) ?? 0,
    status,
    statusName: str(raw.statusName),
    phase: phaseOf(status),
    needsClientConfirmation,
    clientId: int(raw.clientId),
    currencyFrom,
    currencyTo: str(raw.currencyTo),
    value: num(raw.value),
    rate: num(raw.rate),
    amount: num(raw.amount),
    actionType: raw.actionType === 'sell' || raw.actionType === 'buy' ? raw.actionType : sideOf(currencyFrom),
    depId: int(raw.depId),
    kassaId: int(raw.kassaId),
    isReserve: raw.isReserve === true,
    isIndividual,
    reserveMinutes: int(raw.reserveMinutes) ?? 60,
    reservedAt: iso(raw.reservedAt),
    reservedUntil: iso(raw.reservedUntil),
    isExpired: raw.isExpired === true,
    acceptStatus: asAcceptStatus(raw.acceptStatus),
    acceptComment: str(raw.acceptComment) || null,
    comment: str(raw.comment) || null,
    treasurerLogin: str(raw.treasurerLogin) || null,
    printedTicket: str(raw.printedTicket) || null,
    createdAt: iso(raw.createdAt),
    updatedAt: iso(raw.updatedAt),
    accepts,
    history: (raw.history ?? []).map(mapHistory),
  };
}

type RawOperations = {
  accountId?: unknown;
  clientId?: unknown;
  page?: unknown;
  pageSize?: unknown;
  total?: unknown;
  requests?: RawRequest[] | null;
};

export function mapOperationsPage(raw: RawOperations): OperationsPage {
  return {
    accountId: str(raw.accountId),
    clientId: int(raw.clientId),
    page: int(raw.page) ?? 1,
    pageSize: int(raw.pageSize) ?? 20,
    total: int(raw.total) ?? 0,
    requests: (raw.requests ?? []).map(mapRequest),
  };
}

// ------------------------------------------------------------------ аккаунт

type RawAccount = {
  accountId?: unknown;
  phoneNumber?: unknown;
  isLinkedToClient?: unknown;
  clientId?: unknown;
  iin?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  middleName?: unknown;
  client?: {
    clientId?: unknown;
    iin?: unknown;
    firstName?: unknown;
    lastName?: unknown;
    middleName?: unknown;
  } | null;
};

export function mapAccount(raw: RawAccount) {
  // проекция ядрового клиента может лежать плоско или вложенно — берём оба варианта
  const c = raw.client ?? {};
  return {
    accountId: str(raw.accountId),
    phoneNumber: str(raw.phoneNumber),
    isLinkedToClient: raw.isLinkedToClient === true,
    clientId: int(raw.clientId) ?? int(c.clientId),
    iin: str(raw.iin) || str(c.iin) || null,
    firstName: str(raw.firstName) || str(c.firstName),
    lastName: str(raw.lastName) || str(c.lastName),
    middleName: str(raw.middleName) || str(c.middleName),
  };
}
