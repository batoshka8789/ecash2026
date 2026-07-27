// Минимальный декодер Kiwi поверх схемы, встроенной в .fig.
// Отличие от kiwi-schema: при ошибке сообщает путь и смещение, а не просто бросает.

export class Reader {
  constructor(buf) {
    this.buf = buf;
    this.off = 0;
  }
  byte() {
    if (this.off >= this.buf.length) throw new Error('EOF');
    return this.buf[this.off++];
  }
  varuint() {
    let value = 0,
      shift = 0,
      b;
    do {
      b = this.byte();
      value |= (b & 127) << shift;
      shift += 7;
    } while (b & 128 && shift < 35);
    return value >>> 0;
  }
  varint() {
    const v = this.varuint();
    return v & 1 ? ~(v >>> 1) : v >>> 1;
  }
  varfloat() {
    const first = this.byte();
    if (first === 0) return 0;
    let bits = (first | (this.byte() << 8) | (this.byte() << 16) | (this.byte() << 24)) >>> 0;
    bits = ((bits << 23) | (bits >>> 9)) >>> 0;
    const dv = new DataView(new ArrayBuffer(4));
    dv.setUint32(0, bits, true);
    return dv.getFloat32(0, true);
  }
  string() {
    const start = this.off;
    while (this.buf[this.off] !== 0) {
      if (this.off >= this.buf.length) throw new Error('EOF в строке');
      this.off++;
    }
    const s = this.buf.toString('utf8', start, this.off);
    this.off++;
    return s;
  }
  bytes() {
    const n = this.varuint();
    const b = this.buf.subarray(this.off, this.off + n);
    this.off += n;
    return b;
  }
}

export function makeDecoder(schema, opts = {}) {
  const byName = new Map();
  for (const d of schema.definitions) byName.set(d.name, d);
  // Быстрый доступ к enum: value → имя
  const enumMaps = new Map();
  for (const d of schema.definitions) {
    if (d.kind === 'ENUM') {
      const m = new Map();
      for (const f of d.fields) m.set(f.value, f.name);
      enumMaps.set(d.name, m);
    }
  }

  const PRIM = new Set(['bool', 'byte', 'int', 'uint', 'float', 'string']);

  function readPrim(r, type) {
    switch (type) {
      case 'bool':
        return !!r.varuint();
      case 'byte':
        return r.byte();
      case 'int':
        return r.varint();
      case 'uint':
        return r.varuint();
      case 'float':
        return r.varfloat();
      case 'string':
        return r.string();
      default:
        throw new Error(`неизвестный примитив ${type}`);
    }
  }

  function readValue(r, type, path) {
    if (PRIM.has(type)) return readPrim(r, type);
    const def = byName.get(type);
    if (!def) throw new Error(`нет определения типа ${type} @${path}`);
    if (def.kind === 'ENUM') {
      const v = r.varuint();
      return enumMaps.get(type).get(v) ?? v;
    }
    return readCompound(r, def, path);
  }

  function readField(r, f, path) {
    const p = `${path}.${f.name}`;
    if (f.isArray) {
      if (f.type === 'byte') return r.bytes();
      const n = r.varuint();
      if (n > 5_000_000) throw new Error(`подозрительная длина массива ${n} @${p}`);
      const arr = new Array(n);
      for (let i = 0; i < n; i++) arr[i] = readValue(r, f.type, `${p}[${i}]`);
      return arr;
    }
    return readValue(r, f.type, p);
  }

  function readCompound(r, def, path) {
    const obj = {};
    if (def.kind === 'STRUCT') {
      for (const f of def.fields) obj[f.name] = readField(r, f, path);
      return obj;
    }
    // MESSAGE: пары (id, value), терминатор 0
    const byId = def._byId ?? (def._byId = new Map(def.fields.map((f) => [f.value, f])));
    for (;;) {
      const id = r.varuint();
      if (id === 0) break;
      const f = byId.get(id);
      if (!f) {
        const e = new Error(`неизвестное поле #${id} в ${def.name} @${path} off=${r.off}`);
        e.kiwiPath = path;
        e.kiwiDef = def.name;
        e.kiwiId = id;
        throw e;
      }
      obj[f.name] = readField(r, f, path);
    }
    return obj;
  }

  return {
    byName,
    decode(buf, rootType = 'Message') {
      const r = new Reader(buf);
      const def = byName.get(rootType);
      const val = readCompound(r, def, rootType);
      return { value: val, offset: r.off, total: buf.length };
    },
    Reader,
    readCompound,
  };
}
