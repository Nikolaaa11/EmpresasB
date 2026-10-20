// Empresas B en Chile — directorio estático sin dependencias.
// Todo texto que viene de los datos se inserta con textContent (nunca innerHTML).

const AREAS = [
  ["gobernanza", "Gobernanza", "--s1"],
  ["trabajadores", "Trabajadores", "--s2"],
  ["comunidad", "Comunidad", "--s3"],
  ["medio_ambiente", "Medio ambiente", "--s4"],
  ["clientes", "Clientes", "--s5"],
];
const SECCIONES = { "data-center": "Data center", robotica: "Robótica", salmones: "Salmones", maritimo: "Marítimo" };
const TIPOS = ["SpA", "S.A.", "Ltda.", "EIRL", "Cooperativa", "Fundación/Corporación", "Extranjera", "Sin dato"];
const TAMANOS = ["Micro", "Pequeña", "Mediana", "Grande"];
const ORDEN_TAMANO = { Micro: 1, "Pequeña": 2, Mediana: 3, Grande: 4 };
const VISTAS = ["directorio", "industrias", "estadisticas", "sectores", "metodologia"];
const FILTROS_VACIOS = {
  q: "", industria: "", tipo: "", region: "", tamano: "", puntaje: "", anio: "", sede: "", seccion: "",
  web: false, email: false, tel: false, rut: false,
};

const nf = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const estado = {
  empresas: [], sectores: [], meta: {}, lista: [],
  filtros: { ...FILTROS_VACIOS }, orden: { campo: "nombre", dir: 1 }, vista: "directorio", sector: "data-center",
};

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function el(tag, attrs = {}, ...hijos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (k === "style") n.setAttribute("style", v);
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? "" : String(v));
  }
  for (const h of hijos.flat(Infinity)) {
    if (h == null || h === false || h === "") continue;
    n.append(h instanceof Node ? h : document.createTextNode(String(h)));
  }
  return n;
}

const normal = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const pct = (n, total) => (total ? (n / total) * 100 : 0);
const fmtPct = (v) => `${nf.format(v)}%`;
const hrefSeguro = (u) => (typeof u === "string" && /^(https?:|mailto:|tel:)/i.test(u.trim()) ? u.trim() : null);
const telHref = (t) => (t ? `tel:${t.replace(/[^\d+]/g, "")}` : null);
const tamanoGrupo = (e) => e.economia?.tamano_sii_grupo || null;
const mediana = (v) => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const promedio = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);

function enlace(texto, href, extra = {}) {
  const h = hrefSeguro(href);
  if (!h) return document.createTextNode(texto ?? "—");
  const externo = /^https?:/i.test(h);
  return el("a", { href: h, target: externo ? "_blank" : null, rel: externo ? "noopener" : null, ...extra }, texto ?? h);
}

function dominio(u) {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
}

// ---------------------------------------------------------------------------
// Estado en la URL (filtros compartibles)
// ---------------------------------------------------------------------------

function leerHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  const f = { ...FILTROS_VACIOS };
  for (const k of Object.keys(f)) {
    if (!p.has(k)) continue;
    f[k] = typeof f[k] === "boolean" ? p.get(k) === "1" : p.get(k);
  }
  estado.filtros = f;
  const v = p.get("v");
  estado.vista = VISTAS.includes(v) ? v : "directorio";
  if (p.get("s") && SECCIONES[p.get("s")]) estado.sector = p.get("s");
}

function escribirHash() {
  const p = new URLSearchParams();
  if (estado.vista !== "directorio") p.set("v", estado.vista);
  if (estado.vista === "sectores") p.set("s", estado.sector);
  for (const [k, v] of Object.entries(estado.filtros)) {
    if (v === true) p.set(k, "1");
    else if (v) p.set(k, v);
  }
  const h = p.toString();
  history.replaceState(null, "", h ? `#${h}` : location.pathname + location.search);
}

// ---------------------------------------------------------------------------
// Filtros
// ---------------------------------------------------------------------------

function opciones(select, valores, etiquetaTodos) {
  select.replaceChildren(el("option", { value: "" }, etiquetaTodos),
    ...valores.map(([v, t]) => el("option", { value: v }, t)));
}

function prepararFiltros() {
  const form = $("#filtros");
  const cuenta = (fn) => {
    const c = new Map();
    for (const e of estado.empresas) {
      const k = fn(e);
      c.set(k, (c.get(k) || 0) + 1);
    }
    return c;
  };
  const ind = cuenta((e) => e.macro_industria);
  opciones(form.industria, [...ind.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => [k, `${k} (${n})`]),
    "Todas las industrias");
  const tipos = cuenta((e) => e.tipo_sociedad);
  opciones(form.tipo, TIPOS.filter((t) => tipos.get(t)).map((t) => [t, `${t} (${tipos.get(t)})`]), "Todos");
  const regiones = cuenta((e) => (e.sede_en_chile ? e.region || "Sin dato" : null));
  regiones.delete(null);
  opciones(form.region, [...regiones.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => [k, `${k} (${n})`]),
    "Todas");
  const tam = cuenta((e) => tamanoGrupo(e) || "Sin dato");
  opciones(form.tamano, [...TAMANOS, "Sin dato"].filter((t) => tam.get(t)).map((t) => [t, `${t} (${tam.get(t)})`]),
    "Todos");
  opciones(form.puntaje, [80, 90, 100, 110, 120].map((v) => [String(v), `≥ ${v}`]), "Cualquiera");
  const anios = [...new Set(estado.empresas.map((e) => e.anio_certificacion).filter(Boolean))].sort();
  opciones(form.anio, anios.map((a) => [String(a), String(a)]), "Cualquier año");
  opciones(form.sede, [["chile", "Con sede en Chile"], ["extranjero", "Sede en el extranjero (opera en Chile)"]],
    "Todas");
  opciones(form.seccion, Object.entries(SECCIONES), "Todas");

  const sincronizar = () => {
    for (const [k, v] of Object.entries(estado.filtros)) {
      const campo = form.elements[k];
      if (!campo) continue;
      if (campo.type === "checkbox") campo.checked = !!v;
      else campo.value = v;
    }
  };
  sincronizar();

  let t;
  form.addEventListener("input", (ev) => {
    const c = ev.target;
    if (!c.name) return;
    estado.filtros[c.name] = c.type === "checkbox" ? c.checked : c.value;
    clearTimeout(t);
    t = setTimeout(render, c.type === "search" ? 140 : 0);
  });
  $("#limpiar").addEventListener("click", () => {
    estado.filtros = { ...FILTROS_VACIOS };
    sincronizar();
    render();
  });
  $("#exportar").addEventListener("click", exportarCSV);
}

