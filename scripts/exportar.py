"""Genera las salidas publicables a partir de los maestros consolidados.

  data/empresas_b_chile.csv / .xlsx       directorio completo
  data/por_industria/*.csv                una planilla por macro-industria
  data/por_tipo_sociedad/*.csv            una planilla por tipo societario (SpA, S.A., Ltda., ...)
  data/sectores_estrategicos/*.csv        Data center, Robótica, Salmones, Marítimo
  data/estadisticas.json                  porcentajes y promedios
  docs/industrias/*.md, docs/tipos_sociedad.md, docs/sectores_estrategicos.md
  web/data/*.json                         datos del sitio

Uso:  python3 scripts/exportar.py   (después de consolidar.py)
"""
from __future__ import annotations

import csv
import json
import re
import shutil
import statistics
from collections import Counter, defaultdict
from pathlib import Path

from normalizacion import MACROS, NOMBRE_SECCION, TIPOS_SOCIEDAD, slugify

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
DOCS = ROOT / "docs"
WEB = ROOT / "web" / "data"
AREAS = ("gobernanza", "trabajadores", "comunidad", "medio_ambiente", "clientes")
NIVEL_REND = {"critico": "Crítico", "negativo": "Negativo", "observacion": "En observación",
              "sin_senales": "Sin señales públicas", "sin_revisar": "Sin revisar"}
ORDEN_NIVEL = {"critico": 0, "negativo": 1, "observacion": 2, "sin_senales": 3, "sin_revisar": 4}
NIVELES_PEOR = ("critico", "negativo", "observacion")
TIPO_SENAL = {"insolvencia": "Insolvencia", "cierre": "Cierre", "perdidas": "Pérdidas", "caida_ventas": "Caída de ventas",
              "despidos": "Despidos", "deuda": "Deuda", "rescate": "Rescate financiero", "otra": "Otra señal"}


def senales_txt(senales) -> str:
    return " | ".join(f"{TIPO_SENAL.get(s['tipo'], s['tipo'])} ({s.get('fecha') or 's/f'}): {s['descripcion']}"
                      for s in senales or [])


def contexto_rend(r: dict) -> str | None:
    """Contexto de los agentes más el motivo de la revisión editorial, si la hubo."""
    return " ".join(x for x in (r.get("contexto"), r.get("revision") and f"Revisión: {r['revision']}") if x) or None


NOMBRE_AREA = {"gobernanza": "Gobernanza", "trabajadores": "Trabajadores", "comunidad": "Comunidad",
               "medio_ambiente": "Medio ambiente", "clientes": "Clientes"}


def pct(n: int, total: int) -> float:
    return round(n / total * 100, 1) if total else 0.0


def lista(items, campo_valor, campo_extra=None) -> str:
    partes = []
    for it in items or []:
        txt = str(it.get(campo_valor) or "")
        if campo_extra and it.get(campo_extra):
            txt += f" ({it[campo_extra]})"
        if txt:
            partes.append(txt)
    return " | ".join(partes)


def socios_txt(socios) -> str:
    partes = []
    for s in socios or []:
        txt = s["nombre"]
        if s.get("porcentaje") is not None:
            txt += f" ({s['porcentaje']:g}%)"
        partes.append(txt)
    return " | ".join(partes)


