"""Hook PreCompact y SessionEnd: guarda un resumen de la sesión en Engram.

El resumen es mecánico (se extrae de la transcripción): peticiones del usuario, archivos
modificados, skills usadas y estado SDD. El resumen razonado lo guarda el agente con la
herramienta MCP `mem_session_summary` (lo pide CLAUDE.md).
Si Engram no está instalado, el resumen queda en logs/agent/sesiones.jsonl.
"""
import json
import os
from datetime import datetime, timezone

import _comun as c

datos = c.entrada()
raiz = c.proyecto(datos)
evento = datos.get("hook_event_name", "?")
sesion = datos.get("session_id", "?")

prompts, archivos, skills = [], set(), set()
for linea in (c.leer(datos.get("transcript_path", "")) or "").splitlines():
    try:
        msg = json.loads(linea)
    except json.JSONDecodeError:
        continue
    contenido = (msg.get("message") or {}).get("content")
    if msg.get("type") == "user" and isinstance(contenido, str) and not contenido.startswith("<"):
        prompts.append(contenido.strip().replace("\n", " ")[:160])
    if msg.get("type") == "assistant" and isinstance(contenido, list):
        for bloque in contenido:
            if bloque.get("type") != "tool_use":
                continue
            entrada = bloque.get("input") or {}
            if bloque.get("name") in ("Write", "Edit", "MultiEdit", "NotebookEdit"):
                rel = c.ruta_relativa(entrada.get("file_path") or entrada.get("notebook_path") or "", raiz)
                if rel:
                    archivos.add(rel)
            elif bloque.get("name") == "Skill":
                skills.add(entrada.get("skill", "?"))

estado = [f"{f['nombre']}: {c.siguiente_paso(f) or 'cumplida'}" for f in c.funcionalidades(raiz)]
resumen = c.censurar("\n".join([
    f"Evento: {evento}",
    "Peticiones: " + (" | ".join(prompts[-8:]) or "—"),
    "Archivos modificados: " + (", ".join(sorted(archivos)) or "ninguno"),
    "Skills usadas: " + (", ".join(sorted(skills)) or "ninguna"),
    "Estado SDD: " + ("; ".join(estado) or "sin funcionalidades"),
]))

titulo = f"Sesión {sesion[:8]} — {evento} {datetime.now():%Y-%m-%d %H:%M}"
if c.engram("save", titulo, resumen) is None:
    with open(os.path.join(c.dir_logs(raiz), "sesiones.jsonl"), "a", encoding="utf-8") as f:
        f.write(json.dumps({"ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                            "titulo": titulo, "resumen": resumen}, ensure_ascii=False) + "\n")
