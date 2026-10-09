# Imágenes pendientes para la landing (`site/`)

La landing muestra **placeholders discretos** (borde discontinuo + nombre de archivo + descripción)
en cuanto a una imagen falta. Coloca cada archivo con **exactamente este nombre** en
`site/img/` y desaparecerá el placeholder automáticamente.

| Archivo | Tamaño orientativo | Qué debe mostrarse |
|---|---|---|
| `site/img/hero-widget.png` | 1120×700, fondo blanco o parchment | **Hero.** Captura de pantalla real del widget Watchbug abierto sobre una web de ejemplo: botón flotante abajo a la derecha y el compositor de informes visible con una captura previsualizada dentro. |
| `site/img/editor-annotation.png` | 560×420 | El editor de anotación: captura con una **flecha** y un **rectángulo** dibujados sobre el elemento roto y una región ya **enmascarada en negro opaco**. Fondo oscuro preferible (sección oscura). |
| `site/img/masking-before-after.png` | 560×420 | Comparativa **antes/después** en dos paneles: izquierda con campos de contraseña/tarjeta visibles, derecha con esas mismas regiones **destruidas con relleno opaco**. Fondo claro. |
| `site/img/panel-triage.png` | 560×420 | Panel de triaje: barra superior con selector de proyecto, contadores por estado (Pendiente/En proceso/Resuelto) y tabla de informes con sus estados. |
| `site/img/og-cover.png` | 1200×630 | Imagen para compartir en redes/WhatsApp (Open Graph). Logo + titular "Watchbug SDK" + claim. |

Notas:

- `site/img/logo.png` **no hace falta**: se usa el logo que ya existe en `docs/static/img/logo.png`.
- Formato: PNG (o WebP). Mantén los nombres en minúsculas y con guiones.
- Tras añadirlas, reconstruye: `node scripts/build.mjs`.