function coincide(e, f) {
  if (f.industria && e.macro_industria !== f.industria) return false;
  if (f.tipo && e.tipo_sociedad !== f.tipo) return false;
  if (f.region && (!e.sede_en_chile || (e.region || "Sin dato") !== f.region)) return false;
  if (f.tamano && (tamanoGrupo(e) || "Sin dato") !== f.tamano) return false;
  if (f.puntaje && !(e.puntaje_b >= Number(f.puntaje))) return false;
  if (f.anio && !(e.anio_certificacion >= Number(f.anio))) return false;
  if (f.sede === "chile" && !e.sede_en_chile) return false;
  if (f.sede === "extranjero" && e.sede_en_chile) return false;
  if (f.seccion && !(e.secciones || []).includes(f.seccion)) return false;
  const c = e.contactos || {};
  if (f.web && !c.sitio_web) return false;
  if (f.email && !c.email) return false;
  if (f.tel && !(c.telefono || c.whatsapp)) return false;
  if (f.rut && !e.rut) return false;
  if (f.q) {
    const terminos = normal(f.q).replace(/\./g, "").split(/\s+/).filter(Boolean);
    if (!terminos.every((t) => e._busqueda.includes(t))) return false;
  }
  return true;
}

function ordenar(lista) {
  const { campo, dir } = estado.orden;
  const valor = (e) => {
    if (campo === "tamano") return ORDEN_TAMANO[tamanoGrupo(e)] ?? null;
    return e[campo] ?? null;
  };
  return [...lista].sort((a, b) => {
    const va = valor(a);
    const vb = valor(b);
    if (va == null && vb == null) return a.nombre.localeCompare(b.nombre, "es");
    if (va == null) return 1;
    if (vb == null) return -1;
    const r = typeof va === "number" ? va - vb : String(va).localeCompare(String(vb), "es");
    return r * dir || a.nombre.localeCompare(b.nombre, "es");
  });
}

// ---------------------------------------------------------------------------
// Render principal
// ---------------------------------------------------------------------------

function render() {
  estado.lista = estado.empresas.filter((e) => coincide(e, estado.filtros));
  escribirHash();
  $$(".tabs button").forEach((b) => b.toggleAttribute("aria-current", b.dataset.vista === estado.vista));
  $$(".tabs button[aria-current]").forEach((b) => b.setAttribute("aria-current", "page"));
  const filtrable = ["directorio", "industrias", "estadisticas"].includes(estado.vista);
  $("#filtros").hidden = !filtrable;
  $("#conteo").hidden = !filtrable;
  $("#kpis").hidden = estado.vista === "metodologia";
  for (const v of VISTAS) $(`#vista-${v}`).hidden = v !== estado.vista;

  renderKpis();
  const total = estado.empresas.length;
  $("#conteo").textContent = estado.lista.length === total
    ? `Mostrando las ${total} Empresas B del directorio.`
    : `Mostrando ${estado.lista.length} de ${total} Empresas B.`;
  if (estado.vista === "directorio") renderDirectorio();
  if (estado.vista === "industrias") renderIndustrias();
  if (estado.vista === "estadisticas") renderEstadisticas();
  if (estado.vista === "sectores") renderSectores();
  if (estado.vista === "metodologia") renderCobertura();
}

function tile(label, valor, sub) {
  return el("div", { class: "kpi" },
    el("div", { class: "kpi-label" }, label),
    el("div", { class: "kpi-valor" }, valor),
    sub ? el("div", { class: "kpi-sub" }, sub) : null);
}

function renderKpis() {
  const kpis = $("#kpis");
  if (estado.vista === "sectores") {
    const s = estado.sectores.find((x) => x.id === estado.sector);
    const todas = estado.sectores.reduce((a, x) => a + x.total, 0);
    kpis.replaceChildren(
      tile(`Empresas · ${s?.nombre ?? ""}`, nf0.format(s?.total ?? 0), "principales del sector en Chile"),
      tile("Empresas B en el sector", nf0.format(s?.empresas_b ?? 0), "con ficha B Lab vigente"),
      tile("Los 4 sectores", nf0.format(todas), "Data center · Robótica · Salmones · Marítimo"),
    );
    return;
  }
  const l = estado.lista;
  const n = l.length;
  const chile = l.filter((e) => e.sede_en_chile).length;
  const spa = l.filter((e) => e.tipo_sociedad === "SpA").length;
  const conTipo = l.filter((e) => e.tipo_sociedad !== "Sin dato").length;
  const p = l.map((e) => e.puntaje_b).filter((v) => v != null);
  const contacto = l.filter((e) => e.contactos?.email || e.contactos?.telefono || e.contactos?.whatsapp).length;
  kpis.replaceChildren(
    tile("Empresas B", nf0.format(n), n === estado.empresas.length ? "en el directorio" : `de ${estado.empresas.length} en el directorio`),
    tile("Con sede en Chile", nf0.format(chile), `${fmtPct(pct(chile, n))} · el resto opera en Chile`),
    tile("Sociedades por acciones (SpA)", nf0.format(spa),
      conTipo ? `${fmtPct(pct(spa, conTipo))} de las ${conTipo} con tipo conocido` : "tipo societario sin datos"),
    tile("Puntaje B promedio", p.length ? nf.format(promedio(p)) : "—",
      p.length ? `mediana ${nf.format(mediana(p))} · umbral de certificación 80` : null),
    tile("Con email o teléfono", nf0.format(contacto), fmtPct(pct(contacto, n))),
  );
}

// ---------------------------------------------------------------------------
// Directorio
// ---------------------------------------------------------------------------

function badgeTipo(tipo) {
  return el("span", { class: `badge${tipo === "SpA" ? " badge-spa" : ""}` }, tipo);
}

