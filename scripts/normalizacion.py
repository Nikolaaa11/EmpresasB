"""Funciones de normalización compartidas por los scripts del proyecto.

Todo lo que aquí se infiere (región, macro-industria, tipo societario) se
deriva de datos ya recolectados; nunca se inventan valores.
"""
from __future__ import annotations

import re
import unicodedata

# ---------------------------------------------------------------------------
# Texto
# ---------------------------------------------------------------------------

def sin_tildes(texto: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", texto) if not unicodedata.combining(c))


def clave(texto: str | None) -> str:
    """Clave de comparación: minúsculas, sin tildes ni puntuación."""
    if not texto:
        return ""
    t = sin_tildes(texto).lower()
    t = re.sub(r"[^a-z0-9]+", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def slugify(texto: str) -> str:
    return clave(texto).replace(" ", "-") or "sin-nombre"


def limpiar(valor):
    """Normaliza vacíos: '', 'null', 'N/A', 'no disponible' -> None."""
    if valor is None:
        return None
    if isinstance(valor, str):
        v = valor.strip()
        if not v or clave(v) in {"null", "none", "n a", "na", "no disponible", "sin dato", "desconocido", "no encontrado", "no informado", "nd"}:
            return None
        return v
    return valor


# ---------------------------------------------------------------------------
# B Lab
# ---------------------------------------------------------------------------

def slug_blab(url: str | None) -> str | None:
    if not url:
        return None
    m = re.search(r"/company/([^/?#]+)", url)
    return m.group(1).lower() if m else None


def url_blab_canonica(slug: str | None) -> str | None:
    return f"https://www.bcorporation.net/en-us/find-a-b-corp/company/{slug}/" if slug else None


def numero(valor) -> float | None:
    if valor is None or isinstance(valor, bool):
        return None
    if isinstance(valor, (int, float)):
        return float(valor)
    m = re.search(r"-?\d+(?:[.,]\d+)?", str(valor))
    return float(m.group(0).replace(",", ".")) if m else None


MESES = {
    "jan": 1, "january": 1, "ene": 1, "enero": 1,
    "feb": 2, "february": 2, "febrero": 2,
    "mar": 3, "march": 3, "marzo": 3,
    "apr": 4, "april": 4, "abr": 4, "abril": 4,
    "may": 5, "mayo": 5,
    "jun": 6, "june": 6, "junio": 6,
    "jul": 7, "july": 7, "julio": 7,
    "aug": 8, "august": 8, "ago": 8, "agosto": 8,
    "sep": 9, "sept": 9, "september": 9, "septiembre": 9, "setiembre": 9,
    "oct": 10, "october": 10, "octubre": 10,
    "nov": 11, "november": 11, "noviembre": 11,
    "dec": 12, "december": 12, "dic": 12, "diciembre": 12,
}


def fecha_mes(valor) -> str | None:
    """'December 2021', 'dic 2021', '2021-12', '12/2021' -> '2021-12'. Solo año -> '2021'."""
    valor = limpiar(valor)
    if not valor:
        return None
    t = clave(str(valor))
    m = re.search(r"\b(20\d{2}|19\d{2})\s(\d{1,2})\b", t)  # 2021 12
    if m and 1 <= int(m.group(2)) <= 12:
        return f"{m.group(1)}-{int(m.group(2)):02d}"
    m = re.search(r"\b(\d{1,2})\s(20\d{2}|19\d{2})\b", t)  # 12 2021
    if m and 1 <= int(m.group(1)) <= 12:
        return f"{m.group(2)}-{int(m.group(1)):02d}"
    anio = re.search(r"\b(20\d{2}|19\d{2})\b", t)
    for palabra in t.split():
        if palabra in MESES and anio:
            return f"{anio.group(1)}-{MESES[palabra]:02d}"
    return anio.group(1) if anio else None


# ---------------------------------------------------------------------------
# Industrias
# ---------------------------------------------------------------------------

INDUSTRIA_ES = {
    "environmental consulting": "Consultoría ambiental",
    "management consultant": "Consultoría de gestión",
    "management consultant for profits": "Consultoría de gestión",
    "management consultant nonprofits": "Consultoría de gestión (sin fines de lucro)",
    "management financial consulting": "Consultoría de gestión y financiera",
    "food products": "Productos alimenticios",
    "construction": "Construcción",
    "advertising market research": "Publicidad e investigación de mercado",
    "apparel": "Vestuario",
    "apparel footwear accessories": "Vestuario, calzado y accesorios",
    "agricultural processing": "Procesamiento agrícola",
    "computer programming services": "Desarrollo de software",
    "employment placement hr": "Reclutamiento y RR.HH.",
    "other education": "Educación (otros)",
    "accommodation": "Alojamiento",
    "real estate development": "Desarrollo inmobiliario",
    "travel agency related": "Agencias de viaje y turismo",
    "other retail sale": "Comercio minorista",
    "legal activities": "Servicios legales",
    "legal": "Servicios legales",
    "higher education": "Educación superior",
    "other recreation": "Recreación",
    "equity investing emerging markets": "Inversión de capital (mercados emergentes)",
    "equity investing developed markets": "Inversión de capital (mercados desarrollados)",
    "other financial services": "Servicios financieros",
    "financial services": "Servicios financieros",
    "other manufacturing": "Manufactura (otros)",
    "materials recovery recycling": "Recuperación y reciclaje de materiales",
    "materials recovery and recycling": "Recuperación y reciclaje de materiales",
    "education and training": "Educación y capacitación",
    "education training services": "Educación y capacitación",
    "other business support": "Servicios de apoyo empresarial",
    "textiles": "Textiles",
    "personal care products": "Cuidado personal",
    "home personal care manufacturing": "Hogar y cuidado personal",
    "other personal services": "Servicios personales",
    "transportation support": "Apoyo al transporte",
    "agricultural support post harvest": "Servicios agrícolas y poscosecha",
    "agicultural support post harvest": "Servicios agrícolas y poscosecha",
    "growing perennial crops": "Cultivos permanentes",
    "growing non perennial crops": "Cultivos anuales",
    "fishing and aquaculture": "Pesca y acuicultura",
    "agriculture growers": "Agricultura",
    "engineering": "Ingeniería",
    "architecture design planning": "Arquitectura y diseño",
    "design building": "Diseño y construcción",
    "other info service activities": "Servicios de información",
    "waste treatment disposal": "Tratamiento de residuos",
    "other credit emerging markets": "Crédito (mercados emergentes)",
    "investment advisory": "Asesoría de inversiones",
    "financial transaction processing": "Procesamiento de pagos",
    "non life insurance": "Seguros generales",
    "health insurance": "Seguros de salud",
    "leased property": "Arriendo de propiedades",
    "real estate": "Inmobiliario",
    "solar panel installation": "Instalación de paneles solares",
    "other renewable energy installation": "Energías renovables",
    "chemicals manufacturing": "Química",
    "hotel": "Hotelería",
    "sports goods": "Artículos deportivos",
    "medical and dental supplies": "Insumos médicos y dentales",
    "rubber and plastics products": "Caucho y plásticos",
    "paper paper products": "Papel y derivados",
    "other recycling": "Reciclaje",
    "books and other media": "Libros y medios",
    "pharmaceutical products": "Farmacéutica",
    "software": "Software",
    "software publishing and saas platforms": "Software y plataformas SaaS",
    "it software services": "Software y servicios TI",
    "mobile applications": "Aplicaciones móviles",
    "beverages": "Bebidas",
    "wine": "Vinos",
    "restaurants": "Restaurantes",
    "marketing communications services": "Marketing y comunicaciones",
    "media": "Medios",
    "healthcare providers": "Prestadores de salud",
    "telecommunications": "Telecomunicaciones",
    "waste management remediation": "Gestión de residuos",
    "transportation logistics": "Transporte y logística",
    "travel leisure": "Viajes y ocio",
    "wholesale trade": "Comercio mayorista",
    "furniture": "Muebles",
    "building materials": "Materiales de construcción",
    "accounting auditing": "Contabilidad y auditoría",
    "other professional scientific tech": "Otros servicios profesionales y científicos",
    # Taxonomía nueva de B Lab (con "and" en el nombre)
    "professional scientific and technical services": "Servicios profesionales, científicos y técnicos",
    "other professional scientific and technical activities": "Otros servicios profesionales y científicos",
    "agricultural support and post harvest": "Servicios agrícolas y poscosecha",
    "waste treatment and disposal": "Tratamiento de residuos",
    "remediation and other waste management": "Gestión de residuos",
    "cleaning products": "Productos de limpieza",
    "postal and courier activities": "Servicios postales y de mensajería",
    "other transport equipment": "Otros equipos de transporte",
    "restaurants and food service": "Restaurantes y servicios de alimentación",
    "printing and recorded media": "Impresión y medios grabados",
    "newspapers and magazines publishing": "Edición de diarios y revistas",
    "technology based support services": "Servicios de soporte tecnológico",
    "software publishing and saas": "Software y plataformas SaaS",
    "computers and electronics": "Computadores y electrónica",
}

# (palabras clave, macro-industria). El orden importa: la primera coincidencia gana.
# Las palabras con espacios a los lados (" hr ") deben coincidir como palabra completa.
REGLAS_MACRO = [
    (("insurance", "seguros"), "Servicios financieros"),
    (("telecom",), "Tecnología y software"),
    (("food", "beverage", "wine", "winery", "brew", "coffee", "agricult", "agicult", "growing", "crop", "farm",
      "fishing", "aquaculture", "seafood", "restaurant", "catering", "dairy", "livestock", "alimento", "bebida",
      " vino", " vina ", " vinas ", "cerveza", " cafe ", "agricola", " agro", "frutas", " pesca", "acuicultura",
      "restaurante"), "Alimentos, bebidas y agro"),
    (("medical", "health", "pharma", "dental", "hospital", "wellness", "clinic", "veterinar", " salud",
      "farmac", "medic", "psicolog", "bienestar"), "Salud y bienestar"),
    (("advertising", "marketing", " media ", "publishing", "books", " film", "printing", "public relations",
      "communication", " events", "comunicacion", "publicidad", "editorial", "audiovisual", "branding"),
     "Marketing, comunicaciones y medios"),
    (("consult", "legal", "lawyer", " law ", "accounting", "audit", "engineering", "architecture",
      "design planning", "employment", " hr ", "research", "testing", "business support", "translation",
      "professional", "asesor", "abogad", "ingenier", "arquitect", "recursos humanos", "reclutamiento"),
     "Consultoría y servicios profesionales"),
    (("education", "training", "school", "educacion", "capacitacion", "colegio", "escuela", "universidad",
      "formacion"), "Educación y capacitación"),
    (("financ", "credit", "equity", "investment", " bank", "payment", "transaction", "microfinanc",
      "crowdfund", "inversion", "credito", "fintech", "factoring", "banco"), "Servicios financieros"),
    (("real estate", "construction", "building", "leased property", "housing", "inmobiliari", "construc",
      "vivienda"), "Inmobiliario y construcción"),
    (("energy", "solar", "renewable", "electric", "water supply", "utilit", "energia", "renovable"),
     "Energía y agua"),
    (("recycl", "waste", "remediation", "materials recovery", "environmental service", "reciclaje", "residuo",
      "economia circular", "compost"), "Medio ambiente y reciclaje"),
    (("software", "computer", "information", "info service", "mobile app", " data ", "internet", "saas",
      "digital", "tecnolog", "plataforma"), "Tecnología y software"),
    (("transport", "logistic", "freight", "courier", "shipping", "postal", "warehous", "logistica"),
     "Transporte y logística"),
    (("travel", "touris", "accommodation", "hotel", "recreation", " tour", "turismo", "leisure", "viajes",
      "lodge", "expedicion"), "Turismo, hotelería y recreación"),
    (("apparel", "textile", "footwear", "personal care", "cosmetic", " home ", "furniture", "manufactur",
      "chemical", "plastic", "rubber", "paper", "sports goods", " toy", "packaging", "supplies", "products",
      "ropa", "vestuario", "cosmet", "muebles", "fabrica", "envases", "textil"),
     "Manufactura y bienes de consumo"),
    (("retail", "wholesale", "commerce", "store", " trade", "comercio", "tienda", "distribu"),
     "Comercio y retail"),
]

MACRO_POR_SEGMENTO = {
    "alimentos": "Alimentos, bebidas y agro",
    "consultoria": "Consultoría y servicios profesionales",
    "marketing_educacion": "Marketing, comunicaciones y medios",
    "finanzas_inmobiliario_energia": "Servicios financieros",
    "manufactura_retail": "Manufactura y bienes de consumo",
    "tecnologia_salud": "Tecnología y software",
    "ambiente_transporte_turismo": "Medio ambiente y reciclaje",
}

MACROS = list(dict.fromkeys([m for _, m in REGLAS_MACRO] + ["Otros servicios"]))


def industria_es(industria: str | None) -> str | None:
    industria = limpiar(industria)
    if not industria:
        return None
    return INDUSTRIA_ES.get(clave(industria), industria)


def _macro_por_reglas(texto: str | None) -> str | None:
    t = " " + clave(texto) + " "
    if not t.strip():
        return None
    for palabras, macro in REGLAS_MACRO:
        if any(p in t for p in palabras):
            return macro
    return None


def macro_industria(industria: str | None, descripcion: str | None = None,
                    segmento: str | None = None) -> tuple[str, str]:
    """Devuelve (macro-industria, base) donde base indica de dónde salió la clasificación:
    'industria' (ficha B Lab), 'descripcion' (palabras clave) o 'segmento' (búsqueda que la encontró)."""
    if limpiar(industria):
        return (_macro_por_reglas(industria) or "Otros servicios", "industria")
    macro = _macro_por_reglas(descripcion)
    if macro:
        return (macro, "descripcion")
    return (MACRO_POR_SEGMENTO.get(segmento or "", "Otros servicios"), "segmento")


# ---------------------------------------------------------------------------
# Secciones especiales pedidas por el usuario
# ---------------------------------------------------------------------------

# Palabras específicas a propósito: "puerto" marcaría a empresas de Puerto Montt o Puerto Varas y
# "automatización" a consultoras de RPA.
SECCIONES = {
    "data-center": ("data center", "datacenter", "centro de datos", "centros de datos", "colocation", "colocacion",
                    "hyperscale", "hiperescala"),
    "robotica": ("robot", " dron ", " drones ", " drone "),
    "salmones": ("salmon", "salmones", "salmonicultura", "salmonicola", "trucha"),
    "maritimo": ("maritim", "naviera", "naviero", "portuari", " naval", "astillero", "embarcacion", "buque",
                 "navegacion", "armador", "terminal portuario"),
}

NOMBRE_SECCION = {
    "data-center": "Data center",
    "robotica": "Robótica",
    "salmones": "Salmones",
    "maritimo": "Marítimo",
}


def secciones_de(*textos: str | None) -> list[str]:
    t = " " + " ".join(clave(x) for x in textos if x) + " "
    return [s for s, palabras in SECCIONES.items() if any(p in t for p in palabras)]


# ---------------------------------------------------------------------------
# Tipo societario
# ---------------------------------------------------------------------------

TIPOS_SOCIEDAD = ["SpA", "S.A.", "Ltda.", "EIRL", "Cooperativa", "Fundación/Corporación", "Extranjera", "Sin dato"]

_PATRONES_TIPO = [
    (r"\bs\s?p\s?a$|\bsociedad por acciones\b", "SpA"),
    (r"\be\s?i\s?r\s?l$|\bempresa individual de responsabilidad limitada\b", "EIRL"),
    (r"\bltda$|\blimitada$|\bcia ltda$", "Ltda."),
    (r"\bs\s?a\s?c$|\bs\s?r\s?l$|\bs\s?a\s?s$|\binc$|\bllc$|\bb\s?v$|\bs\s?l$|\bltd$|\bgmbh$|\bsa de cv$", "Extranjera"),
    (r"\bs\s?a$|\bsociedad anonima\b", "S.A."),
    (r"\bcooperativa\b", "Cooperativa"),
    (r"^fundacion\b|^corporacion\b", "Fundación/Corporación"),
]


def tipo_sociedad(*nombres: str | None) -> str | None:
    """Deduce el tipo societario desde la razón social (o el nombre). None si no se puede."""
    for nombre in nombres:
        t = clave(nombre)
        if not t:
            continue
        for patron, tipo in _PATRONES_TIPO:
            if re.search(patron, t):
                return tipo
    return None


# ---------------------------------------------------------------------------
# RUT chileno
# ---------------------------------------------------------------------------

def dv_rut(cuerpo: int) -> str:
    suma, factor = 0, 2
    while cuerpo:
        suma += (cuerpo % 10) * factor
        cuerpo //= 10
        factor = 2 if factor == 7 else factor + 1
    resto = 11 - suma % 11
    return {11: "0", 10: "K"}.get(resto, str(resto))


def normalizar_rut(valor) -> str | None:
    """Devuelve el RUT con formato 76.123.456-7 solo si el dígito verificador es válido."""
    valor = limpiar(valor)
    if not valor:
        return None
    m = re.search(r"(\d{1,2})\.?(\d{3})\.?(\d{3})\s*-\s*([\dkK])", str(valor))
    if not m:
        return None
    cuerpo = int(m.group(1) + m.group(2) + m.group(3))
    dv = m.group(4).upper()
    if dv_rut(cuerpo) != dv:
        return None
    s = f"{cuerpo:,}".replace(",", ".")
    return f"{s}-{dv}"


# ---------------------------------------------------------------------------
# Geografía
# ---------------------------------------------------------------------------

REGIONES = {
    "Arica y Parinacota": ("arica", "putre"),
    "Tarapacá": ("iquique", "alto hospicio", "pozo almonte", "tarapaca"),
    "Antofagasta": ("antofagasta", "calama", "san pedro de atacama", "mejillones", "tocopilla", "taltal"),
    "Atacama": ("copiapo", "vallenar", "caldera", "chanaral", "region de atacama", "atacama region"),
    "Coquimbo": ("la serena", "coquimbo", "ovalle", "vicuna", "illapel", "los vilos"),
    "Valparaíso": ("vina del mar", "valparaiso", "concon", "quilpue", "villa alemana", "casablanca", "san antonio",
                   "quillota", "los andes", "san felipe", "limache", "olmue", "zapallar", "papudo", "algarrobo",
                   "el quisco", "isla de pascua", "rapa nui", "cartagena", "puchuncavi", "quintero"),
    "Metropolitana": ("santiago", "providencia", "las condes", "vitacura", "nunoa", "lo barnechea", "huechuraba",
                      "quilicura", "pudahuel", "la florida", "maipu", "puente alto", "san bernardo", "colina",
                      "lampa", "penalolen", "la reina", "macul", "san miguel", "estacion central", "recoleta",
                      "independencia", "renca", "cerrillos", "talagante", "buin", "paine", "pirque", "melipilla",
                      "chicureo", "san joaquin", "la cisterna", "quinta normal", "conchali", "el bosque",
                      "lo espejo", "padre hurtado", "penaflor", "til til", "region metropolitana", "metropolitana",
                      "rm"),
    "O'Higgins": ("rancagua", "machali", "san fernando", "santa cruz", "pichilemu", "rengo", "colchagua",
                  "o higgins", "ohiggins", "libertador"),
    "Maule": ("talca", "curico", "linares", "constitucion", "cauquenes", "maule"),
    "Ñuble": ("chillan", "nuble"),
    "Biobío": ("concepcion", "talcahuano", "san pedro de la paz", "chiguayante", "los angeles", "coronel",
               "hualpen", "tome", "penco", "lota", "biobio", "bio bio"),
    "La Araucanía": ("temuco", "pucon", "villarrica", "angol", "padre las casas", "araucania", "curacautin"),
    "Los Ríos": ("valdivia", "la union", "panguipulli", "los rios", "rio bueno"),
    "Los Lagos": ("puerto montt", "puerto varas", "osorno", "castro", "ancud", "frutillar", "chiloe",
                  "llanquihue", "calbuco", "quellon", "chaiten", "los lagos", "dalcahue"),
    "Aysén": ("coyhaique", "coihaique", "aysen", "aisen", "puerto aysen", "chile chico", "cochrane"),
    "Magallanes": ("punta arenas", "puerto natales", "torres del paine", "magallanes", "porvenir",
                   "puerto williams"),
}


def region_de(*textos: str | None) -> str | None:
    t = " " + " ".join(clave(x) for x in textos if x) + " "
    if not t.strip():
        return None
    # Primero comunas/ciudades específicas fuera de la RM, para que "Santiago" no tape "Santiago, Viña del Mar".
    for region, lugares in REGIONES.items():
        if region == "Metropolitana":
            continue
        if any(f" {l} " in t for l in lugares):
            return region
    if any(f" {l} " in t for l in REGIONES["Metropolitana"]):
        return "Metropolitana"
    return None


PAISES = {
    "chile": "Chile", "argentina": "Argentina", "peru": "Perú", "colombia": "Colombia", "ecuador": "Ecuador",
    "brazil": "Brasil", "brasil": "Brasil", "spain": "España", "espana": "España", "mexico": "México",
    "uruguay": "Uruguay", "bolivia": "Bolivia", "paraguay": "Paraguay",
    "united states": "Estados Unidos", "estados unidos": "Estados Unidos", "usa": "Estados Unidos",
    "eeuu": "Estados Unidos", "netherlands": "Países Bajos", "paises bajos": "Países Bajos",
    "united kingdom": "Reino Unido", "reino unido": "Reino Unido", "france": "Francia", "francia": "Francia",
    "germany": "Alemania", "alemania": "Alemania", "canada": "Canadá", "switzerland": "Suiza", "suiza": "Suiza",
    "italy": "Italia", "italia": "Italia", "norway": "Noruega", "noruega": "Noruega", "nepal": "Nepal",
    "costa rica": "Costa Rica", "guatemala": "Guatemala", "panama": "Panamá", "venezuela": "Venezuela",
    "denmark": "Dinamarca", "portugal": "Portugal", "australia": "Australia", "new zealand": "Nueva Zelanda",
}


def pais(valor: str | None) -> str | None:
    valor = limpiar(valor)
    if not valor:
        return None
    return PAISES.get(clave(valor), valor.strip())


# ---------------------------------------------------------------------------
# Economía: tramos de ventas del SII (definición oficial, en UF anuales)
# ---------------------------------------------------------------------------

TRAMOS_SII = {
    1: ("Sin ventas / sin información", None, None),
    2: ("Micro 1", 0.01, 200),
    3: ("Micro 2", 200.01, 600),
    4: ("Micro 3", 600.01, 2_400),
    5: ("Pequeña 1", 2_400.01, 5_000),
    6: ("Pequeña 2", 5_000.01, 10_000),
    7: ("Pequeña 3", 10_000.01, 25_000),
    8: ("Mediana 1", 25_000.01, 50_000),
    9: ("Mediana 2", 50_000.01, 100_000),
    10: ("Grande 1", 100_000.01, 200_000),
    11: ("Grande 2", 200_000.01, 600_000),
    12: ("Grande 3", 600_000.01, 1_000_000),
    13: ("Grande 4", 1_000_000.01, None),
}


def tamano_sii_grupo(texto: str | None) -> str | None:
    """'Mediana 2' / 'MEDIANA' / 'Gran empresa' -> 'Micro' | 'Pequeña' | 'Mediana' | 'Grande'."""
    t = clave(texto)
    if not t:
        return None
    if "micro" in t:
        return "Micro"
    if "pequen" in t:
        return "Pequeña"
    if "median" in t:
        return "Mediana"
    if "grande" in t or "gran empresa" in t:
        return "Grande"
    return None
