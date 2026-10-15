"""Hook SessionStart: carga el contexto de Engram y el estado del flujo SDD; aplica la retención de logs."""
import glob
import os
import time

import _comun as c

RETENCION_DIAS = 30

datos = c.entrada()
raiz = c.proyecto(datos)

# Retención: logs/agent/ conserva 30 días (trazas JSONL, diffs de revisión, contadores)
limite = time.time() - RETENCION_DIAS * 86400
for archivo in glob.glob(os.path.join(raiz, "logs", "agent", "*")) + glob.glob(os.path.join(raiz, "logs", "agent", ".*")):
    try:
        if os.path.isfile(archivo) and os.path.getmtime(archivo) < limite:
            os.remove(archivo)
    except OSError:
        pass


def p(*partes):
    return os.path.join(raiz, *partes)


lineas = ["## Estado del proyecto (SDD)", ""]
lineas.append(f"- Visión de producto: {c.campo(p('specs', '00-vision', 'producto.md')) or '—'}")
lineas.append(f"- Roadmap: {c.campo(p('specs', '00-vision', 'roadmap.md')) or '—'}")
lineas.append(f"- Stack: {c.campo(p('specs', '01-arquitectura', 'stack.md')) or '—'}")

adrs = sorted(glob.glob(p("specs", "01-arquitectura", "adr", "ADR-*.md")))
lineas.append(f"- ADRs: {len(adrs)}"
              + "".join(f"\n  - {os.path.basename(a)}: {c.campo(a)}" for a in adrs))

feats = c.funcionalidades(raiz)
if feats:
    lineas.append("- Funcionalidades:")
    for f in feats:
        paso = c.siguiente_paso(f) or "cumplida"
        lineas.append(f"  - {f['nombre']} [{f['tipo']}]: {paso}")
else:
    lineas.append("- Funcionalidades: ninguna todavía")

memoria = c.engram("context")
lineas += ["", "## Memoria (Engram)", ""]
if memoria:
    lineas.append(memoria[:4000])
else:
    lineas.append("Engram no disponible o sin contexto previo. Memoria versionada: specs/02-memoria/aprendizajes.md")

print("\n".join(lineas))
