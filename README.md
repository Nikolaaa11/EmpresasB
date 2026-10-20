# Empresas B en Chile

Directorio abierto de las **Empresas B certificadas (B Corp) con sede u operación en Chile**, separado
por **industria** y por **tipo de sociedad** (SpA, S.A., Ltda., EIRL…), con puntaje de impacto, cómo
les va económicamente, propiedad y contactos corporativos. Incluye una sección de **sectores
estratégicos**: Data center, Robótica, Salmones y Marítimo (sean o no Empresas B).

- **Sitio web (Vercel):** <!-- url:inicio -->[empresas-b-chile.vercel.app](https://empresas-b-chile.vercel.app)<!-- url:fin -->
- **Super prompt reutilizable:** [SUPER_PROMPT.md](SUPER_PROMPT.md)
- **Listado por industria:** [docs/industrias](docs/industrias/README.md) · **por tipo de sociedad:**
  [docs/tipos_sociedad.md](docs/tipos_sociedad.md) · **sectores estratégicos:**
  [docs/sectores_estrategicos.md](docs/sectores_estrategicos.md)

## Cifras actuales

<!-- cifras:inicio -->
Actualizado el **2026-10-20**.

- **224 Empresas B** en el directorio: **186** con sede en Chile y 38 con sede en el extranjero que operan en Chile.
- Puntaje B promedio **91.9** (mediana 88.4; rango 80.0–142.8).
- Tipo de sociedad: SpA 41 (18.3%), S.A. 24 (10.7%), Ltda. 13 (5.8%), Extranjera 33 (14.7%), Sin dato 113 (50.4%).
- Sectores estratégicos: Data center 13 (0 B), Robótica 25 (0 B), Salmones 22 (1 B), Marítimo 25 (0 B).

| Industria | Empresas | % |
|---|---:|---:|
| Consultoría y servicios profesionales | 45 | 20.1% |
| Alimentos, bebidas y agro | 34 | 15.2% |
| Manufactura y bienes de consumo | 31 | 13.8% |
| Turismo, hotelería y recreación | 16 | 7.1% |
| Tecnología y software | 14 | 6.2% |
| Inmobiliario y construcción | 13 | 5.8% |
| Medio ambiente y reciclaje | 13 | 5.8% |
| Servicios financieros | 11 | 4.9% |
| Marketing, comunicaciones y medios | 11 | 4.9% |
| Educación y capacitación | 11 | 4.9% |
| Otros servicios | 10 | 4.5% |
| Comercio y retail | 5 | 2.2% |
| Energía y agua | 4 | 1.8% |
| Transporte y logística | 4 | 1.8% |
| Salud y bienestar | 2 | 0.9% |

**Cobertura de datos** (empresas con el dato, sobre el total):

| Dato | Empresas | % |
|---|---:|---:|
| Puntaje B | 187 | 83.5% |
| Desglose por área de impacto | 6 | 2.7% |
| Tipo de sociedad | 111 | 49.6% |
| Razón social | 43 | 19.2% |
| RUT validado | 9 | 4% |
| Sitio web | 166 | 74.1% |
| Email corporativo | 3 | 1.3% |
| Teléfono | 5 | 2.2% |
| Dirección | 7 | 3.1% |
| LinkedIn de la empresa | 0 | 0% |
| Líderes | 16 | 7.1% |
| Datos económicos | 24 | 10.7% |
| Propiedad | 10 | 4.5% |
<!-- cifras:fin -->

## Qué contiene

| Archivo | Contenido |
|---|---|
| `data/empresas_b_chile.json` / `.csv` / `.xlsx` | Directorio completo (una fila por empresa, con fuentes) |
| `data/por_industria/*.csv` | Una planilla por macro-industria |
| `data/por_tipo_sociedad/*.csv` | Una planilla por tipo de sociedad (`spa.csv`, `s-a.csv`, `ltda.csv`, …) |
| `data/sectores_estrategicos/*.csv` | Data center, Robótica, Salmones y Marítimo |
| `data/estadisticas.json` | Porcentajes por industria, tipo, región, tamaño; promedios por área de impacto |
| `docs/` | Las mismas tablas en Markdown, navegables en GitHub |
| `data/raw/` | Investigación en bruto de cada agente (trazabilidad) |
| `scripts/` | Consolidación, validación, exportación y cruce con el SII |
| `web/` | Sitio estático (sin dependencias) que se despliega en Vercel |

## «Qué porcentajes les corresponden»

El directorio responde la pregunta de tres maneras:

1. **Puntaje B por área de impacto**: cuánto aporta Gobernanza, Trabajadores, Comunidad, Medio
   Ambiente y Clientes al puntaje total de cada empresa (en la ficha y en Estadísticas).
2. **Participación en el total**: qué % del directorio representa cada industria, tipo de sociedad,
   región y tamaño (se recalcula con cada filtro).
3. **Propiedad**: socios o accionistas y su % cuando es información pública (CMF, Diario Oficial,
   memorias, prensa). En las SpA los accionistas rara vez son públicos.

## Cómo les va económicamente

- **SII – Nómina de Personas Jurídicas**: tramo oficial de ventas anuales en UF (Micro, Pequeña,
  Mediana, Grande) y número de trabajadores, cruzado por RUT con `scripts/sii_nomina.py`.
- **Prensa, memorias y CMF**: ventas o ingresos reportados, rondas de inversión y si cotiza en bolsa,
  siempre con año y fuente.
- El SII no publica estados financieros de empresas privadas, así que esa nómina es la referencia
  oficial de tamaño.

## Actualizar los datos

```bash
python3 scripts/sii_nomina.py      # opcional: cruce SII (requiere acceso a sii.cl o --archivo nomina.zip)
python3 scripts/consolidar.py      # data/raw/ -> data/empresas_b_chile.json + sectores
python3 scripts/exportar.py        # CSV, XLSX, docs/, estadísticas y web/data/
cd web && python3 -m http.server   # ver el sitio en http://localhost:8000
```

`data/pendientes_enriquecimiento.json` es la cola de trabajo: las empresas que aún no tienen
razón social, RUT, contactos o economía completos. Una nueva pasada de agentes (ver
[SUPER_PROMPT.md](SUPER_PROMPT.md), fase 2) toma esa lista y deja sus resultados en
`data/raw/enriquecimiento/`.

Para agregar o corregir una empresa, edita o agrega un JSON en `data/raw/` (cada dato con su fuente)
y vuelve a correr los dos últimos scripts. ¿Encontraste un error?
[Abre un issue](https://github.com/Nikolaaa11/EmpresasB/issues/new).

## Metodología

1. **Listado**: agentes en paralelo recorrieron el directorio oficial de B Lab (filtro Chile) por
   segmento de industria, por ciudad y por forma legal, y revisaron prensa y Sistema B. Se deduplica
   por la URL de la ficha B Lab.
2. **Enriquecimiento**: por empresa, razón social, RUT (validado con su dígito verificador),
   contactos corporativos, líderes públicos, propiedad y economía. Para el sitio web se usa además la
   búsqueda gratuita de organizaciones de Apollo.io.
3. **Validación automática** (`scripts/consolidar.py`):
   - RUT con dígito verificador inválido → se descarta;
   - puntajes fuera de rango, o áreas que no suman el total → se descartan;
   - emails no genéricos → se excluyen por privacidad;
   - el tipo societario se deduce de la razón social.
4. **Sectores estratégicos**: un agente por sector, con resumen del mercado y fuentes.

El detalle completo está en [SUPER_PROMPT.md](SUPER_PROMPT.md) y en la pestaña «Metodología» del
sitio.

## Privacidad

Solo se publican **canales corporativos**: sitio web, email genérico, teléfono central, dirección y
redes de la empresa. De las personas, solo nombre y cargo de líderes que aparecen en fuentes
públicas. No se publican emails ni teléfonos personales.

## Limitaciones

- La información proviene de fuentes públicas a la fecha de actualización y puede contener errores.
  Las certificaciones B se renuevan cada 3 años.
- Las cifras económicas son las que publicaron las empresas o la prensa, no estados financieros
  auditados.
- «B Corp» y «Empresa B» son marcas de B Lab. Este proyecto no está afiliado a B Lab ni a Sistema B.
