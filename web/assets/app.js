// Empresas B en Chile — directorio estático, estilo Apple, sin dependencias.
// Todo texto que viene de los datos se inserta con textContent (nunca innerHTML).

// Orden de las áreas = orden de la paleta validada (azul, naranja, verde, morado, rosa).
const AREAS = [
  ["gobernanza", "Gobernanza", "--s1"],
  ["trabajadores", "Trabajadores", "--s2"],
  ["medio_ambiente", "Medio ambiente", "--s3"],
  ["comunidad", "Comunidad", "--s4"],
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
const PASO = 48;
const SVGNS = "http://www.w3.org/2000/svg";

const nf = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const estado = {
  empresas: [], sectores: [], meta: {}, lista: [],
  filtros: { ...FILTROS_VACIOS }, orden: "nombre", limite: PASO, vista: "directorio", sector: "data-center",
};

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function el(tag, attrs = {}, ...hijos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v;
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

function icono(nombre) {
  const s = document.createElementNS(SVGNS, "svg");
  s.setAttribute("class", "ico");
  s.setAttribute("aria-hidden", "true");
  const u = document.createElementNS(SVGNS, "use");
  u.setAttribute("href", `#i-${nombre}`);
  s.append(u);
  return s;
}

const normal = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const pct = (n, total) => (total ? (n / total) * 100 : 0);
const fmtPct = (v) => `${nf.format(v)}%`;
const hrefSeguro = (u) => (typeof u === "string" && /^(https?:|mailto:|tel:)/i.test(u.trim()) ? u.trim() : null);
const telHref = (t) => (t ? `tel:${t.replace(/[^\d+]/g, "")}` : null);
const waHref = (t) => (t ? `https://wa.me/${t.replace(/\D/g, "")}` : null);
const mapaHref = (d) => (d ? `https://maps.apple.com/?q=${encodeURIComponent(d)}` : null);
const tamanoGrupo = (e) => e.economia?.tamano_sii_grupo || null;
const promedio = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
const mediana = (v) => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

function enlace(texto, href, extra = {}) {
  const h = hrefSeguro(href);
  if (!h) return document.createTextNode(texto ?? "");
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

function lugar(e) {
  if (!e.sede_en_chile) return `${e.pais_sede || "Extranjero"} · opera en Chile`;
  return e.region ? (e.region === "Metropolitana" ? "Región Metropolitana" : e.region) : e.sede || "";
}

// "Sin dato" no se muestra como etiqueta (queda en la sección Datos de la ficha).
function etiquetaTipo(tipo) {
  if (!tipo || tipo === "Sin dato") return null;
  return el("span", { class: `etq${tipo === "SpA" ? " etq-spa" : ""}` }, tipo);
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
  if (p.get("o")) estado.orden = p.get("o");
}

function escribirHash() {
  const p = new URLSearchParams();
  if (estado.vista !== "directorio") p.set("v", estado.vista);
  if (estado.vista === "sectores") p.set("s", estado.sector);
  if (estado.orden !== "nombre") p.set("o", estado.orden);
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

function contarPor(lista, fn) {
  const c = new Map();
  for (const e of lista) {
    const k = fn(e);
    if (k == null) continue;
    c.set(k, (c.get(k) || 0) + 1);
  }
  return c;
}

function prepararFiltros() {
  const form = $("#filtros");
  const E = estado.empresas;
  const ind = contarPor(E, (e) => e.macro_industria);
  opciones(form.industria, [...ind].sort((a, b) => b[1] - a[1]).map(([k, n]) => [k, `${k} (${n})`]), "Todas");
  const tipos = contarPor(E, (e) => e.tipo_sociedad);
  opciones(form.tipo, TIPOS.filter((t) => tipos.get(t)).map((t) => [t, `${t} (${tipos.get(t)})`]), "Todos");
  const regiones = contarPor(E.filter((e) => e.sede_en_chile), (e) => e.region || "Sin dato");
  opciones(form.region, [...regiones].sort((a, b) => b[1] - a[1]).map(([k, n]) => [k, `${k} (${n})`]), "Todas");
  const tam = contarPor(E, (e) => tamanoGrupo(e) || "Sin dato");
  opciones(form.tamano, [...TAMANOS, "Sin dato"].filter((t) => tam.get(t)).map((t) => [t, `${t} (${tam.get(t)})`]), "Todos");
  opciones(form.puntaje, [80, 90, 100, 110, 120].map((v) => [String(v), `≥ ${v}`]), "Cualquiera");
  const anios = [...new Set(E.map((e) => e.anio_certificacion).filter(Boolean))].sort();
  opciones(form.anio, anios.map((a) => [String(a), String(a)]), "Cualquier año");
  opciones(form.sede, [["chile", "En Chile"], ["extranjero", "En el extranjero"]], "Todas");
  opciones(form.seccion, Object.entries(SECCIONES), "Todas");

  form.addEventListener("input", (ev) => {
    const c = ev.target;
    if (!c.name) return;
    estado.filtros[c.name] = c.type === "checkbox" ? c.checked : c.value;
    estado.limite = PASO;
    render();
  });
  let t;
  $("#q").addEventListener("input", (ev) => {
    estado.filtros.q = ev.target.value;
    estado.limite = PASO;
    clearTimeout(t);
    t = setTimeout(render, 140);
  });
  $("#limpiar").addEventListener("click", () => {
    estado.filtros = { ...FILTROS_VACIOS, q: estado.filtros.q };
    estado.limite = PASO;
    render();
  });
  $("#abrir-filtros").addEventListener("click", () => abrirDialogo($("#dlg-filtros")));
  $("#ver-resultados").addEventListener("click", () => {
    const suave = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    $("#chips").scrollIntoView({ behavior: suave ? "smooth" : "auto", block: "start" });
  });
  $("#exportar").addEventListener("click", exportarCSV);
  $("#orden").addEventListener("change", (ev) => { estado.orden = ev.target.value; estado.limite = PASO; render(); });
  $("#mas").addEventListener("click", () => { estado.limite += PASO; renderDirectorio(); });
}

function sincronizarControles() {
  const form = $("#filtros");
  for (const [k, v] of Object.entries(estado.filtros)) {
    const campo = form.elements[k];
    if (!campo) continue;
    if (campo.type === "checkbox") campo.checked = !!v;
    else campo.value = v;
  }
  if ($("#q").value !== estado.filtros.q) $("#q").value = estado.filtros.q;
  $("#orden").value = estado.orden;
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
    if (!terminos.every((x) => e._busqueda.includes(x))) return false;
  }
  return true;
}

const ETIQUETAS_FILTRO = {
  industria: (v) => v,
  region: (v) => `Región: ${v}`,
  tamano: (v) => `Tamaño: ${v}`,
  puntaje: (v) => `Puntaje ≥ ${v}`,
  anio: (v) => `Desde ${v}`,
  sede: (v) => (v === "chile" ? "Sede en Chile" : "Sede en el extranjero"),
  seccion: (v) => SECCIONES[v] || v,
  web: () => "Con sitio web",
  email: () => "Con email",
  tel: () => "Con teléfono",
  rut: () => "Con RUT",
};

function filtrosActivos() {
  return Object.keys(ETIQUETAS_FILTRO).filter((k) => estado.filtros[k]);
}

function ordenar(lista) {
  const porNombre = (a, b) => a.nombre.localeCompare(b.nombre, "es");
  const nulosAlFinal = (va, vb, cmp) => (va == null && vb == null ? 0 : va == null ? 1 : vb == null ? -1 : cmp(va, vb));
  const criterios = {
    nombre: porNombre,
    puntaje: (a, b) => nulosAlFinal(a.puntaje_b, b.puntaje_b, (x, y) => y - x) || porNombre(a, b),
    reciente: (a, b) => nulosAlFinal(a.certificada_desde, b.certificada_desde, (x, y) => y.localeCompare(x)) || porNombre(a, b),
    industria: (a, b) => a.macro_industria.localeCompare(b.macro_industria, "es") || porNombre(a, b),
    region: (a, b) => nulosAlFinal(a.region, b.region, (x, y) => x.localeCompare(y, "es")) || porNombre(a, b),
  };
  return [...lista].sort(criterios[estado.orden] || porNombre);
}

// ---------------------------------------------------------------------------
// Render principal
// ---------------------------------------------------------------------------

function render() {
  estado.lista = estado.empresas.filter((e) => coincide(e, estado.filtros));
  escribirHash();
  sincronizarControles();
  for (const b of $$("[data-vista]")) {
    if (b.dataset.vista === estado.vista) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  }
  const filtrable = ["directorio", "industrias", "estadisticas"].includes(estado.vista);
  $("#toolbar").hidden = !filtrable;
  $("#resultados").hidden = !filtrable;
  $(".orden").hidden = estado.vista !== "directorio";
  $("#activos").hidden = !filtrable;
  $("#hero").hidden = estado.vista === "metodologia";
  for (const v of VISTAS) $(`#vista-${v}`).hidden = v !== estado.vista;

  renderHero();
  if (filtrable) {
    renderChips();
    renderActivos();
    const total = estado.empresas.length;
    const n = estado.lista.length;
    $("#conteo").textContent = n === total ? plural(total, "empresa", "empresas") : `${nf0.format(n)} de ${plural(total, "empresa", "empresas")}`;
  }
  $("#ver-resultados").textContent = `Ver ${plural(estado.lista.length, "empresa", "empresas")}`;
  const nAct = filtrosActivos().length + (estado.filtros.tipo ? 1 : 0);
  $("#n-filtros").hidden = !nAct;
  $("#n-filtros").textContent = String(nAct);

  if (estado.vista === "directorio") renderDirectorio();
  if (estado.vista === "industrias") renderIndustrias();
  if (estado.vista === "estadisticas") renderEstadisticas();
  if (estado.vista === "sectores") renderSectores();
  if (estado.vista === "metodologia") renderCobertura();
}

function kpi(valor, label, sub) {
  return el("div", { class: "kpi" },
    el("div", { class: "kpi-valor" }, valor),
    el("div", { class: "kpi-label" }, label),
    sub ? el("div", { class: "kpi-sub" }, sub) : null);
}

const TITULOS = {
  industrias: ["Por industria.", "Toca una industria para ver sus empresas."],
  estadisticas: ["En cifras.", "Porcentajes por industria, tipo de sociedad, región y áreas de impacto."],
  sectores: ["Sectores estratégicos.", "Data center, robótica, salmones y marítimo en Chile, sean o no Empresas B."],
};

function renderHero() {
  const titulo = $("#hero-titulo");
  const lead = $("#hero-lead");
  const compacto = estado.vista in TITULOS;
  $("#hero").classList.toggle("compacto", compacto);
  $(".hero .meta").hidden = compacto;
  $("#kpis").hidden = compacto;
  if (compacto) {
    [titulo.textContent, lead.textContent] = TITULOS[estado.vista];
    return;
  }
  titulo.textContent = "Empresas B en Chile.";
  lead.textContent = "Las empresas que equilibran propósito y utilidad, por industria, tipo de sociedad, economía y contacto.";
  const l = estado.lista;
  const n = l.length;
  const chile = l.filter((e) => e.sede_en_chile).length;
  const spa = l.filter((e) => e.tipo_sociedad === "SpA").length;
  const conTipo = l.filter((e) => e.tipo_sociedad !== "Sin dato").length;
  const p = l.map((e) => e.puntaje_b).filter((v) => v != null);
  $("#kpis").replaceChildren(
    kpi(nf0.format(n), "Empresas B", n === estado.empresas.length ? "en el directorio" : `de ${nf0.format(estado.empresas.length)}`),
    kpi(nf0.format(chile), "Con sede en Chile", fmtPct(pct(chile, n))),
    kpi(nf0.format(spa), "Son SpA", conTipo ? `${fmtPct(pct(spa, conTipo))} de las con tipo conocido` : null),
    kpi(p.length ? nf.format(promedio(p)) : "—", "Puntaje B promedio", p.length ? `mediana ${nf.format(mediana(p))}` : null),
  );
}

function renderChips() {
  const base = estado.empresas.filter((e) => coincide(e, { ...estado.filtros, tipo: "" }));
  const cuenta = contarPor(base, (e) => e.tipo_sociedad);
  const chip = (valor, texto, n) => {
    const b = el("button", { type: "button", class: "chip", "aria-pressed": String(estado.filtros.tipo === valor) },
      texto, n != null ? el("span", { class: "n" }, nf0.format(n)) : null);
    b.addEventListener("click", () => {
      estado.filtros.tipo = estado.filtros.tipo === valor ? "" : valor;
      estado.limite = PASO;
      render();
    });
    return b;
  };
  $("#chips").replaceChildren(chip("", "Todas", base.length),
    ...TIPOS.filter((t) => cuenta.get(t) || estado.filtros.tipo === t).map((t) => chip(t, t, cuenta.get(t) || 0)));
}

function renderActivos() {
  $("#activos").replaceChildren(...filtrosActivos().map((k) => {
    const b = el("button", { type: "button", class: "activo", "aria-label": `Quitar filtro ${ETIQUETAS_FILTRO[k](estado.filtros[k])}` },
      ETIQUETAS_FILTRO[k](estado.filtros[k]), icono("x"));
    b.addEventListener("click", () => {
      estado.filtros[k] = typeof FILTROS_VACIOS[k] === "boolean" ? false : "";
      estado.limite = PASO;
      render();
    });
    return b;
  }));
}

// ---------------------------------------------------------------------------
// Directorio (tarjetas)
// ---------------------------------------------------------------------------

function accionesContacto(c = {}) {
  const items = [
    ["globe", "Sitio web", c.sitio_web],
    ["mail", "Email", c.email ? `mailto:${c.email}` : null],
    ["phone", "Llamar", telHref(c.telefono)],
    ["chat", "WhatsApp", waHref(c.whatsapp)],
    ["linkedin", "LinkedIn", c.linkedin],
    ["instagram", "Instagram", c.instagram],
  ].filter(([, , h]) => hrefSeguro(h));
  if (!items.length) return el("p", { class: "t-sub vacio" }, "Sin contactos aún");
  return el("div", { class: "t-acciones" }, items.slice(0, 4).map(([ico, nombre, h]) => {
    const a = enlace(null, h, { class: "icono-btn", "aria-label": nombre, title: nombre });
    a.replaceChildren(icono(ico));
    return a;
  }));
}

function tarjetaEmpresa(e) {
  const nombre = el("button", { type: "button", class: "t-nombre" }, e.nombre);
  nombre.addEventListener("click", () => abrirFicha(e));
  return el("article", { class: "tarjeta" },
    el("div", { class: "t-cab" }, nombre,
      e.puntaje_b != null ? el("div", { class: "t-puntaje" }, el("b", {}, nf.format(e.puntaje_b)), el("span", {}, "puntaje B")) : null),
    el("p", { class: "t-sub" }, [e.industria || e.macro_industria, lugar(e)].filter(Boolean).join(" · ")),
    el("div", { class: "t-pie" },
      el("div", { class: "etiquetas" }, etiquetaTipo(e.tipo_sociedad),
        e.certificada_desde ? el("span", { class: "etq" }, `B desde ${e.certificada_desde.slice(0, 4)}`) : null,
        (e.secciones || []).map((s) => el("span", { class: "etq" }, SECCIONES[s]))),
      accionesContacto(e.contactos)));
}

function renderDirectorio() {
  const orden = ordenar(estado.lista);
  const visibles = orden.slice(0, estado.limite);
  $("#lista").replaceChildren(...(visibles.length ? visibles.map(tarjetaEmpresa)
    : [el("p", { class: "sin-resultados" }, "Ninguna empresa coincide con la búsqueda.")]));
  const resto = orden.length - visibles.length;
  $("#mas").hidden = resto <= 0;
  $("#mas").textContent = `Mostrar más (${nf0.format(resto)})`;
}

// ---------------------------------------------------------------------------
// Por industria (acordeón)
// ---------------------------------------------------------------------------

function renderIndustrias() {
  const grupos = new Map();
  for (const e of estado.lista) {
    if (!grupos.has(e.macro_industria)) grupos.set(e.macro_industria, []);
    grupos.get(e.macro_industria).push(e);
  }
  const n = estado.lista.length;
  const max = Math.max(1, ...[...grupos.values()].map((l) => l.length));
  const bloques = [...grupos].sort((a, b) => b[1].length - a[1].length).map(([macro, lista]) => {
    const p = lista.map((e) => e.puntaje_b).filter((v) => v != null);
    const spa = lista.filter((e) => e.tipo_sociedad === "SpA").length;
    lista.sort((a, b) => (b.puntaje_b ?? 0) - (a.puntaje_b ?? 0) || a.nombre.localeCompare(b.nombre, "es"));
    const filas = lista.map((e) => {
      const b = el("button", { type: "button", class: "ind-fila" },
        el("span", { class: "n1" }, e.nombre),
        el("span", { class: "n3" }, e.puntaje_b != null ? nf.format(e.puntaje_b) : "—"),
        el("span", { class: "n2" }, [e.tipo_sociedad !== "Sin dato" ? e.tipo_sociedad : null, lugar(e)].filter(Boolean).join(" · ")));
      b.addEventListener("click", () => abrirFicha(e));
      return b;
    });
    return el("details", { class: "ind" },
      el("summary", {},
        el("span", { class: "ind-tit" }, macro),
        el("span", { class: "ind-chev" }, icono("chevron")),
        el("span", { class: "ind-meta" }, `${plural(lista.length, "empresa", "empresas")} · ${fmtPct(pct(lista.length, n))}` +
          (p.length ? ` · puntaje B ${nf.format(promedio(p))}` : "") + ` · ${spa} SpA`),
        el("span", { class: "ind-barra", "aria-hidden": "true" }, el("span", { style: `width:${(lista.length / max) * 100}%` }))),
      el("div", { class: "ind-cuerpo" }, filas));
  });
  $("#vista-industrias").replaceChildren(bloques.length ? el("div", { class: "industrias" }, bloques)
    : el("p", { class: "sin-resultados" }, "Ninguna empresa coincide con la búsqueda."));
}

// ---------------------------------------------------------------------------
// Gráficos (HTML accesible) + tooltip
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
  t.style.left = `${Math.min(Math.max(8, x + 12), window.innerWidth - t.offsetWidth - 8)}px`;
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
  const tablaWrap = el("div", { class: "tabla-scroll", hidden: true }, tabla);
  const boton = el("button", { type: "button", class: "ver-tabla", "aria-expanded": "false" }, "Ver tabla");
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

function barrasH(titulo, nota, datos, total, ancho = false) {
  const max = Math.max(1, ...datos.map((d) => d.valor));
  const cuerpo = el("div", { class: "barras" }, datos.map((d) => {
    const pista = el("div", { class: "b-pista" },
      el("div", { class: "b-barra", style: `width:${(d.valor / max) * 100 * 0.8}%` }),
      el("span", { class: "b-valor" }, `${nf0.format(d.valor)} · ${fmtPct(pct(d.valor, total))}`));
    conTooltip(pista, d.categoria, [["--s1", `${nf0.format(d.valor)} empresas`], [null, `${fmtPct(pct(d.valor, total))} del total`]]);
    return [el("div", { class: "b-label" }, d.categoria), pista];
  }));
  const tabla = tablaSimple(["Categoría", "Empresas", "%"], datos.map((d) => [d.categoria, nf0.format(d.valor), fmtPct(pct(d.valor, total))]));
  return figura(titulo, nota, cuerpo, tabla, ancho);
}

function columnas(titulo, nota, datos, ancho = false) {
  const max = Math.max(1, ...datos.map((d) => d.valor));
  const barras = el("div", { class: "columnas" }, datos.map((d) => conTooltip(el("div", { class: "col" },
    el("span", { class: "col-valor" }, d.valor ? nf0.format(d.valor) : ""),
    el("div", { class: "col-barra", style: `height:${(d.valor / max) * 82}%` })), String(d.categoria), [["--s1", `${nf0.format(d.valor)} empresas`]])));
  const ejes = el("div", { class: "col-ejes", "aria-hidden": "true" }, datos.map((d) => el("span", {}, String(d.categoria))));
  const tabla = tablaSimple(["Categoría", "Empresas"], datos.map((d) => [String(d.categoria), nf0.format(d.valor)]));
  return figura(titulo, nota, el("div", {}, barras, ejes), tabla, ancho);
}

function leyendaAreas(valores, base) {
  return el("ul", { class: "leyenda" }, AREAS.filter(([k]) => !valores || valores[k] != null).map(([k, nombre, color]) =>
    el("li", {}, el("span", { class: "muestra", style: `background:var(${color})` }),
      valores ? `${nombre} ${nf.format(valores[k])} (${fmtPct(pct(valores[k], base))})` : nombre)));
}

function pilaAreas(valores, titulo) {
  const total = AREAS.reduce((s, [k]) => s + (valores[k] || 0), 0);
  return el("div", { class: "pila" }, AREAS.filter(([k]) => valores[k] != null).map(([k, nombre, color]) =>
    conTooltip(el("div", { class: "seg-a", style: `flex:${valores[k]} 1 0;background:var(${color})` }),
      `${titulo ? `${titulo} · ` : ""}${nombre}`, [[color, `${nf.format(valores[k])} puntos`], [null, `${fmtPct(pct(valores[k], total))} del puntaje`]])));
}

function apiladas(titulo, nota, filas) {
  const max = Math.max(1, ...filas.map((f) => AREAS.reduce((s, [k]) => s + (f.areas[k] || 0), 0)));
  const cuerpo = el("div", { class: "apiladas" }, filas.map((f) => {
    const total = AREAS.reduce((s, [k]) => s + (f.areas[k] || 0), 0);
    const pila = pilaAreas(f.areas, f.categoria);
    pila.style.width = `${(total / max) * 84}%`;
    return [el("div", { class: "b-label" }, `${f.categoria} (n=${f.n})`),
      el("div", { class: "pila-fila" }, pila, el("span", { class: "pila-total" }, nf.format(total)))];
  }));
  const tabla = tablaSimple(["Industria", ...AREAS.map((a) => a[1]), "Total"], filas.map((f) => {
    const t = AREAS.reduce((s, [k]) => s + (f.areas[k] || 0), 0);
    return [f.categoria, ...AREAS.map(([k]) => `${nf.format(f.areas[k] || 0)} (${fmtPct(pct(f.areas[k] || 0, t))})`), nf.format(t)];
  }));
  return figura(titulo, nota, el("div", {}, leyendaAreas(null), cuerpo), tabla, true);
}

function renderEstadisticas() {
  const l = estado.lista;
  const n = l.length;
  const g = $("#graficos");
  if (!n) {
    g.replaceChildren(el("p", { class: "sin-resultados" }, "Ninguna empresa coincide con la búsqueda."));
    return;
  }
  const porMacro = [...contarPor(l, (e) => e.macro_industria)].map(([categoria, valor]) => ({ categoria, valor }))
    .sort((a, b) => b.valor - a.valor);
  const porTipo = TIPOS.map((t) => ({ categoria: t, valor: l.filter((e) => e.tipo_sociedad === t).length })).filter((d) => d.valor);
  const chile = l.filter((e) => e.sede_en_chile);
  const porRegion = [...contarPor(chile, (e) => e.region || "Sin dato")].map(([categoria, valor]) => ({ categoria, valor }))
    .sort((a, b) => b.valor - a.valor);
  const porTamano = [...TAMANOS, "Sin dato"].map((t) => ({ categoria: t, valor: l.filter((e) => (tamanoGrupo(e) || "Sin dato") === t).length }))
    .filter((d) => d.valor);
  const conTamano = porTamano.filter((d) => d.categoria !== "Sin dato").reduce((s, d) => s + d.valor, 0);
  const anios = contarPor(l, (e) => e.anio_certificacion);
  const rango = [...anios.keys()].sort();
  const porAnio = rango.length ? Array.from({ length: rango.at(-1) - rango[0] + 1 }, (_, i) => rango[0] + i)
    .map((a) => ({ categoria: a, valor: anios.get(a) || 0 })) : [];
  const puntajes = l.map((e) => e.puntaje_b).filter((v) => v != null);
  const bins = [[80, 90], [90, 100], [100, 110], [110, 120], [120, 140], [140, 201]];
  const porPuntaje = bins.map(([a, b]) => ({ categoria: b > 200 ? `${a}+` : `${a}–${b}`, valor: puntajes.filter((p) => p >= a && p < b).length }));

  const completas = l.filter((e) => AREAS.every(([k]) => e.areas?.[k] != null));
  const promAreas = (lista) => Object.fromEntries(AREAS.map(([k]) => [k, promedio(lista.map((e) => e.areas[k]))]));
  const filasAreas = completas.length ? [{ categoria: "Todas", areas: promAreas(completas), n: completas.length }] : [];
  for (const { categoria } of porMacro) {
    const sub = completas.filter((e) => e.macro_industria === categoria);
    if (sub.length) filasAreas.push({ categoria, areas: promAreas(sub), n: sub.length });
  }

  g.replaceChildren(
    barrasH("Empresas B por industria", "Porcentaje sobre el total filtrado", porMacro, n, true),
    barrasH("Tipo de sociedad", "Deducido de la razón social. «Sin dato»: aún no encontrada.", porTipo, n),
    barrasH("Región de la sede", `Empresas con sede en Chile (${nf0.format(chile.length)})`, porRegion, chile.length),
    conTamano >= 10
      ? barrasH("Tamaño según ventas (SII)", "Tramo SII cuando hay cruce por RUT", porTamano, n)
      : figura("Tamaño según ventas (SII)", "Se completa con el cruce por RUT con la Nómina de Personas Jurídicas del SII.",
        el("p", { class: "nota" }, `${plural(conTamano, "empresa", "empresas")} con tamaño informado por ahora.`),
        tablaSimple(["Tamaño", "Empresas"], porTamano.map((d) => [d.categoria, nf0.format(d.valor)]))),
    columnas("Primera certificación por año", "Año en que cada empresa se certificó por primera vez", porAnio),
    columnas("Distribución del puntaje B", `${nf0.format(puntajes.length)} empresas con puntaje · se certifica desde 80`, porPuntaje),
    filasAreas.length
      ? apiladas("Puntaje B por área de impacto", "Promedio por industria, solo empresas con desglose completo publicado (n).", filasAreas)
      : figura("Puntaje B por área de impacto", null, el("p", { class: "nota" }, "Ninguna empresa filtrada tiene el desglose publicado."), el("span")),
  );
}

// ---------------------------------------------------------------------------
// Hojas (dialog) y fichas
// ---------------------------------------------------------------------------

function abrirDialogo(d) {
  if (!d.open) d.showModal();
  document.documentElement.style.overflow = "hidden";
  const cuerpo = d.querySelector(".hoja-cuerpo");
  if (cuerpo) cuerpo.scrollTop = 0;
}

function prepararDialogos() {
  for (const d of $$("dialog.hoja")) {
    d.addEventListener("click", (ev) => { if (ev.target === d) d.close(); });
    d.addEventListener("close", () => { document.documentElement.style.overflow = ""; ocultarTooltip(); });
    for (const b of $$("[data-cerrar]", d)) b.addEventListener("click", () => d.close());
  }
}

const plural = (n, uno, varios) => `${nf0.format(n)} ${n === 1 ? uno : varios}`;

// Fila de texto libre a todo el ancho (resúmenes, notas y avisos de "sin datos").
function filaTexto(texto) {
  return texto ? el("div", { class: "fila fila-texto" }, texto) : null;
}

function fila(k, v) {
  if (v == null || v === "" || (Array.isArray(v) && !v.length)) return null;
  return el("div", { class: "fila" }, el("span", {}, k), el("span", { class: "v" }, v));
}

function filaEnlace(k, texto, href) {
  const h = hrefSeguro(href);
  if (!h) return null;
  const externo = /^https?:/i.test(h);
  return el("a", { class: "fila fila-link", href: h, target: externo ? "_blank" : null, rel: externo ? "noopener" : null },
    el("span", {}, k), el("span", { class: "v" }, texto));
}

function conFuente(texto, fuente) {
  return [texto, fuente ? [" · ", enlace("fuente", fuente)] : null];
}

function grupo(titulo, filas, vacio) {
  const items = filas.flat().filter(Boolean);
  if (!items.length && !vacio) return null;
  return [el("p", { class: "grupo-tit" }, titulo), el("div", { class: "grupo" }, items.length ? items : filaTexto(vacio))];
}

function accionesRapidas(c = {}) {
  const items = [
    ["globe", "Web", c.sitio_web],
    ["phone", "Llamar", telHref(c.telefono)],
    ["mail", "Email", c.email ? `mailto:${c.email}` : null],
    ["chat", "WhatsApp", waHref(c.whatsapp)],
    ["linkedin", "LinkedIn", c.linkedin],
    ["pin", "Mapa", mapaHref(c.direccion)],
  ].filter(([, , h]) => hrefSeguro(h));
  if (!items.length) return null;
  return el("div", { class: "acciones-rapidas" }, items.map(([ico, nombre, h]) => {
    const a = enlace(null, h, { class: "accion" });
    a.replaceChildren(icono(ico), el("span", {}, nombre));
    return a;
  }));
}

// Cada área ocupa su proporción real del puntaje total; lo no desglosado queda como tramo gris.
function barraPuntaje(e, presentes, base) {
  const suma = presentes.reduce((s, [k]) => s + e.areas[k], 0);
  const segs = presentes.map(([k, nombre, color]) => conTooltip(
    el("div", { class: "seg-a", style: `width:${(e.areas[k] / base) * 100}%;background:var(${color})` }),
    nombre, [[color, `${nf.format(e.areas[k])} puntos`], [null, `${fmtPct(pct(e.areas[k], base))} del puntaje`]]));
  if (base - suma > 0.5) {
    segs.push(conTooltip(el("div", { class: "seg-a seg-resto", style: `width:${((base - suma) / base) * 100}%` }),
      "Sin desglose público", [[null, `${nf.format(base - suma)} puntos`]]));
  }
  return el("div", { class: "pila-puntaje" }, segs);
}

function cajaPuntaje(e) {
  const presentes = AREAS.filter(([k]) => e.areas?.[k] != null);
  if (e.puntaje_b == null && !presentes.length) return null;
  const base = e.puntaje_b || presentes.reduce((s, [k]) => s + e.areas[k], 0);
  return [el("p", { class: "grupo-tit" }, "Puntaje B"),
    el("div", { class: "puntaje-caja" },
      el("div", { class: "puntaje-cab" },
        el("span", { class: "puntaje-num" }, e.puntaje_b != null ? nf.format(e.puntaje_b) : "—"),
        el("span", { class: "nota" }, "puntos · se certifica desde 80; una empresa común promedia ≈ 50,9")),
      presentes.length ? barraPuntaje(e, presentes, base) : null,
      presentes.length ? leyendaAreas(Object.fromEntries(presentes.map(([k]) => [k, e.areas[k]])), base) : null,
      presentes.length < AREAS.length
        ? el("p", { class: "nota" }, presentes.length ? "Desglose por área incompleto en las fuentes públicas." : "Desglose por área no disponible en las fuentes consultadas.")
        : null)];
}

function grupoEconomia(eco = {}) {
  return grupo("Cómo le va económicamente", [
    fila("Tamaño (SII)", eco.tramo_ventas_sii || eco.tamano_sii),
    fila("Trabajadores (SII)", eco.trabajadores_sii),
    fila("Trabajadores", eco.trabajadores),
    (eco.ventas_reportadas || []).map((v) => fila(v.periodo ? `Ventas ${v.periodo}` : "Ventas", conFuente(v.valor, v.fuente))),
    (eco.financiamiento || []).map((v) => fila(v.fecha ? `Inversión ${v.fecha}` : "Inversión", conFuente(v.descripcion, v.fuente))),
    (eco.inversion_anunciada || []).map((v) => fila(v.fecha ? `Inversión anunciada ${v.fecha}` : "Inversión anunciada",
      conFuente([v.valor, v.descripcion].filter(Boolean).join(" — "), v.fuente))),
    fila("Capacidad", eco.capacidad),
    fila("Cotiza en bolsa", eco.cotiza_en_bolsa == null ? null : (eco.cotiza_en_bolsa ? "Sí" : "No")),
    filaTexto(eco.resumen),
  ], "Sin datos económicos públicos encontrados todavía.");
}

function grupoPropiedad(p = {}) {
  return grupo("Propiedad", [
    fila("Controlador", p.controlador),
    fila("Grupo", p.grupo_empresarial),
    (p.socios || []).map((s) => fila(s.nombre, conFuente(s.porcentaje != null ? `${nf.format(s.porcentaje)}%` : "% no publicado", s.fuente))),
    filaTexto(p.notas),
  ], "No publicada en las fuentes consultadas (en las SpA los accionistas rara vez son públicos).");
}

function grupoPersonas(personas) {
  return grupo("Líderes", (personas || []).map((p) => p.linkedin
    ? filaEnlace(p.nombre, p.cargo ? `${p.cargo} · LinkedIn` : "LinkedIn", p.linkedin)
    : fila(p.nombre, p.cargo || "")));
}

function grupoContacto(c = {}) {
  return grupo("Contacto corporativo", [
    filaEnlace("Sitio web", c.sitio_web ? dominio(c.sitio_web) : null, c.sitio_web),
    filaEnlace("Email", c.email, c.email ? `mailto:${c.email}` : null),
    filaEnlace("Teléfono", c.telefono, telHref(c.telefono)),
    filaEnlace("WhatsApp", c.whatsapp, waHref(c.whatsapp)),
    filaEnlace("Dirección", c.direccion, mapaHref(c.direccion)),
    fila("Comuna", c.comuna),
    filaEnlace("LinkedIn", "Perfil de la empresa", c.linkedin),
    filaEnlace("Instagram", "Ver perfil", c.instagram),
    filaEnlace("Facebook", "Ver página", c.facebook),
    filaEnlace("X", "Ver perfil", c.x),
    filaEnlace("YouTube", "Ver canal", c.youtube),
  ], "Sin contactos corporativos encontrados todavía.");
}

function grupoFuentes(fuentes) {
  if (!fuentes?.length) return null;
  return [el("p", { class: "grupo-tit" }, "Fuentes"),
    el("div", { class: "grupo" }, el("ul", { class: "lista-fuentes" },
      fuentes.slice(0, 25).map((f) => el("li", {}, enlace(dominio(f), f)))))];
}

function abrirFicha(e) {
  const reporte = `https://github.com/Nikolaaa11/EmpresasB/issues/new?title=${encodeURIComponent(`Corrección: ${e.nombre}`)}`;
  $("#ficha-cab").textContent = e.nombre;
  $("#ficha-cuerpo").replaceChildren(...[
    el("div", { class: "f-hero" },
      el("h3", { id: "ficha-titulo" }, e.nombre),
      el("p", { class: "f-razon" }, [e.razon_social && e.razon_social !== e.nombre ? e.razon_social : null, e.rut ? `RUT ${e.rut}` : null]
        .filter(Boolean).join(" · ") || "Razón social y RUT por confirmar"),
      el("div", { class: "etiquetas" }, etiquetaTipo(e.tipo_sociedad), el("span", { class: "etq etq-b" }, "Empresa B"),
        el("span", { class: "etq" }, e.macro_industria))),
    accionesRapidas(e.contactos),
    e.descripcion ? el("p", { class: "f-desc" }, e.descripcion) : null,
    cajaPuntaje(e),
    grupoEconomia(e.economia),
    grupoPropiedad(e.propiedad),
    grupoPersonas(e.personas),
    grupoContacto(e.contactos),
    grupo("Datos", [
      fila("Industria", e.industria),
      fila("Sector B Lab", e.sector_blab),
      fila("Sede", e.sede_en_chile ? e.sede : `${e.pais_sede} (opera en Chile)`),
      fila("Región", e.region),
      fila("Certificada desde", e.certificada_desde),
      fila("Tipo de sociedad", e.tipo_sociedad),
      fila("Giro", e.giro),
    ]),
    grupoFuentes(e.fuentes),
    el("div", { class: "f-pie" }, enlace("Ficha oficial en B Lab", e.url_blab), enlace("Reportar un error", reporte)),
    el("p", { class: "f-nota" }, `Completitud del registro ${e.completitud}% · actualizado ${e.actualizado}`),
  ].flat().filter(Boolean));
  abrirDialogo($("#ficha"));
}

function abrirFichaSector(s, sector) {
  if (s.id_empresa_b) {
    const b = estado.empresas.find((e) => e.id === s.id_empresa_b);
    if (b) return abrirFicha(b);
  }
  $("#ficha-cab").textContent = s.nombre;
  $("#ficha-cuerpo").replaceChildren(...[
    el("div", { class: "f-hero" },
      el("h3", { id: "ficha-titulo" }, s.nombre),
      el("p", { class: "f-razon" }, [s.razon_social && s.razon_social !== s.nombre ? s.razon_social : null, s.rut ? `RUT ${s.rut}` : null]
        .filter(Boolean).join(" · ") || "Razón social y RUT por confirmar"),
      el("div", { class: "etiquetas" }, etiquetaTipo(s.tipo_sociedad),
        s.es_empresa_b ? el("span", { class: "etq etq-b" }, "Empresa B") : null,
        el("span", { class: "etq" }, sector.nombre), s.subsector ? el("span", { class: "etq" }, s.subsector) : null)),
    accionesRapidas(s.contactos),
    s.descripcion ? el("p", { class: "f-desc" }, s.descripcion) : null,
    grupoEconomia(s.economia),
    grupoPropiedad(s.propiedad),
    grupoPersonas(s.personas),
    grupoContacto(s.contactos),
    grupo("Datos", [fila("Sector", sector.nombre), fila("Subsector", s.subsector), fila("Sede", s.sede), fila("Región", s.region)]),
    grupoFuentes(s.fuentes),
    s.url_blab ? el("div", { class: "f-pie" }, enlace("Ficha oficial en B Lab", s.url_blab)) : null,
  ].flat().filter(Boolean));
  abrirDialogo($("#ficha"));
}

// ---------------------------------------------------------------------------
// Sectores estratégicos
// ---------------------------------------------------------------------------

function tarjetaSector(x, sector) {
  const eco = x.economia || {};
  const cifra = eco.ventas_reportadas?.[0]
    ? `Ventas: ${eco.ventas_reportadas[0].valor}${eco.ventas_reportadas[0].periodo ? ` (${eco.ventas_reportadas[0].periodo})` : ""}`
    : eco.inversion_anunciada?.[0] ? `Inversión: ${eco.inversion_anunciada[0].valor}` : eco.capacidad ? `Capacidad: ${eco.capacidad}` : null;
  const control = x.propiedad?.controlador || (x.propiedad?.socios?.length ? x.propiedad.socios.map((p) => p.nombre).join(", ") : null);
  const nombre = el("button", { type: "button", class: "t-nombre" }, x.nombre);
  nombre.addEventListener("click", () => abrirFichaSector(x, sector));
  return el("article", { class: "tarjeta" },
    el("div", { class: "t-cab" }, nombre, x.es_empresa_b ? el("span", { class: "etq etq-b" }, "Empresa B") : null),
    el("p", { class: "t-sub" }, [x.subsector, x.region].filter(Boolean).join(" · ") || sector.nombre),
    cifra ? el("p", { class: "t-sub" }, cifra) : null,
    control ? el("p", { class: "t-sub" }, `Propiedad: ${control}`) : null,
    el("div", { class: "t-pie" },
      el("div", { class: "etiquetas" }, etiquetaTipo(x.tipo_sociedad), eco.cotiza_en_bolsa ? el("span", { class: "etq" }, "Cotiza en bolsa") : null),
      accionesContacto(x.contactos)));
}

function renderSectores() {
  $("#subtabs").replaceChildren(...estado.sectores.map((s) => {
    const b = el("button", { type: "button", "aria-current": s.id === estado.sector ? "true" : null }, `${s.nombre} · ${s.total}`);
    b.addEventListener("click", () => { estado.sector = s.id; render(); });
    return b;
  }));
  const s = estado.sectores.find((x) => x.id === estado.sector);
  if (!s) {
    $("#sector").replaceChildren(el("p", { class: "sin-resultados" }, "Sin datos del sector todavía."));
    return;
  }
  const web = s.empresas.filter((x) => x.contactos?.sitio_web).length;
  $("#sector").replaceChildren(
    el("div", { class: "sector-cab" },
      el("h2", {}, `${s.nombre}.`),
      el("p", { class: "sector-cifras" }, `${nf0.format(s.total)} empresas · ${nf0.format(s.empresas_b)} Empresas B · ${nf0.format(web)} con sitio web`),
      s.resumen ? el("p", {}, s.resumen) : null,
      s.fuentes?.length ? el("p", { class: "fuentes-mini" }, "Fuentes: ", s.fuentes.map((f, i) => [i ? " · " : "", enlace(dominio(f), f)])) : null),
    el("div", { class: "lista" }, s.empresas.length ? s.empresas.map((x) => tarjetaSector(x, s))
      : el("p", { class: "sin-resultados" }, "Sin empresas registradas todavía.")),
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
// Arranque
// ---------------------------------------------------------------------------

async function cargar(ruta) {
  const r = await fetch(ruta, { cache: "no-cache" });
  if (!r.ok) throw new Error(`${ruta}: ${r.status}`);
  return r.json();
}

async function iniciar() {
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
    $("#contenido").prepend(el("p", { class: "sin-resultados" }, `No se pudieron cargar los datos (${err.message}).`));
    return;
  }
  leerHash();
  prepararFiltros();
  prepararDialogos();
  for (const b of $$("[data-vista]")) {
    b.addEventListener("click", () => {
      estado.vista = b.dataset.vista;
      render();
      window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    });
  }
  $(".marca").addEventListener("click", (ev) => {
    ev.preventDefault();
    estado.vista = "directorio";
    render();
    window.scrollTo({ top: 0 });
  });
  window.addEventListener("hashchange", () => { leerHash(); render(); });
  render();
}

iniciar();
