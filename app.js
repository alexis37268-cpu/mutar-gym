// =====================================================================
// APP: pantallas y navegación
// Cada pestaña es una función que dibuja su contenido en <main>.
// =====================================================================
import { datos, MODO, hoy, sumarDias, diasEntre, estadoSocio } from "./datos.js";

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const vista = $("#vista");
const dlg = $("#dlg");
const dlgCuerpo = $("#dlg-cuerpo");

let CFG = null;       // configuración (gimnasio + técnica)
let SESION = null;    // { nombre, rol }
let filtroSocios = "todos";
let mesCaja = hoy().slice(0, 7);

// ---------- utilidades ----------
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pesos = n => "$" + Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 });
const fechaCorta = iso => iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) : "—";
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const ETIQUETA = { al_dia: "Al día", por_vencer: "Por vencer", vencido: "Vencidos", inactivo: "Inactivos" };
const RESULTADO = { ok: "Entró", vencido: "Cuota vencida", limite_semanal: "Ya usó sus días", inactivo: "Socio inactivo", desconocido: "Tarjeta desconocida" };

function aviso(texto) {
  const a = $("#aviso"); a.textContent = texto; a.classList.add("visible");
  clearTimeout(aviso.t); aviso.t = setTimeout(() => a.classList.remove("visible"), 2600);
}
function abrir(html) { dlgCuerpo.innerHTML = html; dlg.showModal(); }
function cerrar() { dlg.close(); }
dlg.addEventListener("click", e => { if (e.target === dlg || e.target.closest("[data-cerrar]")) cerrar(); });

// Disco con los días que le quedan al socio
function disco(s) {
  const est = estadoSocio(s, CFG.gym.dias_aviso_previo);
  let txt = "–";
  if (s.vence_el && est !== "inactivo") { const d = diasEntre(hoy(), s.vence_el); txt = d < 0 ? "−" + Math.abs(d) : d; }
  return `<span class="disco ${est}" aria-hidden="true">${txt}</span>`;
}
function textoVence(s) {
  if (!s.activo) return "Inactivo";
  if (!s.vence_el) return "Nunca pagó";
  const d = diasEntre(hoy(), s.vence_el);
  if (d < 0) return `Venció el ${fechaCorta(s.vence_el)}`;
  if (d === 0) return "Vence hoy";
  return `Vence el ${fechaCorta(s.vence_el)}`;
}

// Link de WhatsApp con el mensaje armado (wa.me)
function linkWhatsapp(s) {
  const tel = (s.telefono || "").replace(/\D/g, "");
  if (!tel) return null;
  const plantilla = s.vence_el && s.vence_el < hoy() ? CFG.gym.msg_vencido : CFG.gym.msg_vencimiento;
  const msg = plantilla.replaceAll("{nombre}", s.nombre).replaceAll("{vence}", fechaCorta(s.vence_el));
  return `https://wa.me/${tel}?text=${encodeURIComponent(msg)}`;
}

function aplicarMarca() {
  document.documentElement.style.setProperty("--marca", CFG.gym.color_principal || "#1F5FBF");
  $("#gym-nombre").textContent = CFG.gym.nombre;
  const logo = CFG.gym.logo_url || "logo-192.png";
  document.querySelectorAll("#gym-logo, .tabs-marca img").forEach(i => { i.src = logo; });
  document.title = CFG.gym.nombre;
}