function linksContacto(c = {}) {
  const items = [
    ["Web", c.sitio_web],
    ["Email", c.email ? `mailto:${c.email}` : null],
    ["Tel", telHref(c.telefono || c.whatsapp)],
    ["in", c.linkedin],
    ["IG", c.instagram],
  ].filter(([, h]) => hrefSeguro(h));
  if (!items.length) return el("span", { class: "vacio" }, "—");
  return el("div", { class: "links" }, items.map(([t, h]) => {
    const a = enlace(t, h, { "aria-label": `${t}` });
    a.addEventListener("click", (ev) => ev.stopPropagation());
    return a;
  }));
}

function tamanoTexto(e) {
  return e.economia?.tramo_ventas_sii || e.economia?.tamano_sii || (e.tamano_empleados ? `${e.tamano_empleados} empl.` : "—");
}

function renderDirectorio() {
  const tbody = $("#tabla tbody");
  const filas = ordenar(estado.lista).map((e) => {
    const sub = [e.razon_social && e.razon_social !== e.nombre ? e.razon_social : null, e.rut].filter(Boolean).join(" · ");
    const tr = el("tr", { tabindex: "0" },
      el("td", { "data-label": "Empresa" }, el("div", { class: "nombre" }, e.nombre), sub ? el("div", { class: "sec" }, sub) : null),
      el("td", { "data-label": "Industria" }, el("div", {}, e.macro_industria), e.industria ? el("div", { class: "sec" }, e.industria) : null),
      el("td", { "data-label": "Tipo" }, badgeTipo(e.tipo_sociedad)),
      el("td", { "data-label": "Región" }, e.sede_en_chile ? e.region || "—" : `${e.pais_sede || "Extranjero"} (opera en Chile)`),
      el("td", { class: "num", "data-label": "Puntaje B" }, e.puntaje_b != null ? nf.format(e.puntaje_b) : "—"),
      el("td", { "data-label": "Certificada" }, e.certificada_desde || "—"),
      el("td", { "data-label": "Tamaño" }, tamanoTexto(e)),
      el("td", { "data-label": "Contacto" }, linksContacto(e.contactos)),
    );
    tr.addEventListener("click", () => abrirFicha(e));
    tr.addEventListener("keydown", (ev) => { if (ev.key === "Enter") abrirFicha(e); });
    return tr;
  });
  if (!filas.length) filas.push(el("tr", {}, el("td", { colspan: "8", class: "vacio" }, "Ninguna empresa coincide con los filtros.")));
  tbody.replaceChildren(...filas);
  $$("#tabla th").forEach((th) => {
    const b = th.querySelector("button");
    if (!b) return;
    th.setAttribute("aria-sort", b.dataset.orden === estado.orden.campo
      ? (estado.orden.dir === 1 ? "ascending" : "descending") : "none");
  });
}

function prepararOrden() {
  $$("#tabla th button").forEach((b) => b.addEventListener("click", () => {
    const campo = b.dataset.orden;
    estado.orden = { campo, dir: estado.orden.campo === campo ? -estado.orden.dir : (campo === "puntaje_b" ? -1 : 1) };
    renderDirectorio();
  }));
}

// ---------------------------------------------------------------------------
// Por industria
// ---------------------------------------------------------------------------

function renderIndustrias() {
  const cont = $("#vista-industrias");
  const grupos = new Map();
  for (const e of estado.lista) {
    if (!grupos.has(e.macro_industria)) grupos.set(e.macro_industria, []);
    grupos.get(e.macro_industria).push(e);
  }
  const n = estado.lista.length;
  const secciones = [...grupos.entries()].sort((a, b) => b[1].length - a[1].length).map(([macro, lista]) => {
    const p = lista.map((e) => e.puntaje_b).filter((v) => v != null);
    const spa = lista.filter((e) => e.tipo_sociedad === "SpA").length;
    lista.sort((a, b) => (b.puntaje_b ?? 0) - (a.puntaje_b ?? 0) || a.nombre.localeCompare(b.nombre, "es"));
    return el("section", { class: "grupo" },
      el("div", { class: "grupo-cab" },
        el("h2", {}, macro),
        el("p", {}, `${lista.length} empresas · ${fmtPct(pct(lista.length, n))} del total filtrado` +
          (p.length ? ` · puntaje B promedio ${nf.format(promedio(p))}` : "") + ` · ${spa} SpA`)),
      el("div", { class: "tarjetas" }, lista.map((e) => {
        const b = el("button", { type: "button", class: "tarjeta" },
          el("span", { class: "t-nombre" }, e.nombre),
          el("span", { class: "t-meta" }, [e.industria, e.sede_en_chile ? e.region : `${e.pais_sede || "Extranjero"} (opera en Chile)`].filter(Boolean).join(" · ")),
          el("span", { class: "t-pie" }, badgeTipo(e.tipo_sociedad),
            e.puntaje_b != null ? el("span", { class: "badge" }, `B ${nf.format(e.puntaje_b)}`) : null,
            e.certificada_desde ? el("span", { class: "t-meta" }, `desde ${e.certificada_desde.slice(0, 4)}`) : null));
        b.addEventListener("click", () => abrirFicha(e));
        return b;
      })));
  });
  cont.replaceChildren(...(secciones.length ? secciones : [el("p", { class: "vacio" }, "Ninguna empresa coincide con los filtros.")]));
}

// ---------------------------------------------------------------------------
// Gráficos (HTML accesible: barras, columnas, barras apiladas) + tooltip
// ---------------------------------------------------------------------------

const tooltip = () => $("#tooltip");

function mostrarTooltip(ev, titulo, filas) {
  const t = tooltip();
  t.replaceChildren(el("strong", {}, titulo), ...filas.map(([color, texto]) => el("div", { class: "tt-fila" },
    color ? el("span", { class: "tt-key", style: `background:var(${color})` }) : null, texto)));
  t.hidden = false;
  const r = ev.currentTarget.getBoundingClientRect();
  const x = ev.clientX ?? r.left + r.width / 2;
  const y = ev.clientY ?? r.top;
  const w = t.offsetWidth;
  t.style.left = `${Math.min(Math.max(8, x + 12), window.innerWidth - w - 8)}px`;
  t.style.top = `${Math.max(8, y - t.offsetHeight - 12)}px`;
}
const ocultarTooltip = () => { tooltip().hidden = true; };

