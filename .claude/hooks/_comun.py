"""Utilidades compartidas por los hooks del proyecto."""
import glob
import json
import os
import re
import shutil
import subprocess
import sys

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

ESTADO = re.compile(r"^\s*estado:\s*([\w-]+)", re.MULTILINE)
TIPO = re.compile(r"^\s*tipo:\s*([\w-]+)", re.MULTILINE)

# Tokens, claves y datos personales que nunca deben llegar a logs ni a Engram.
SENSIBLE = re.compile(
    r"(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_\w{20,}|APP_USR-[\w-]{10,}|TEST-[\w-]{20,}|sk-[\w-]{20,}"
    r"|eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}"
    r"|(?i:\b(password|passwd|secret|token|api[_-]?key|access[_-]?key)\b\s*[=:]\s*)\S+"
    r"|[\w.+-]+@[\w-]+\.[\w.-]+)"
)


def censurar(texto):
    return SENSIBLE.sub("[REDACTADO]", str(texto))


def entrada():
    """JSON que Claude Code envía por stdin (vacío si no hay)."""
    datos = sys.stdin.buffer.read().decode("utf-8").strip()
    return json.loads(datos) if datos else {}


def proyecto(datos=None):
    return os.environ.get("CLAUDE_PROJECT_DIR") or (datos or {}).get("cwd") or os.getcwd()


def leer(ruta):
    try:
        with open(ruta, encoding="utf-8") as f:
            return f.read()
    except OSError:
        return None


def campo(ruta, patron=ESTADO):
    texto = leer(ruta)
    if texto is None:
        return None
    m = patron.search(texto)
    return m.group(1) if m else None


def ruta_relativa(ruta_abs, raiz):
    """Ruta relativa al proyecto con '/', o None si está fuera de él."""
    try:
        rel = os.path.relpath(os.path.abspath(ruta_abs), os.path.abspath(raiz)).replace("\\", "/")
    except ValueError:
        return None  # otra unidad de disco en Windows
    return None if rel.startswith("..") else rel


def funcionalidades(raiz):
    """Lista de dicts con el estado de cada funcionalidad en specs/features/."""
    res = []
    for d in sorted(glob.glob(os.path.join(raiz, "specs", "features", "*"))):
        if not os.path.isdir(d):
            continue
        res.append({
            "nombre": os.path.basename(d),
            "tipo": campo(os.path.join(d, "spec.md"), TIPO) or campo(os.path.join(d, "contexto.md"), TIPO) or "?",
            "contexto": os.path.exists(os.path.join(d, "contexto.md")),
            "spec": campo(os.path.join(d, "spec.md")),
            "diseno": campo(os.path.join(d, "diseno.md")),
            "tasks": campo(os.path.join(d, "tasks.md")),
            "tasks_texto": leer(os.path.join(d, "tasks.md")) or "",
        })
    return res


def siguiente_paso(f):
    """Etapa SDD en la que está una funcionalidad y qué toca hacer."""
    nnn = f["nombre"].split("-")[0]
    if f["spec"] == "cumplida":
        return None
    if not f["contexto"]:
        return f"etapa 1 · ejecutar /explorar"
    if f["spec"] is None:
        return f"etapa 2 · ejecutar /especificar {nnn}"
    if f["spec"] != "aprobada":
        return f"etapa 2 · spec en '{f['spec']}', espera aprobación humana"
    if f["diseno"] is None:
        return f"etapa 3 · ejecutar /disenar {nnn}"
    if f["diseno"] != "aprobada":
        return f"etapa 3 · diseño en '{f['diseno']}', espera aprobación humana"
    if f["tasks"] is None:
        return f"etapa 4 · ejecutar /tareas {nnn}"
    pendientes = f["tasks_texto"].count("| [ ] |") + f["tasks_texto"].count("| [~] |")
    if pendientes:
        return f"etapa 5 · {pendientes} tarea(s) pendiente(s): /implementar {nnn}"
    return f"etapa 6-7 · ejecutar /verificar {nnn} y luego /archivar {nnn}"


def engram(*args, timeout=15):
    """Ejecuta el CLI de Engram si está instalado. Devuelve stdout o None."""
    if not shutil.which("engram"):
        return None
    try:
        r = subprocess.run(["engram", *args], capture_output=True, text=True,
                           encoding="utf-8", errors="replace", timeout=timeout)
        return r.stdout.strip() if r.returncode == 0 else None
    except (OSError, subprocess.TimeoutExpired):
        return None


def dir_logs(raiz):
    ruta = os.path.join(raiz, "logs", "agent")
    os.makedirs(ruta, exist_ok=True)
    return ruta