// =====================================================================
// HOY
// =====================================================================
async function vistaHoy() {
  const [socios, accesos, caja] = await Promise.all([datos.socios(), datos.accesosHoy(), datos.caja(hoy().slice(0, 7))]);
  const cuenta = { vencido: 0, por_vencer: 0, al_dia: 0 };
  socios.forEach(s => { const e = estadoSocio(s, CFG.gym.dias_aviso_previo); if (e in cuenta) cuenta[e]++; });
  const delDia = caja.filter(m => m.fecha === hoy());
  const entra = delDia.filter(m => m.tipo === "ingreso" || m.tipo === "aporte").reduce((a, m) => a + Number(m.monto), 0);
  const sale = delDia.filter(m => m.tipo === "gasto" || m.tipo === "retiro").reduce((a, m) => a + Number(m.monto), 0);
  const entraron = accesos.filter(a => a.resultado === "ok").length;
  // Gente adentro (estimada): socios distintos que entraron dentro del tiempo de permanencia
  const desde = Date.now() - (CFG.gym.minutos_permanencia || 90) * 60000;
  const adentro = new Set(accesos.filter(a => a.resultado === "ok" && new Date(a.fecha_hora).getTime() >= desde).map(a => a.socio_id)).size;
  const fecha = new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Argentina/Buenos_Aires" });

  vista.innerHTML = `
    <section class="seccion">
      <h1>${esc(fecha.charAt(0).toUpperCase() + fecha.slice(1))}</h1>
      <p class="adentro"><strong>${adentro}</strong> ${adentro === 1 ? "persona entrenando ahora" : "personas entrenando ahora"} (estimado)</p>
      <div class="pesas">
        ${["vencido", "por_vencer", "al_dia"].map(e => `
          <a class="pesa" href="#socios" data-filtro="${e}">
            <span class="disco ${e}">${cuenta[e]}</span>
            <span class="rotulo">${ETIQUETA[e]}</span>
          </a>`).join("")}
      </div>
    </section>

    <section class="seccion">
      <div class="seccion-cab"><h2>Caja de hoy</h2><a href="#caja">Ver caja</a></div>
      <div class="balance">
        <div><span>Entró</span><strong>${pesos(entra)}</strong></div>
        <div><span>Salió</span><strong>${pesos(sale)}</strong></div>
        <div><span>Neto</span><strong>${pesos(entra - sale)}</strong></div>
      </div>
    </section>

    <section class="seccion">
      <div class="seccion-cab"><h2>Entradas de hoy</h2><small>${entraron} ${entraron === 1 ? "persona" : "personas"}</small></div>
      ${accesos.length ? `<ul class="lista">${accesos.map(a => `
        <li class="fila">
          <span class="hora">${new Date(a.fecha_hora).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Argentina/Buenos_Aires" })}</span>
          <span class="punto ${a.resultado}" aria-hidden="true"></span>
          <span class="info"><span class="nombre">${esc(a.nombre)}</span>
            ${a.resultado !== "ok" ? `<span class="sub"> · ${RESULTADO[a.resultado]}</span>` : ""}</span>
        </li>`).join("")}</ul>`
      : `<p class="vacio">Todavía no entró nadie. Las entradas aparecen acá apenas alguien pasa la tarjeta o pone su PIN.</p>`}
    </section>`;

  vista.classList.add("dos-col");
  vista.querySelectorAll("[data-filtro]").forEach(a => a.addEventListener("click", () => { filtroSocios = a.dataset.filtro; }));
}

// =====================================================================
// SOCIOS
// =====================================================================
async function vistaSocios() {
  const socios = await datos.socios();
  const filtros = ["todos", "vencido", "por_vencer", "al_dia", "inactivo"];

  vista.innerHTML = `
    <section class="seccion">
      <div class="seccion-cab"><h1>Socios</h1><button class="btn primario" id="nuevo">Nuevo socio</button></div>
      <input type="search" id="buscar" placeholder="Buscar por nombre o DNI" aria-label="Buscar socio">
      <div class="filtros" role="group" aria-label="Filtrar">
        ${filtros.map(f => `<button data-f="${f}" aria-pressed="${f === filtroSocios}">${f === "todos" ? "Todos" : ETIQUETA[f]}</button>`).join("")}
      </div>
      <div id="lista-socios"></div>
    </section>`;

  const pintar = () => {
    const q = $("#buscar").value.trim().toLowerCase();
    const lista = socios
      .filter(s => filtroSocios === "todos" || estadoSocio(s, CFG.gym.dias_aviso_previo) === filtroSocios)
      .filter(s => !q || `${s.nombre} ${s.apellido} ${s.dni}`.toLowerCase().includes(q))
      .sort((a, b) => (a.vence_el || "").localeCompare(b.vence_el || "") || a.apellido.localeCompare(b.apellido));
    $("#lista-socios").innerHTML = lista.length ? `<ul class="lista">${lista.map(s => `
      <li><button class="fila" data-id="${s.id}">
        ${disco(s)}
        <span class="info"><span class="nombre">${esc(s.apellido)}, ${esc(s.nombre)}</span><br>
          <span class="sub">${textoVence(s)} · ${esc(s.plan_nombre || "Sin plan")}</span></span>
      </button></li>`).join("")}</ul>`
      : `<p class="vacio">${socios.length ? "Nadie coincide con la búsqueda." : "Todavía no hay socios. Tocá «Nuevo socio» para cargar el primero."}</p>`;
    $("#lista-socios").querySelectorAll("[data-id]").forEach(b =>
      b.addEventListener("click", () => fichaSocio(socios.find(s => s.id === Number(b.dataset.id)))));
  };

  $("#buscar").addEventListener("input", pintar);
  vista.querySelectorAll("[data-f]").forEach(b => b.addEventListener("click", () => {
    filtroSocios = b.dataset.f;
    vista.querySelectorAll("[data-f]").forEach(x => x.setAttribute("aria-pressed", x === b));
    pintar();
  }));
  $("#nuevo").addEventListener("click", () => formSocio());
  pintar();
}