function conTooltip(nodo, titulo, filas) {
  nodo.tabIndex = 0;
  nodo.setAttribute("aria-label", `${titulo}: ${filas.map((f) => f[1]).join(", ")}`);
  nodo.addEventListener("pointermove", (ev) => mostrarTooltip(ev, titulo, filas));
  nodo.addEventListener("pointerleave", ocultarTooltip);
  nodo.addEventListener("focus", (ev) => mostrarTooltip(ev, titulo, filas));
  nodo.addEventListener("blur", ocultarTooltip);
  return nodo;
}

function figura(titulo, nota, cuerpo, tabla, ancho = false) {
  const tablaWrap = el("div", { hidden: true }, tabla);
  const boton = el("button", { type: "button", class: "btn btn-ghost ver-tabla", "aria-expanded": "false" }, "Ver tabla");
  boton.addEventListener("click", () => {
    const abrir = tablaWrap.hidden;
    tablaWrap.hidden = !abrir;
    cuerpo.hidden = abrir;
    boton.textContent = abrir ? "Ver gráfico" : "Ver tabla";
    boton.setAttribute("aria-expanded", String(abrir));
  });
  return el("figure", { class: `grafico${ancho ? " grafico-ancho" : ""}` },
    el("figcaption", {}, el("div", {}, el("h3", {}, titulo), nota ? el("p", { class: "nota" }, nota) : null), boton),
    cuerpo, tablaWrap);
}

function tablaSimple(cabeceras, filas) {
  return el("table", { class: "tabla-mini" },
    el("thead", {}, el("tr", {}, cabeceras.map((c, i) => el("th", { class: i ? "num" : null, scope: "col" }, c)))),
    el("tbody", {}, filas.map((f) => el("tr", {}, f.map((v, i) => el("td", { class: i ? "num" : null }, v))))));
}

// datos: [{categoria, valor}] — una serie, un color; etiqueta de valor en la punta.
function barrasH(titulo, nota, datos, total, ancho = false) {
  const max = Math.max(1, ...datos.map((d) => d.valor));
  const cuerpo = el("div", { class: "barras" }, datos.map((d) => {
    const texto = `${nf0.format(d.valor)} · ${fmtPct(pct(d.valor, total))}`;
    const pista = el("div", { class: "b-pista" },
      el("div", { class: "b-barra", style: `width:${(d.valor / max) * 100 * 0.82}%` }),
      el("span", { class: "b-valor" }, texto));
    conTooltip(pista, d.categoria, [["--s1", `${nf0.format(d.valor)} empresas`], [null, `${fmtPct(pct(d.valor, total))} del total`]]);
    return [el("div", { class: "b-label" }, d.categoria), pista];
  }));
  const tabla = tablaSimple(["Categoría", "Empresas", "%"], datos.map((d) => [d.categoria, nf0.format(d.valor), fmtPct(pct(d.valor, total))]));
  return figura(titulo, nota, cuerpo, tabla, ancho);
}

function columnas(titulo, nota, datos, ancho = false) {
  const max = Math.max(1, ...datos.map((d) => d.valor));
  const barras = el("div", { class: "columnas" }, datos.map((d) => {
    const col = el("div", { class: "col" },
      el("span", { class: "col-valor" }, d.valor ? nf0.format(d.valor) : ""),
      el("div", { class: "col-barra", style: `height:${(d.valor / max) * 82}%` }));
    return conTooltip(col, String(d.categoria), [["--s1", `${nf0.format(d.valor)} empresas`]]);
  }));
  const ejes = el("div", { class: "col-ejes", "aria-hidden": "true" }, datos.map((d) => el("span", {}, String(d.categoria))));
  const tabla = tablaSimple(["Categoría", "Empresas"], datos.map((d) => [String(d.categoria), nf0.format(d.valor)]));
  return figura(titulo, nota, el("div", {}, barras, ejes), tabla, ancho);
}

// filas: [{categoria, areas:{...}, n}] — 5 series (áreas de impacto), leyenda siempre visible.
function apiladas(titulo, nota, filas) {
  const max = Math.max(1, ...filas.map((f) => AREAS.reduce((s, [k]) => s + (f.areas[k] || 0), 0)));
  const leyenda = el("ul", { class: "leyenda" }, AREAS.map(([, nombre, color]) =>
    el("li", {}, el("span", { class: "swatch", style: `background:var(${color})` }), nombre)));
  const cuerpo = el("div", { class: "apiladas" }, filas.map((f) => {
    const totalFila = AREAS.reduce((s, [k]) => s + (f.areas[k] || 0), 0);
    const pila = el("div", { class: "pila", style: `width:${(totalFila / max) * 86}%` }, AREAS.map(([k, nombre, color]) => {
      const v = f.areas[k] || 0;
      const seg = el("div", { class: "seg", style: `flex:${v} 1 0;background:var(${color})` });
      return conTooltip(seg, `${f.categoria} · ${nombre}`, [[color, `${nf.format(v)} puntos`], [null, `${fmtPct(pct(v, totalFila))} del puntaje`]]);
    }));
    return [el("div", { class: "b-label" }, `${f.categoria} (n=${f.n})`),
      el("div", { class: "pila-fila" }, pila, el("span", { class: "pila-total" }, nf.format(totalFila)))];
  }));
  const tabla = tablaSimple(["Industria", ...AREAS.map((a) => a[1]), "Total"], filas.map((f) => {
    const t = AREAS.reduce((s, [k]) => s + (f.areas[k] || 0), 0);
    return [f.categoria, ...AREAS.map(([k]) => `${nf.format(f.areas[k] || 0)} (${fmtPct(pct(f.areas[k] || 0, t))})`), nf.format(t)];
  }));
  return figura(titulo, nota, el("div", {}, leyenda, cuerpo), tabla, true);
}

