"""Cruce con la Nómina de Personas Jurídicas del SII (tramo de ventas y trabajadores por RUT).

Fuente: https://www.sii.cl/sobre_el_sii/nominapersonasjuridicas.html (archivos .txt/.zip anuales).
El SII no publica estados financieros de empresas privadas; esta nómina es la fuente oficial pública
del tamaño de cada empresa: tramo de ventas anuales en UF, número de trabajadores, rubro y comuna.

Uso:
  python3 scripts/sii_nomina.py                      # descarga la nómina más reciente (requiere acceso a sii.cl)
  python3 scripts/sii_nomina.py --archivo nomina.zip # usa un archivo descargado a mano (.zip, .txt o .csv)
Luego:
  python3 scripts/consolidar.py && python3 scripts/exportar.py

Salida: data/raw/sii/cruce_sii.json  {"76.123.456-7": {...}} solo para los RUT del directorio.
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import re
import sys
import urllib.request
import zipfile
from pathlib import Path

from normalizacion import TRAMOS_SII, clave, normalizar_rut

ROOT = Path(__file__).resolve().parent.parent
PAGINA = "https://www.sii.cl/sobre_el_sii/nominapersonasjuridicas.html"
SALIDA = ROOT / "data" / "raw" / "sii" / "cruce_sii.json"

# Columnas esperadas (se buscan por coincidencia parcial del encabezado normalizado)
COLUMNAS = {
    "anio": ("ano comercial", "anio comercial", "ano"),
    "rut": ("rut",),
    "dv": ("dv", "digito verificador"),
    "razon_social": ("razon social", "nombre"),
    "tramo": ("tramo segun ventas", "tramo ventas", "tramo de ventas"),
    "trabajadores": ("numero de trabajadores", "n trabajadores", "trabajadores dependientes", "trabajadores"),
    "region": ("region",),
    "comuna": ("comuna",),
    "rubro": ("rubro economico", "rubro"),
    "actividad": ("actividad economica", "actividad"),
    "inicio": ("fecha inicio de actividades", "inicio de actividades"),
    "termino": ("fecha termino de giro", "termino de giro"),
}


def descargar_ultima() -> tuple[bytes, str]:
    html = urllib.request.urlopen(PAGINA, timeout=60).read().decode("latin-1", "replace")
    enlaces = re.findall(r'href="([^"]+\.(?:zip|txt|csv))"', html, re.I)
    if not enlaces:
        sys.exit(f"No se encontraron archivos en {PAGINA}; descárgalo a mano y usa --archivo.")

    def anio(u: str) -> int:
        m = re.findall(r"(20\d{2})", u)
        return int(m[-1]) if m else 0

    url = max(enlaces, key=anio)
    if url.startswith("/"):
        url = "https://www.sii.cl" + url
    elif not url.startswith("http"):
        url = PAGINA.rsplit("/", 1)[0] + "/" + url
    print(f"Descargando {url}")
    return urllib.request.urlopen(url, timeout=600).read(), url


def abrir_texto(datos: bytes, nombre: str) -> io.TextIOBase:
    if nombre.lower().endswith(".zip") or datos[:2] == b"PK":
        z = zipfile.ZipFile(io.BytesIO(datos))
        interno = max(z.namelist(), key=lambda n: z.getinfo(n).file_size)
        datos = z.read(interno)
    for cod in ("utf-8-sig", "latin-1"):
        try:
            return io.StringIO(datos.decode(cod))
        except UnicodeDecodeError:
            continue
    raise ValueError("Codificación desconocida")


def mapear_columnas(encabezado: list[str]) -> dict[str, int]:
    norm = [clave(h) for h in encabezado]
    idx = {}
    for campo, opciones in COLUMNAS.items():
        for op in opciones:
            hit = next((i for i, h in enumerate(norm) if h == op or h.startswith(op)), None)
            if hit is not None:
                idx[campo] = hit
                break
    faltan = {"rut", "dv", "tramo"} - idx.keys()
    if faltan:
        raise ValueError(f"No se reconocieron las columnas {faltan} en el encabezado: {encabezado}")
    return idx


def etiqueta_tramo(valor: str) -> str | None:
    v = (valor or "").strip()
    if v.isdigit() and int(v) in TRAMOS_SII:
        nombre, desde, hasta = TRAMOS_SII[int(v)]
        if desde is None:
            return nombre
        rango = f"{desde:,.0f}–{hasta:,.0f} UF" if hasta else f"más de {desde - 0.01:,.0f} UF"
        return f"{nombre} ({rango.replace(',', '.')})"
    return v or None


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--archivo", help="Nómina descargada a mano (.zip, .txt o .csv)")
    args = ap.parse_args()

    if args.archivo:
        datos, fuente = Path(args.archivo).read_bytes(), PAGINA
        nombre = args.archivo
    else:
        datos, fuente = descargar_ultima()
        nombre = fuente

    maestro = json.loads((ROOT / "data" / "empresas_b_chile.json").read_text(encoding="utf-8"))
    ruts = {e["rut"] for e in maestro["empresas"] if e.get("rut")}
    razones = {clave(e["razon_social"]): e["id"] for e in maestro["empresas"] if e.get("razon_social") and not e.get("rut")}

    texto = abrir_texto(datos, nombre)
    muestra = texto.readline()
    delim = max(("\t", ";", ",", "|"), key=muestra.count)
    texto.seek(0)
    lector = csv.reader(texto, delimiter=delim)
    idx = mapear_columnas(next(lector))

    cruce, por_razon = {}, {}
    for fila in lector:
        try:
            rut = normalizar_rut(f"{fila[idx['rut']]}-{fila[idx['dv']]}")
        except IndexError:
            continue
        if not rut:
            continue
        def col(c):
            return fila[idx[c]].strip() if c in idx and idx[c] < len(fila) else None
        registro = {
            "razon_social": col("razon_social"),
            "anio_comercial": col("anio"),
            "tramo_ventas": etiqueta_tramo(col("tramo")),
            "trabajadores": col("trabajadores"),
            "region": col("region"), "comuna": col("comuna"),
            "rubro": col("rubro"), "actividad": col("actividad"),
            "inicio_actividades": col("inicio"), "termino_giro": col("termino"),
            "fuente": f"SII, Nómina de Personas Jurídicas ({col('anio') or 'último año disponible'})",
        }
        if rut in ruts:
            # Si hay varios años, conservar el más reciente
            previo = cruce.get(rut)
            if not previo or (registro["anio_comercial"] or "") >= (previo["anio_comercial"] or ""):
                cruce[rut] = registro
        elif razones and clave(registro["razon_social"]) in razones:
            por_razon.setdefault(clave(registro["razon_social"]), []).append((rut, registro))

    # Coincidencia exacta y única por razón social para empresas sin RUT conocido (se marca como tal)
    sugeridos = {}
    for k, filas in por_razon.items():
        distintos = {r for r, _ in filas}
        if len(distintos) == 1:
            rut, reg = filas[-1]
            sugeridos[razones[k]] = {"rut": rut, **reg, "metodo": "razón social exacta"}

    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    SALIDA.write_text(json.dumps(cruce, ensure_ascii=False, indent=1), encoding="utf-8")
    (SALIDA.parent / "sugeridos_por_razon_social.json").write_text(
        json.dumps(sugeridos, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Cruce SII: {len(cruce)} de {len(ruts)} RUT del directorio · {len(sugeridos)} sugeridos por razón social")


if __name__ == "__main__":
    main()
