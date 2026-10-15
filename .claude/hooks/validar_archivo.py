"""Hook PostToolUse (Write|Edit|MultiEdit): validación en tiempo real del archivo editado.

Sobre código JS/TS de apps/* y packages/*:
  1. Cero deuda técnica (siempre, sin dependencias): TODO sin tarea, código comentado,
     `any`, @ts-ignore/@ts-nocheck y eslint-disable sin justificación.
  2. Formato (Prettier), lint (ESLint) y typecheck (tsc), si las dependencias están instaladas.
Si algo falla devuelve exit 2: el error llega al agente, que debe corregirlo antes de continuar.
"""
import os
import re
import shutil
import subprocess
import sys

import _comun as c

EXTENSIONES = (".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs")
DEUDA = [
    (re.compile(r"\b(TODO|FIXME|HACK|XXX)\b(?!\(T-\d+\))"), "TODO/FIXME sin tarea asociada (usa `TODO(T-xx)`)"),
    (re.compile(r"^\s*//\s*(const|let|var|if|for|while|return|import|export|await|function|class)\b"), "código comentado"),
    (re.compile(r"@ts-(ignore|nocheck)\b"), "@ts-ignore/@ts-nocheck (usa @ts-expect-error con descripción)"),
    (re.compile(r"eslint-disable(?![^\n]*\s--\s+\S)"), "eslint-disable sin justificación (`-- motivo`)"),
]
ANY = (re.compile(r"(:\s*any\b|\bas\s+any\b|<any>|any\[\])"), "uso de `any`")

datos = c.entrada()
raiz = c.proyecto(datos)
ruta = (datos.get("tool_input") or {}).get("file_path", "")
rel = c.ruta_relativa(ruta, raiz)

if not rel or not rel.endswith(EXTENSIONES) or not rel.startswith(("apps/", "packages/")):
    sys.exit(0)

errores = []

# 1. Cero deuda técnica
reglas = DEUDA + ([ANY] if rel.endswith((".ts", ".tsx")) else [])
hallazgos = [f"  línea {n}: {motivo}"
             for n, linea in enumerate((c.leer(ruta) or "").splitlines(), 1)
             for patron, motivo in reglas if patron.search(linea)]
if hallazgos:
    errores.append("Deuda técnica:\n" + "\n".join(hallazgos[:20]))

# 2. Herramientas del paquete (solo si las dependencias están instaladas)
paquete = os.path.join(raiz, *rel.split("/")[:2])
bin_dir = os.path.join(paquete, "node_modules", ".bin")
pnpm = shutil.which("pnpm")


def existe(binario):
    return any(os.path.exists(os.path.join(bin_dir, binario + ext)) for ext in ("", ".cmd", ".ps1"))


def correr(*args, timeout=120):
    try:
        r = subprocess.run([pnpm, "exec", *args], cwd=paquete, capture_output=True, text=True,
                           encoding="utf-8", errors="replace", timeout=timeout)
        return r.returncode, (r.stdout + r.stderr).strip()
    except subprocess.TimeoutExpired:
        return 1, f"timeout ejecutando {' '.join(args)}"


if pnpm and os.path.isdir(bin_dir):
    if existe("prettier"):
        correr("prettier", "--write", "--log-level", "warn", ruta)
    if existe("eslint"):
        codigo, salida = correr("eslint", "--fix", ruta)
        if codigo:
            errores.append(f"ESLint:\n{salida[-3000:]}")
    if existe("tsc") and rel.endswith((".ts", ".tsx")) and os.path.exists(os.path.join(paquete, "tsconfig.json")):
        codigo, salida = correr("tsc", "--noEmit", "-p", "tsconfig.json", timeout=300)
        if codigo:
            errores.append(f"TypeScript:\n{salida[-3000:]}")

if errores:
    print(f"Validación fallida en '{rel}'. Corrige antes de continuar:\n\n" + "\n\n".join(errores), file=sys.stderr)
    sys.exit(2)
