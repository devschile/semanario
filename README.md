# 📰 Semanario devsChile

Newsletter semanal de la comunidad [devsChile](https://devschile.cl): resumen de la actividad de la semana, pegas nuevas y los links más útiles compartidos en los canales de contenido.

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

## Cómo se genera

Cada **lunes en la noche** un cron del bot (Hermes/Pudú) revisa el historial de Slack de la semana (domingo → sábado) y:

1. Lee los canales de contenido: #ai, #musiqueria, #juegos, #lifehacks, #diy, #ux, #desarrollo, #cultura, #comunidad, #eventos-juntas, #frontend, #backend, #liderazgo, #mascotas, #moneas, #persa, #remoto.
2. Arma el resumen de actividad (mensajes por día, día más activo, personas nuevas).
3. Cuenta pegas: `se publicaron [XX] pegas nuevas en pegas.devschile.cl y [X] anuncios en #trabajos`.
4. Filtra links útiles (sin memes) y genera frases con contexto por canal.
5. Revisa #anuncios: si hubo mensajes en la semana, va como bloque destacado al inicio; si no, se omite.
6. Genera `ediciones/YYYY-MM-DD/newsletter.html` + `resumen.md` y pushea.

El newsletter se envía los **martes en la mañana** usando la edición del lunes.

## La web

El sitio se despliega en Netlify desde este mismo repo.

| Ruta | Qué es |
|---|---|
| `/` | Landing con el formulario de suscripción |
| `/newsletter/` | Archivo con todas las ediciones |
| `/newsletter/YYYY-MM-DD/` | Una edición |
| `/ediciones/*` | Redirige (301) a `/newsletter/*` |

`scripts/build.mjs` arma el directorio `dist/` que Netlify publica: copia los
estáticos, transforma `ediciones/YYYY-MM-DD/newsletter.html` en
`newsletter/YYYY-MM-DD/index.html` y **genera la lista de ediciones leyendo las
carpetas**. Nadie edita ese listado a mano: el bot pushea su edición del lunes y
la portada se actualiza sola en el deploy.

### Suscripciones

El alta la maneja una Netlify Function que escribe en Postgres (Neon). El flujo
es double opt-in: alta → `pending`, se confirma con un token → `confirmed`, y
cada correo lleva su token de baja.

| Endpoint | Qué hace |
|---|---|
| `POST /api/subscribe` | Da de alta un correo en estado `pending` |
| `GET /api/confirmar?token=` | Confirma la suscripción |
| `GET /api/baja?token=` | Da de baja |

### Correr en local

```bash
npm install
cp .env.example .env     # y completar DATABASE_URL con la connection string de Neon
npm run db:schema        # crea la tabla subscribers (idempotente)
npm run dev              # build + netlify dev en localhost:8888
```

## Canales cubiertos

Contenido: #ai, #desarrollo, #frontend, #backend, #diy, #lifehacks, #ux, #juegos, #musiqueria, #cultura, #comunidad, #eventos-juntas, #mascotas, #moneas, #persa, #remoto, #liderazgo.
Pegas: #trabajos (bot d4rkmul → pegas.devschile.cl).
Destaque: #anuncios (solo si tuvo actividad la semana).

*Generado por la comunidad, para la comunidad. 🦌*
