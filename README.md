# 📰 Semanario devsChile

Newsletter semanal de la comunidad [devsChile](https://devschile.cl): resumen de la actividad de la semana, pegas nuevas y los links más útiles compartidos en los canales de contenido.

## Estructura

```
semanario/
├── template.html              # Diseño base del correo (email-safe, 600px)
└── ediciones/
    └── YYYY-MM-DD/
        ├── newsletter.html    # Edición de la semana lista para enviar
        └── resumen.md         # Fuente de datos: links y contexto por canal
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

## Canales cubiertos

Contenido: #ai, #desarrollo, #frontend, #backend, #diy, #lifehacks, #ux, #juegos, #musiqueria, #cultura, #comunidad, #eventos-juntas, #mascotas, #moneas, #persa, #remoto, #liderazgo.
Pegas: #trabajos (bot d4rkmul → pegas.devschile.cl).
Destaque: #anuncios (solo si tuvo actividad la semana).

*Generado por la comunidad, para la comunidad. 🦌*
