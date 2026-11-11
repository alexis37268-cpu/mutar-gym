// =====================================================================
// CAPA DE DATOS
// Es el ÚNICO archivo que sabe dónde se guardan las cosas.
// El resto de la app llama a estas funciones y no le importa si atrás
// hay Supabase o el modo prueba. Si un día cambia el proveedor, se
// reescribe este archivo y nada más.
// =====================================================================
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";

export const MODO = SUPABASE_URL && SUPABASE_KEY ? "nube" : "demo";

// ---------- utilidades de fecha (hora de Argentina) ----------
export function hoy() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}
export function sumarDias(fechaISO, n) {
  const d = new Date(fechaISO + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function diasEntre(desdeISO, hastaISO) {
  return Math.round((new Date(hastaISO + "T12:00:00Z") - new Date(desdeISO + "T12:00:00Z")) / 86400000);
}

// Misma regla que la vista v_socios_estado de la base
export function estadoSocio(s, diasAviso) {
  if (!s.activo) return "inactivo";
  if (!s.vence_el || s.vence_el < hoy()) return "vencido";
  if (diasEntre(hoy(), s.vence_el) <= diasAviso) return "por_vencer";
  return "al_dia";
}

// =====================================================================
// MODO PRUEBA: todo en localStorage del navegador
// =====================================================================
const CLAVE = "gimnasio-demo-v2";

function semilla() {
  const h = hoy();
  const nombres = [
    ["Juan", "Pérez"], ["Ana", "Gómez"], ["Lucas", "Sosa"], ["Micaela", "Rojas"],
    ["Diego", "Fernández"], ["Sofía", "Quiroga"], ["Matías", "Lucero"], ["Valentina", "Ortiz"],
    ["Nicolás", "Funes"], ["Camila", "Arce"], ["Franco", "Domínguez"], ["Julieta", "Videla"],
  ];
  const vencen = [25, 2, -4, 14, 1, 30, -12, 8, 19, 3, -1, 22];
  const db = {
    seq: 100,
    config_gimnasio: {
      nombre: "Mutar Gym", color_principal: "#01BC60", telefono_whatsapp: "", logo_url: null,
      msg_vencimiento: "Hola {nombre}! Tu cuota vence el {vence}. Te esperamos 💪",
      msg_vencido: "Hola {nombre}, tu cuota venció el {vence}. Pasá a renovarla cuando puedas.",
      dias_aviso_previo: 3, minutos_permanencia: 90,
    },
    config_tecnica: { facturacion_arca: false, rele_habilitado: false, rele_tiempo_ms: 3000, dias_gracia: 0 },
    planes: [
      { id: 1, nombre: "Mensual libre", precio: 25000, duracion_dias: 30, dias_por_semana: null, activo: true },
      { id: 2, nombre: "3 veces por semana", precio: 18000, duracion_dias: 30, dias_por_semana: 3, activo: true },
      { id: 3, nombre: "Pase diario", precio: 3000, duracion_dias: 1, dias_por_semana: null, activo: true },
    ],
    socios: [], pagos: [], caja: [], rutinas: [], accesos: [],
  };
  nombres.forEach(([n, a], i) => {
    db.socios.push({
      id: i + 1, nombre: n, apellido: a, dni: String(30000000 + i * 137711),
      telefono: "+54926640" + String(10000 + i * 731).slice(0, 5), email: "",
      nfc_uid: "04" + (0xA1B2C3 + i * 4099).toString(16).toUpperCase(), pin: "",
      plan_id: i % 3 === 1 ? 2 : 1, vence_el: sumarDias(h, vencen[i]), activo: true,
      apto_medico_vence: null, contacto_emergencia: "", notas: "",
    });
  });
  // entradas de hoy: una cada ~25 minutos hacia atrás desde ahora
  const horaAR = ms => new Date(ms).toLocaleString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" }).replace(" ", "T") + "-03:00";
  [7, 0, 4, 9, 1, 11, 2, 5].forEach((idx, k) => {
    const s = db.socios[idx];
    db.accesos.push({ id: k + 1, socio_id: s.id, metodo: "nfc",
      resultado: s.vence_el < h ? "vencido" : "ok", fecha_hora: horaAR(Date.now() - (k * 25 + 5) * 60000) });
  });
  // caja del mes
  const cuota = (dia, socio, monto, medio, comp) => db.caja.push({ id: ++db.seq, fecha: sumarDias(h, -dia), tipo: "ingreso",
    categoria: "Cuota", monto, medio, comprobante: comp, descripcion: "Cuota " + socio });
  cuota(0, "Pérez, Juan", 25000, "efectivo", "interno");
  cuota(1, "Rojas, Micaela", 25000, "transferencia", "factura_arca");
  cuota(3, "Ortiz, Valentina", 18000, "mercadopago", "interno");
  db.caja.push({ id: ++db.seq, fecha: sumarDias(h, -2), tipo: "gasto", categoria: "Luz", monto: 38000, medio: "transferencia", comprobante: "interno", descripcion: "Factura EDESAL" });
  db.caja.push({ id: ++db.seq, fecha: h, tipo: "ingreso", categoria: "Venta", monto: 2500, medio: "efectivo", comprobante: "interno", descripcion: "2 aguas" });
  // una rutina de ejemplo
  db.rutinas.push({ id: 1, socio_id: 1, nombre: "Día A – Pecho y tríceps", activa: true, ejercicios: [
    { ejercicio: "Press banca", series: 4, repeticiones: "10", peso: "50 kg" },
    { ejercicio: "Press inclinado mancuernas", series: 3, repeticiones: "12", peso: "18 kg" },
    { ejercicio: "Fondos", series: 3, repeticiones: "al fallo", peso: "" },
    { ejercicio: "Tríceps polea", series: 3, repeticiones: "12", peso: "25 kg" },
  ]});
  return db;
}

function leer() {
  try { const t = localStorage.getItem(CLAVE); if (t) return JSON.parse(t); } catch {}
  const db = semilla(); escribir(db); return db;
}
function escribir(db) { try { localStorage.setItem(CLAVE, JSON.stringify(db)); } catch {} }
function cambiar(fn) { const db = leer(); const r = fn(db); escribir(db); return r; }

const demo = {
  async sesion() { return { rol: "tecnico", nombre: "Prueba" }; },
  async login() {}, async logout() {},
  async reiniciar() { localStorage.removeItem(CLAVE); },

  async config() { const db = leer(); return { gym: db.config_gimnasio, tec: db.config_tecnica }; },
  async guardarConfigGym(c) { cambiar(db => Object.assign(db.config_gimnasio, c)); },
  async guardarConfigTec(c) { cambiar(db => Object.assign(db.config_tecnica, c)); },

  async planes() { return leer().planes; },
  async guardarPlan(p) {
    cambiar(db => {
      if (p.id) Object.assign(db.planes.find(x => x.id === p.id), p);
      else db.planes.push({ ...p, id: ++db.seq, activo: true });
    });
  },

  async socios() {
    const db = leer();
    return db.socios.map(s => ({ ...s, plan_nombre: db.planes.find(p => p.id === s.plan_id)?.nombre ?? "" }));
  },
  async guardarSocio(s, pin) {
    return cambiar(db => {
      const dup = (campo, val) => val && db.socios.some(x => x[campo] === val && x.id !== s.id);
      if (dup("dni", s.dni)) throw new Error("Ya hay un socio con ese DNI");
      if (dup("nfc_uid", s.nfc_uid)) throw new Error("Esa tarjeta ya está asignada a otro socio");
      if (pin && db.socios.some(x => x.pin === pin && x.id !== s.id)) throw new Error("Ese PIN ya lo usa otro socio");
      if (s.id) { Object.assign(db.socios.find(x => x.id === s.id), s, pin ? { pin } : {}); return s.id; }
      const id = ++db.seq; db.socios.push({ ...s, id, pin: pin || "", activo: true, vence_el: null }); return id;
    });
  },

  // Misma lógica que el trigger de la base: extiende vencimiento y anota en caja
  async registrarPago(p) {
    cambiar(db => {
      const s = db.socios.find(x => x.id === p.socio_id);
      const plan = db.planes.find(x => x.id === p.plan_id);
      const fecha = hoy();
      const desde = s.vence_el && s.vence_el >= fecha ? sumarDias(s.vence_el, 1) : fecha;
      const hasta = sumarDias(desde, plan.duracion_dias - 1);
      s.vence_el = hasta; s.plan_id = plan.id;
      const id = ++db.seq;
      db.pagos.push({ ...p, id, fecha, periodo_desde: desde, periodo_hasta: hasta });
      db.caja.push({ id: ++db.seq, fecha, tipo: "ingreso", categoria: "Cuota", monto: p.monto, medio: p.medio,
        comprobante: p.comprobante, descripcion: `Cuota ${s.apellido}, ${s.nombre}`, pago_id: id });
    });
  },

  async caja(mes) { return leer().caja.filter(m => m.fecha.startsWith(mes)).sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id); },
  async agregarMovimiento(m) { cambiar(db => { db.caja.push({ ...m, id: ++db.seq }); }); },
  async borrarMovimiento(id) {
    cambiar(db => {
      const m = db.caja.find(x => x.id === id);
      if (m?.pago_id) throw new Error("Este ingreso viene de una cuota: no se borra desde la caja");
      db.caja = db.caja.filter(x => x.id !== id);
    });
  },

  async accesosHoy() {
    const db = leer(); const h = hoy();
    return db.accesos.filter(a => a.fecha_hora.startsWith(h))
      .sort((a, b) => b.fecha_hora.localeCompare(a.fecha_hora))
      .map(a => { const s = db.socios.find(x => x.id === a.socio_id); return { ...a, nombre: s ? `${s.nombre} ${s.apellido}` : "Tarjeta desconocida" }; });
  },

  async rutinas(socioId) { return leer().rutinas.filter(r => r.socio_id === socioId); },
  async guardarRutina(r) {
    cambiar(db => {
      if (r.id) Object.assign(db.rutinas.find(x => x.id === r.id), r);
      else db.rutinas.push({ ...r, id: ++db.seq, activa: true });
    });
  },
  async borrarRutina(id) { cambiar(db => { db.rutinas = db.rutinas.filter(x => x.id !== id); }); },

  async exportar() { return leer(); },
};

// =====================================================================
// MODO NUBE: Supabase (mismas funciones, mismos resultados)
// =====================================================================
let sb = null;
async function cliente() {
  if (!sb) {
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  }
  return sb;
}
function ok({ data, error }) {
  if (error) {
    const m = error.message || "";
    if (m.includes("socios_dni_key")) throw new Error("Ya hay un socio con ese DNI");
    if (m.includes("socios_nfc_uid_key")) throw new Error("Esa tarjeta ya está asignada a otro socio");
    if (m.includes("socios_pin_hash_key")) throw new Error("Ese PIN ya lo usa otro socio");
    throw new Error(m);
  }
  return data;
}

const nube = {
  async sesion() {
    const c = await cliente();
    const { data: { session } } = await c.auth.getSession();
    if (!session) return null;
    const p = ok(await c.from("perfiles").select("nombre, rol").eq("id", session.user.id).single());
    return p;
  },
  async login(email, password) { const c = await cliente(); ok(await c.auth.signInWithPassword({ email, password })); },
  async logout() { const c = await cliente(); await c.auth.signOut(); },
  async reiniciar() {},

  async config() {
    const c = await cliente();
    const gym = ok(await c.from("config_gimnasio").select("*").eq("id", 1).single());
    const tec = ok(await c.from("config_tecnica").select("*").eq("id", 1).single());
    return { gym, tec };
  },
  async guardarConfigGym(v) { const c = await cliente(); ok(await c.from("config_gimnasio").update(v).eq("id", 1)); },
  async guardarConfigTec(v) {
    const c = await cliente();
    const r = ok(await c.from("config_tecnica").update(v).eq("id", 1).select());
    if (!r.length) throw new Error("Solo el técnico puede cambiar esta configuración");
  },

  async planes() { const c = await cliente(); return ok(await c.from("planes").select("*").order("id")); },
  async guardarPlan(p) {
    const c = await cliente(); const { id, ...resto } = p;
    ok(id ? await c.from("planes").update(resto).eq("id", id) : await c.from("planes").insert(resto));
  },

  async socios() {
    const c = await cliente();
    return ok(await c.from("v_socios_estado").select("*").order("apellido"));
  },
  async guardarSocio(s, pin) {
    const c = await cliente();
    const { id, estado, dias_restantes, plan_nombre, pin_hash, creado_el, pin: _p, ...resto } = s;
    let socioId = id;
    if (id) ok(await c.from("socios").update(resto).eq("id", id));
    else socioId = ok(await c.from("socios").insert(resto).select("id").single()).id;
    if (pin) ok(await c.rpc("set_pin", { p_socio: socioId, p_pin: pin }));
    return socioId;
  },
  async registrarPago(p) { const c = await cliente(); ok(await c.from("pagos").insert(p)); },

  async caja(mes) {
    const c = await cliente();
    const desde = mes + "-01"; const hasta = sumarDias(sumarDias(desde, 32).slice(0, 8) + "01", -1);
    return ok(await c.from("caja").select("*").gte("fecha", desde).lte("fecha", hasta)
      .order("fecha", { ascending: false }).order("id", { ascending: false }));
  },
  async agregarMovimiento(m) { const c = await cliente(); ok(await c.from("caja").insert(m)); },
  async borrarMovimiento(id) {
    const c = await cliente();
    const m = ok(await c.from("caja").select("pago_id").eq("id", id).single());
    if (m.pago_id) throw new Error("Este ingreso viene de una cuota: no se borra desde la caja");
    ok(await c.from("caja").delete().eq("id", id));
  },

  async accesosHoy() {
    const c = await cliente();
    const inicio = new Date(hoy() + "T00:00:00-03:00").toISOString();
    const filas = ok(await c.from("accesos").select("*, socios(nombre, apellido)")
      .gte("fecha_hora", inicio).order("fecha_hora", { ascending: false }));
    return filas.map(a => ({ ...a, nombre: a.socios ? `${a.socios.nombre} ${a.socios.apellido}` : "Tarjeta desconocida" }));
  },

  async rutinas(socioId) {
    const c = await cliente();
    const r = ok(await c.from("rutinas").select("*, rutina_ejercicios(*)").eq("socio_id", socioId).order("id"));
    return r.map(x => ({ ...x, ejercicios: (x.rutina_ejercicios || []).sort((a, b) => a.orden - b.orden) }));
  },
  async guardarRutina(r) {
    const c = await cliente();
    let id = r.id;
    if (id) ok(await c.from("rutinas").update({ nombre: r.nombre }).eq("id", id));
    else id = ok(await c.from("rutinas").insert({ socio_id: r.socio_id, nombre: r.nombre }).select("id").single()).id;
    ok(await c.from("rutina_ejercicios").delete().eq("rutina_id", id));
    if (r.ejercicios.length) ok(await c.from("rutina_ejercicios").insert(
      r.ejercicios.map((e, i) => ({ ...e, rutina_id: id, orden: i + 1 }))));
  },
  async borrarRutina(id) { const c = await cliente(); ok(await c.from("rutinas").delete().eq("id", id)); },

  async exportar() {
    const c = await cliente(); const out = { exportado: new Date().toISOString() };
    for (const t of ["config_gimnasio", "config_tecnica", "planes", "socios", "pagos", "caja", "rutinas", "rutina_ejercicios", "accesos"])
      out[t] = ok(await c.from(t).select("*"));
    return out;
  },
};

export const datos = MODO === "nube" ? nube : demo;