function contar(lista, fn) {
  const m = new Map();
  for (const e of lista) {
    const k = fn(e);
    if (k == null) continue;
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}

function renderEstadisticas() {
  const l = estado.lista;
  const n = l.length;
  const g = $("#graficos");
  if (!n) {
    g.replaceChildren(el("p", { class: "vacio" }, "Ninguna empresa coincide con los filtros."));
    return;
  }
  const porMacro = [...contar(l, (e) => e.macro_industria)].map(([categoria, valor]) => ({ categoria, valor }))
    .sort((a, b) => b.valor - a.valor);
  const porTipo = TIPOS.map((t) => ({ categoria: t, valor: l.filter((e) => e.tipo_sociedad === t).length })).filter((d) => d.valor);
  const chile = l.filter((e) => e.sede_en_chile);
  const porRegion = [...contar(chile, (e) => e.region || "Sin dato")].map(([categoria, valor]) => ({ categoria, valor }))
    .sort((a, b) => b.valor - a.valor);
  const porTamano = [...TAMANOS, "Sin dato"].map((t) => ({ categoria: t, valor: l.filter((e) => (tamanoGrupo(e) || "Sin dato") === t).length }))
    .filter((d) => d.valor);
  const anios = contar(l, (e) => e.anio_certificacion);
  const rango = [...anios.keys()].sort();
  const porAnio = rango.length ? Array.from({ length: rango.at(-1) - rango[0] + 1 }, (_, i) => rango[0] + i)
    .map((a) => ({ categoria: a, valor: anios.get(a) || 0 })) : [];
  const puntajes = l.map((e) => e.puntaje_b).filter((v) => v != null);
  const bins = [[80, 90], [90, 100], [100, 110], [110, 120], [120, 140], [140, 201]];
  const porPuntaje = bins.map(([a, b]) => ({ categoria: b > 200 ? `${a}+` : `${a}–${b}`, valor: puntajes.filter((p) => p >= a && p < b).length }));

  const completas = (e) => AREAS.every(([k]) => e.areas?.[k] != null);
  const filasAreas = [];
  const conAreas = l.filter(completas);
  const promAreas = (lista) => Object.fromEntries(AREAS.map(([k]) => [k, promedio(lista.map((e) => e.areas[k]))]));
  if (conAreas.length) filasAreas.push({ categoria: "Todas", areas: promAreas(conAreas), n: conAreas.length });
  for (const { categoria } of porMacro) {
    const sub = conAreas.filter((e) => e.macro_industria === categoria);
    if (sub.length) filasAreas.push({ categoria, areas: promAreas(sub), n: sub.length });
  }

  g.replaceChildren(
    barrasH("Empresas B por industria", "Porcentaje sobre el total filtrado", porMacro, n, true),
    barrasH("Tipo de sociedad", "Deducido de la razón social. «Sin dato»: razón social no encontrada todavía.", porTipo, n),
    barrasH("Región de la sede", `Solo empresas con sede en Chile (${chile.length})`, porRegion, chile.length),
    porTamano.filter((d) => d.categoria !== "Sin dato").reduce((s, d) => s + d.valor, 0) >= 10
      ? barrasH("Tamaño según ventas (SII)", "Tramo SII cuando hay cruce por RUT; si no, tamaño informado por otras fuentes", porTamano, n)
      : figura("Tamaño según ventas (SII)", "Pendiente: el cruce por RUT con la Nómina de Personas Jurídicas del SII se completa al habilitar el acceso a sii.cl.",
        el("p", { class: "vacio" }, `${porTamano.filter((d) => d.categoria !== "Sin dato").reduce((s, d) => s + d.valor, 0)} empresas con tamaño informado por ahora.`),
        tablaSimple(["Tamaño", "Empresas"], porTamano.map((d) => [d.categoria, nf0.format(d.valor)]))),
    columnas("Primera certificación B por año", "Año en que la empresa se certificó por primera vez", porAnio),
    columnas("Distribución del puntaje B", `${puntajes.length} empresas con puntaje · se certifica desde 80`, porPuntaje),
    filasAreas.length
      ? apiladas("Puntaje B por área de impacto (promedio por industria)",
        "Solo empresas con desglose completo publicado (n). El ancho de cada tramo es el aporte del área al puntaje.", filasAreas)
      : el("p", { class: "vacio" }, "Ninguna empresa filtrada tiene el desglose por área disponible."),
  );
}

// ---------------------------------------------------------------------------
// Ficha de empresa
// ---------------------------------------------------------------------------

function filaDL(dt, dd) {
  if (dd == null || dd === "" || (Array.isArray(dd) && !dd.length)) return [];
  return [el("dt", {}, dt), el("dd", {}, dd)];
}

function seccion(titulo, ...contenido) {
  const items = contenido.flat().filter(Boolean);
  if (!items.length) return null;
  return el("section", {}, el("h3", {}, titulo), items);
}

function listaFuentes(items, texto, extra) {
  return items?.length ? el("ul", { class: "lista-simple" }, items.map((it) => el("li", {}, texto(it),
    it.fuente ? [" · ", enlace("fuente", it.fuente)] : null, extra ? extra(it) : null))) : null;
}

function bloquePuntaje(e) {
  if (e.puntaje_b == null && !AREAS.some(([k]) => e.areas?.[k] != null)) return null;
  const presentes = AREAS.filter(([k]) => e.areas?.[k] != null);
  const base = e.puntaje_b || presentes.reduce((s, [k]) => s + e.areas[k], 0);
  const pila = presentes.length ? el("div", { class: "pila", style: "width:100%;height:18px" }, presentes.map(([k, nombre, color]) =>
    conTooltip(el("div", { class: "seg", style: `flex:${e.areas[k]} 1 0;background:var(${color})` }), nombre,
      [[color, `${nf.format(e.areas[k])} puntos`], [null, `${fmtPct(pct(e.areas[k], base))} del puntaje`]]))) : null;
  const leyenda = presentes.length ? el("ul", { class: "leyenda", style: "margin-top:10px" }, presentes.map(([k, nombre, color]) =>
    el("li", {}, el("span", { class: "swatch", style: `background:var(${color})` }),
      `${nombre}: ${nf.format(e.areas[k])} (${fmtPct(pct(e.areas[k], base))})`))) : null;
  return seccion("Puntaje B (impacto)",
    el("div", { class: "puntaje-cab" },
      el("span", { class: "puntaje-num" }, e.puntaje_b != null ? nf.format(e.puntaje_b) : "—"),
      el("span", { class: "nota" }, "puntos · certifica desde 80; mediana de empresas comunes ≈ 50,9")),
    pila, leyenda,
    presentes.length && presentes.length < AREAS.length ? el("p", { class: "nota" }, "Desglose por área incompleto en las fuentes públicas.") : null,
    !presentes.length ? el("p", { class: "nota" }, "Desglose por área no disponible en las fuentes consultadas.") : null);
}

function dlConDatos(...filas) {
  const dl = el("dl", { class: "dl" }, ...filas);
  return dl.childElementCount ? dl : null;
}

function bloqueEconomia(eco = {}) {
  const hay = eco.tramo_ventas_sii || eco.tamano_sii || eco.trabajadores_sii || eco.trabajadores || eco.resumen
    || eco.cotiza_en_bolsa != null || eco.capacidad || eco.ventas_reportadas?.length || eco.financiamiento?.length
    || eco.inversion_anunciada?.length;
  if (!hay) return seccion("Cómo le va económicamente", el("p", { class: "nota" }, "Sin datos económicos públicos encontrados todavía."));
  return seccion("Cómo le va económicamente",
    dlConDatos(
      filaDL("Tamaño (SII)", eco.tramo_ventas_sii || eco.tamano_sii),
      filaDL("Trabajadores (SII)", eco.trabajadores_sii),
      filaDL("Trabajadores", eco.trabajadores),
      filaDL("Cotiza en bolsa", eco.cotiza_en_bolsa == null ? null : (eco.cotiza_en_bolsa ? "Sí" : "No")),
      filaDL("Resumen", eco.resumen)),
    eco.ventas_reportadas?.length ? [el("p", { class: "nota" }, "Ventas / ingresos reportados"),
      listaFuentes(eco.ventas_reportadas, (v) => [v.valor, v.periodo ? ` (${v.periodo})` : ""].join(""))] : null,
    eco.financiamiento?.length ? [el("p", { class: "nota" }, "Financiamiento e inversión"),
      listaFuentes(eco.financiamiento, (v) => [v.descripcion, v.fecha ? ` (${v.fecha})` : ""].join(""))] : null,
    eco.inversion_anunciada?.length ? [el("p", { class: "nota" }, "Inversión anunciada"),
      listaFuentes(eco.inversion_anunciada, (v) => [v.valor, v.descripcion ? ` — ${v.descripcion}` : "", v.fecha ? ` (${v.fecha})` : ""].join(""))] : null,
    eco.capacidad ? el("p", {}, `Capacidad: ${eco.capacidad}`) : null);
}

function bloquePropiedad(p = {}) {
  if (!(p.controlador || p.grupo_empresarial || p.notas || p.socios?.length)) {
    return seccion("Propiedad (dueños y porcentajes)", el("p", { class: "nota" },
      "No publicada en las fuentes consultadas. En las SpA los accionistas rara vez son públicos."));
  }
  return seccion("Propiedad (dueños y porcentajes)",
    dlConDatos(
      filaDL("Controlador", p.controlador),
      filaDL("Grupo empresarial", p.grupo_empresarial),
      filaDL("Notas", p.notas)),
    p.socios?.length ? listaFuentes(p.socios, (s) => `${s.nombre}${s.porcentaje != null ? ` — ${nf.format(s.porcentaje)}%` : " — % no publicado"}`) : null);
}

function bloqueContactos(c = {}) {
  const maps = c.direccion ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.direccion)}` : null;
  return seccion("Contactos corporativos",
    dlConDatos(
      filaDL("Sitio web", c.sitio_web ? enlace(dominio(c.sitio_web), c.sitio_web) : null),
      filaDL("Email", c.email ? enlace(c.email, `mailto:${c.email}`) : null),
      filaDL("Teléfono", c.telefono ? enlace(c.telefono, telHref(c.telefono)) : null),
      filaDL("WhatsApp", c.whatsapp ? enlace(c.whatsapp, `https://wa.me/${c.whatsapp.replace(/\D/g, "")}`) : null),
      filaDL("Dirección", c.direccion ? enlace(c.direccion, maps) : null),
      filaDL("Comuna", c.comuna),
      filaDL("LinkedIn", c.linkedin ? enlace("Perfil de la empresa", c.linkedin) : null),
      filaDL("Instagram", c.instagram ? enlace("Instagram", c.instagram) : null),
      filaDL("Facebook", c.facebook ? enlace("Facebook", c.facebook) : null),
      filaDL("X", c.x ? enlace("X", c.x) : null),
      filaDL("YouTube", c.youtube ? enlace("YouTube", c.youtube) : null)),
    !Object.values(c).some(Boolean) ? el("p", { class: "nota" }, "Sin contactos corporativos encontrados todavía.") : null);
}

