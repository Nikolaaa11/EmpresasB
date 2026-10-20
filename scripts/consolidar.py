"""Consolida la investigación en bruto de data/raw/ en los archivos maestros:

  data/empresas_b_chile.json        directorio de Empresas B (una fila por empresa)
  data/sectores_estrategicos.json   Data center, Robótica, Salmones y Marítimo

Entradas (todas opcionales salvo la primera):
  data/raw/blab/*.json              listados del directorio B Lab (agentes de recolección)
  data/raw/enriquecimiento/*.json   razón social, RUT, contactos, economía, propiedad
  data/raw/sectores/*.json          investigación de los sectores estratégicos
  data/raw/sii/cruce_sii.json       cruce por RUT con la Nómina de Personas Jurídicas del SII
  data/raw/apollo/*.json            enriquecimiento de empresa desde Apollo.io

Uso:  python3 scripts/consolidar.py
"""
from __future__ import annotations

import collections
import datetime as dt
import glob
import json
import re
from pathlib import Path

from normalizacion import (
    NOMBRE_SECCION, clave, fecha_mes, industria_es, limpiar, macro_industria, normalizar_rut, numero, pais,
    region_de, secciones_de, slug_blab, slugify, tamano_sii_grupo, tipo_sociedad, url_blab_canonica,
)

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
HOY = dt.date.today().isoformat()
RANGO_CONFIANZA = {"alta": 3, "media": 2, "baja": 1}
AREAS = ("gobernanza", "trabajadores", "comunidad", "medio_ambiente", "clientes")
CAMPOS_CONTACTO = ("sitio_web", "email", "telefono", "whatsapp", "direccion", "comuna", "region",
                   "linkedin", "instagram", "facebook", "x", "youtube")
EMAIL_GENERICO = ("contacto", "contact", "info", "hola", "hello", "hi", "ventas", "venta", "sales", "comercial",
                  "admin", "administracion", "gerencia", "recepcion", "prensa", "press", "comunicaciones",
                  "marketing", "rrhh", "personas", "talento", "trabaja", "empleo", "soporte", "support",
                  "ayuda", "help", "clientes", "servicio", "atencion", "reservas", "booking", "consultas",
                  "oficina", "office", "general", "secretaria", "proyectos", "sustentabilidad", "impacto",
                  "partners", "negocios", "business", "inversionistas", "investor", "pedidos", "tienda", "shop",
                  "store", "web", "mail", "correo", "team", "equipo", "somos", "pagos", "facturacion")


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------

def leer_json(ruta: str | Path):
    with open(ruta, encoding="utf-8") as f:
        return json.load(f)


def elegir(candidatos: list[tuple[int, object]]):
    """Elige el valor con mayor confianza; a igualdad, el más frecuente y luego el más largo."""
    validos = [(c, v) for c, v in candidatos if limpiar(v) is not None]
    if not validos:
        return None
    frecuencia = collections.Counter(json.dumps(v, sort_keys=True, ensure_ascii=False) for _, v in validos)
    return max(validos, key=lambda cv: (cv[0], frecuencia[json.dumps(cv[1], sort_keys=True, ensure_ascii=False)],
                                        len(str(cv[1]))))[1]


def unicos(items):
    vistos, salida = set(), []
    for x in items:
        if x and x not in vistos:
            vistos.add(x)
            salida.append(x)
    return salida


def url(valor, dominio_requerido: str | None = None) -> str | None:
    valor = limpiar(valor)
    if not valor or not isinstance(valor, str):
        return None
    v = valor.strip().rstrip(".,;")
    if " " in v:
        return None
    if not re.match(r"^https?://", v, re.I):
        if not re.match(r"^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(/.*)?$", v, re.I):
            return None
        v = "https://" + v
    if dominio_requerido and dominio_requerido not in v.lower():
        return None
    return v


