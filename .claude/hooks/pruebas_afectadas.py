"""Hook Stop / SubagentStop: corre las pruebas de los paquetes afectados; si fallan, no se da por terminado.

Ajustado tras la retrospectiva de la 001 (specs/02-memoria/retrospectiva-001-proceso.md, mejoras 1 y 10):
- Solo actúa al terminar un subagente que escribe código o pruebas (backend-dev, frontend-dev, qa-tester).
  El orquestador no programa, así que su Stop no repite las pruebas (antes se solapaba con los agentes).
- Solo los paquetes con cambios sin commit y sus dependientes (`--filter=...[HEAD]`), sin cobertura:
  la cobertura y la suite completa se miden al cerrar cada hito y en /verificar.
- Un solo hook a la vez (candado en logs/agent/); si otra verificación está en marcha, no se solapa.
- Borra los candados huérfanos de cobertura de Vitest (%TEMP%/vitest-coverage-*.lock cuyo PID ya no es node).
- Si fallan: exit 2, el agente recibe el error y debe seguir trabajando.
- Corta-circuito: tras 3 bloqueos seguidos en la misma sesión deja terminar y avisa al usuario.
"""
import glob
import json
import os
import shutil
import subprocess
import sys
import tempfile

import _comun as c

MAX_INTENTOS = 3
AGENTES_QUE_ESCRIBEN_CODIGO = {"backend-dev", "frontend-dev", "qa-tester"}


def pid_vivo(pid, imagen=None):
    """True si el PID existe (y, si se indica, es esa imagen). Sin os.kill: en Windows terminaría el proceso."""
    try:
        pid = int(pid)
    except (TypeError, ValueError):
        return False
    if os.name != "nt":
        return os.path.exists(f"/proc/{pid}")
    r = subprocess.run(["tasklist", "/FI", f"PID eq {pid}", "/NH", "/FO", "CSV"],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    salida = r.stdout.lower()
    return f'"{pid}"' in salida and (imagen is None or imagen.lower() in salida)


def candados_vitest_activos():
    """Borra los candados huérfanos de Vitest y devuelve cuántos siguen en uso por un node vivo."""
    activos = 0
    for ruta in glob.glob(os.path.join(tempfile.gettempdir(), "vitest-coverage-*.lock")):
        try:
            pid = json.loads(c.leer(ruta) or "{}").get("pid")
        except ValueError:
            pid = None
        if pid_vivo(pid, "node.exe" if os.name == "nt" else None):
            activos += 1
        else:
            try:
                os.remove(ruta)
            except OSError:
                pass
    return activos


datos = c.entrada()
if datos.get("hook_event_name") == "Stop" or datos.get("agent_type") not in AGENTES_QUE_ESCRIBEN_CODIGO:
    sys.exit(0)

raiz = c.proyecto(datos)
pnpm = shutil.which("pnpm")
if not pnpm or not os.path.isdir(os.path.join(raiz, "node_modules")):
    sys.exit(0)  # dependencias no instaladas todavía

cambios = subprocess.run(["git", "status", "--porcelain", "--", "apps", "packages"], cwd=raiz,
                         capture_output=True, text=True, encoding="utf-8", errors="replace").stdout.strip()
if not cambios:
    sys.exit(0)

logs = c.dir_logs(raiz)
candado = os.path.join(logs, ".pruebas-hook.lock")
if (os.path.exists(candado) and pid_vivo(c.leer(candado))) or candados_vitest_activos():
    print(json.dumps({"systemMessage": "Pruebas del hook omitidas: hay otra verificación en marcha. "
                                       "Verifica tu paquete con su comando de la ficha de tarea."},
                     ensure_ascii=False))
    sys.exit(0)

with open(candado, "w", encoding="utf-8") as f:
    f.write(str(os.getpid()))
try:
    r = subprocess.run([pnpm, "turbo", "run", "test", "--filter=...[HEAD]", "--output-logs=errors-only",
                        "--", "--coverage.enabled=false"],
                       cwd=raiz, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=600)
    ok, salida = r.returncode == 0, (r.stdout + r.stderr).strip()
except subprocess.TimeoutExpired:
    ok, salida = False, "Las pruebas superaron el tiempo máximo (10 min)."
finally:
    try:
        os.remove(candado)
    except OSError:
        pass

contador = os.path.join(logs, f".stop-{datos.get('session_id', 'sin-sesion')}")
if ok:
    if os.path.exists(contador):
        os.remove(contador)
    sys.exit(0)

intentos = int(c.leer(contador) or 0) + 1
if intentos >= MAX_INTENTOS:
    if os.path.exists(contador):
        os.remove(contador)
    print(json.dumps({"systemMessage": f"⚠️ Las pruebas afectadas siguen fallando tras {MAX_INTENTOS} intentos. "
                                       "La tarea NO está terminada: revisa los errores."}, ensure_ascii=False))
    sys.exit(0)

with open(contador, "w", encoding="utf-8") as f:
    f.write(str(intentos))
print(f"Las pruebas afectadas fallan (intento {intentos}/{MAX_INTENTOS}). No des la tarea por terminada: "
      f"corrige el código o, si la spec es incorrecta, detente e informa (regla de la etapa 2).\n\n{salida[-4000:]}",
      file=sys.stderr)
sys.exit(2)