function bloquePersonas(personas) {
  return personas?.length ? seccion("Líderes (fuentes públicas)", el("ul", { class: "lista-simple" }, personas.map((p) =>
    el("li", {}, el("strong", {}, p.nombre), p.cargo ? ` — ${p.cargo}` : "",
      p.linkedin ? [" · ", enlace("LinkedIn", p.linkedin)] : null, p.fuente ? [" · ", enlace("fuente", p.fuente)] : null)))) : null;
}

function bloqueFuentes(fuentes) {
  return fuentes?.length ? seccion("Fuentes", el("ul", { class: "lista-simple fuentes-mini" },
    fuentes.slice(0, 25).map((f) => el("li", {}, enlace(dominio(f) + (f.length > 60 ? "…" : ""), f))))) : null;
}

// "Santiago, Región Metropolitana" + "Metropolitana" -> sin repetir la región.
function ubicacion(sede, region) {
  if (!region) return sede || "";
  if (sede && normal(sede).includes(normal(region))) return sede;
  if (sede && region === "Metropolitana" && /metropolitan|santiago/i.test(sede)) return sede;
  return [sede, `Región ${region}`].filter(Boolean).join(" · ");
}

function abrirDialogo(nodos) {
  const d = $("#ficha");
  $("#ficha-cuerpo").replaceChildren(...nodos.filter(Boolean));
  if (!d.open) d.showModal();
  d.scrollTop = 0;
}