def fila_csv(e: dict) -> dict:
    c, eco, prop = e["contactos"], e["economia"], e["propiedad"]
    fila = {
        "nombre": e["nombre"], "razon_social": e.get("razon_social"), "rut": e.get("rut"),
        "tipo_sociedad": e["tipo_sociedad"], "macro_industria": e["macro_industria"], "industria": e.get("industria"),
        "industria_blab": e.get("industria_blab"), "sector_blab": e.get("sector_blab"),
        "secciones": ", ".join(NOMBRE_SECCION[s] for s in e["secciones"]),
        "region": e.get("region"), "sede": e.get("sede"), "pais_sede": e.get("pais_sede"),
        "sede_en_chile": "sí" if e["sede_en_chile"] else "no",
        "certificada_desde": e.get("certificada_desde"), "puntaje_b": e.get("puntaje_b"),
    }
    for a in AREAS:
        fila[f"puntaje_{a}"] = e["areas"].get(a)
    for a in AREAS:
        fila[f"pct_{a}"] = e["areas_pct"].get(a)
    fila.update({
        "tamano_empleados_blab": e.get("tamano_empleados"),
        "tamano_sii": eco.get("tamano_sii"), "tramo_ventas_sii": eco.get("tramo_ventas_sii"),
        "trabajadores_sii": eco.get("trabajadores_sii"), "trabajadores": eco.get("trabajadores"),
        "ventas_reportadas": lista(eco.get("ventas_reportadas"), "valor", "periodo"),
        "financiamiento": lista(eco.get("financiamiento"), "descripcion", "fecha"),
        "cotiza_en_bolsa": {True: "sí", False: "no"}.get(eco.get("cotiza_en_bolsa")),
        "resumen_economico": eco.get("resumen"),
        "rendimiento_economico": NIVEL_REND.get((e.get("rendimiento") or {}).get("nivel"), "Sin revisar"),
        "senales_negativas": senales_txt((e.get("rendimiento") or {}).get("senales")),
        "contexto_rendimiento": contexto_rend(e.get("rendimiento") or {}),
        "controlador": prop.get("controlador"), "grupo_empresarial": prop.get("grupo_empresarial"),
        "socios": socios_txt(prop.get("socios")),
        "sitio_web": c.get("sitio_web"), "email": c.get("email"), "telefono": c.get("telefono"),
        "whatsapp": c.get("whatsapp"), "direccion": c.get("direccion"), "comuna": c.get("comuna"),
        "linkedin": c.get("linkedin"), "instagram": c.get("instagram"), "facebook": c.get("facebook"),
        "x": c.get("x"), "youtube": c.get("youtube"),
        "personas": lista(e.get("personas"), "nombre", "cargo"),
        "descripcion": e.get("descripcion"), "url_blab": e.get("url_blab"),
        "completitud_pct": e.get("completitud"), "fuentes": " | ".join(e.get("fuentes") or []),
        "actualizado": e.get("actualizado"),
    })
    return fila


def fila_sector(s: dict, nombre_sector: str) -> dict:
    c, eco, prop = s["contactos"], s["economia"], s["propiedad"]
    return {
        "sector": nombre_sector, "nombre": s["nombre"], "es_empresa_b": "sí" if s["es_empresa_b"] else "no",
        "subsector": s.get("subsector"), "razon_social": s.get("razon_social"), "rut": s.get("rut"),
        "tipo_sociedad": s.get("tipo_sociedad"), "region": s.get("region"), "sede": s.get("sede"),
        "ventas_reportadas": lista(eco.get("ventas_reportadas"), "valor", "periodo"),
        "inversion_anunciada": lista(eco.get("inversion_anunciada"), "valor", "fecha"),
        "capacidad": eco.get("capacidad"), "trabajadores": eco.get("trabajadores"),
        "cotiza_en_bolsa": {True: "sí", False: "no"}.get(eco.get("cotiza_en_bolsa")),
        "resumen_economico": eco.get("resumen"), "controlador": prop.get("controlador"),
        "socios": socios_txt(prop.get("socios")), "sitio_web": c.get("sitio_web"), "email": c.get("email"),
        "telefono": c.get("telefono"), "direccion": c.get("direccion"), "linkedin": c.get("linkedin"),
        "personas": lista(s.get("personas"), "nombre", "cargo"), "descripcion": s.get("descripcion"),
        "url_blab": s.get("url_blab"), "fuentes": " | ".join(s.get("fuentes") or []),
    }


def escribir_csv(ruta: Path, filas: list[dict]) -> None:
    ruta.parent.mkdir(parents=True, exist_ok=True)
    if not filas:
        ruta.write_text("", encoding="utf-8")
        return
    with open(ruta, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(filas[0].keys()))
        w.writeheader()
        w.writerows(filas)


def limpiar_dir(ruta: Path) -> None:
    if ruta.exists():
        shutil.rmtree(ruta)
    ruta.mkdir(parents=True)


