---
id: 001
titulo: Login de administrador
tipo: vertical        # horizontal (base técnica) | vertical (valor para el usuario)
estado: aprobada      # borrador → aprobada (solo tú) → cumplida
aprobacion: dueño (Harold) el 2026-10-15; reaprobada el mismo día tras quitar las referencias a 000 y 002 (sin cambios de RF, CA, CB ni RNF)
autor: analista-specs
plataforma: web       # panel de administración solo en la web (responsive)
depende_de: []
---

# Spec 001 — Login de administrador

## Contexto y objetivo
Perchados es una tienda en línea de ropa de segunda mano de buena calidad. Quienes administran la tienda (publican prendas, revisan su estado, gestionan pedidos) necesitan un acceso privado al panel de administración, separado de la experiencia del comprador.

Esta funcionalidad resuelve **cómo entra un administrador al panel**: con su usuario y su contraseña, de forma clara, segura y sin fricción. De momento el panel aún no tiene secciones: tras entrar, el administrador ve una pantalla de «Próximamente, estamos trabajando».

Importa porque el panel controla el catálogo, los precios y los pedidos. Un acceso débil pone en riesgo la tienda entera, y un acceso confuso hace perder tiempo a quien la opera.

El login **solo autentica cuentas que ya existen**. Las cuentas se crean y gestionan fuera de esta pantalla (ver «Fuera de alcance»).

**Referencia visual:** [`mockup-login.png`](mockup-login.png). Se implementa salvo lo excluido en «Decisiones tomadas»: «Recordar mi usuario» y las credenciales de prueba.

## Usuarios involucrados
- **Administrador:** persona con una cuenta ya creada que necesita entrar al panel.
- **Responsable de la tienda:** persona que crea cuentas y restablece contraseñas; recibe las solicitudes de «olvidé mi contraseña».
- **Visitante no autorizado:** cualquiera que intente entrar sin credenciales válidas, incluidos los intentos automatizados.

## Historias de usuario
- **HU-01:** Como administrador, quiero iniciar sesión con mi usuario y mi contraseña, para acceder al panel de administración.
- **HU-02:** Como administrador, quiero ver qué campo está mal cuando me equivoco, para corregirlo sin adivinar.
- **HU-03:** Como administrador, quiero mostrar u ocultar la contraseña mientras la escribo, para comprobar que la tecleé bien.
- **HU-04:** Como administrador, quiero que se me avise si tengo activado Bloq Mayús, para no fallar la contraseña sin darme cuenta.
- **HU-05:** Como administrador, quiero saber a quién acudir si olvidé mi contraseña, para recuperar el acceso.
- **HU-06:** Como responsable de la tienda, quiero que una cuenta se bloquee 30 minutos tras varios intentos fallidos, para proteger el panel frente a quien intenta adivinar contraseñas.
- **HU-07:** Como administrador, quiero salir de mi sesión cuando termino, para que nadie más use el panel desde mi equipo.
- **HU-08:** Como administrador, quiero ver un aviso de «Próximamente» al entrar, para saber que el panel está en construcción y que mi acceso funcionó.
- **HU-09:** Como responsable de la tienda, quiero que las sesiones caduquen tras una jornada, para que un equipo olvidado abierto no deje el panel expuesto indefinidamente.