function abrirFicha(e) {
  const reporte = `https://github.com/Nikolaaa11/EmpresasB/issues/new?title=${encodeURIComponent(`Corrección: ${e.nombre}`)}`;
  abrirDialogo([
    el("h2", { id: "ficha-titulo" }, e.nombre),
    el("p", { class: "linea" }, [e.razon_social, e.rut ? `RUT ${e.rut}` : null].filter(Boolean).join(" · ") || "Razón social y RUT no encontrados todavía"),
    el("p", { class: "linea" }, badgeTipo(e.tipo_sociedad), " ", el("span", { class: "badge badge-b" }, "Empresa B"), " ",
      [e.macro_industria, e.industria].filter(Boolean).join(" › ")),
    el("p", { class: "linea" }, [e.sede_en_chile ? ubicacion(e.sede, e.region) : `Sede: ${e.pais_sede} · opera en Chile`,
      e.certificada_desde ? `certificada desde ${e.certificada_desde}` : null].filter(Boolean).join(" · ")),
    e.descripcion ? el("p", {}, e.descripcion) : null,
    el("p", { class: "linea" }, enlace("Ficha oficial en B Lab", e.url_blab), " · ", enlace("Reportar un error", reporte)),
    bloquePuntaje(e),
    bloqueEconomia(e.economia),
    bloquePropiedad(e.propiedad),
    bloqueContactos(e.contactos),
    bloquePersonas(e.personas),
    seccion("Calidad del registro", el("p", { class: "nota" }, `Completitud ${e.completitud}% · actualizado ${e.actualizado}`)),
    bloqueFuentes(e.fuentes),
  ]);
}

function abrirFichaSector(s, sector) {
  if (s.id_empresa_b) {
    const b = estado.empresas.find((e) => e.id === s.id_empresa_b);
    if (b) return abrirFicha(b);
  }
  abrirDialogo([
    el("h2", { id: "ficha-titulo" }, s.nombre),
    el("p", { class: "linea" }, [s.razon_social, s.rut ? `RUT ${s.rut}` : null].filter(Boolean).join(" · ") || "Razón social y RUT no encontrados todavía"),
    el("p", { class: "linea" }, badgeTipo(s.tipo_sociedad || "Sin dato"), " ",
      s.es_empresa_b ? el("span", { class: "badge badge-b" }, "Empresa B") : el("span", { class: "badge" }, "No es Empresa B"),
      " ", [sector.nombre, s.subsector].filter(Boolean).join(" › ")),
    el("p", { class: "linea" }, ubicacion(s.sede, s.region)),
    s.descripcion ? el("p", {}, s.descripcion) : null,
    s.url_blab ? el("p", { class: "linea" }, enlace("Ficha oficial en B Lab", s.url_blab)) : null,
    bloqueEconomia(s.economia),
    bloquePropiedad(s.propiedad),
    bloqueContactos(s.contactos),
    bloquePersonas(s.personas),
    bloqueFuentes(s.fuentes),
  ]);
}

// ---------------------------------------------------------------------------
// Sectores estratégicos
// ---------------------------------------------------------------------------

function renderSectores() {
  const nav = $("#subtabs");
  nav.replaceChildren(...estado.sectores.map((s) => {
    const b = el("button", { type: "button", "aria-current": s.id === estado.sector ? "true" : null }, `${s.nombre} (${s.total})`);
    b.addEventListener("click", () => { estado.sector = s.id; render(); });
    return b;
  }));
  const s = estado.sectores.find((x) => x.id === estado.sector);
  const cont = $("#sector");
  if (!s) {
    cont.replaceChildren(el("p", { class: "vacio" }, "Sin datos del sector todavía."));
    return;
  }
  const filas = s.empresas.map((x) => {
    const eco = x.economia || {};
    const cifra = eco.ventas_reportadas?.[0] ? `${eco.ventas_reportadas[0].valor}${eco.ventas_reportadas[0].periodo ? ` (${eco.ventas_reportadas[0].periodo})` : ""}`
      : eco.inversion_anunciada?.[0] ? `Inversión: ${eco.inversion_anunciada[0].valor}` : eco.capacidad || eco.trabajadores || "—";
    const tr = el("tr", { tabindex: "0" },
      el("td", { "data-label": "Empresa" }, el("div", { class: "nombre" }, x.nombre, x.es_empresa_b ? [" ", el("span", { class: "badge badge-b" }, "B")] : null),
        x.razon_social && x.razon_social !== x.nombre ? el("div", { class: "sec" }, x.razon_social) : null),
      el("td", { "data-label": "Subsector" }, x.subsector || "—"),
      el("td", { "data-label": "Tipo" }, badgeTipo(x.tipo_sociedad || "Sin dato")),
      el("td", { "data-label": "Región" }, x.region || "—"),
      el("td", { "data-label": "Cifras" }, cifra),
      el("td", { "data-label": "Propiedad" }, x.propiedad?.controlador || (x.propiedad?.socios?.length ? x.propiedad.socios.map((p) => p.nombre).join(", ") : "—")),
      el("td", { "data-label": "Contacto" }, linksContacto(x.contactos)));
    tr.addEventListener("click", () => abrirFichaSector(x, s));
    tr.addEventListener("keydown", (ev) => { if (ev.key === "Enter") abrirFichaSector(x, s); });
    return tr;
  });
  cont.replaceChildren(
    el("div", { class: "sector-cab" },
      el("h2", {}, s.nombre),
      s.resumen ? el("p", {}, s.resumen) : null,
      s.fuentes?.length ? el("p", { class: "fuentes-mini" }, "Fuentes: ", s.fuentes.map((f, i) => [i ? " · " : "", enlace(dominio(f), f)])) : null,
      el("p", { class: "nota" }, "Principales empresas del sector en Chile, sean o no Empresas B (marcadas con B).")),
    el("div", { class: "tabla-wrap" }, el("table", { class: "tabla" },
      el("thead", {}, el("tr", {}, ["Empresa", "Subsector", "Tipo", "Región", "Cifras", "Propiedad", "Contacto"].map((h) => el("th", { scope: "col" }, h)))),
      el("tbody", {}, filas.length ? filas : el("tr", {}, el("td", { colspan: "7", class: "vacio" }, "Sin empresas registradas todavía."))))),
  );
}

// ---------------------------------------------------------------------------
// Cobertura de datos (metodología)
// ---------------------------------------------------------------------------

