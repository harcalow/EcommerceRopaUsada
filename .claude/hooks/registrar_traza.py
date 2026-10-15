"""Hook PostToolUse (todas): escribe una línea JSONL por uso de herramienta en logs/agent/AAAA-MM-DD.jsonl.

Registra QUÉ se hizo, nunca el contenido (sin textos de archivos ni respuestas), para no filtrar datos.
"""
import json
import os
from datetime import datetime, timezone

import _comun as c

datos = c.entrada()
raiz = c.proyecto(datos)
entrada = datos.get("tool_input") or {}
respuesta = datos.get("tool_response")

objetivo = (entrada.get("file_path") or entrada.get("notebook_path") or entrada.get("command")
            or entrada.get("pattern") or entrada.get("url") or entrada.get("skill")
            or entrada.get("description") or "")
if objetivo and os.path.isabs(str(objetivo)):
    objetivo = c.ruta_relativa(objetivo, raiz) or objetivo

error = isinstance(respuesta, dict) and bool(respuesta.get("error") or respuesta.get("is_error"))

ahora = datetime.now(timezone.utc)
registro = {
    "ts": ahora.isoformat(timespec="seconds"),
    "session": datos.get("session_id"),
    "agent": datos.get("agent_type") or "orquestador",
    "agent_id": datos.get("agent_id"),
    "tool": datos.get("tool_name"),
    "target": c.censurar(str(objetivo)[:300]),
    "ok": not error,
}

with open(os.path.join(c.dir_logs(raiz), f"{ahora:%Y-%m-%d}.jsonl"), "a", encoding="utf-8") as f:
    f.write(json.dumps(registro, ensure_ascii=False) + "\n")
