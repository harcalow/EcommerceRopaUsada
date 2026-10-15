"""Hook UserPromptSubmit: recuerda la etapa SDD y trae memorias de Engram relacionadas con el prompt.

Deliberadamente breve: se inyecta en cada turno y consume contexto.
"""
import _comun as c

datos = c.entrada()
activas = [(f["nombre"], c.siguiente_paso(f)) for f in c.funcionalidades(c.proyecto(datos))]
activas = [(n, s) for n, s in activas if s]

if activas:
    detalle = "; ".join(f"{n} → {s}" for n, s in activas)
    print(f"[SDD] Funcionalidades activas: {detalle}. No saltes etapas; si la spec es incorrecta, vuelve a la etapa 2.")
else:
    print("[SDD] Sin funcionalidades activas. Toda funcionalidad nueva empieza con /explorar.")

# Memorias relacionadas (solo prompts en lenguaje natural; las skills del flujo delegan su propia búsqueda)
prompt = (datos.get("prompt") or "").strip()
if len(prompt) > 15 and not prompt.startswith("/"):
    resultado = c.engram("search", c.censurar(prompt[:120]), timeout=5)
    if resultado:
        print(f"[Engram] Memorias relacionadas:\n{resultado[:700]}")