## Requisitos funcionales
| ID | Requisito | Prioridad |
|----|-----------|-----------|
| RF-001 | El sistema debe permitir iniciar sesión con usuario y contraseña de una cuenta de administrador existente. | Must |
| RF-002 | Tras un inicio de sesión correcto, el sistema debe mostrar la pantalla del panel con el mensaje «Próximamente, estamos trabajando». | Must |
| RF-003 | El sistema debe validar que usuario y contraseña no estén vacíos antes de enviar, mostrando el error junto al campo afectado. | Must |
| RF-004 | Ante credenciales incorrectas, el sistema debe mostrar un mensaje genérico que no revele si el usuario existe o si falló solo la contraseña. | Must |
| RF-005 | El sistema debe ofrecer un control para mostrar u ocultar la contraseña; por defecto aparece oculta. | Should |
| RF-006 | El sistema debe avisar mientras se escribe la contraseña si Bloq Mayús está activado. | Should |
| RF-007 | El enlace «¿Olvidaste tu contraseña?» debe indicar que el administrador escriba por correo electrónico al responsable de la tienda, mostrando esa dirección (configurable), sin ofrecer recuperación automática. | Must |
| RF-008 | El sistema debe bloquear la cuenta durante 30 minutos tras 5 intentos fallidos consecutivos, informando al administrador de que podrá volver a intentarlo pasado ese tiempo. | Must |
| RF-009 | Un inicio de sesión correcto debe reiniciar el contador de intentos fallidos. | Must |
| RF-010 | El sistema no debe ofrecer registro ni creación de cuentas desde la pantalla de login. | Must |
| RF-011 | El sistema debe impedir el acceso a cualquier página del panel sin sesión iniciada, llevando al login. | Must |
| RF-012 | El sistema debe permitir cerrar sesión desde el panel. | Must |
| RF-014 | El botón «Entrar al panel» debe mostrar un estado de carga y evitar envíos repetidos mientras se verifica. | Should |
| RF-015 | El nombre de usuario solo admite letras (incluidas tildes y ñ), sin números, espacios ni caracteres especiales; si no cumple, se muestra el error junto al campo sin enviar el intento. | Must |
| RF-016 | La contraseña debe tener mínimo 8 caracteres; si tiene menos, se muestra el error junto al campo sin enviar el intento. | Must |
| RF-017 | Pasados los 30 minutos, la cuenta se desbloquea sola y el contador de intentos fallidos vuelve a 0. | Must |
| RF-018 | Las cuentas de administrador deben guardarse en base de datos, con la contraseña almacenada cifrada de forma irreversible (hash), nunca en texto legible. | Must |
| RF-019 | La base de datos debe incluir desde el inicio el rol «administrador» y la cuenta `HaroldAdmin` asociada a ese rol, con la contraseña inicial que entregó el dueño (ver «Datos iniciales»). De momento es la **única** cuenta que existe y, por tanto, la única que puede iniciar sesión. | Must |
| RF-023 | El rol de cada cuenta debe guardarse en la base de datos, y el acceso al panel debe comprobarse contra el rol guardado, no contra valores fijos en el código. | Must |
| RF-020 | La sesión debe caducar 8 horas después de iniciarse, aunque haya actividad. Tras caducar, la siguiente acción lleva al login con el aviso «Tu sesión ha caducado. Vuelve a iniciar sesión». | Must |
| RF-021 | La pantalla de login debe informar de que solo permite iniciar sesión y de que las cuentas de administrador se crean fuera del panel. | Should |
| RF-022 | La pantalla de login no debe mostrar credenciales de ejemplo ni de prueba en ningún entorno. | Must |

