# 📰 Semanario devsChile

Newsletter semanal de la comunidad [devsChile](https://devschile.cl): resumen de la actividad de la semana, pegas nuevas y los links más útiles compartidos en los canales de contenido.

🔗 **[semanario.devschile.cl](https://semanario.devschile.cl)** — landing de suscripción y archivo de ediciones.

## Estructura

```
semanario/
├── template.html              # Diseño base del correo (email-safe, 600px)
├── ediciones/
│   └── YYYY-MM-DD/
│       ├── newsletter.html    # Edición de la semana lista para enviar
│       └── resumen.md         # Fuente de datos: links y contexto por canal
│
├── index.html                 # Landing de suscripción
├── css/, js/, assets/         # Estáticos de la landing
├── scripts/build.mjs          # Arma dist/ para Netlify
├── netlify/functions/         # Endpoints de alta, confirmación y baja
└── db/                        # Esquema de suscriptores (Neon/Postgres)
```

## Pipeline: de Slack al inbox

Tres pasos, en tres momentos distintos — en ese orden importa: **la edición
queda publicada en la web horas antes de que se envíe el correo**, así que el
link "ver en el navegador" del correo siempre apunta a una página que ya existe.

### 1. Generación — lunes en la noche

Un cron del bot (Hermes/Pudú) revisa el historial de Slack de la semana
(domingo → sábado) y:

1. Lee los canales de contenido: #ai, #musiqueria, #juegos, #lifehacks, #diy, #ux, #desarrollo, #cultura, #comunidad, #eventos-juntas, #frontend, #backend, #liderazgo, #mascotas, #moneas, #persa, #remoto.
2. Arma el resumen de actividad (mensajes por día, día más activo, personas nuevas).
3. Cuenta pegas: `se publicaron [XX] pegas nuevas en pegas.devschile.cl y [X] anuncios en #trabajos`.
4. Filtra links útiles (sin memes) y genera frases con contexto por canal.
5. Revisa #anuncios: si hubo mensajes en la semana, va como bloque destacado al inicio; si no, se omite.
6. Rellena los `{{PLACEHOLDERS}}` de `template.html` (el diseño base, email-safe,
   600px) y escribe el resultado ya renderizado —sin placeholders— en
   `ediciones/YYYY-MM-DD/newsletter.html` + `resumen.md` (la fuente de datos en
   texto plano, para la versión texto del correo).
7. Pushea a `main`.

### 2. Publicación — automática, al pushear

Ese push dispara un build y deploy de Netlify. `scripts/build.mjs` arma el
directorio `dist/` que se publica en
[semanario.devschile.cl](https://semanario.devschile.cl):

- copia los estáticos de la landing (`css/`, `js/`, `assets/`),
- transforma cada `ediciones/YYYY-MM-DD/newsletter.html` en
  `dist/newsletter/YYYY-MM-DD/index.html` — la versión web de esa edición,
- **genera la lista de ediciones leyendo las carpetas de `ediciones/`** e
  inyecta las últimas 4 en la portada y el archivo completo en `/newsletter/`.
  Nadie edita ese listado a mano.

| Ruta | Qué es |
|---|---|
| `/` | Landing con el formulario de suscripción |
| `/newsletter/` | Archivo con todas las ediciones |
| `/newsletter/YYYY-MM-DD/` | Una edición, en su versión web |
| `/ediciones/*` | Redirige (301) a `/newsletter/*` |

Este paso ocurre el lunes en la noche, apenas se pushea — no el martes cuando
se manda el correo. Para cuando el envío ocurre, la página ya lleva horas viva.

### 3. Envío — martes en la mañana

`scripts/enviar.mjs` (lo corre el cron del bot; el workflow de
`.github/workflows/enviar.yml` es solo respaldo manual) toma la edición más
reciente de `ediciones/` y le hace dos inyecciones antes de mandarla por
Mailgun a los suscriptores `confirmed` de Neon:

- **Ver en el navegador** (marcador `<!--VER_HTML-->` en el header del
  template): el mismo link para todos, apunta a la página que el paso 2 ya
  publicó — `{SITE_URL}/newsletter/YYYY-MM-DD/`.
- **Baja en un clic** (marcador `<!-- BAJA_LINK -->` en el footer): un link
  distinto por destinatario, con su `unsubscribe_token` de la base — más el
  header `List-Unsubscribe` para el botón nativo de Gmail/Outlook.

Si la edición más reciente tiene más de 3 días, el script aborta (para no
reenviar una edición vieja). Un fallo de envío individual no corta la lista.

## Suscripciones

El alta la maneja una Netlify Function que escribe en Postgres (Neon). El flujo
es double opt-in: alta → `pending`, Mailgun manda el correo de confirmación,
se confirma con el token del link → `confirmed`. Cada correo de edición lleva
su token de baja.

| Endpoint | Qué hace |
|---|---|
| `POST /api/subscribe` | Da de alta un correo en `pending` y dispara el correo de confirmación (Mailgun) |
| `GET /api/confirmar?token=` | Confirma la suscripción |
| `GET /api/baja?token=` | Da de baja |

Si el envío por Mailgun falla, el alta en la base **no se revierte** — queda
como `pending` y el error solo se loguea (`netlify/functions/subscribe.mjs`).

## Desarrollo local

```bash
npm install
cp .env.example .env     # completar DATABASE_URL (Neon) y las variables MAILGUN_*
npm run db:schema        # crea la tabla subscribers (idempotente)
npm run dev              # build + netlify dev en localhost:8888
```

## Canales cubiertos

Contenido: #ai, #desarrollo, #frontend, #backend, #diy, #lifehacks, #ux, #juegos, #musiqueria, #cultura, #comunidad, #eventos-juntas, #mascotas, #moneas, #persa, #remoto, #liderazgo.
Pegas: #trabajos (bot d4rkmul → pegas.devschile.cl).
Destaque: #anuncios (solo si tuvo actividad la semana).

*Generado por la comunidad, para la comunidad. 🦌*
