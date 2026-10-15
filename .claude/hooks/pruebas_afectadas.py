"""Hook Stop / SubagentStop: corre las pruebas de los paquetes afectados; si fallan, no se da por terminado.

- Solo actúa si hay cambios en apps/ o packages/ y las dependencias están instaladas.
- Usa `turbo run test --affected` (paquetes cambiados respecto de la rama base y sus dependientes).
- Si fallan: exit 2, el agente recibe el error y debe seguir trabajando.
- Corta-circuito: tras 3 bloqueos seguidos en la misma sesión deja terminar y avisa al usuario,
  para evitar bucles infinitos.
"""
import json
import os
import shutil
import subprocess
import sys

import _comun as c

MAX_INTENTOS = 3

datos = c.entrada()
raiz = c.proyecto(datos)
pnpm = shutil.which("pnpm")

if not pnpm or not os.path.isdir(os.path.join(raiz, "node_modules")):
    sys.exit(0)  # dependencias no instaladas todavía

cambios = subprocess.run(["git", "status", "--porcelain", "--", "apps", "packages"], cwd=raiz,
                         capture_output=True, text=True, encoding="utf-8", errors="replace").stdout.strip()
if not cambios:
    sys.exit(0)

contador = os.path.join(c.dir_logs(raiz), f".stop-{datos.get('session_id', 'sin-sesion')}")
try:
    r = subprocess.run([pnpm, "turbo", "run", "test", "--affected", "--output-logs=errors-only"], cwd=raiz,
                       capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=600)
    ok, salida = r.returncode == 0, (r.stdout + r.stderr).strip()
except subprocess.TimeoutExpired:
    ok, salida = False, "Las pruebas superaron el tiempo máximo (10 min)."

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