function renderCobertura() {
  const l = estado.empresas;
  const n = l.length;
  const items = [
    ["Puntaje B", l.filter((e) => e.puntaje_b != null).length],
    ["Desglose por área", l.filter((e) => AREAS.every(([k]) => e.areas?.[k] != null)).length],
    ["Tipo de sociedad", l.filter((e) => e.tipo_sociedad !== "Sin dato").length],
    ["Razón social", l.filter((e) => e.razon_social).length],
    ["RUT validado", l.filter((e) => e.rut).length],
    ["Sitio web", l.filter((e) => e.contactos?.sitio_web).length],
    ["Email corporativo", l.filter((e) => e.contactos?.email).length],
    ["Teléfono", l.filter((e) => e.contactos?.telefono || e.contactos?.whatsapp).length],
    ["LinkedIn de la empresa", l.filter((e) => e.contactos?.linkedin).length],
    ["Líderes identificados", l.filter((e) => e.personas?.length).length],
    ["Datos económicos", l.filter((e) => { const x = e.economia || {}; return x.tamano_sii || x.trabajadores || x.resumen || x.ventas_reportadas?.length || x.financiamiento?.length; }).length],
    ["Propiedad", l.filter((e) => { const p = e.propiedad || {}; return p.controlador || p.grupo_empresarial || p.socios?.length; }).length],
  ];
  $("#cobertura").replaceChildren(el("div", { class: "medidores" }, items.map(([nombre, v]) =>
    el("div", {},
      el("div", { class: "medidor-cab" }, el("span", {}, nombre), el("span", {}, `${v} de ${n} · ${fmtPct(pct(v, n))}`)),
      el("div", { class: "medidor", role: "meter", "aria-valuemin": "0", "aria-valuemax": String(n), "aria-valuenow": String(v), "aria-label": nombre },
        el("div", { style: `width:${pct(v, n)}%` }))))));
}

// ---------------------------------------------------------------------------
// Exportar CSV (lo filtrado)
// ---------------------------------------------------------------------------

function exportarCSV() {
  const cols = [
    ["nombre", (e) => e.nombre], ["razon_social", (e) => e.razon_social], ["rut", (e) => e.rut],
    ["tipo_sociedad", (e) => e.tipo_sociedad], ["industria", (e) => e.macro_industria], ["subindustria", (e) => e.industria],
    ["region", (e) => e.region], ["sede", (e) => e.sede], ["pais_sede", (e) => e.pais_sede],
    ["certificada_desde", (e) => e.certificada_desde], ["puntaje_b", (e) => e.puntaje_b],
    ...AREAS.map(([k]) => [`puntaje_${k}`, (e) => e.areas?.[k]]),
    ["tamano_sii", (e) => e.economia?.tramo_ventas_sii || e.economia?.tamano_sii], ["trabajadores", (e) => e.economia?.trabajadores_sii || e.economia?.trabajadores],
    ["resumen_economico", (e) => e.economia?.resumen], ["controlador", (e) => e.propiedad?.controlador],
    ["socios", (e) => (e.propiedad?.socios || []).map((s) => `${s.nombre}${s.porcentaje != null ? ` (${s.porcentaje}%)` : ""}`).join(" | ")],
    ["sitio_web", (e) => e.contactos?.sitio_web], ["email", (e) => e.contactos?.email], ["telefono", (e) => e.contactos?.telefono],
    ["whatsapp", (e) => e.contactos?.whatsapp], ["direccion", (e) => e.contactos?.direccion], ["linkedin", (e) => e.contactos?.linkedin],
    ["instagram", (e) => e.contactos?.instagram],
    ["lideres", (e) => (e.personas || []).map((p) => `${p.nombre}${p.cargo ? ` (${p.cargo})` : ""}`).join(" | ")],
    ["url_blab", (e) => e.url_blab],
  ];
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const filas = [cols.map((c) => c[0]).join(","), ...ordenar(estado.lista).map((e) => cols.map(([, fn]) => esc(fn(e))).join(","))];
  const blob = new Blob(["﻿" + filas.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = el("a", { href: URL.createObjectURL(blob), download: `empresas-b-chile-${new Date().toISOString().slice(0, 10)}.csv` });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

// ---------------------------------------------------------------------------
// Tema y arranque
// ---------------------------------------------------------------------------

function prepararTema() {
  $("#tema").addEventListener("click", () => {
    const actual = document.documentElement.dataset.theme
      || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const nuevo = actual === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nuevo;
    try { localStorage.setItem("tema", nuevo); } catch { /* sin almacenamiento */ }
  });
}

async function cargar(ruta) {
  const r = await fetch(ruta, { cache: "no-cache" });
  if (!r.ok) throw new Error(`${ruta}: ${r.status}`);
  return r.json();
}

async function iniciar() {
  prepararTema();
  try {
    const [empresas, sectores, meta] = await Promise.all([
      cargar("data/empresas.json"), cargar("data/sectores.json"), cargar("data/meta.json")]);
    estado.empresas = empresas.map((e) => ({
      ...e,
      _busqueda: normal([e.nombre, e.razon_social, e.rut, (e.rut || "").replace(/\./g, ""), e.macro_industria, e.industria,
        e.industria_blab, e.descripcion, e.giro, e.sede, e.region, e.pais_sede].filter(Boolean).join(" ")).replace(/\./g, ""),
    }));
    estado.sectores = sectores.sectores || [];
    estado.meta = meta;
    $("#fecha").textContent = meta.generado || "—";
    $("#fecha").setAttribute("datetime", meta.generado || "");
  } catch (err) {
    $("#contenido").prepend(el("p", { class: "vacio" }, `No se pudieron cargar los datos (${err.message}).`));
    return;
  }
  leerHash();
  prepararFiltros();
  prepararOrden();
  $$(".tabs button").forEach((b) => b.addEventListener("click", () => {
    estado.vista = b.dataset.vista;
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }));
  $("#ficha").addEventListener("click", (ev) => { if (ev.target === ev.currentTarget) ev.currentTarget.close(); });
  $("#ficha").addEventListener("close", ocultarTooltip);
  window.addEventListener("hashchange", () => { leerHash(); render(); });
  render();
}

iniciar();
