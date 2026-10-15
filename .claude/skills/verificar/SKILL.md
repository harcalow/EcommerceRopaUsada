---
name: verificar
description: Etapa 6 SDD — Verifica una funcionalidad con pruebas, lint, typecheck y revisión de código y seguridad contra la spec
argument-hint: <NNN>
disable-model-invocation: true
---

Funcionalidad: $ARGUMENTS

1. Localiza `specs/features/$ARGUMENTS-*/`. Si quedan tareas sin `[x]`, informa cuáles y DETENTE.
2. **Diff para el revisor:** genera `logs/agent/diff-$ARGUMENTS.patch` con los cambios de la rama respecto de `main` (`git diff main...HEAD`, más los cambios sin commit).
3. Ejecuta los comandos de pruebas, lint, typecheck y cobertura documentados en `CLAUDE.md`. Si aún no existen, indícalo.
4. Delega **en paralelo**:
   - `qa-tester`: matriz `CA/CB → prueba → resultado` y cobertura.
   - `revisor`: revisión de código y de seguridad sobre el diff.
5. Muestra al usuario un informe consolidado:
   - El veredicto.
   - Los hallazgos 🔴/🟡.
   - La cobertura.
   - El tamaño del diff.
6. **Revisión humana obligatoria:** si el revisor marcó ⚠️ (autenticación, pagos, permisos o datos personales), el usuario debe confirmar explícitamente que leyó el diff de esas rutas antes de `/archivar`.
7. Si hay cambios requeridos, indica la etapa a la que volver: `/implementar` si es un defecto de código, `/especificar` o `/disenar` si es un problema de spec o de diseño.
8. DETENTE. No corrijas nada sin autorización.