## Criterios de aceptación
```gherkin
Característica: Login de administrador

  # CA-001 (RF-001, RF-002)
  Escenario: Inicio de sesión correcto
    Dado que existe la cuenta de administrador "lucia" con una contraseña válida
    Cuando ingresa "lucia" y su contraseña y pulsa "Entrar al panel"
    Entonces ve el panel con el mensaje "Próximamente, estamos trabajando"

  # CA-002 (RF-003)
  Escenario: Campos vacíos
    Dado que el administrador está en la pantalla de login
    Cuando pulsa "Entrar al panel" sin escribir usuario ni contraseña
    Entonces ve "Escribe tu usuario" junto al campo usuario
    Y ve "Escribe tu contraseña" junto al campo contraseña
    Y no se envía ningún intento

  # CA-014 (RF-015)
  Esquema del escenario: Usuario con caracteres no permitidos
    Dado que el administrador está en la pantalla de login
    Cuando escribe el usuario "<usuario>" y pulsa "Entrar al panel"
    Entonces ve "El usuario solo puede tener letras" junto al campo usuario
    Y no se envía ningún intento

    Ejemplos:
      | usuario      |
      | Harold1      |
      | Harold_Admin |
      | Harold Admin |

  # CA-015 (RF-016)
  Escenario: Contraseña demasiado corta
    Dado que el administrador está en la pantalla de login
    Cuando escribe una contraseña de 7 caracteres y pulsa "Entrar al panel"
    Entonces ve "La contraseña debe tener al menos 8 caracteres" junto al campo contraseña
    Y no se envía ningún intento

  # CA-003 (RF-004)
  Escenario: Credenciales incorrectas
    Dado que existe la cuenta "lucia"
    Cuando ingresa "lucia" con una contraseña incorrecta
    Entonces ve "Usuario o contraseña incorrectos"
    Y el mensaje es el mismo que vería con un usuario inexistente

  # CA-004 (RF-005)
  Escenario: Mostrar y ocultar la contraseña
    Dado que el administrador escribió su contraseña
    Cuando pulsa "Mostrar"
    Entonces ve la contraseña en texto legible
    Y al pulsar "Ocultar" vuelve a verse enmascarada

  # CA-005 (RF-006)
  Escenario: Aviso de Bloq Mayús
    Dado que Bloq Mayús está activado
    Cuando el administrador escribe en el campo contraseña
    Entonces ve el aviso "Bloq Mayús está activado"
    Y el aviso desaparece al desactivarlo

  # CA-006 (RF-007)
  Escenario: Olvidé mi contraseña
    Dado que el administrador está en la pantalla de login
    Cuando pulsa "¿Olvidaste tu contraseña?"
    Entonces ve que debe escribir al correo del responsable de la tienda
    Y ve la dirección de correo del responsable
    Y no se le pide correo ni se envía ningún enlace

  # CA-007 (RF-008)
  Escenario: Bloqueo de 30 minutos tras 5 intentos fallidos
    Dado que la cuenta "lucia" acumula 4 intentos fallidos consecutivos
    Cuando falla un quinto intento
    Entonces la cuenta queda bloqueada durante 30 minutos
    Y ve "Demasiados intentos. Vuelve a intentarlo en 30 minutos"
    Y un intento posterior con la contraseña correcta tampoco entra mientras dure el bloqueo

  # CA-016 (RF-017)
  Escenario: Desbloqueo automático
    Dado que la cuenta "lucia" fue bloqueada hace 30 minutos
    Cuando ingresa su usuario y su contraseña correcta
    Entonces entra al panel
    Y su contador de intentos fallidos está en 0

  # CA-008 (RF-009)
  Escenario: El contador se reinicia al entrar
    Dado que la cuenta "lucia" acumula 3 intentos fallidos
    Cuando inicia sesión correctamente
    Entonces su contador de intentos fallidos vuelve a 0

  # CA-009 (RF-010, RF-021, RF-022)
  Escenario: Sin registro ni credenciales visibles
    Dado que un visitante está en la pantalla de login
    Entonces no ve ninguna opción para crear una cuenta
    Y ve que las cuentas de administrador se crean fuera del panel
    Y no ve ningún usuario ni contraseña de ejemplo o de prueba

  # CA-010 (RF-011)
  Escenario: Acceso directo al panel sin sesión
    Dado que el administrador no ha iniciado sesión
    Cuando abre la dirección del panel
    Entonces es llevado al login

  # CA-011 (RF-012)
  Escenario: Cerrar sesión
    Dado que el administrador tiene la sesión iniciada
    Cuando pulsa "Cerrar sesión"
    Entonces vuelve al login
    Y al pulsar "Atrás" en el navegador no ve contenido del panel

  # CA-013 (RF-014)
  Escenario: Evitar envíos repetidos
    Dado que el administrador pulsó "Entrar al panel"
    Mientras se verifican sus credenciales
    Entonces el botón muestra un estado de carga y no admite nuevos clics

  # CA-017 (RF-018, RF-019, RF-023)
  Escenario: Cuenta inicial y su rol guardados en base de datos
    Dado que la base de datos se inicializó con la carga inicial
    Cuando se consultan las cuentas y los roles en la base de datos
    Entonces existe el rol "administrador"
    Y "HaroldAdmin" es la única cuenta y tiene el rol "administrador"
    Y la contraseña aparece solo como hash, nunca en texto legible
    Y "HaroldAdmin" puede iniciar sesión con su contraseña inicial

  # CA-019 (RF-023)
  Escenario: Sin el rol de administrador no se entra al panel
    Dado que existe una cuenta con credenciales válidas pero sin el rol "administrador" guardado
    Cuando intenta iniciar sesión
    Entonces no entra al panel
    Y ve "Usuario o contraseña incorrectos"

  # CA-018 (RF-020)
  Escenario: Caducidad absoluta de la sesión
    Dado que el administrador inició sesión hace 8 horas
    Y ha estado usando el panel sin interrupción
    Cuando realiza cualquier acción en el panel
    Entonces es llevado al login
    Y ve "Tu sesión ha caducado. Vuelve a iniciar sesión"
```