async function fichaSocio(s) {
  const rutinas = await datos.rutinas(s.id);
  const wsp = linkWhatsapp(s);
  abrir(`
    <div class="dlg-cab">${disco(s)}
      <div class="info"><h2>${esc(s.nombre)} ${esc(s.apellido)}</h2><p class="sub">${textoVence(s)}</p></div>
      <button class="btn chico cerrar" data-cerrar aria-label="Cerrar">Cerrar</button>
    </div>
    <div class="acciones">
      <button class="btn primario" id="cobrar">Cobrar cuota</button>
      ${wsp ? `<a class="btn wsp" href="${wsp}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
      <button class="btn" id="editar">Editar</button>
    </div>
    <dl class="datos">
      <dt>Plan</dt><dd>${esc(s.plan_nombre || "Sin plan")}</dd>
      <dt>DNI</dt><dd>${esc(s.dni || "—")}</dd>
      <dt>Teléfono</dt><dd>${esc(s.telefono || "—")}</dd>
      <dt>Tarjeta</dt><dd>${s.nfc_uid ? esc(s.nfc_uid) : "Sin tarjeta"}</dd>
      <dt>Apto médico</dt><dd>${s.apto_medico_vence ? "Vence " + fechaCorta(s.apto_medico_vence) : "No cargado"}</dd>
      ${s.notas ? `<dt>Notas</dt><dd>${esc(s.notas)}</dd>` : ""}
    </dl>
    <section class="seccion">
      <div class="seccion-cab"><h3>Rutinas</h3><button class="btn chico" id="nueva-rutina">Nueva rutina</button></div>
      ${rutinas.length ? rutinas.map(r => `
        <div class="rutina">
          <div class="seccion-cab"><strong>${esc(r.nombre)}</strong><button class="btn chico" data-rutina="${r.id}">Editar</button></div>
          <table class="ejercicios"><tbody>${r.ejercicios.map(e => `
            <tr><td>${esc(e.ejercicio)}</td><td>${e.series ? esc(e.series) + " × " + esc(e.repeticiones) : esc(e.repeticiones)}</td><td>${esc(e.peso)}</td></tr>`).join("")}
          </tbody></table>
        </div>`).join("") : `<p class="vacio">Sin rutina cargada.</p>`}
    </section>`);
  $("#cobrar").onclick = () => formPago(s);
  $("#editar").onclick = () => formSocio(s);
  $("#nueva-rutina").onclick = () => formRutina({ socio_id: s.id, nombre: "", ejercicios: [] }, s);
  dlgCuerpo.querySelectorAll("[data-rutina]").forEach(b =>
    b.onclick = () => formRutina(structuredClone(rutinas.find(r => r.id === Number(b.dataset.rutina))), s));
}

async function formSocio(s = { activo: true }) {
  const planes = (await datos.planes()).filter(p => p.activo);
  abrir(`
    <div class="dlg-cab"><h2>${s.id ? "Editar socio" : "Nuevo socio"}</h2>
      <button class="btn chico cerrar" data-cerrar type="button">Cancelar</button></div>
    <form id="f">
      <div class="dos">
        <div class="campo"><label for="nombre">Nombre</label><input id="nombre" required value="${esc(s.nombre)}"></div>
        <div class="campo"><label for="apellido">Apellido</label><input id="apellido" required value="${esc(s.apellido)}"></div>
      </div>
      <div class="dos">
        <div class="campo"><label for="dni">DNI</label><input id="dni" inputmode="numeric" value="${esc(s.dni)}"></div>
        <div class="campo"><label for="telefono">Celular</label><input id="telefono" type="tel" placeholder="+549266..." value="${esc(s.telefono)}"></div>
      </div>
      <div class="campo"><label for="plan">Plan</label>
        <select id="plan">${planes.map(p => `<option value="${p.id}" ${p.id === s.plan_id ? "selected" : ""}>${esc(p.nombre)} – ${pesos(p.precio)}</option>`).join("")}</select></div>
      <div class="dos">
        <div class="campo"><label for="nfc">Tarjeta NFC</label><input id="nfc" value="${esc(s.nfc_uid)}" placeholder="04A1B2C3">
          <span class="ayuda">Código que muestra el lector al pasar el llavero.</span></div>
        <div class="campo"><label for="pin">PIN de entrada</label><input id="pin" inputmode="numeric" pattern="[0-9]{4,6}" placeholder="${s.id ? "Sin cambios" : "4 a 6 números"}">
          <span class="ayuda">Para entrar sin tarjeta.</span></div>
      </div>
      <div class="dos">
        <div class="campo"><label for="apto">Apto médico vence</label><input id="apto" type="date" value="${esc(s.apto_medico_vence)}"></div>
        <div class="campo"><label for="emerg">Contacto de emergencia</label><input id="emerg" value="${esc(s.contacto_emergencia)}"></div>
      </div>
      <div class="campo"><label for="notas">Notas</label><textarea id="notas">${esc(s.notas)}</textarea></div>
      ${s.id ? `<label><input type="checkbox" id="activo" ${s.activo ? "checked" : ""} style="width:auto;min-height:0"> Socio activo</label>` : ""}
      <button class="btn primario">${s.id ? "Guardar cambios" : "Guardar socio"}</button>
    </form>`);
  $("#f").onsubmit = async e => {
    e.preventDefault();
    const tel = $("#telefono").value.trim();
    const nuevo = {
      ...s, nombre: $("#nombre").value.trim(), apellido: $("#apellido").value.trim(),
      dni: $("#dni").value.trim() || null,
      telefono: tel && !tel.startsWith("+") ? "+549" + tel.replace(/\D/g, "") : tel || null,
      plan_id: Number($("#plan").value), nfc_uid: $("#nfc").value.trim().toUpperCase() || null,
      apto_medico_vence: $("#apto").value || null, contacto_emergencia: $("#emerg").value.trim(),
      notas: $("#notas").value.trim(), activo: s.id ? $("#activo").checked : true,
    };
    try {
      await datos.guardarSocio(nuevo, $("#pin").value.trim());
      cerrar(); aviso(s.id ? "Cambios guardados" : "Socio guardado"); render();
    } catch (err) { aviso(err.message); }
  };
}

async function formPago(s) {
  const planes = (await datos.planes()).filter(p => p.activo);
  const plan0 = planes.find(p => p.id === s.plan_id) || planes[0];
  abrir(`
    <div class="dlg-cab"><h2>Cobrar a ${esc(s.nombre)}</h2>
      <button class="btn chico cerrar" data-cerrar type="button">Cancelar</button></div>
    <form id="f">
      <div class="campo"><label for="plan">Plan</label>
        <select id="plan">${planes.map(p => `<option value="${p.id}" data-precio="${p.precio}" ${p.id === plan0?.id ? "selected" : ""}>${esc(p.nombre)}</option>`).join("")}</select></div>
      <div class="dos">
        <div class="campo"><label for="monto">Monto</label><input id="monto" type="number" min="0" step="1" required value="${plan0?.precio ?? ""}"></div>
        <div class="campo"><label for="medio">Medio de pago</label>
          <select id="medio"><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option>
            <option value="mercadopago">Mercado Pago</option><option value="tarjeta">Tarjeta</option><option value="otro">Otro</option></select></div>
      </div>
      <div class="dos">
        <div class="campo"><label for="comp">Comprobante</label>
          <select id="comp"><option value="interno">Recibo interno</option><option value="factura_arca">Factura ARCA</option></select></div>
        <div class="campo"><label for="nro">N.º de factura</label><input id="nro" placeholder="Opcional"></div>
      </div>
      <p class="ayuda" id="nuevo-vence"></p>
      <button class="btn primario">Registrar pago</button>
    </form>`);
  const calc = () => {
    const p = planes.find(x => x.id === Number($("#plan").value));
    const desde = s.vence_el && s.vence_el >= hoy() ? sumarDias(s.vence_el, 1) : hoy();
    $("#nuevo-vence").textContent = `Va a quedar al día hasta el ${fechaCorta(sumarDias(desde, p.duracion_dias - 1))}.`;
  };
  $("#plan").onchange = e => { $("#monto").value = e.target.selectedOptions[0].dataset.precio; calc(); };
  calc();
  $("#f").onsubmit = async e => {
    e.preventDefault();
    try {
      await datos.registrarPago({ socio_id: s.id, plan_id: Number($("#plan").value), monto: Number($("#monto").value),
        medio: $("#medio").value, comprobante: $("#comp").value, nro_comprobante: $("#nro").value.trim() || null });
      cerrar(); aviso("Pago registrado"); render();
    } catch (err) { aviso(err.message); }
  };
}

function formRutina(r, s) {
  const filaEj = (e = {}) => `
    <div class="ej-fila">
      <input placeholder="Ejercicio" value="${esc(e.ejercicio)}" aria-label="Ejercicio">
      <input placeholder="Series" inputmode="numeric" value="${esc(e.series)}" aria-label="Series">
      <input placeholder="Reps" value="${esc(e.repeticiones)}" aria-label="Repeticiones">
      <input placeholder="Peso" value="${esc(e.peso)}" aria-label="Peso">
      <button type="button" class="btn chico" data-quitar aria-label="Quitar ejercicio">×</button>
    </div>`;
  abrir(`
    <div class="dlg-cab"><h2>Rutina de ${esc(s.nombre)}</h2>
      <button class="btn chico cerrar" data-cerrar type="button">Cancelar</button></div>
    <form id="f">
      <div class="campo"><label for="rn">Nombre</label><input id="rn" required placeholder="Día A – Pecho y tríceps" value="${esc(r.nombre)}"></div>
      <div id="ejs" class="seccion">${(r.ejercicios.length ? r.ejercicios : [{}, {}, {}]).map(filaEj).join("")}</div>
      <div class="acciones"><button type="button" class="btn" id="mas">Agregar ejercicio</button>
        ${r.id ? `<button type="button" class="btn peligro" id="borrar">Borrar rutina</button>` : ""}</div>
      <button class="btn primario">Guardar rutina</button>
    </form>`);
  const ejs = $("#ejs");
  ejs.addEventListener("click", e => { if (e.target.closest("[data-quitar]")) e.target.closest(".ej-fila").remove(); });
  $("#mas").onclick = () => { ejs.insertAdjacentHTML("beforeend", filaEj()); ejs.lastElementChild.querySelector("input").focus(); };
  if (r.id) $("#borrar").onclick = async () => {
    if (!confirm("¿Borrar esta rutina?")) return;
    await datos.borrarRutina(r.id); aviso("Rutina borrada"); fichaSocio(s);
  };
  $("#f").onsubmit = async e => {
    e.preventDefault();
    r.nombre = $("#rn").value.trim();
    r.ejercicios = [...ejs.querySelectorAll(".ej-fila")].map(f => {
      const [ej, se, re, pe] = [...f.querySelectorAll("input")].map(i => i.value.trim());
      return { ejercicio: ej, series: se ? Number(se) : null, repeticiones: re, peso: pe };
    }).filter(x => x.ejercicio);
    try { await datos.guardarRutina(r); aviso("Rutina guardada"); fichaSocio(s); }
    catch (err) { aviso(err.message); }
  };
}

// =====================================================================
// CAJA
// =====================================================================
async function vistaCaja() {
  const movs = await datos.caja(mesCaja);
  const suma = f => movs.filter(f).reduce((a, m) => a + Number(m.monto), 0);
  const ingresos = suma(m => m.tipo === "ingreso");
  const gastos = suma(m => m.tipo === "gasto");
  const facturado = suma(m => m.tipo === "ingreso" && m.comprobante === "factura_arca");
  const [anio, mes] = mesCaja.split("-").map(Number);
  const signo = { ingreso: "+", aporte: "+", gasto: "−", retiro: "−" };

  vista.innerHTML = `
    <section class="seccion">
      <div class="seccion-cab"><h1>Caja</h1><button class="btn primario" id="anotar">Anotar movimiento</button></div>
      <div class="mes">
        <button class="btn chico" id="ant" aria-label="Mes anterior">‹</button>
        <h2>${MESES[mes - 1]} ${anio}</h2>
        <button class="btn chico" id="sig" aria-label="Mes siguiente" ${mesCaja >= hoy().slice(0, 7) ? "disabled" : ""}>›</button>
      </div>
      <div class="balance">
        <div><span>Ingresos</span><strong>${pesos(ingresos)}</strong></div>
        <div><span>Gastos</span><strong>${pesos(gastos)}</strong></div>
        <div><span>Resultado</span><strong>${pesos(ingresos - gastos)}</strong></div>
      </div>
      <p class="desglose">Con factura ARCA: ${pesos(facturado)} · Con recibo interno: ${pesos(ingresos - facturado)}
        ${suma(m => m.tipo === "aporte") ? ` · Aportes: ${pesos(suma(m => m.tipo === "aporte"))}` : ""}
        ${suma(m => m.tipo === "retiro") ? ` · Retiros: ${pesos(suma(m => m.tipo === "retiro"))}` : ""}</p>
    </section>
    <section class="seccion">
      <h2>Movimientos</h2>
      ${movs.length ? `<ul class="lista">${movs.map(m => `
        <li class="fila">
          <span class="hora">${fechaCorta(m.fecha)}</span>
          <span class="info"><span class="nombre">${esc(m.categoria)}</span><br>
            <span class="sub">${esc(m.descripcion || "")}${m.comprobante === "factura_arca" ? " · Factura" : ""}</span></span>
          <span class="monto ${m.tipo}">${signo[m.tipo]}${pesos(m.monto)}</span>
          ${m.pago_id ? "" : `<button class="btn chico" data-borrar="${m.id}" aria-label="Borrar movimiento">×</button>`}
        </li>`).join("")}</ul>`
      : `<p class="vacio">No hay movimientos este mes. Las cuotas cobradas se anotan solas; los gastos y otras ventas se cargan con «Anotar movimiento».</p>`}
    </section>`;

  const mover = n => { const d = new Date(Date.UTC(anio, mes - 1 + n, 1)); mesCaja = d.toISOString().slice(0, 7); vistaCaja(); };
  $("#ant").onclick = () => mover(-1);
  $("#sig").onclick = () => mover(1);
  $("#anotar").onclick = formMovimiento;
  vista.querySelectorAll("[data-borrar]").forEach(b => b.onclick = async () => {
    if (!confirm("¿Borrar este movimiento?")) return;
    try { await datos.borrarMovimiento(Number(b.dataset.borrar)); aviso("Movimiento borrado"); vistaCaja(); }
    catch (err) { aviso(err.message); }
  });
}

function formMovimiento() {
  const cats = { ingreso: ["Venta", "Clase suelta", "Otro ingreso"], gasto: ["Alquiler", "Luz", "Agua", "Internet", "Limpieza", "Mantenimiento", "Equipamiento", "Sueldos", "Impuestos", "Otro gasto"],
    aporte: ["Aporte de los dueños"], retiro: ["Retiro de los dueños"] };
  abrir(`
    <div class="dlg-cab"><h2>Anotar movimiento</h2>
      <button class="btn chico cerrar" data-cerrar type="button">Cancelar</button></div>
    <form id="f">
      <div class="filtros" role="group" aria-label="Tipo">
        ${Object.keys(cats).map((t, i) => `<button type="button" data-t="${t}" aria-pressed="${i === 1}">${{ ingreso: "Ingreso", gasto: "Gasto", aporte: "Aporte", retiro: "Retiro" }[t]}</button>`).join("")}
      </div>
      <div class="dos">
        <div class="campo"><label for="cat">Categoría</label><select id="cat"></select></div>
        <div class="campo"><label for="monto">Monto</label><input id="monto" type="number" min="1" step="1" required></div>
      </div>
      <div class="dos">
        <div class="campo"><label for="fecha">Fecha</label><input id="fecha" type="date" value="${hoy()}" max="${hoy()}"></div>
        <div class="campo"><label for="medio">Medio</label>
          <select id="medio"><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="mercadopago">Mercado Pago</option><option value="tarjeta">Tarjeta</option></select></div>
      </div>
      <div class="campo"><label for="desc">Detalle</label><input id="desc" placeholder="Factura de luz de octubre"></div>
      <div class="campo"><label for="comp">Comprobante</label>
        <select id="comp"><option value="interno">Interno</option><option value="factura_arca">Factura ARCA</option></select></div>
      <button class="btn primario">Guardar movimiento</button>
    </form>`);
  let tipo = "gasto";
  const llenar = () => { $("#cat").innerHTML = cats[tipo].map(c => `<option>${c}</option>`).join(""); };
  dlgCuerpo.querySelectorAll("[data-t]").forEach(b => b.onclick = () => {
    tipo = b.dataset.t; dlgCuerpo.querySelectorAll("[data-t]").forEach(x => x.setAttribute("aria-pressed", x === b)); llenar();
  });
  llenar();
  $("#f").onsubmit = async e => {
    e.preventDefault();
    try {
      await datos.agregarMovimiento({ tipo, categoria: $("#cat").value, monto: Number($("#monto").value), fecha: $("#fecha").value,
        medio: $("#medio").value, descripcion: $("#desc").value.trim(), comprobante: $("#comp").value });
      cerrar(); aviso("Movimiento guardado"); vistaCaja();
    } catch (err) { aviso(err.message); }
  };
}

// =====================================================================
// AJUSTES
// =====================================================================
async function vistaAjustes() {
  const planes = await datos.planes();
  const g = CFG.gym, t = CFG.tec;
  const esTecnico = SESION.rol === "tecnico";

  vista.innerHTML = `
    <section class="seccion">
      <h1>Ajustes</h1>
      <form id="fg">
        <h2>El gimnasio</h2>
        <div class="dos">
          <div class="campo"><label for="gn">Nombre</label><input id="gn" required value="${esc(g.nombre)}"></div>
          <div class="campo"><label for="gc">Color</label><input id="gc" type="color" value="${esc(g.color_principal)}"></div>
        </div>
        <div class="campo"><label for="gm1">Mensaje para cuotas por vencer</label><textarea id="gm1">${esc(g.msg_vencimiento)}</textarea>
          <span class="ayuda">{nombre} y {vence} se reemplazan por los datos de cada socio.</span></div>
        <div class="campo"><label for="gm2">Mensaje para cuotas vencidas</label><textarea id="gm2">${esc(g.msg_vencido)}</textarea></div>
        <div class="dos">
          <div class="campo"><label for="gd">Avisar vencimientos con (días)</label><input id="gd" type="number" min="0" max="15" value="${g.dias_aviso_previo}"></div>
          <div class="campo"><label for="gp">Tiempo promedio de entrenamiento (min)</label><input id="gp" type="number" min="15" max="300" step="5" value="${g.minutos_permanencia ?? 90}">
            <span class="ayuda">Se usa para estimar cuánta gente hay adentro.</span></div>
        </div>
        <button class="btn primario">Guardar datos del gimnasio</button>
      </form>
    </section>

    <section class="seccion">
      <div class="seccion-cab"><h2>Planes</h2><button class="btn chico" id="nuevo-plan">Nuevo plan</button></div>
      <ul class="lista">${planes.map(p => `
        <li><button class="fila" data-plan="${p.id}">
          <span class="info"><span class="nombre">${esc(p.nombre)}</span>${p.activo ? "" : " (no se ofrece)"}<br>
            <span class="sub">${p.duracion_dias} días${p.dias_por_semana ? ` · ${p.dias_por_semana} por semana` : " · libre"}</span></span>
          <span class="monto">${pesos(p.precio)}</span>
        </button></li>`).join("")}</ul>
    </section>

    <section class="seccion">
      <h2>Instalación</h2>
      <p class="ayuda">${esTecnico ? "Estos datos dependen del equipo instalado en la puerta." : "Los configura el técnico según el equipo instalado. Si necesitás cambiar algo, consultale."}</p>
      <form id="ft">
        <label><input type="checkbox" id="tr" ${t.rele_habilitado ? "checked" : ""} ${esTecnico ? "" : "disabled"} style="width:auto;min-height:0"> La puerta se abre sola (relé instalado)</label>
        <label><input type="checkbox" id="tf" ${t.facturacion_arca ? "checked" : ""} ${esTecnico ? "" : "disabled"} style="width:auto;min-height:0"> Facturación electrónica conectada a ARCA</label>
        <div class="dos">
          <div class="campo"><label for="tg">Días de gracia al vencer</label><input id="tg" type="number" min="0" max="10" value="${t.dias_gracia}" ${esTecnico ? "" : "disabled"}></div>
          <div class="campo"><label for="tm">Tiempo de apertura (ms)</label><input id="tm" type="number" min="500" step="500" value="${t.rele_tiempo_ms}" ${esTecnico ? "" : "disabled"}></div>
        </div>
        ${esTecnico ? `<button class="btn">Guardar instalación</button>` : ""}
      </form>
    </section>

    <section class="seccion">
      <h2>Respaldo</h2>
      <p class="ayuda">Descarga una copia de todos los datos. Guardala en el Drive o en un pendrive.</p>
      <div class="acciones">
        <button class="btn" id="exportar">Descargar copia</button>
        ${MODO === "demo" ? `<button class="btn peligro" id="reiniciar">Volver a los datos de prueba</button>`
          : `<button class="btn" id="salir">Cerrar sesión</button>`}
      </div>
    </section>`;

  $("#fg").onsubmit = async e => {
    e.preventDefault();
    try {
      await datos.guardarConfigGym({ nombre: $("#gn").value.trim(), color_principal: $("#gc").value,
        msg_vencimiento: $("#gm1").value, msg_vencido: $("#gm2").value, dias_aviso_previo: Number($("#gd").value),
        minutos_permanencia: Number($("#gp").value) });
      CFG = await datos.config(); aplicarMarca(); aviso("Datos del gimnasio guardados");
    } catch (err) { aviso(err.message); }
  };
  $("#ft").onsubmit = async e => {
    e.preventDefault();
    try {
      await datos.guardarConfigTec({ rele_habilitado: $("#tr").checked, facturacion_arca: $("#tf").checked,
        dias_gracia: Number($("#tg").value), rele_tiempo_ms: Number($("#tm").value) });
      CFG = await datos.config(); aviso("Instalación guardada");
    } catch (err) { aviso(err.message); }
  };
  $("#nuevo-plan").onclick = () => formPlan();
  vista.querySelectorAll("[data-plan]").forEach(b => b.onclick = () => formPlan(planes.find(p => p.id === Number(b.dataset.plan))));
  $("#exportar").onclick = async () => {
    const blob = new Blob([JSON.stringify(await datos.exportar(), null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `respaldo-${CFG.gym.nombre.replace(/\W+/g, "-").toLowerCase()}-${hoy()}.json`; a.click();
    aviso("Copia descargada");
  };
  if (MODO === "demo") $("#reiniciar").onclick = async () => {
    if (!confirm("Se borra todo lo cargado y vuelven los datos de ejemplo. ¿Seguir?")) return;
    await datos.reiniciar(); CFG = await datos.config(); aplicarMarca(); aviso("Datos de prueba restaurados"); render();
  };
  else $("#salir").onclick = async () => { await datos.logout(); location.reload(); };
}

function formPlan(p = { activo: true, duracion_dias: 30 }) {
  abrir(`
    <div class="dlg-cab"><h2>${p.id ? "Editar plan" : "Nuevo plan"}</h2>
      <button class="btn chico cerrar" data-cerrar type="button">Cancelar</button></div>
    <form id="f">
      <div class="campo"><label for="pn">Nombre</label><input id="pn" required value="${esc(p.nombre)}" placeholder="3 veces por semana"></div>
      <div class="dos">
        <div class="campo"><label for="pp">Precio</label><input id="pp" type="number" min="0" required value="${esc(p.precio)}"></div>
        <div class="campo"><label for="pd">Dura (días)</label><input id="pd" type="number" min="1" required value="${esc(p.duracion_dias)}"></div>
      </div>
      <div class="campo"><label for="ps">Días por semana</label><input id="ps" type="number" min="1" max="7" value="${esc(p.dias_por_semana)}" placeholder="Vacío = libre"></div>
      ${p.id ? `<label><input type="checkbox" id="pa" ${p.activo ? "checked" : ""} style="width:auto;min-height:0"> Se ofrece a socios nuevos</label>` : ""}
      <button class="btn primario">Guardar plan</button>
    </form>`);
  $("#f").onsubmit = async e => {
    e.preventDefault();
    try {
      await datos.guardarPlan({ id: p.id, nombre: $("#pn").value.trim(), precio: Number($("#pp").value), duracion_dias: Number($("#pd").value),
        dias_por_semana: $("#ps").value ? Number($("#ps").value) : null, activo: p.id ? $("#pa").checked : true });
      cerrar(); aviso("Plan guardado"); vistaAjustes();
    } catch (err) { aviso(err.message); }
  };
}

// =====================================================================
// LOGIN (solo en modo nube)
// =====================================================================
function vistaLogin() {
  document.querySelector(".tabs").hidden = true;
  vista.innerHTML = `
    <section class="seccion">
      <h1>Entrar</h1>
      <form id="fl">
        <div class="campo"><label for="le">Mail</label><input id="le" type="email" autocomplete="username" required></div>
        <div class="campo"><label for="lp">Contraseña</label><input id="lp" type="password" autocomplete="current-password" required></div>
        <button class="btn primario">Entrar</button>
      </form>
    </section>`;
  $("#fl").onsubmit = async e => {
    e.preventDefault();
    try { await datos.login($("#le").value, $("#lp").value); location.reload(); }
    catch { aviso("Mail o contraseña incorrectos"); }
  };
}

// =====================================================================
// NAVEGACIÓN
// =====================================================================
const VISTAS = { hoy: vistaHoy, socios: vistaSocios, caja: vistaCaja, ajustes: vistaAjustes };

async function render() {
  const tab = (location.hash.slice(1) || "hoy");
  const fn = VISTAS[tab] || vistaHoy;
  document.querySelectorAll(".tabs a").forEach(a => a.dataset.tab === tab ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
  vista.className = "";
  try { await fn(); } catch (err) { vista.innerHTML = `<p class="vacio">No se pudo cargar: ${esc(err.message)}. Revisá la conexión y volvé a intentar.</p>`; }
}

window.addEventListener("hashchange", () => { render(); vista.focus(); });

(async function iniciar() {
  if (MODO === "demo") $("#modo-demo").hidden = false;
  SESION = await datos.sesion();
  if (!SESION) return vistaLogin();
  CFG = await datos.config();
  aplicarMarca();
  render();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