# ---------------------------------------------------------------------------
# Estadísticas
# ---------------------------------------------------------------------------

def conteo(empresas, clave_fn, orden=None) -> list[dict]:
    total = len(empresas)
    c = Counter(clave_fn(e) for e in empresas)
    claves = orden if orden else [k for k, _ in c.most_common()]
    return [{"categoria": k if k is not None else "Sin dato", "empresas": c.get(k, 0), "pct": pct(c.get(k, 0), total)}
            for k in claves if c.get(k, 0)]


def promedio(valores) -> float | None:
    v = [x for x in valores if x is not None]
    return round(statistics.mean(v), 1) if v else None


def estadisticas(empresas: list[dict]) -> dict:
    total = len(empresas)
    puntajes = [e["puntaje_b"] for e in empresas if e.get("puntaje_b") is not None]
    con_areas = [e for e in empresas if all(e["areas"].get(a) is not None for a in AREAS)]
    prom_areas = {a: promedio(e["areas"][a] for e in con_areas) for a in AREAS}
    suma = sum(v for v in prom_areas.values() if v) or None
    por_macro = []
    for macro in MACROS:
        grupo = [e for e in empresas if e["macro_industria"] == macro]
        if not grupo:
            continue
        g_areas = [e for e in grupo if all(e["areas"].get(a) is not None for a in AREAS)]
        por_macro.append({
            "categoria": macro, "empresas": len(grupo), "pct": pct(len(grupo), total),
            "puntaje_promedio": promedio(e.get("puntaje_b") for e in grupo),
            "areas_promedio": {a: promedio(e["areas"][a] for e in g_areas) for a in AREAS} if g_areas else None,
            "con_areas": len(g_areas),
            "spa": sum(e["tipo_sociedad"] == "SpA" for e in grupo),
        })
    por_macro.sort(key=lambda x: -x["empresas"])
    bins = [(80, 90), (90, 100), (100, 110), (110, 120), (120, 140), (140, 200)]
    c = lambda pred: sum(1 for e in empresas if pred(e))
    return {
        "total": total,
        "sede_en_chile": c(lambda e: e["sede_en_chile"]),
        "por_macro_industria": por_macro,
        "por_industria": conteo(empresas, lambda e: e.get("industria")),
        "por_tipo_sociedad": conteo(empresas, lambda e: e["tipo_sociedad"], TIPOS_SOCIEDAD),
        "por_region": conteo([e for e in empresas if e["sede_en_chile"]], lambda e: e.get("region")),
        "por_anio_certificacion": sorted(conteo(empresas, lambda e: e.get("anio_certificacion")),
                                         key=lambda x: str(x["categoria"])),
        "por_tamano_sii": conteo(empresas, lambda e: e["economia"].get("tamano_sii_grupo"),
                                 ["Micro", "Pequeña", "Mediana", "Grande", None]),
        "por_rendimiento": conteo(empresas, lambda e: NIVEL_REND.get((e.get("rendimiento") or {}).get("nivel"), "Sin revisar"),
                                  list(NIVEL_REND.values())),
        "puntaje_b": {
            "con_puntaje": len(puntajes), "promedio": promedio(puntajes),
            "mediana": round(statistics.median(puntajes), 1) if puntajes else None,
            "minimo": min(puntajes) if puntajes else None, "maximo": max(puntajes) if puntajes else None,
            "distribucion": [{"categoria": f"{a}–{b}", "empresas": sum(1 for p in puntajes if a <= p < b)}
                             for a, b in bins],
        },
        "areas": {
            "empresas_con_desglose": len(con_areas),
            "promedio": prom_areas,
            "pct_del_total": {a: (round(v / suma * 100, 1) if v and suma else None) for a, v in prom_areas.items()},
        },
        "cobertura": {
            "razon_social": c(lambda e: e.get("razon_social")), "rut": c(lambda e: e.get("rut")),
            "tipo_sociedad": c(lambda e: e["tipo_sociedad"] != "Sin dato"),
            "sitio_web": c(lambda e: e["contactos"].get("sitio_web")),
            "email": c(lambda e: e["contactos"].get("email")),
            "telefono": c(lambda e: e["contactos"].get("telefono") or e["contactos"].get("whatsapp")),
            "direccion": c(lambda e: e["contactos"].get("direccion")),
            "linkedin": c(lambda e: e["contactos"].get("linkedin")),
            "personas": c(lambda e: e.get("personas")),
            "economia": c(lambda e: e["economia"].get("tamano_sii") or e["economia"]["ventas_reportadas"]
                          or e["economia"].get("trabajadores") or e["economia"]["financiamiento"]
                          or e["economia"].get("resumen")),
            "propiedad": c(lambda e: e["propiedad"].get("controlador") or e["propiedad"]["socios"]
                           or e["propiedad"].get("grupo_empresarial")),
            "puntaje_b": len(puntajes), "areas": len(con_areas),
        },
    }


