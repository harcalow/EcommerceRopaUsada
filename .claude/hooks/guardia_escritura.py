"""Hook PreToolUse (Write|Edit|MultiEdit|NotebookEdit).

Aplica de forma determinista las reglas del flujo SDD y del equipo de agentes:
  1. Secretos: nunca se escriben.
  2. Solo el humano aprueba: nadie pasa un documento a `aprobada` ni un ADR a `aceptada`.
  3. Volver a la etapa 2: un documento aprobado/aceptado no se modifica tal cual; para corregirlo
     se devuelve a `borrador` (y se re-aprueba) o se cierra (`cumplida`, `reemplazada`).
  4. Herramientas mínimas: cada subagente (campo `agent_type`) solo escribe en su ámbito;
     el orquestador (sin `agent_type`) no programa: delega.
  5. Archivos de gobierno (CLAUDE.md, plantillas, settings, hooks, .mcp.json): piden confirmación.
  6. Sin spec no hay código: fuera de las rutas de documentación solo se escribe si alguna
     funcionalidad tiene `spec.md` y `diseno.md` en `estado: aprobada`.

Salida: exit 2 + stderr bloquea; JSON con permissionDecision "ask" pide confirmación.
"""
import json
import os
import re
import sys

import _comun as c

APROBADOS = {"aprobada", "aceptada"}
SECRETOS = re.compile(r"(^|/)(\.env(\..*)?|secrets/.*|.*\.(pem|key))$")
DOCUMENTACION = ("specs/", ".claude/", "CLAUDE.md", "README.md", ".mcp.json", ".gitignore")
GOBIERNO = ("CLAUDE.md", "specs/_plantillas/", ".claude/settings.json", ".claude/hooks/", ".mcp.json")
REGISTRO = "specs/02-memoria/registro-componentes.md"
TASKS = re.compile(r"^specs/features/[^/]+/tasks\.md$")
PRUEBA = re.compile(r"(\.(test|spec|e2e)\.[cm]?[jt]sx?$|(^|/)(tests?|__tests__|e2e|fixtures|page-objects)/)")


def implementador(rel):
    if rel == REGISTRO or TASKS.match(rel) or rel.startswith(".claude/skills/"):
        return True
    return not rel.startswith(DOCUMENTACION)


ALCANCES = {
    "analista-specs": (lambda r: r.startswith("specs/") and not r.startswith(("specs/01-arquitectura/", "specs/_plantillas/")),
                       "specs/ (salvo arquitectura y plantillas)"),
    "arquitecto": (lambda r: r.startswith("specs/") and not r.startswith("specs/_plantillas/"),
                   "specs/ (salvo plantillas)"),
    "documentador": (lambda r: r.startswith(("specs/02-memoria/", "specs/features/")) or r == "specs/00-vision/roadmap.md",
                     "specs/02-memoria/, specs/features/ y el roadmap"),
    "qa-tester": (lambda r: bool(PRUEBA.search(r)) or r == REGISTRO,
                  "archivos de prueba y el registro de componentes"),
    "backend-dev": (implementador, "código, configuración, skills de convenciones, tasks.md y el registro"),
    "frontend-dev": (implementador, "código, configuración, skills de convenciones, tasks.md y el registro"),
}


def bloquear(motivo):
    print(motivo, file=sys.stderr)
    sys.exit(2)


def preguntar(motivo):
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse", "permissionDecision": "ask", "permissionDecisionReason": motivo,
    }}, ensure_ascii=False))
    sys.exit(0)


def reemplazar(texto, edit):
    viejo, nuevo = edit.get("old_string", ""), edit.get("new_string", "")
    if not viejo:
        return texto
    return texto.replace(viejo, nuevo) if edit.get("replace_all") else texto.replace(viejo, nuevo, 1)


def contenido_resultante(herramienta, entrada, actual):
    """Simula el archivo tras la operación. None si no se puede calcular."""
    if herramienta == "Write":
        return entrada.get("content", "")
    if herramienta == "Edit":
        return reemplazar(actual, entrada)
    if herramienta == "MultiEdit":
        for e in entrada.get("edits", []):
            actual = reemplazar(actual, e)
        return actual
    return None


def estado(texto):
    m = c.ESTADO.search(texto or "")
    return m.group(1) if m else None


def funcionalidad_aprobada(raiz):
    return any(f["spec"] == "aprobada" and f["diseno"] == "aprobada" for f in c.funcionalidades(raiz))


datos = c.entrada()
herramienta = datos.get("tool_name", "")
entrada = datos.get("tool_input", {})
ruta_abs = entrada.get("file_path") or entrada.get("notebook_path") or ""
raiz = c.proyecto(datos)
agente = datos.get("agent_type")  # None = orquestador (sesión principal)

rel = c.ruta_relativa(ruta_abs, raiz)
if rel is None:
    sys.exit(0)  # fuera del proyecto: no es asunto de este hook

# 1. Secretos
if SECRETOS.search(rel):
    bloquear(f"Bloqueado: '{rel}' es un archivo de secretos. Edítalo manualmente.")

# 2 y 3. Estados de documentos
if rel.startswith("specs/"):
    antes = c.leer(ruta_abs) or ""
    despues = contenido_resultante(herramienta, entrada, antes)
    if despues is not None:
        e_antes, e_despues = estado(antes), estado(despues)
        if e_despues in APROBADOS and e_antes != e_despues:
            bloquear(f"Bloqueado: solo el humano puede marcar '{rel}' como {e_despues}. "
                     "Deja el documento en borrador/propuesta y pide al usuario que lo apruebe.")
        if e_antes in APROBADOS and e_despues == e_antes and despues != antes:
            bloquear(f"Bloqueado: '{rel}' está {e_antes} y no se modifica tal cual. Regla de la etapa 2: "
                     "cambia su estado a 'borrador' en la misma edición, explica el motivo y pide de nuevo la aprobación.")

# 4. Herramientas mínimas por agente
if agente is None:
    if not rel.startswith(DOCUMENTACION):
        bloquear(f"Bloqueado: el orquestador no programa. Delega '{rel}' en el subagente implementador "
                 "que indique tasks.md (/implementar).")
elif agente in ALCANCES:
    permitido, descripcion = ALCANCES[agente]
    if not permitido(rel):
        bloquear(f"Bloqueado: '{agente}' solo puede escribir en {descripcion}; '{rel}' está fuera de su ámbito. "
                 "Informa al orquestador en tu salida.")
else:
    bloquear(f"Bloqueado: el agente '{agente}' no forma parte del equipo del proyecto y no puede escribir en él. "
             "Usa los subagentes de .claude/agents/.")

# 5. Gobierno
if rel.startswith(GOBIERNO):
    preguntar(f"'{rel}' define las reglas del proyecto. ¿Confirmas el cambio?")

# 6. Sin spec no hay código
if not rel.startswith(DOCUMENTACION) and not funcionalidad_aprobada(raiz):
    bloquear(f"Bloqueado: no se puede escribir '{rel}' porque ninguna funcionalidad tiene spec.md y diseno.md "
             "aprobados. Flujo SDD: /explorar → /especificar → /disenar → /tareas → /implementar.")