## Casos borde
| ID | Situación | Comportamiento esperado | RF |
|----|-----------|-------------------------|----|
| CB-001 | El usuario tiene espacios al inicio o al final | Se ignoran esos espacios en el usuario; la contraseña se toma tal cual | RF-001 |
| CB-002 | El usuario se escribe con mayúsculas distintas («Lucia» vs «lucia») | El usuario no distingue mayúsculas; la contraseña sí | RF-001 |
| CB-003 | Usuario inexistente | Mismo mensaje genérico que una contraseña incorrecta | RF-004 |
| CB-004 | Intentos fallidos con un usuario inexistente | No se revela que no existe; no se crea ni bloquea ninguna cuenta | RF-004, RF-008 |
| CB-005 | La cuenta ya está bloqueada y se escribe la contraseña correcta | No entra; ve el aviso de bloqueo. El intento no alarga los 30 minutos | RF-008 |
| CB-006 | Intentos fallidos repartidos en varios dispositivos o pestañas | Cuentan para el mismo contador de la cuenta | RF-008 |
| CB-007 | Se pierde la conexión al pulsar «Entrar al panel» | Muestra «No hay conexión, inténtalo de nuevo»; no cuenta como intento fallido | RF-014 |
| CB-008 | Se pega una contraseña desde un gestor de contraseñas | Se acepta; el autocompletado del navegador funciona | RF-001 |
| CB-009 | Bloq Mayús activado antes de enfocar el campo | El aviso aparece al empezar a escribir en el campo contraseña | RF-006 |
| CB-011 | Un administrador ya autenticado abre la página de login | Va directamente al panel | RF-002 |
| CB-012 | La cuenta fue desactivada por el responsable con la sesión abierta | En la siguiente acción se cierra la sesión y vuelve al login | RF-011 |
| CB-013 | Tras el desbloqueo automático, se vuelve a fallar | Empieza un contador nuevo: hacen falta otros 5 fallos para un nuevo bloqueo | RF-017 |
| CB-014 | Usuario con tildes o ñ («Ñandú», «José») | Se acepta como válido | RF-015 |
| CB-015 | Contraseña de exactamente 8 caracteres | Se acepta | RF-016 |
| CB-016 | Contraseña con espacios o caracteres especiales («Perch@ 2026») | Se acepta; la regla solo exige longitud mínima | RF-016 |
| CB-017 | La sesión caduca con varias pestañas del panel abiertas | Todas llevan al login en su siguiente acción | RF-020 |
| CB-018 | Se cierra sesión en una pestaña con otras pestañas del panel abiertas | Las demás pestañas llevan al login en su siguiente acción | RF-012 |

## Requisitos no funcionales
- **Seguridad:**
  - Las contraseñas nunca se muestran, guardan ni registran en texto legible; en base de datos solo se guarda su hash.
  - La conexión siempre va cifrada.
  - Los mensajes de error no revelan si un usuario existe.
  - Los intentos fallidos y los bloqueos quedan registrados para el responsable.
- **Rendimiento:** la respuesta al pulsar «Entrar al panel» llega en ≤ 1 s (p95) con una red normal. La pantalla cumple el presupuesto web de ADR-006.
- **Accesibilidad (WCAG 2.2 AA):**
  - Todo se usa con teclado (Tab, Enter).
  - Cada campo tiene una etiqueta visible.
  - Los errores se anuncian a lectores de pantalla y se asocian a su campo.
  - El aviso de Bloq Mayús y el estado de carga también se anuncian.
  - El control mostrar/ocultar tiene un nombre accesible.
  - El contraste es suficiente con los colores de marca.
  - Se puede pegar la contraseña y usar gestores de contraseñas (sin pruebas cognitivas, criterio 3.3.8).
- **Sin conexión:** el login requiere conexión. Sin ella se muestra un mensaje claro y no se pierde lo escrito en el campo usuario.
- **Permisos:** solo las cuentas con rol de administrador pueden entrar al panel. Una cuenta de comprador no accede aunque sus credenciales sean válidas.
- **Plataforma y responsive:**
  - Panel solo en la web, desde 360 px hasta escritorio.
  - En pantallas estrechas, el bloque ilustrado de marca pasa a segundo plano y el formulario queda primero.
- **Marca e idioma:** textos en español, tuteando al usuario, con la identidad visual de Perchados (mockup).

## Datos iniciales
La base de datos arranca con esta cuenta de administrador, entregada por el dueño:

| Usuario | Rol (guardado en BD) | Contraseña inicial |
|---------|----------------------|--------------------|
| `HaroldAdmin` | administrador | La entregó el dueño el 15-10-2026; se configura en `ADMIN_INITIAL_PASSWORD` del `.env` y no se escribe en el repositorio |

Es la única cuenta que se crea: de momento nadie más puede iniciar sesión. La carga inicial es idempotente: si se vuelve a ejecutar, no duplica la cuenta ni el rol, y no sobrescribe una contraseña que ya se haya cambiado.

La cuenta se crea con un proceso de carga inicial (semilla). Ese proceso:
- Lee la contraseña de una configuración segura (variable de entorno o gestor de secretos), nunca del código ni de un archivo del repositorio.
- Guarda en base de datos solo su hash, con un algoritmo lento y con sal (por ejemplo bcrypt o argon2).

Se recomienda cambiarla antes de salir a producción.

## Fuera de alcance
- Registro o creación de cuentas de administrador desde esta pantalla.
- Recuperación automática de contraseña (correo, SMS o enlace): será una funcionalidad posterior.
- Avisar al responsable cuando una cuenta se bloquea: el administrador solo espera los 30 minutos.
- Verificación en dos pasos (2FA): queda para una fase posterior.
- Cambio de contraseña por el propio administrador.
- Desbloqueo manual de cuentas por el responsable: de momento el bloqueo se levanta solo a los 30 minutos.
- Cierre de sesión por inactividad. Sí existe la caducidad absoluta de 8 horas (RF-020).
- Las secciones del panel (catálogo, pedidos…): de momento solo se muestra «Próximamente».
- Gestión de roles y permisos dentro del panel.
- Inicio de sesión con Google u otros proveedores.
- Login de compradores en la tienda.
- El panel en la app móvil.
- La opción «Recordarme» y la opción «Recordar mi usuario» que aparece en el mockup.

## Preguntas abiertas
- [POR ACLARAR] Dirección de correo del responsable de la tienda (RF-007). Es configurable, así que no bloquea la implementación, pero hace falta su valor para producción.
- **Motivo de la vuelta a `borrador` (2026-10-15):** solo se corrigieron las referencias a las funcionalidades 000 y 002, fusionadas en esta (ADR-010): `depende_de` queda vacío y la nota de dependencias remite a `diseno.md` (RT-001..RT-021). No cambia ningún RF, CA, CB ni RNF. Reaprobada por el dueño el mismo día.

## Decisiones tomadas
**14-10-2026 (dueño):**
- El bloqueo dura 30 minutos y se levanta solo.
- Tras entrar se muestra «Próximamente, estamos trabajando».
- El usuario es un nombre libre solo con letras; la contraseña tiene mínimo 8 caracteres.
- Las cuentas se guardan en base de datos, con la cuenta inicial `HaroldAdmin`.
- Supuesto: se aceptan tildes y ñ en el usuario.
- «Olvidé mi contraseña» remite al responsable por correo electrónico; el restablecimiento automático será otra funcionalidad.
- No se avisa al responsable cuando una cuenta se bloquea.
- La verificación en dos pasos (2FA) queda para más adelante.

**15-10-2026 (evaluación de la spec con el dueño):**
- **Caducidad absoluta de 8 h** (RF-020), por seguridad (OWASP A07). Reemplaza «la sesión no expira por tiempo»; sigue sin haber cierre por inactividad.
- **Del mockup se excluyen** «Recordar mi usuario» (fuera de alcance) y el recuadro «Prueba el prototipo con admin / perchados2026» (RF-022: nunca se muestran credenciales).
- El botón se llama **«Entrar al panel»**, como en el mockup. Se añade el texto informativo del mockup (RF-021).
- Panel **solo web**, responsive.
- Rendimiento del login: ≤ 1 s (p95).
- **El rol se guarda en la base de datos** (RF-023). `HaroldAdmin`, con rol administrador, es de momento la única cuenta y la única que puede iniciar sesión (RF-019).
- La contraseña inicial la compartió el dueño en el chat. Como quedó escrita fuera de un gestor de secretos, **debe cambiarse antes de salir a producción**.
- No depende de otras funcionalidades: la base técnica necesaria (estructura, Docker, apps, base de datos, errores, sesiones y tokens de marca) está en el diseño de esta misma funcionalidad (`diseno.md`, RT-001..RT-021; ver ADR-010).