# ---------------------------------------------------------------------------
# Markdown
# ---------------------------------------------------------------------------

def md_celda(v) -> str:
    if v is None or v == "":
        return "—"
    return str(v).replace("|", "/").replace("\n", " ")


def md_link(texto, href) -> str:
    return f"[{md_celda(texto)}]({href})" if href else md_celda(texto)


def md_tabla_empresas(empresas: list[dict]) -> str:
    filas = ["| Empresa | Razón social | Tipo | Industria | Región | Puntaje B | Certificada | Web | Contacto |",
             "|---|---|---|---|---|---:|---|---|---|"]
    for e in empresas:
        c = e["contactos"]
        contacto = " · ".join(x for x in (c.get("email"), c.get("telefono")) if x) or "—"
        filas.append("| " + " | ".join([
            md_link(e["nombre"], e.get("url_blab")), md_celda(e.get("razon_social")), md_celda(e["tipo_sociedad"]),
            md_celda(e.get("industria")), md_celda(e.get("region") or e.get("pais_sede")),
            md_celda(f"{e['puntaje_b']:g}" if e.get("puntaje_b") is not None else None),
            md_celda(e.get("certificada_desde")), md_link("sitio", c.get("sitio_web")) if c.get("sitio_web") else "—",
            md_celda(contacto),
        ]) + " |")
    return "\n".join(filas)


AVISO = ("> Fuente: investigación sobre fuentes públicas (directorio B Lab, sitios de las empresas, prensa y "
         "registros públicos). Ver [metodología](../README.md#metodología). Solo se publican contactos corporativos.")