def dominio(sitio: str | None) -> str | None:
    if not sitio:
        return None
    m = re.match(r"^https?://(?:www\.)?([^/?#]+)", sitio, re.I)
    return m.group(1).lower() if m else None


def email_corporativo(valor, sitio: str | None) -> str | None:
    """Acepta solo emails genéricos de la empresa (privacidad: el directorio es público)."""
    valor = limpiar(valor)
    if not valor or not isinstance(valor, str):
        return None
    m = re.search(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", valor)
    if not m:
        return None
    email = m.group(0).lower()
    local, dom = email.split("@", 1)
    marca = (dominio(sitio) or dom).split(".")[0]
    if any(g in local for g in EMAIL_GENERICO) or (marca and len(marca) > 2 and marca in local):
        return email
    return None


def telefono(valor) -> str | None:
    valor = limpiar(valor)
    if not valor:
        return None
    t = re.sub(r"[^\d+]", " ", str(valor))
    t = re.sub(r"\s+", " ", t).strip()
    return t if len(re.sub(r"\D", "", t)) >= 8 else None


# ---------------------------------------------------------------------------
# 1. Listados B Lab
# ---------------------------------------------------------------------------

def cargar_enumeracion():
    grupos: dict[str, list[dict]] = collections.OrderedDict()
    nombre_a_id: dict[str, str] = {}
    sin_ficha: list[dict] = []
    verificaciones: dict[str, dict] = {}
    for ruta in sorted(glob.glob(str(RAW / "blab" / "*.json"))):
        datos = leer_json(ruta)
        for v in datos.get("verificadas") or []:
            verificaciones[clave(v.get("nombre"))] = v
        for e in datos.get("empresas") or []:
            e = dict(e, _segmento=datos.get("segmento"))
            sid = slug_blab(e.get("url_blab"))
            if sid:
                grupos.setdefault(sid, []).append(e)
                nombre_a_id.setdefault(clave(e.get("nombre")), sid)
            else:
                sin_ficha.append(e)
    pendientes = []
    for e in sin_ficha:
        k = clave(e.get("nombre"))
        v = verificaciones.get(k, {})
        sid = nombre_a_id.get(k) or slug_blab(v.get("url_blab"))
        if sid:
            grupos.setdefault(sid, []).append(e)
        else:
            pendientes.append({"nombre": e.get("nombre"), "motivo": "sin ficha B Lab confirmada",
                               "fuentes": e.get("fuentes") or []})
    return grupos, pendientes


def fusionar_listado(sid: str, registros: list[dict]) -> dict:
    def cand(campo):
        return [(RANGO_CONFIANZA.get(r.get("confianza"), 1), r.get(campo)) for r in registros]

    areas = {}
    for a in AREAS:
        areas[a] = numero(elegir([(RANGO_CONFIANZA.get(r.get("confianza"), 1), (r.get("areas") or {}).get(a))
                                  for r in registros if isinstance(r.get("areas"), dict)]))
    opera = unicos(pais(p) for r in registros for p in (r.get("opera_en") or []) if isinstance(p, str))
    return {
        "id": sid,
        "nombre": limpiar(elegir(cand("nombre"))),
        "url_blab": url_blab_canonica(sid),
        "industria_blab": limpiar(elegir(cand("industria"))),
        "sector_blab": limpiar(elegir(cand("sector"))),
        "sede": limpiar(elegir(cand("sede"))),
        "pais_sede": pais(elegir(cand("pais_sede"))),
        "opera_en": opera,
        "certificada_desde": fecha_mes(elegir(cand("certificada_desde"))),
        "puntaje_b": numero(elegir(cand("puntaje_b"))),
        "areas": areas,
        "sitio_web": url(elegir(cand("sitio_web"))),
        "descripcion": limpiar(elegir(cand("descripcion"))),
        "tamano_empleados": limpiar(elegir(cand("tamano"))),
        "estado_b": limpiar(elegir(cand("estado"))) or "certificada",
        "_segmentos": unicos(r.get("_segmento") for r in registros),
        "fuentes": unicos(f for r in registros for f in (r.get("fuentes") or []) if isinstance(f, str)),
    }


# ---------------------------------------------------------------------------
# 2. Enriquecimiento
# ---------------------------------------------------------------------------

def cargar_enriquecimiento() -> dict[str, dict]:
    salida: dict[str, dict] = {}
    for ruta in sorted(glob.glob(str(RAW / "enriquecimiento" / "*.json"))):
        for e in leer_json(ruta).get("empresas") or []:
            if e.get("id"):
                salida[e["id"]] = e
    return salida


def limpiar_personas(personas) -> list[dict]:
    salida = []
    for p in personas or []:
        if not isinstance(p, dict) or not limpiar(p.get("nombre")):
            continue
        salida.append({
            "nombre": limpiar(p.get("nombre")),
            "cargo": limpiar(p.get("cargo")),
            "linkedin": url(p.get("linkedin"), "linkedin.com"),
            "fuente": url(p.get("fuente")),
        })
    vistos, unicas = set(), []
    for p in salida:
        k = clave(p["nombre"])
        if k not in vistos:
            vistos.add(k)
            unicas.append(p)
    return unicas[:8]


def limpiar_lista(items, campos) -> list[dict]:
    salida = []
    for it in items or []:
        if not isinstance(it, dict):
            continue
        fila = {c: (url(it.get(c)) if c == "fuente" else limpiar(it.get(c))) for c in campos}
        if any(v for k, v in fila.items() if k != "fuente"):
            salida.append(fila)
    return salida


def limpiar_socios(socios) -> list[dict]:
    salida = []
    for s in socios or []:
        if not isinstance(s, dict) or not limpiar(s.get("nombre")):
            continue
        pct = numero(s.get("porcentaje"))
        salida.append({"nombre": limpiar(s.get("nombre")),
                       "porcentaje": pct if pct is not None and 0 < pct <= 100 else None,
                       "fuente": url(s.get("fuente"))})
    return salida


def aplicar_enriquecimiento(emp: dict, enr: dict | None) -> None:
    enr = enr or {}
    contactos_enr = enr.get("contactos") or {}
    sitio = url(contactos_enr.get("sitio_web")) or emp.get("sitio_web")
    contactos = {
        "sitio_web": sitio,
        "email": email_corporativo(contactos_enr.get("email"), sitio),
        "telefono": telefono(contactos_enr.get("telefono")),
        "whatsapp": telefono(contactos_enr.get("whatsapp")),
        "direccion": limpiar(contactos_enr.get("direccion")),
        "comuna": limpiar(contactos_enr.get("comuna")),
        "linkedin": url(contactos_enr.get("linkedin"), "linkedin.com"),
        "instagram": url(contactos_enr.get("instagram"), "instagram.com"),
        "facebook": url(contactos_enr.get("facebook"), "facebook.com"),
        "x": url(contactos_enr.get("x")),
        "youtube": url(contactos_enr.get("youtube"), "youtube.com"),
    }
    emp.pop("sitio_web", None)
    emp["contactos"] = contactos

    emp["razon_social"] = limpiar(enr.get("razon_social"))
    emp["rut"] = normalizar_rut(enr.get("rut"))
    emp["rut_descartado"] = bool(limpiar(enr.get("rut")) and not emp["rut"])
    emp["giro"] = limpiar(enr.get("giro"))

    # Datos B Lab que el enriquecimiento haya completado
    blab = enr.get("blab") or {}
    for campo, destino in (("industria", "industria_blab"), ("sector", "sector_blab"), ("tamano", "tamano_empleados")):
        if not emp.get(destino) and limpiar(blab.get(campo)):
            emp[destino] = limpiar(blab.get(campo))
    if emp.get("puntaje_b") is None and numero(blab.get("puntaje_b")) is not None:
        emp["puntaje_b"] = numero(blab.get("puntaje_b"))
    for a in AREAS:
        if emp["areas"].get(a) is None and isinstance(blab.get("areas"), dict):
            emp["areas"][a] = numero(blab["areas"].get(a))

    eco = enr.get("economia") or {}
    emp["economia"] = {
        "tamano_sii": limpiar(eco.get("tamano_sii")),
        "tamano_sii_grupo": tamano_sii_grupo(eco.get("tamano_sii")),
        "tramo_ventas_sii": None,
        "trabajadores_sii": None,
        "fuente_sii": None,
        "ventas_reportadas": limpiar_lista(eco.get("ventas_reportadas"), ("valor", "periodo", "fuente")),
        "trabajadores": limpiar(eco.get("trabajadores")),
        "financiamiento": limpiar_lista(eco.get("financiamiento"), ("descripcion", "fecha", "fuente")),
        "cotiza_en_bolsa": eco.get("cotiza_en_bolsa") if isinstance(eco.get("cotiza_en_bolsa"), bool) else None,
        "resumen": limpiar(eco.get("resumen")),
    }
    prop = enr.get("propiedad") or {}
    emp["propiedad"] = {
        "controlador": limpiar(prop.get("controlador")),
        "grupo_empresarial": limpiar(prop.get("grupo_empresarial")),
        "socios": limpiar_socios(prop.get("socios")),
        "notas": limpiar(prop.get("notas")),
    }
    emp["personas"] = limpiar_personas(enr.get("personas"))
    emp["notas"] = limpiar(enr.get("notas"))
    emp["fuentes"] = unicos(emp["fuentes"] + [f for f in (enr.get("fuentes") or []) if isinstance(f, str)])
    emp["_contacto_region"] = limpiar(contactos_enr.get("region"))
    emp["enriquecida"] = bool(enr)


# ---------------------------------------------------------------------------
# 3. Fuentes opcionales: SII y Apollo
# ---------------------------------------------------------------------------

def aplicar_sii(empresas: list[dict]) -> int:
    ruta = RAW / "sii" / "cruce_sii.json"
    if not ruta.exists():
        return 0
    cruce = leer_json(ruta)
    n = 0
    for emp in empresas:
        fila = cruce.get(emp.get("rut") or "")
        if not fila:
            continue
        eco = emp["economia"]
        eco["tramo_ventas_sii"] = fila.get("tramo_ventas")
        eco["tamano_sii"] = fila.get("tramo_ventas") or eco["tamano_sii"]
        eco["tamano_sii_grupo"] = tamano_sii_grupo(fila.get("tramo_ventas")) or eco["tamano_sii_grupo"]
        eco["trabajadores_sii"] = fila.get("trabajadores")
        eco["fuente_sii"] = fila.get("fuente")
        if not emp.get("razon_social") and fila.get("razon_social"):
            emp["razon_social"] = fila["razon_social"]
        n += 1
    return n


def aplicar_apollo_lookup(empresas: list[dict]) -> int:
    """Completa el sitio web con el lookup gratuito de Apollo (solo coincidencias exactas o probables)."""
    ruta = RAW / "apollo" / "lookup.json"
    if not ruta.exists():
        return 0
    por_id = {o.get("id"): o for o in leer_json(ruta).get("organizaciones") or []
              if o.get("coincidencia") in ("exacta", "probable")}
    n = 0
    for emp in empresas:
        org = por_id.get(emp["id"])
        sitio = url((org or {}).get("sitio_web")) or (url("https://" + org["dominio"]) if org and org.get("dominio") else None)
        if sitio and not emp["contactos"].get("sitio_web"):
            emp["contactos"]["sitio_web"] = sitio
            emp["fuentes"] = unicos(emp["fuentes"] + ["https://www.apollo.io/ (búsqueda de organizaciones)"])
            n += 1
    return n


def aplicar_apollo(empresas: list[dict]) -> int:
    por_dominio = {}
    for ruta in sorted(glob.glob(str(RAW / "apollo" / "enriquecimiento*.json"))):
        for org in leer_json(ruta).get("organizaciones") or []:
            d = (org.get("dominio") or "").lower()
            if d:
                por_dominio[d] = org
    n = 0
    for emp in empresas:
        org = por_dominio.get(dominio(emp["contactos"].get("sitio_web")) or "")
        if not org:
            continue
        c = emp["contactos"]
        c["telefono"] = c["telefono"] or telefono(org.get("telefono"))
        c["linkedin"] = c["linkedin"] or url(org.get("linkedin"), "linkedin.com")
        c["direccion"] = c["direccion"] or limpiar(org.get("direccion"))
        eco = emp["economia"]
        eco["empleados_estimados_apollo"] = org.get("empleados_estimados")
        eco["ingresos_estimados_apollo"] = org.get("ingresos_estimados")
        emp["fuentes"] = unicos(emp["fuentes"] + ["https://www.apollo.io/ (enriquecimiento de empresa)"])
        n += 1
    return n


# ---------------------------------------------------------------------------
# 4. Campos derivados y validaciones
# ---------------------------------------------------------------------------

def validar_puntajes(emp: dict) -> None:
    total = emp.get("puntaje_b")
    if total is not None and not (80 <= total <= 200):
        emp["puntaje_b"] = total = None
    areas = emp["areas"]
    for a in AREAS:
        v = areas.get(a)
        if v is not None and (v < 0 or v > 100 or (total is not None and v > total)):
            areas[a] = None
    presentes = [areas[a] for a in AREAS if areas.get(a) is not None]
    emp["areas_consistentes"] = None
    if total is not None and len(presentes) == len(AREAS):
        suma = sum(presentes)
        emp["areas_consistentes"] = abs(suma - total) <= 2.5
        if not emp["areas_consistentes"]:
            emp["areas"] = {a: None for a in AREAS}
    base = total or (sum(presentes) if len(presentes) == len(AREAS) else None)
    emp["areas_pct"] = {a: (round(areas[a] / base * 100, 1) if base and emp["areas"].get(a) is not None else None)
                        for a in AREAS}


def derivar(emp: dict) -> None:
    emp["pais_sede"] = emp.get("pais_sede") or ("Chile" if region_de(emp.get("sede")) else None)
    emp["sede_en_chile"] = emp["pais_sede"] in (None, "Chile")
    emp["region"] = (region_de(emp.get("sede")) or region_de(emp["contactos"].get("comuna"), emp.get("_contacto_region"),
                                                            emp["contactos"].get("direccion"))
                     if emp["sede_en_chile"] else None)
    if emp["sede_en_chile"] and emp["pais_sede"] is None:
        emp["pais_sede"] = "Chile"
    tipo = tipo_sociedad(emp.get("razon_social"))
    base = "razon_social" if tipo else None
    if not tipo:
        tipo = tipo_sociedad(emp.get("nombre"))
        base = "nombre" if tipo else None
    if not tipo and not emp["sede_en_chile"]:
        tipo, base = "Extranjera", "sede"
    emp["tipo_sociedad"] = tipo or "Sin dato"
    emp["tipo_sociedad_base"] = base
    emp["industria"] = industria_es(emp.get("industria_blab"))
    segmento = (emp.get("_segmentos") or [None])[0]
    emp["macro_industria"], emp["macro_base"] = macro_industria(emp.get("industria_blab"), emp.get("descripcion"),
                                                                segmento)
    cert = emp.get("certificada_desde")
    emp["anio_certificacion"] = int(cert[:4]) if cert and cert[:4].isdigit() else None
    if emp["anio_certificacion"] and not (2007 <= emp["anio_certificacion"] <= dt.date.today().year):
        emp["certificada_desde"] = emp["anio_certificacion"] = None
    emp["secciones"] = secciones_de(emp.get("nombre"), emp.get("industria_blab"), emp.get("descripcion"),
                                    emp.get("giro"))
    validar_puntajes(emp)
    emp["completitud"] = completitud(emp)
    emp["actualizado"] = HOY


def completitud(emp: dict) -> int:
    c = emp["contactos"]
    chequeos = [
        bool(emp.get("razon_social")), bool(emp.get("rut")), emp["tipo_sociedad"] != "Sin dato",
        bool(emp.get("industria_blab")), bool(emp.get("region") or not emp["sede_en_chile"]),
        emp.get("puntaje_b") is not None, any(v is not None for v in emp["areas"].values()),
        bool(c.get("sitio_web")), bool(c.get("email") or c.get("telefono") or c.get("whatsapp")),
        bool(c.get("direccion")), bool(c.get("linkedin") or c.get("instagram")), bool(emp["personas"]),
        bool(emp["economia"].get("tamano_sii") or emp["economia"]["ventas_reportadas"] or
             emp["economia"].get("trabajadores") or emp["economia"]["financiamiento"] or emp["economia"].get("resumen")),
        bool(emp["propiedad"].get("controlador") or emp["propiedad"]["socios"] or emp["propiedad"].get("grupo_empresarial")),
    ]
    return round(sum(chequeos) / len(chequeos) * 100)


def maestro_sede_chile(p: dict) -> bool:
    return p.get("pais_sede") in (None, "Chile")


ORDEN_CAMPOS = [
    "id", "nombre", "razon_social", "rut", "tipo_sociedad", "tipo_sociedad_base", "giro",
    "macro_industria", "macro_base", "industria", "industria_blab", "sector_blab", "secciones",
    "sede", "region", "pais_sede", "sede_en_chile", "opera_en",
    "estado_b", "certificada_desde", "anio_certificacion", "puntaje_b", "areas", "areas_pct", "areas_consistentes",
    "tamano_empleados", "descripcion", "economia", "propiedad", "contactos", "personas",
    "url_blab", "completitud", "enriquecida", "rut_descartado", "notas", "fuentes", "actualizado",
]


def ordenar(emp: dict) -> dict:
    return {k: emp.get(k) for k in ORDEN_CAMPOS}


# ---------------------------------------------------------------------------
# 5. Sectores estratégicos
# ---------------------------------------------------------------------------

SECTOR_ARCHIVO = {"data-center": "data_center", "robotica": "robotica", "salmones": "salmones", "maritimo": "maritimo"}


def consolidar_sectores(empresas_b: list[dict]) -> dict:
    por_nombre_b = {clave(e["nombre"]): e for e in empresas_b}
    por_razon_b = {clave(e["razon_social"]): e for e in empresas_b if e.get("razon_social")}
    sectores = []
    for sector_id, nombre in NOMBRE_SECCION.items():
        ruta = RAW / "sectores" / f"sector_{SECTOR_ARCHIVO[sector_id]}.json"
        datos = leer_json(ruta) if ruta.exists() else {}
        filas, vistos = [], set()
        for e in datos.get("empresas") or []:
            nom = limpiar(e.get("nombre"))
            if not nom or clave(nom) in vistos:
                continue
            vistos.add(clave(nom))
            b = por_nombre_b.get(clave(nom)) or por_razon_b.get(clave(e.get("razon_social")))
            sid = slug_blab(e.get("url_blab"))
            es_b = bool(b) or (bool(e.get("es_empresa_b")) and bool(sid))
            sitio = url(e.get("sitio_web")) or url((e.get("contactos") or {}).get("sitio_web"))
            cont = e.get("contactos") or {}
            eco = e.get("economia") or {}
            prop = e.get("propiedad") or {}
            filas.append({
                "id": slugify(nom),
                "nombre": nom,
                "razon_social": limpiar(e.get("razon_social")),
                "rut": normalizar_rut(e.get("rut")),
                "tipo_sociedad": tipo_sociedad(e.get("razon_social"), nom) or limpiar(e.get("tipo_sociedad")) or "Sin dato",
                "subsector": limpiar(e.get("subsector")),
                "descripcion": limpiar(e.get("descripcion")),
                "sede": limpiar(e.get("sede")),
                "region": region_de(e.get("region"), e.get("sede"), cont.get("direccion")) or limpiar(e.get("region")),
                "es_empresa_b": es_b,
                "url_blab": (b or {}).get("url_blab") or url_blab_canonica(sid) if es_b else None,
                "id_empresa_b": (b or {}).get("id"),
                "contactos": {
                    "sitio_web": sitio,
                    "email": email_corporativo(cont.get("email"), sitio),
                    "telefono": telefono(cont.get("telefono")),
                    "direccion": limpiar(cont.get("direccion")),
                    "linkedin": url(cont.get("linkedin"), "linkedin.com"),
                    "instagram": url(cont.get("instagram"), "instagram.com"),
                },
                "personas": limpiar_personas(e.get("personas")),
                "economia": {
                    "ventas_reportadas": limpiar_lista(eco.get("ventas_reportadas"), ("valor", "periodo", "fuente")),
                    "inversion_anunciada": limpiar_lista(eco.get("inversion_anunciada"),
                                                         ("valor", "descripcion", "fecha", "fuente")),
                    "capacidad": limpiar(eco.get("capacidad")),
                    "trabajadores": limpiar(eco.get("trabajadores")),
                    "cotiza_en_bolsa": eco.get("cotiza_en_bolsa") if isinstance(eco.get("cotiza_en_bolsa"), bool) else None,
                    "resumen": limpiar(eco.get("resumen")),
                },
                "propiedad": {
                    "controlador": limpiar(prop.get("controlador")),
                    "socios": limpiar_socios(prop.get("socios")),
                    "notas": limpiar(prop.get("notas")),
                },
                "fuentes": unicos(f for f in (e.get("fuentes") or []) if isinstance(f, str)),
            })
        # Empresas B del directorio que también pertenecen al sector
        for b in empresas_b:
            if sector_id in b["secciones"] and clave(b["nombre"]) not in vistos:
                vistos.add(clave(b["nombre"]))
                filas.append({
                    "id": b["id"], "nombre": b["nombre"], "razon_social": b.get("razon_social"), "rut": b.get("rut"),
                    "tipo_sociedad": b["tipo_sociedad"], "subsector": b.get("industria"),
                    "descripcion": b.get("descripcion"), "sede": b.get("sede"), "region": b.get("region"),
                    "es_empresa_b": True, "url_blab": b["url_blab"], "id_empresa_b": b["id"],
                    "contactos": {k: b["contactos"].get(k) for k in ("sitio_web", "email", "telefono", "direccion",
                                                                     "linkedin", "instagram")},
                    "personas": b["personas"],
                    "economia": {"ventas_reportadas": b["economia"]["ventas_reportadas"], "inversion_anunciada": [],
                                 "capacidad": None, "trabajadores": b["economia"].get("trabajadores"),
                                 "cotiza_en_bolsa": b["economia"].get("cotiza_en_bolsa"),
                                 "resumen": b["economia"].get("resumen")},
                    "propiedad": {k: b["propiedad"].get(k) for k in ("controlador", "socios", "notas")},
                    "fuentes": b["fuentes"],
                })
        filas.sort(key=lambda f: (not f["es_empresa_b"], clave(f["nombre"])))
        sectores.append({
            "id": sector_id,
            "nombre": nombre,
            "resumen": limpiar(datos.get("resumen_sector")),
            "fuentes": unicos(f for f in (datos.get("fuentes_resumen") or []) if isinstance(f, str)),
            "total": len(filas),
            "empresas_b": sum(f["es_empresa_b"] for f in filas),
            "empresas": filas,
        })
    return {"generado": HOY, "sectores": sectores}


# ---------------------------------------------------------------------------

def main() -> None:
    grupos, pendientes = cargar_enumeracion()
    enriquecimiento = cargar_enriquecimiento()
    empresas = []
    for sid, registros in grupos.items():
        emp = fusionar_listado(sid, registros)
        if clave(emp.get("estado_b")) not in ("certificada", "certified", "vigente"):
            pendientes.append({"nombre": emp["nombre"], "motivo": f"estado B Lab: {emp.get('estado_b')}",
                               "fuentes": emp["fuentes"]})
            continue
        aplicar_enriquecimiento(emp, enriquecimiento.get(sid))
        empresas.append(emp)
    n_sii = aplicar_sii(empresas)
    n_lookup = aplicar_apollo_lookup(empresas)
    n_apollo = aplicar_apollo(empresas)
    for emp in empresas:
        derivar(emp)
    empresas.sort(key=lambda e: clave(e["nombre"]))
    maestro = {
        "titulo": "Empresas B en Chile",
        "generado": HOY,
        "total": len(empresas),
        "sede_en_chile": sum(e["sede_en_chile"] for e in empresas),
        "cruce_sii": n_sii,
        "enriquecidas_apollo": n_apollo,
        "nota": ("Datos recolectados de fuentes públicas (directorio B Lab, sitios de las empresas, prensa, registros "
                 "públicos). Cada empresa lista sus fuentes. Solo se publican canales de contacto corporativos."),
        "empresas": [ordenar(e) for e in empresas],
        "pendientes_verificacion": pendientes,
    }
    destino = ROOT / "data" / "empresas_b_chile.json"
    destino.write_text(json.dumps(maestro, ensure_ascii=False, indent=1), encoding="utf-8")
    # Cola de trabajo para la siguiente pasada de enriquecimiento (en esta u otra sesión)
    marcas = ("PENDIENTE", "INCOMPLETO", "PARCIAL")
    pendientes_enr = [
        {"id": e["id"], "nombre": e["nombre"], "url_blab": e["url_blab"], "sede": e.get("sede"),
         "pais_sede": e.get("pais_sede"), "industria_blab": e.get("industria_blab"),
         "descripcion": e.get("descripcion"), "sitio_web": e["contactos"].get("sitio_web"),
         "motivo": "sin enriquecer" if not e["enriquecida"] else "enriquecimiento parcial",
         "completitud": e["completitud"]}
        for e in empresas
        if not e["enriquecida"] or any(m in (e.get("notas") or "").upper()[:40] for m in marcas)
    ]
    pendientes_enr.sort(key=lambda p: (not maestro_sede_chile(p), p["completitud"], clave(p["nombre"])))
    (ROOT / "data" / "pendientes_enriquecimiento.json").write_text(
        json.dumps({"generado": HOY, "total": len(pendientes_enr), "empresas": pendientes_enr},
                   ensure_ascii=False, indent=1), encoding="utf-8")
    sectores = consolidar_sectores(maestro["empresas"])
    (ROOT / "data" / "sectores_estrategicos.json").write_text(json.dumps(sectores, ensure_ascii=False, indent=1),
                                                              encoding="utf-8")
    print(f"Empresas B: {len(empresas)} ({maestro['sede_en_chile']} con sede en Chile) · "
          f"enriquecidas: {sum(e['enriquecida'] for e in empresas)} · SII: {n_sii} · "
          f"sitios vía Apollo: {n_lookup} · Apollo enriquecidas: {n_apollo} · sin ficha confirmada: {len(pendientes)} · "
          f"por enriquecer: {len(pendientes_enr)}")
    for s in sectores["sectores"]:
        print(f"  {s['nombre']}: {s['total']} empresas ({s['empresas_b']} B)")


if __name__ == "__main__":
    main()
