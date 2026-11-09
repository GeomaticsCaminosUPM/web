---
# File name = id, e.g. content/projects/mi-proyecto.md
title: Título del proyecto
summary: Una frase para la tarjeta y la cabecera.
type: Investigación                  # free text: Investigación, Servicio, Cooperación, Formación...
status: En curso                     # optional: free text (En curso, Finalizado...)
year: 2025                           # optional; used for ordering
start: 2024-01                       # optional, free text
end: 2026-12                         # optional
funding: Ministerio de Ciencia (PID2023-000000)   # optional
image: mi-proyecto.jpg               # optional; file in assets/img/projects/
video: mi-proyecto.mp4              # optional; file in assets/media/ OR a YouTube/Vimeo/.mp4 URL (autoplays muted, loops)
lines: [sostenibilidad]              # research line ids from data/site.json; first is the main one
people: [ana-perez-gomez]            # ids of files in content/people/
web: https://example.org             # optional
github: https://github.com/org/repo  # optional
links:                               # optional, "Label | URL"
  - Informe final | https://example.org/informe.pdf
---
Description in Markdown. Papers and conferences that reference this project's id
are listed below it automatically.