def escribir_docs(empresas: list[dict], stats: dict, sectores: dict) -> None:
    ind_dir = DOCS / "industrias"
    limpiar_dir(ind_dir)
    indice = ["# Empresas B en Chile por industria", "", AVISO.replace("../README.md", "../../README.md"), "",
              f"Total: **{stats['total']}** Empresas B ({stats['sede_en_chile']} con sede en Chile).", "",
              "| Industria | Empresas | % del total | Puntaje B promedio | SpA |", "|---|---:|---:|---:|---:|"]
    for m in stats["por_macro_industria"]:
        slug = slugify(m["categoria"])
        indice.append(f"| [{m['categoria']}]({slug}.md) | {m['empresas']} | {m['pct']}% | "
                      f"{md_celda(m['puntaje_promedio'])} | {m['spa']} |")
        grupo = sorted((e for e in empresas if e["macro_industria"] == m["categoria"]),
                       key=lambda e: (-(e.get("puntaje_b") or 0), e["nombre"]))
        sub = Counter(e.get("industria") or "Sin dato" for e in grupo)
        cuerpo = [f"# {m['categoria']}", "", AVISO.replace("../README.md", "../../README.md"), "",
                  f"**{len(grupo)}** empresas · {m['pct']}% del total · puntaje B promedio "
                  f"{md_celda(m['puntaje_promedio'])}", "",
                  "Subindustrias: " + ", ".join(f"{k} ({v})" for k, v in sub.most_common()), "",
                  md_tabla_empresas(grupo), ""]
        (ind_dir / f"{slug}.md").write_text("\n".join(cuerpo), encoding="utf-8")
    (ind_dir / "README.md").write_text("\n".join(indice) + "\n", encoding="utf-8")

    tipos = ["# Empresas B en Chile por tipo de sociedad", "", AVISO, "",
             "El tipo societario se deduce de la razón social (ej. «… SpA»). «Sin dato» = no se encontró la "
             "razón social en fuentes públicas.", "", "| Tipo | Empresas | % |", "|---|---:|---:|"]
    tipos += [f"| {t['categoria']} | {t['empresas']} | {t['pct']}% |" for t in stats["por_tipo_sociedad"]]
    for t in stats["por_tipo_sociedad"]:
        grupo = sorted((e for e in empresas if e["tipo_sociedad"] == t["categoria"]), key=lambda e: e["nombre"])
        tipos += ["", f"## {t['categoria']} ({t['empresas']})", "", md_tabla_empresas(grupo)]
    (DOCS / "tipos_sociedad.md").write_text("\n".join(tipos) + "\n", encoding="utf-8")

    sec = ["# Sectores estratégicos: Data center, Robótica, Salmones y Marítimo", "", AVISO, "",
           "Incluye las principales empresas de cada sector en Chile, sean o no Empresas B "
           "(marcadas con **B**).", ""]
    for s in sectores["sectores"]:
        sec += [f"## {s['nombre']} ({s['total']} empresas, {s['empresas_b']} Empresas B)", ""]
        if s.get("resumen"):
            sec += [s["resumen"], ""]
        sec += ["| Empresa | B | Subsector | Tipo | Región | Ventas / inversión | Controlador | Web |",
                "|---|---|---|---|---|---|---|---|"]
        for e in s["empresas"]:
            eco = e["economia"]
            cifra = lista(eco.get("ventas_reportadas"), "valor", "periodo") or \
                lista(eco.get("inversion_anunciada"), "valor", "fecha")
            sec.append("| " + " | ".join([
                md_celda(e["nombre"]), "**B**" if e["es_empresa_b"] else "", md_celda(e.get("subsector")),
                md_celda(e.get("tipo_sociedad")), md_celda(e.get("region")), md_celda(cifra or None),
                md_celda(e["propiedad"].get("controlador")),
                md_link("sitio", e["contactos"].get("sitio_web")) if e["contactos"].get("sitio_web") else "—",
            ]) + " |")
        if s.get("fuentes"):
            sec += ["", "Fuentes del resumen: " + " · ".join(f"<{u}>" for u in s["fuentes"])]
        sec.append("")
    (DOCS / "sectores_estrategicos.md").write_text("\n".join(sec) + "\n", encoding="utf-8")

    peores = peor_rendimiento(empresas)
    rev = sum(1 for e in empresas if (e.get("rendimiento") or {}).get("nivel") != "sin_revisar")
    doc = ["# Empresas B con peor rendimiento económico", "", AVISO, "",
           "Empresas con **señales económicas negativas publicadas** por fuentes confiables (prensa económica, "
           "Boletín Concursal, CMF, Poder Judicial o la propia empresa):", "",
           "- **Crítico**: liquidación o quiebra, reorganización judicial o cierre total confirmado.",
           "- **Negativo**: pérdidas, cierre de operaciones, despidos o reestructuración, deuda impaga o rescate "
           "financiero en los últimos tres años.",
           "- **En observación**: ventas o utilidades a la baja sin pérdidas, o problemas anteriores ya superados.",
           "", f"Revisadas: **{rev}** de {len(empresas)} empresas. Que una empresa no aparezca aquí no significa que le "
           "vaya bien: la mayoría no publica estados financieros. El cruce con el tramo de ventas del SII completará "
           "este análisis.", ""]
    for nivel in NIVELES_PEOR:
        grupo = [e for e in peores if e["rendimiento"]["nivel"] == nivel]
        doc += [f"## {NIVEL_REND[nivel]} ({len(grupo)})", ""]
        if not grupo:
            doc += ["Ninguna empresa con señales de este nivel en las fuentes revisadas.", ""]
            continue
        doc += ["| Empresa | Industria | Señales (fecha) | Contexto | Confianza | Fuentes |", "|---|---|---|---|---|---|"]
        for e in grupo:
            r = e["rendimiento"]
            fuentes = " ".join(f"[{i + 1}]({s['fuente']})" for i, s in enumerate(r["senales"]))
            doc.append("| " + " | ".join([
                md_link(e["nombre"], e.get("url_blab")), md_celda(e.get("industria") or e["macro_industria"]),
                md_celda(senales_txt(r["senales"])), md_celda(contexto_rend(r)), md_celda(r.get("confianza")),
                fuentes or "—"]) + " |")
        doc.append("")
    (DOCS / "peor_rendimiento.md").write_text("\n".join(doc) + "\n", encoding="utf-8")


