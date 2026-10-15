"""Hook PreToolUse (Bash|PowerShell|Read|Grep|Glob): seguridad.

Bloquea, aunque un permiso lo permitiera por error:
  - Borrados recursivos forzados (rm -rf y equivalentes en PowerShell).
  - git push forzado.
  - Lectura de .env y secretos (por herramienta o por comando).
Complementa las reglas `deny` de settings.json: los permisos se comparan por prefijo,
este hook analiza el comando completo (p. ej. `cd x && rm -fr y`).
"""
import re
import sys

import _comun as c

# `.env` solo como nombre de archivo (no `process.env`); `.env.example` está permitido.
SECRETO = r"((^|[\s\\/\"'=])\.env(?!\.example\b)(\.[\w-]+)?\b|(^|[\\/\s\"'])secrets[\\/]|\.pem\b|\.key\b)"

COMANDOS_PROHIBIDOS = [
    (re.compile(r"\brm\s+(-\w*r\w*f\w*|-\w*f\w*r\w*|(-\w+\s+)*-r\w*\s+(-\w+\s+)*-f\w*|(-\w+\s+)*-f\w*\s+(-\w+\s+)*-r\w*|--recursive\s+--force|--force\s+--recursive)", re.I),
     "borrado recursivo forzado (rm -rf)"),
    (re.compile(r"\bRemove-Item\b(?=.*-Recurse)(?=.*-Force)", re.I), "borrado recursivo forzado (Remove-Item -Recurse -Force)"),
    (re.compile(r"\b(rd|rmdir)\s+.*/s\b.*/q\b", re.I), "borrado recursivo forzado (rd /s /q)"),
    (re.compile(r"\bgit\s+push\b.*(\s--force\b|\s--force-with-lease\b|\s-f\b|\s\+\S+)", re.I), "git push forzado"),
    (re.compile(r"\b(cat|type|more|less|head|tail|Get-Content|gc|sed|awk|grep|rg|findstr|Select-String|cp|copy|scp|curl)\b[^|;&]*" + SECRETO, re.I),
     "lectura o copia de secretos"),
]


def bloquear(motivo):
    print(f"Bloqueado por seguridad: {motivo}. Si es imprescindible, pide al usuario que lo haga manualmente.",
          file=sys.stderr)
    sys.exit(2)


datos = c.entrada()
herramienta = datos.get("tool_name", "")
entrada = datos.get("tool_input", {})

if herramienta in ("Bash", "PowerShell"):
    comando = entrada.get("command", "")
    for patron, motivo in COMANDOS_PROHIBIDOS:
        if patron.search(comando):
            bloquear(motivo)
elif herramienta in ("Read", "Grep", "Glob"):
    objetivo = " ".join(str(entrada.get(k, "")) for k in ("file_path", "path", "pattern", "glob"))
    if re.search(SECRETO, objetivo, re.I):
        bloquear("lectura de un archivo de secretos")