def peor_rendimiento(empresas: list[dict]) -> list[dict]:
    """Empresas con señales negativas, de la más grave y reciente a la menos."""
    con = [e for e in empresas if (e.get("rendimiento") or {}).get("nivel") in NIVELES_PEOR]
    con.sort(key=lambda e: str((e["rendimiento"]["senales"] or [{}])[0].get("fecha") or ""), reverse=True)
    return sorted(con, key=lambda e: ORDEN_NIVEL[e["rendimiento"]["nivel"]])


def actualizar_readme(stats: dict, sectores: dict, generado: str) -> None:
    """Reescribe el bloque de cifras del README (entre los marcadores cifras:inicio / cifras:fin)."""
    ruta = ROOT / "README.md"
    if not ruta.exists():
        return
    t, cob, total = stats, stats["cobertura"], stats["total"]
    p = lambda n: f"{pct(n, total):g}%"
    lineas = [
        f"Actualizado el **{generado}**.", "",
        f"- **{total} Empresas B** en el directorio: **{t['sede_en_chile']}** con sede en Chile y "
        f"{total - t['sede_en_chile']} con sede en el extranjero que operan en Chile.",
        f"- Puntaje B promedio **{t['puntaje_b']['promedio']}** (mediana {t['puntaje_b']['mediana']}; "
        f"rango {t['puntaje_b']['minimo']}–{t['puntaje_b']['maximo']}).",
        "- Tipo de sociedad: " + ", ".join(f"{x['categoria']} {x['empresas']} ({x['pct']}%)"
                                           for x in t["por_tipo_sociedad"]) + ".",
        "- Sectores estratégicos: " + ", ".join(f"{s['nombre']} {s['total']} ({s['empresas_b']} B)"
                                               for s in sectores["sectores"]) + ".",
        "- [Peor rendimiento económico](docs/peor_rendimiento.md): " + ", ".join(
            f"{x['categoria']} {x['empresas']}" for x in t["por_rendimiento"]) + ".",
        "", "| Industria | Empresas | % |", "|---|---:|---:|",
        *[f"| {m['categoria']} | {m['empresas']} | {m['pct']}% |" for m in t["por_macro_industria"]],
        "", "**Cobertura de datos** (empresas con el dato, sobre el total):", "",
        "| Dato | Empresas | % |", "|---|---:|---:|",
        *[f"| {nombre} | {cob[k]} | {p(cob[k])} |" for k, nombre in (
            ("puntaje_b", "Puntaje B"), ("areas", "Desglose por área de impacto"),
            ("tipo_sociedad", "Tipo de sociedad"), ("razon_social", "Razón social"), ("rut", "RUT validado"),
            ("sitio_web", "Sitio web"), ("email", "Email corporativo"), ("telefono", "Teléfono"),
            ("direccion", "Dirección"), ("linkedin", "LinkedIn de la empresa"), ("personas", "Líderes"),
            ("economia", "Datos económicos"), ("propiedad", "Propiedad"))],
    ]
    texto = ruta.read_text(encoding="utf-8")
    nuevo = re.sub(r"(<!-- cifras:inicio -->).*?(<!-- cifras:fin -->)",
                   lambda m: m.group(1) + "\n" + "\n".join(lineas) + "\n" + m.group(2), texto, flags=re.S)
    ruta.write_text(nuevo, encoding="utf-8")


# ---------------------------------------------------------------------------

def main() -> None:
    maestro = json.loads((DATA / "empresas_b_chile.json").read_text(encoding="utf-8"))
    sectores = json.loads((DATA / "sectores_estrategicos.json").read_text(encoding="utf-8"))
    empresas = maestro["empresas"]

    filas = [fila_csv(e) for e in empresas]
    escribir_csv(DATA / "empresas_b_chile.csv", filas)
    limpiar_dir(DATA / "por_industria")
    for macro in MACROS:
        sub = [fila_csv(e) for e in empresas if e["macro_industria"] == macro]
        if sub:
            escribir_csv(DATA / "por_industria" / f"{slugify(macro)}.csv", sub)
    limpiar_dir(DATA / "por_tipo_sociedad")
    for tipo in TIPOS_SOCIEDAD:
        sub = [fila_csv(e) for e in empresas if e["tipo_sociedad"] == tipo]
        if sub:
            escribir_csv(DATA / "por_tipo_sociedad" / f"{slugify(tipo)}.csv", sub)
    escribir_csv(DATA / "peor_rendimiento.csv", [fila_csv(e) for e in peor_rendimiento(empresas)])
    limpiar_dir(DATA / "sectores_estrategicos")
    filas_sector = []
    for s in sectores["sectores"]:
        sub = [fila_sector(e, s["nombre"]) for e in s["empresas"]]
        filas_sector += sub
        escribir_csv(DATA / "sectores_estrategicos" / f"{s['id']}.csv", sub)

    stats = {"generado": maestro["generado"], "todas": estadisticas(empresas),
             "sede_en_chile": estadisticas([e for e in empresas if e["sede_en_chile"]])}
    (DATA / "estadisticas.json").write_text(json.dumps(stats, ensure_ascii=False, indent=1), encoding="utf-8")

    try:
        import pandas as pd
        with pd.ExcelWriter(DATA / "empresas_b_chile.xlsx", engine="openpyxl") as xw:
            pd.DataFrame(filas).to_excel(xw, sheet_name="Empresas B", index=False)
            pd.DataFrame(stats["todas"]["por_macro_industria"]).drop(columns=["areas_promedio"]).to_excel(
                xw, sheet_name="Por industria", index=False)
            pd.DataFrame(stats["todas"]["por_tipo_sociedad"]).to_excel(xw, sheet_name="Por tipo de sociedad", index=False)
            pd.DataFrame(stats["todas"]["por_region"]).to_excel(xw, sheet_name="Por región", index=False)
            if filas_sector:
                pd.DataFrame(filas_sector).to_excel(xw, sheet_name="Sectores estratégicos", index=False)
    except ImportError:
        print("pandas/openpyxl no disponibles: se omite el .xlsx")

    escribir_docs(empresas, stats["todas"], sectores)
    actualizar_readme(stats["todas"], sectores, maestro["generado"])

    WEB.mkdir(parents=True, exist_ok=True)
    # El sitio no necesita las notas internas de investigación (quedan en data/empresas_b_chile.json).
    publico = [{k: v for k, v in e.items() if not k.startswith("_") and k not in ("notas", "rut_descartado")}
               for e in empresas]
    (WEB / "empresas.json").write_text(json.dumps(publico, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (WEB / "sectores.json").write_text(json.dumps(sectores, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    for archivo in ("empresas_b_chile.csv", "empresas_b_chile.xlsx"):
        if (DATA / archivo).exists():
            shutil.copyfile(DATA / archivo, WEB / archivo)
    meta = {k: maestro[k] for k in ("titulo", "generado", "total", "sede_en_chile", "cruce_sii", "enriquecidas_apollo")}
    meta["cobertura"] = stats["todas"]["cobertura"]
    (WEB / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Exportadas {len(empresas)} empresas · {len(filas_sector)} filas de sectores · "
          f"{len(stats['todas']['por_macro_industria'])} industrias")


if __name__ == "__main__":
    main()
