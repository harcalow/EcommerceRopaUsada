---
id: 002
titulo: Fundaciones de web y API
tipo: horizontal      # horizontal (base técnica) | vertical (valor para el usuario)
estado: aprobada      # borrador → aprobada (solo el dueño) → cumplida
aprobacion: dueño (Harold) el 2026-10-15, aplicada por el orquestador con su autorización explícita en el chat
autor: analista-specs
plataforma: web, api  # la app móvil queda fuera
depende_de: [000]
---

# Spec 002 — Fundaciones de web y API

## Contexto y objetivo
La 001 (login de administrador) es la primera rebanada vertical. Necesita una base técnica que todavía no existe. El dueño decidió (15-10-2026) agrupar esas capas en una sola funcionalidad horizontal, que va después de la 000 (estructura y Docker) y antes de la 001. Ver [`contexto.md`](contexto.md).

Esta spec define **qué debe ofrecer la base y cómo se comprueba**:
- Las aplicaciones `apps/api` y `apps/web` generadas, con un ciclo de calidad automático.
- Un contrato de API único.
- Errores y logs uniformes, y configuración validada.
- Base de datos con migraciones.
- Mecanismo de sesión y hash de contraseñas.
- Límite de peticiones.
- Design system web accesible con la marca Perchados.
- Base de pruebas E2E.
- Healthcheck.

Ninguna rebanada vertical debe crear después esta infraestructura (regla de oro de la skill `estrategia-entrega`).

Al ser horizontal, se nombran las tecnologías ya fijadas en ADR-001, ADR-003 y ADR-006: NestJS, Next.js (App Router), Prisma, PostgreSQL, Zod → OpenAPI, Playwright, pnpm + Turborepo y GitHub Actions. Lo que todavía no está decidido se expresa como requisito verificable y lo decide el diseño (`diseno.md` y ADR):
- El mecanismo de sesión (sesión en servidor o token).
- El algoritmo de hash.
- La herramienta de escaneo.
- La librería de pruebas de accesibilidad.
- La ubicación exacta de los componentes.

## Usuarios involucrados
- **Equipo de desarrollo** (humano y agentes de IA): construye las rebanadas sobre esta base.
- **Dueño / responsable técnico:** aprueba los PR y necesita que la CI le dé confianza.
- **Usuarios finales** (administradores y, más adelante, compradores): se benefician indirectamente de la seguridad, la accesibilidad y la coherencia visual.

## Historias de usuario
- **HU-01:** Como agente de desarrollo, quiero arrancar, probar y validar la API y la web con un solo comando desde la raíz, para no improvisar la forma de trabajar en cada rebanada.
- **HU-02:** Como dueño, quiero que cada PR pase automáticamente lint, tipos, pruebas, cobertura y escaneos, para fusionar solo cambios que no rompen nada ni filtran secretos.
- **HU-03:** Como desarrollador web, quiero un cliente de API tipado y generado desde el contrato, para que una discrepancia con la API falle al compilar y no en producción.
- **HU-04:** Como responsable técnico, quiero errores y logs uniformes con un id de correlación, para diagnosticar un fallo siguiendo una sola petición de punta a punta.
- **HU-05:** Como responsable de la tienda, quiero que las contraseñas se guarden con un hash lento y que las sesiones caduquen y puedan revocarse al instante, para que un robo de datos o un equipo olvidado no comprometa el panel.
- **HU-06:** Como desarrollador web, quiero componentes de marca accesibles y ya probados, para construir pantallas coherentes que cumplan WCAG 2.2 AA sin rehacerlos.
- **HU-07:** Como QA, quiero Playwright configurado con un Page Object base, para escribir pruebas E2E por escenario Gherkin desde la primera rebanada.

## Requisitos funcionales

### A. Aplicaciones y comandos
| ID | Requisito | Prioridad |
|----|-----------|-----------|
| RF-001 | La API NestJS debe existir en `apps/api`, arrancar en modo desarrollo y exponer todas sus rutas bajo el prefijo `/v1`. | Must |
| RF-002 | La web Next.js (App Router) debe existir en `apps/web`, arrancar en modo desarrollo y mostrar una página inicial provisional con la marca Perchados. | Must |
| RF-003 | Desde la raíz del monorepo debe haber un comando único para cada acción: `dev`, `build`, `test`, `lint` y `typecheck`. Cada uno se ejecuta en todas las apps y paquetes que lo definen. | Must |
| RF-004 | La API y la web deben arrancar con el perfil `apps` de Docker Compose. Las imágenes de producción (Dockerfiles de la 000) deben construirse y arrancar. | Must |

### B. Calidad e integración continua
| ID | Requisito | Prioridad |
|----|-----------|-----------|
| RF-005 | El lint y la comprobación de tipos (modo estricto) deben fallar ante cualquier error en apps y paquetes. | Must |
| RF-006 | Las pruebas unitarias deben generar un informe de cobertura y fallar si no se alcanza el umbral mínimo configurado. | Must |
| RF-007 | Un pipeline de GitHub Actions debe ejecutarse en cada PR hacia `main` y en cada push a `main`. Debe instalar dependencias y pasar lint, typecheck, pruebas con cobertura, build y verificación del contrato, y aplicar las migraciones sobre una base de datos vacía. Si un paso falla, el PR queda marcado como fallido. | Must |
| RF-008 | El pipeline debe escanear las dependencias (falla con vulnerabilidades de severidad alta o crítica) y los secretos (falla si detecta uno en el código o en el historial del PR). | Must |

### C. Contrato de API
| ID | Requisito | Prioridad |
|----|-----------|-----------|
| RF-009 | Los esquemas de petición y respuesta deben definirse una sola vez, con Zod, en `packages/contracts`. La API debe validar cada entrada con ellos. | Must |
| RF-010 | La API debe publicar un documento OpenAPI de `/v1` generado desde esos esquemas, solo fuera de producción. En producción no se expone ni el documento ni su visor. | Must |
| RF-011 | Debe generarse un cliente tipado en `packages/api-client` a partir del documento OpenAPI. La web debe consumir la API solo a través de ese cliente. | Must |
| RF-012 | Debe haber pruebas de contrato que comprueben que las respuestas reales de la API cumplen el documento OpenAPI, y que el cliente generado está al día con los esquemas. | Must |

### D. Errores, logging y configuración
| ID | Requisito | Prioridad |
|----|-----------|-----------|
| RF-013 | Toda respuesta de error de la API debe usar `application/problem+json` (RFC 9457) con `type`, `title`, `status`, `detail` y `correlationId`. Los errores de validación incluyen la lista de campos afectados. Los errores inesperados (500) no revelan detalles internos. | Must |
| RF-014 | Cada petición debe tener un id de correlación. Se reutiliza el que llega en la petición si es válido o, si no, se genera uno nuevo. Se devuelve en una cabecera de la respuesta y aparece en los logs y en los errores. | Must |
| RF-015 | La API debe emitir logs JSON estructurados, una línea por evento, con marca de tiempo, nivel, mensaje y id de correlación. El nivel es configurable. Contraseñas, cookies, tokens, cabeceras de autorización y secretos se ocultan. | Must |
| RF-016 | La configuración de la API y la de servidor de la web deben validarse al arrancar. Si falta una variable obligatoria o no es válida, la aplicación no arranca: termina con un código distinto de 0 y nombra la variable sin mostrar su valor. | Must |

### E. Base de datos
| ID | Requisito | Prioridad |
|----|-----------|-----------|
| RF-017 | La API debe conectarse mediante Prisma al PostgreSQL de Docker, usando la URL de conexión de la configuración. | Must |
| RF-018 | Los cambios de esquema deben hacerse con migraciones versionadas en el repositorio y aplicarse con un comando desde la raíz. Una migración ya fusionada en `main` no se modifica. | Must |
| RF-019 | Debe existir un mecanismo de semilla idempotente, ejecutable con un comando desde la raíz, que lea los valores sensibles solo de variables de entorno. | Must |

### F. Autenticación base (sin pantallas)
| ID | Requisito | Prioridad |
|----|-----------|-----------|
| RF-020 | Las contraseñas deben guardarse solo como hash lento y con sal. Los parámetros de coste deben cumplir, al menos, los mínimos vigentes de la *OWASP Password Storage Cheat Sheet* para el algoritmo elegido. Debe existir una operación para verificar una contraseña contra su hash. | Must |
| RF-021 | Debe existir un mecanismo para abrir una sesión para una cuenta ya autenticada. Cada inicio de sesión genera un identificador nuevo. La credencial viaja en una cookie no accesible desde JavaScript, marcada como segura fuera del entorno local y que el navegador no envía en peticiones originadas en otros sitios. | Must |
| RF-022 | La sesión debe tener una caducidad absoluta configurable (8 h por defecto) contada desde su inicio. La actividad no la prolonga. Una petición con una sesión caducada recibe 401 con un `type` específico de «sesión caducada», distinto del de «no autenticado». | Must |
| RF-023 | La sesión debe poder revocarse de inmediato. Al cerrar sesión se invalida la sesión actual. Al desactivar una cuenta se invalidan todas sus sesiones. La siguiente petición con una sesión revocada recibe 401. | Must |
| RF-024 | Las peticiones que cambian estado (todo lo que no es lectura) autenticadas con cookie deben estar protegidas contra CSRF. Sin una prueba anti-CSRF válida, reciben 403 en `problem+json`. | Must |
| RF-025 | Debe existir un guard que proteja las rutas por rol. Toda ruta está protegida por defecto y solo es pública si se declara de forma explícita. Sin sesión, la respuesta es 401; con una sesión de rol insuficiente, 403. | Must |
| RF-026 | Debe existir un modelo mínimo de cuenta con identificador, rol, estado (activa o desactivada) y hash de contraseña, sobre el que operan RF-020 a RF-025. La 001 añade el nombre de usuario, el contador de intentos, el bloqueo y la semilla de `HaroldAdmin`. | Must |

### G. Límite de peticiones
| ID | Requisito | Prioridad |
|----|-----------|-----------|
| RF-027 | La API debe aplicar un límite global de peticiones por IP, configurable. Al superarlo responde 429 en `problem+json` con la cabecera `Retry-After`. | Must |
| RF-028 | Una ruta debe poder declarar un límite propio, más estricto y configurable, que se aplica además del global. | Must |

### H. Design system web
| ID | Requisito | Prioridad |
|----|-----------|-----------|
| RF-029 | Los tokens de marca Perchados deben definirse en `packages/ui-tokens` y ser la única fuente de estilo de los componentes:<br>- **Colores:** primario azul intenso; acentos naranja, verde agua y rosa; neutros; estados de error, éxito, aviso e información.<br>- **Tipografías:** sans geométrica en negrita para títulos, monoespaciada para etiquetas y una de cuerpo.<br>- **Radios y espaciados.** | Must |
| RF-030 | Debe existir un componente **Button** con variantes (al menos primaria y secundaria), estado deshabilitado y estado de carga. En carga, el botón no admite nuevas activaciones y lo anuncia a los lectores de pantalla. | Must |
| RF-031 | Debe existir un componente **TextField** con: etiqueta visible asociada al campo, icono decorativo opcional, texto de ayuda opcional y mensaje de error asociado programáticamente al campo, que se anuncia al aparecer. | Must |
| RF-032 | Debe existir un componente **PasswordField**, basado en TextField, oculto por defecto. Su control mostrar/ocultar se maneja con teclado, tiene un nombre accesible que refleja la acción («Mostrar contraseña» / «Ocultar contraseña») y anuncia su estado. Permite pegar y usar el autocompletado de los gestores de contraseñas. Admite un aviso contextual bajo el campo. | Must |
| RF-033 | Debe existir un componente **Checkbox** con etiqueta clicable, manejable con teclado y con estados de error y deshabilitado. | Should |
| RF-034 | Debe existir un componente **Link** para enlaces internos y externos, con foco visible. Los enlaces que abren otra pestaña lo indican de forma accesible. | Must |
| RF-035 | Debe existir un componente **Alert/Notice** con variantes información, éxito, aviso y error. Error y aviso se anuncian de forma inmediata; información y éxito, de forma no intrusiva. La variante no se distingue solo por el color. | Must |
| RF-036 | Cada componente debe tener pruebas unitarias y pruebas automáticas de accesibilidad en todos sus estados, sin violaciones detectables de WCAG 2.2 A/AA. | Must |
| RF-037 | Debe existir un catálogo visual de los componentes y sus estados, disponible solo fuera de producción, donde se ejecuten las pruebas de accesibilidad y visuales. | Should |

### I. Base E2E
| ID | Requisito | Prioridad |
|----|-----------|-----------|
| RF-038 | Playwright debe estar configurado contra la web, en local y en CI. Genera un informe HTML agrupado por ID de escenario. Hace como máximo 1 reintento, solo en CI, y reporta como «inestable» la prueba que pasa al reintentar. | Must |
| RF-039 | Debe existir un Page Object base reutilizable y la convención de selectores `data-testid` (o roles accesibles). Al menos una prueba de humo debe usarlos. | Must |

### J. Salud del sistema
| ID | Requisito | Prioridad |
|----|-----------|-----------|
| RF-040 | La API debe exponer `GET /v1/health`, público, que comprueba la conexión a la base de datos. Responde 200 si responde y 503 si no, sin revelar detalles internos. Lo usa el healthcheck de Docker. | Must |

## Criterios de aceptación
```gherkin
Característica: Fundaciones de web y API

  # --- A. Aplicaciones y comandos ---

  # CA-001 (RF-001, RF-003)
  Escenario: La API arranca en desarrollo
    Dado el repositorio con dependencias instaladas y la infraestructura de Docker en "healthy"
    Cuando se ejecuta el comando "dev" desde la raíz
    Entonces la API responde en "/v1/health" con estado 200
    Y una ruta fuera de "/v1" (por ejemplo "/health") responde 404 en "problem+json"

  # CA-002 (RF-002, RF-003)
  Escenario: La web arranca en desarrollo
    Dado el comando "dev" en ejecución
    Cuando se abre la URL raíz de la web
    Entonces se ve la página inicial provisional con el nombre "Perchados"
    Y la página usa la tipografía y el color primario de los tokens de marca

  # CA-003 (RF-003)
  Esquema del escenario: Comandos únicos desde la raíz
    Dado el repositorio con dependencias instaladas
    Cuando se ejecuta "<comando>" desde la raíz
    Entonces se ejecuta en "apps/api", "apps/web" y en cada paquete que lo define
    Y termina con código 0 si no hay errores

    Ejemplos:
      | comando   |
      | build     |
      | test      |
      | lint      |
      | typecheck |

  # CA-004 (RF-004)
  Escenario: Apps en Docker con el perfil "apps"
    Dado un ".env" copiado de ".env.example"
    Cuando se ejecuta "docker compose --profile apps up -d"
    Entonces los servicios "api" y "web" quedan en "healthy"
    Y un cambio en un archivo de "apps/api/src" se refleja sin reconstruir la imagen

  # CA-005 (RF-004)
  Escenario: Imágenes de producción construibles
    Dado los Dockerfiles de "apps/api" y "apps/web"
    Cuando se construye la etapa "prod" de cada uno y se arranca el contenedor con la configuración mínima
    Entonces la API responde 200 en "/v1/health" y la web sirve su página inicial
    Y el proceso del contenedor no se ejecuta como root

  # --- B. Calidad e integración continua ---

  # CA-006 (RF-005)
  Escenario: Un error de tipos o de lint bloquea
    Dado un cambio que asigna un texto a una variable numérica en "apps/api"
    Cuando se ejecuta "typecheck" desde la raíz
    Entonces termina con un código distinto de 0 e indica el archivo y la línea
    Y lo mismo ocurre con "lint" ante una regla de lint incumplida

  # CA-007 (RF-006)
  Escenario: Cobertura por debajo del umbral
    Dado un umbral de cobertura configurado del 80 % de líneas
    Cuando se ejecuta "test" y la cobertura de un paquete queda por debajo del umbral
    Entonces el comando termina con un código distinto de 0 e informa del paquete y del porcentaje alcanzado

  # CA-008 (RF-007)
  Escenario: El pipeline valida cada PR
    Dado un PR abierto hacia "main"
    Cuando se ejecuta el pipeline de CI
    Entonces se ejecutan, por este orden lógico, instalación, lint, typecheck, pruebas con cobertura, build, verificación del contrato y aplicación de migraciones sobre una base de datos vacía
    Y si cualquier paso falla, el PR muestra el pipeline en rojo con el nombre del paso fallido

  # CA-009 (RF-008)
  Escenario: Secreto detectado en un PR
    Dado un PR que añade un archivo con una clave privada o un token con formato reconocible
    Cuando se ejecuta el pipeline
    Entonces el paso de escaneo de secretos falla e indica el archivo, sin imprimir el secreto completo

  # CA-010 (RF-008)
  Escenario: Dependencia vulnerable
    Dado un PR que añade una dependencia con una vulnerabilidad conocida de severidad alta o crítica
    Cuando se ejecuta el pipeline
    Entonces el paso de escaneo de dependencias falla e indica el paquete y la vulnerabilidad

  # --- C. Contrato de API ---

  # CA-011 (RF-009)
  Escenario: Entrada inválida rechazada por el esquema
    Dado una ruta de "/v1" cuyo cuerpo exige el campo obligatorio "name" de tipo texto
    Cuando se envía un cuerpo sin "name"
    Entonces la API responde 400 en "problem+json"
    Y la respuesta indica el campo "name" y el motivo
    Y el controlador no llega a ejecutarse

  # CA-012 (RF-010)
  Escenario: Documento OpenAPI publicado
    Dado la API en ejecución fuera de producción
    Cuando se solicita el documento OpenAPI de "/v1"
    Entonces es un documento OpenAPI 3.x válido
    Y contiene "GET /v1/health" con los esquemas de sus respuestas 200 y 503
    Y declara el esquema común de error "problem+json"

  # CA-012b (RF-010)
  Escenario: OpenAPI oculto en producción
    Dado la API en ejecución en producción
    Cuando se solicita el documento OpenAPI o su visor
    Entonces la respuesta es 404

  # CA-013 (RF-011, RF-012)
  Escenario: Cliente desactualizado
    Dado un cambio en un esquema de "packages/contracts" sin regenerar "packages/api-client"
    Cuando se ejecuta la verificación del contrato
    Entonces falla e indica que el cliente generado no coincide con el contrato

  # CA-014 (RF-011)
  Escenario: Un cambio incompatible rompe la compilación del cliente
    Dado que la web usa el cliente tipado para leer el campo "status" de "/v1/health"
    Cuando se renombra ese campo en el contrato y se regenera el cliente
    Entonces "typecheck" falla en "apps/web"

  # CA-015 (RF-012)
  Escenario: La API cumple su contrato
    Dado las pruebas de contrato
    Cuando se ejecutan contra la API con una base de datos de pruebas
    Entonces cada respuesta de cada ruta probada valida contra su esquema del documento OpenAPI
    Y una respuesta con un campo no declarado o de tipo distinto hace fallar la prueba

  # --- D. Errores, logging y configuración ---

  # CA-016 (RF-013)
  Esquema del escenario: Errores uniformes
    Dado la API en ejecución
    Cuando se produce "<situación>"
    Entonces la respuesta tiene estado <status> y tipo de contenido "application/problem+json"
    Y el cuerpo contiene "type", "title", "status", "detail" y "correlationId"

    Ejemplos:
      | situación                                | status |
      | una ruta inexistente                     | 404    |
      | un cuerpo que no cumple el esquema       | 400    |
      | una petición sin sesión a ruta protegida | 401    |
      | un error inesperado en el servidor       | 500    |

  # CA-017 (RF-013, RF-015)
  Escenario: Error inesperado sin detalles internos
    Dado una ruta de prueba que lanza una excepción no controlada
    Cuando se invoca
    Entonces la respuesta 500 no contiene trazas de pila, rutas de archivos, SQL ni mensajes internos
    Y el log de nivel "error" con el mismo "correlationId" sí contiene la traza

  # CA-018 (RF-014)
  Escenario: Correlación de punta a punta
    Dado una petición sin id de correlación
    Cuando la API la procesa
    Entonces la respuesta incluye un id de correlación nuevo en la cabecera
    Y todas las líneas de log de esa petición llevan el mismo id
    Y si la petición trae un id válido, se reutiliza ese mismo id

  # CA-019 (RF-015)
  Escenario: Datos sensibles ocultos en los logs
    Dado una petición con el campo "password" con valor "Perch@ 2026", una cookie de sesión y una cabecera de autorización
    Cuando la API registra la petición
    Entonces el log no contiene "Perch@ 2026", ni el valor de la cookie, ni el de la cabecera
    Y en su lugar aparece un marcador de valor oculto

  # CA-020 (RF-015)
  Escenario: Nivel de log configurable
    Dado el nivel de log configurado en "warn"
    Cuando la API atiende una petición correcta
    Entonces no se emiten líneas de nivel "info" ni "debug"

  # CA-021 (RF-016)
  Escenario: Falta una variable obligatoria
    Dado que la variable de la URL de base de datos no está definida
    Cuando se arranca la API
    Entonces el proceso termina con un código distinto de 0 antes de aceptar peticiones
    Y el mensaje nombra la variable que falta
    Y no se imprime el valor de ninguna variable

  # --- E. Base de datos ---

  # CA-022 (RF-017, RF-018)
  Escenario: Migraciones sobre una base de datos vacía
    Dado el PostgreSQL de Docker con una base de datos vacía
    Cuando se ejecuta el comando de migraciones desde la raíz
    Entonces se aplican todas las migraciones del repositorio en orden
    Y al repetir el comando no se aplica ninguna de nuevo y termina con código 0

  # CA-023 (RF-019)
  Escenario: Semilla con secretos desde el entorno
    Dado las variables de entorno de la semilla definidas
    Cuando se ejecuta la semilla dos veces seguidas
    Entonces los datos iniciales existen una sola vez
    Y ningún valor sensible aparece en la salida, en el código ni en archivos del repositorio

  # CA-024 (RF-019)
  Escenario: Semilla sin la variable sensible
    Dado que falta una variable sensible requerida por la semilla
    Cuando se ejecuta la semilla
    Entonces termina con un código distinto de 0, nombrando la variable
    Y no crea datos parciales

  # --- F. Autenticación base ---

  # CA-025 (RF-020)
  Escenario: Hash lento y con sal
    Dado la contraseña "Perch@ 2026"
    Cuando se calcula su hash dos veces
    Entonces los dos hashes son distintos
    Y ninguno contiene la contraseña en texto legible
    Y ambos se verifican correctamente con "Perch@ 2026" y fallan con "perch@ 2026"
    Y los parámetros de coste cumplen los mínimos de OWASP para el algoritmo elegido

  # CA-026 (RF-021)
  Escenario: Apertura de sesión
    Dado una cuenta activa ya autenticada
    Cuando se abre una sesión
    Entonces la respuesta fija una cookie de sesión con los atributos "HttpOnly", "Secure" (fuera del entorno local) y una política "SameSite" que impide su envío en peticiones de otros sitios
    Y el valor de la cookie no contiene el identificador de la cuenta, su rol ni su contraseña

  # CA-027 (RF-022)
  Escenario: Caducidad absoluta
    Dado una caducidad configurada de 8 horas y una sesión abierta hace 7 h 59 min
    Y peticiones autenticadas cada minuto durante ese tiempo
    Cuando se hace una petición a las 8 h 00 min de abrirla
    Entonces la API responde 401 con el "type" de «sesión caducada»
    Y una petición a las 7 h 59 min había respondido correctamente

  # CA-028 (RF-022)
  Escenario: Caducidad configurable
    Dado la caducidad configurada en 1 minuto en un entorno de pruebas
    Cuando pasan 61 segundos desde la apertura de la sesión
    Entonces la siguiente petición autenticada recibe 401 con el "type" de «sesión caducada»

  # CA-029 (RF-023)
  Escenario: Cierre de sesión revoca al instante
    Dado una sesión abierta y una copia de su cookie
    Cuando se cierra la sesión
    Entonces una petición inmediata con la copia de la cookie recibe 401
    Y la respuesta del cierre elimina la cookie del navegador

  # CA-030 (RF-023)
  Escenario: Cuenta desactivada con sesiones abiertas
    Dado una cuenta con dos sesiones abiertas en navegadores distintos
    Cuando la cuenta se desactiva
    Entonces la siguiente petición de cada sesión recibe 401
    Y no se puede abrir una sesión nueva para esa cuenta

  # CA-031 (RF-024)
  Escenario: Petición de otro sitio sin prueba anti-CSRF
    Dado una sesión válida en el navegador
    Cuando llega una petición que cambia estado sin una prueba anti-CSRF válida
    Entonces la API responde 403 en "problem+json" y no aplica ningún cambio
    Y la misma petición con una prueba válida se procesa

  # CA-032 (RF-025)
  Esquema del escenario: Guard por rol
    Dado una ruta que exige el rol "administrador"
    Cuando la invoca <quién>
    Entonces la respuesta es <status>

    Ejemplos:
      | quién                                 | status |
      | alguien sin sesión                    | 401    |
      | una sesión con rol "comprador"        | 403    |
      | una sesión con rol "administrador"    | 200    |

  # CA-033 (RF-025)
  Escenario: Protegida por defecto
    Dado una ruta nueva sin declaración de acceso
    Cuando se invoca sin sesión
    Entonces la respuesta es 401
    Y "GET /v1/health", declarada pública, responde sin sesión

  # CA-034 (RF-026)
  Escenario: Modelo mínimo de cuenta
    Dado las migraciones aplicadas
    Cuando se crea una cuenta de prueba con rol "administrador" y una contraseña
    Entonces queda guardada con su rol, su estado "activa" y solo el hash de la contraseña

  # --- G. Límite de peticiones ---

  # CA-035 (RF-027)
  Escenario: Límite global por IP
    Dado un límite global configurado de 100 peticiones por minuto y por IP
    Cuando una misma IP envía N + 1 peticiones dentro de la ventana
    Entonces la petición N + 1 recibe 429 en "problem+json" con la cabecera "Retry-After"
    Y una petición desde otra IP en la misma ventana se atiende con normalidad

  # CA-036 (RF-028)
  Escenario: Límite propio de una ruta
    Dado una ruta con un límite propio de 5 peticiones por minuto y el global más alto
    Cuando una IP envía 6 peticiones a esa ruta en un minuto
    Entonces la sexta recibe 429
    Y esa IP sigue pudiendo usar otras rutas hasta agotar el límite global

  # --- H. Design system web ---

  # CA-037 (RF-029)
  Escenario: Los componentes usan solo tokens
    Dado los componentes del design system
    Cuando se revisan sus estilos
    Entonces todos los colores, tipografías, radios y espaciados vienen de los tokens de "packages/ui-tokens"
    Y cambiar el valor de un token cambia todos los componentes que lo usan

  # CA-038 (RF-029)
  Escenario: Contraste de la paleta
    Dado las combinaciones de texto y fondo que usan los componentes
    Cuando se mide su contraste
    Entonces el texto normal alcanza al menos 4,5:1 y el texto grande y los bordes de los controles, al menos 3:1

  # CA-039 (RF-030)
  Escenario: Botón en estado de carga
    Dado un Button en estado de carga
    Cuando se pulsa con el ratón o con Enter o Espacio
    Entonces no se dispara ninguna acción
    Y un lector de pantalla anuncia que está ocupado
    Y el botón conserva su ancho y su nombre accesible

  # CA-040 (RF-031)
  Escenario: Campo de texto con error
    Dado un TextField con la etiqueta "Usuario", un icono y el error "Escribe tu usuario"
    Cuando el foco llega al campo
    Entonces un lector de pantalla anuncia la etiqueta "Usuario", que el campo es inválido y el texto "Escribe tu usuario"
    Y el icono no se anuncia
    Y al hacer clic en la etiqueta el foco pasa al campo

  # CA-041 (RF-032)
  Escenario: Mostrar y ocultar contraseña accesible
    Dado un PasswordField con texto escrito
    Cuando se activa con el teclado el control "Mostrar contraseña"
    Entonces el texto se ve legible y el control pasa a llamarse "Ocultar contraseña"
    Y el foco permanece en el control
    Y al activarlo de nuevo el texto vuelve a enmascararse

  # CA-042 (RF-032)
  Escenario: Pegar y autocompletar
    Dado un PasswordField
    Cuando se pega una contraseña o la rellena un gestor de contraseñas
    Entonces el valor se acepta sin restricciones

  # CA-043 (RF-033)
  Escenario: Checkbox con teclado
    Dado un Checkbox con la etiqueta "Acepto"
    Cuando recibe el foco y se pulsa Espacio, o se hace clic en la etiqueta
    Entonces cambia su estado y un lector de pantalla anuncia "marcado" o "no marcado"

  # CA-044 (RF-034)
  Escenario: Enlace que abre otra pestaña
    Dado un Link externo configurado para abrir otra pestaña
    Cuando un lector de pantalla lo lee
    Entonces anuncia que se abre en una pestaña nueva
    Y el enlace muestra un foco visible al recibirlo con Tab

  # CA-045 (RF-035)
  Escenario: Aviso de error anunciado
    Dado una pantalla con un Alert de variante "error" que aparece tras una acción
    Cuando aparece
    Entonces un lector de pantalla lo anuncia sin que el usuario mueva el foco
    Y la variante se reconoce también por un icono o un texto, no solo por el color

  # CA-046 (RF-036)
  Escenario: Accesibilidad automática de los componentes
    Dado cada componente en cada uno de sus estados (normal, foco, error, deshabilitado, carga)
    Cuando se ejecutan las pruebas automáticas de accesibilidad
    Entonces no hay ninguna violación de los criterios WCAG 2.2 A y AA detectables automáticamente
    Y una violación hace fallar el comando "test" y la CI

  # CA-047 (RF-037)
  Escenario: Catálogo solo fuera de producción
    Dado la web en un entorno de desarrollo
    Cuando se abre el catálogo de componentes
    Entonces se ven todos los componentes con todos sus estados
    Y en la imagen de producción el catálogo no es accesible (404)

  # --- I. Base E2E ---

  # CA-048 (RF-038, RF-039)
  Escenario: Prueba de humo E2E
    Dado la web y la API en ejecución
    Cuando se ejecuta la suite E2E
    Entonces la prueba de humo abre la página inicial mediante el Page Object base
    Y localiza sus elementos con "data-testid" o roles accesibles
    Y se genera un informe HTML donde la prueba aparece con su ID de escenario

  # CA-049 (RF-038)
  Escenario: Reintentos controlados
    Dado una prueba E2E que falla la primera vez y pasa al reintentar en CI
    Cuando termina la suite
    Entonces el informe la marca como "inestable"
    Y en local la misma prueba no se reintenta

  # --- J. Salud del sistema ---

  # CA-050 (RF-040)
  Escenario: Salud con la base de datos disponible
    Dado la API y la base de datos en ejecución
    Cuando se solicita "GET /v1/health" sin sesión
    Entonces la respuesta es 200 e indica que la base de datos está disponible

  # CA-051 (RF-040)
  Escenario: Salud con la base de datos caída
    Dado la API en ejecución y la base de datos detenida
    Cuando se solicita "GET /v1/health"
    Entonces la respuesta llega en 3 s como máximo, con estado 503
    Y indica que la base de datos no está disponible, sin cadenas de conexión, hosts ni mensajes internos
    Y el healthcheck de Docker marca el servicio "api" como "unhealthy"
```

## Casos borde
| ID | Situación | Comportamiento esperado | RF |
|----|-----------|-------------------------|----|
| CB-001 | La API arranca con la base de datos aún no disponible (por ejemplo, Docker acaba de levantarse) | Arranca y `/v1/health` responde 503 hasta que la base responde; después pasa a 200 sin reiniciar | RF-017, RF-040 |
| CB-002 | El puerto de la API o de la web ya está ocupado | Los puertos son configurables; el error de arranque indica el puerto en conflicto | RF-001, RF-002 |
| CB-003 | Una variable obligatoria existe pero tiene un formato inválido (por ejemplo, una URL mal formada o una duración negativa) | No arranca; nombra la variable y el formato esperado, sin mostrar su valor | RF-016 |
| CB-004 | La caducidad de sesión configurada es 0, negativa o no numérica | No arranca (se trata como configuración inválida) | RF-016, RF-022 |
| CB-005 | Una migración ya fusionada en `main` se modifica en un PR | La CI falla e indica la migración alterada | RF-018 |
| CB-006 | Dos migraciones nuevas de PR distintos entran en conflicto de orden | La CI del segundo PR falla al aplicar las migraciones sobre una base vacía actualizada con `main` | RF-007, RF-018 |
| CB-007 | El id de correlación entrante es demasiado largo (más de 128 caracteres) o contiene caracteres no permitidos | Se descarta y se genera uno nuevo; el valor recibido no se escribe en los logs sin sanear | RF-014 |
| CB-008 | Un campo sensible viene anidado o con otro uso de mayúsculas (`user.Password`, `newPassword`, `token`) | También se oculta en los logs | RF-015 |
| CB-009 | El cuerpo de la petición no es JSON válido o supera el tamaño máximo permitido | 400 o 413 en `problem+json`, sin traza interna | RF-013 |
| CB-010 | Un error ocurre antes de asignar el id de correlación (por ejemplo, al interpretar la petición) | La respuesta y el log igualmente llevan un `correlationId` | RF-013, RF-014 |
| CB-011 | Se verifica la contraseña de una cuenta inexistente | La operación tarda un tiempo comparable al de una cuenta existente, para no revelar que la cuenta no existe (lo usa la 001, RF-004) | RF-020 |
| CB-012 | Contraseña con caracteres no ASCII, emojis o de longitud muy grande | Se hashea y verifica correctamente; existe una longitud máxima documentada que evita el abuso de CPU, y por encima de ella la contraseña se rechaza con un error de validación | RF-020 |
| CB-013 | Se presenta una cookie de sesión manipulada, inventada o de otro entorno | 401 «no autenticado»; nunca 500 | RF-021, RF-025 |
| CB-014 | Se reutiliza la cookie de sesión anterior a un nuevo inicio de sesión en el mismo navegador | La sesión anterior queda invalidada (protección contra la fijación de sesión) | RF-021, RF-023 |
| CB-015 | Se cierra sesión con una sesión ya caducada o ya revocada | Respuesta correcta e idempotente; la cookie se elimina | RF-023 |
| CB-016 | Una cuenta desactivada se reactiva | Las sesiones revocadas siguen inválidas; hay que abrir una nueva | RF-023 |
| CB-017 | El reloj de la máquina cambia o la API se reinicia durante una sesión | La caducidad absoluta se respeta igualmente (se cuenta desde el inicio registrado, no desde el arranque del proceso) | RF-022 |
| CB-018 | Petición de lectura (`GET`) sin prueba anti-CSRF | Se atiende con normalidad; las lecturas no cambian estado | RF-024 |
| CB-019 | Petición con credenciales desde un origen no configurado | Se rechaza; solo los orígenes configurados (la web) pueden enviar credenciales | RF-021, RF-024 |
| CB-020 | La API está detrás de un proxy inverso | La IP del límite se toma del cliente real solo si el proxy está configurado como de confianza; si no, se usa la IP de conexión | RF-027 |
| CB-021 | `GET /v1/health` recibe muchas peticiones del healthcheck de Docker | No consume el límite global de peticiones [propuesta; confirmar en el diseño] | RF-027, RF-040 |
| CB-022 | Se reinicia la API con una ventana de límite en curso | Comportamiento documentado en el diseño (el contador puede reiniciarse en desarrollo; en producción no debe permitir eludir el límite reiniciando) | RF-027 |
| CB-023 | Button con un texto muy largo o a 360 px de ancho | El texto se ajusta sin desbordar; el área táctil mide al menos 24 × 24 px | RF-030 |
| CB-024 | Un TextField sin etiqueta visible por diseño | No está permitido: la etiqueta es obligatoria; las pruebas fallan si falta | RF-031, RF-036 |
| CB-025 | El usuario tiene activado «reducir movimiento» en el sistema | El indicador de carga del Button no usa animaciones intensas | RF-030 |
| CB-026 | Se aplica un zoom del 200 % o el texto se agranda | Los componentes siguen siendo legibles y operables, sin solapes ni pérdida de contenido | RF-029–RF-035 |
| CB-027 | Un componente se usa con un tema de alto contraste forzado del sistema operativo | Los bordes, el foco y el estado siguen siendo visibles | RF-029–RF-035 |
| CB-028 | El escaneo de dependencias detecta una vulnerabilidad sin corrección disponible | La CI falla; solo se puede eximir con una excepción documentada y con fecha de caducidad en el repositorio aprobada por el dueño, con caducidad máxima de 30 días | RF-008 |
| CB-029 | Un secreto aparece en un commit intermedio del PR, aunque se borre en el último | El escaneo lo detecta igualmente | RF-008 |
| CB-030 | Un PR que solo cambia documentación en `specs/` | El pipeline se ejecuta (o se omite de forma explícita y documentada) sin falsos fallos | RF-007 |

## Requisitos no funcionales
- **Seguridad:**
  - Ningún secreto se versiona. `.env.example` (000, RF-006) documenta todas las variables nuevas con valores de ejemplo no sensibles.
  - Contraseñas, cookies, tokens y secretos nunca aparecen en logs, respuestas de error ni salidas de comandos.
  - La API solo acepta peticiones con credenciales desde los orígenes configurados.
  - Una ruta nueva es privada mientras no se declare pública.
- **Rendimiento:**
  - `GET /v1/health` responde en ≤ 200 ms (p95) con la base de datos sana. Con la base caída, responde en ≤ 3 s.
  - El coste del hash se ajusta para que una verificación tarde aproximadamente entre 100 y 500 ms en el entorno de referencia. Así se mantiene el ≤ 1 s (p95) del login de la 001.
  - La página inicial de la web cumple el presupuesto de ADR-006: LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1 y JS inicial ≤ 200 KB gzip.
- **Accesibilidad (WCAG 2.2 AA):** todos los componentes cumplen:
  - Uso completo con teclado y foco visible y no oculto (2.4.7 y 2.4.11).
  - Área táctil de al menos 24 × 24 px (2.5.8).
  - Contraste de 4,5:1 para el texto y de 3:1 para los componentes de interfaz.
  - Nombres accesibles y estados anunciados.
  - Funcionamiento desde 360 px de ancho y con zoom del 200 %.
  - Se puede pegar en los campos y usar gestores de contraseñas (3.3.8).
- **Observabilidad:** los logs se emiten en una línea por evento hacia la salida estándar, aptos para recogerlos en contenedores.
- **Mantenibilidad:**
  - Cada componente, servicio, page object o utilidad reutilizable creado aquí se registra en `specs/02-memoria/registro-componentes.md`.
  - Las skills `api-rest-conventions` y `prisma-datos` (ADR-004) se crean con esta capa.
- **CI:** el pipeline completo de un PR tarda ≤ 15 min [propuesta; confirmar en el diseño].

## Fuera de alcance
- La app móvil (Expo), sus componentes y Maestro.
- El almacenamiento de imágenes (puerto S3) y la pasarela de pagos.
- Las pantallas de login, cierre de sesión y panel. También las reglas de negocio de la 001: formato del usuario, longitud mínima de la contraseña, bloqueo de 30 min tras 5 intentos, mensajes de error de login y la cuenta inicial `HaroldAdmin`. Esta capa solo ofrece las piezas que las hacen posibles.
- La creación y gestión de cuentas o de roles desde una interfaz.
- El despliegue a producción (CD), los entornos en la nube y los dominios.
- Las alertas por fallos sostenidos y la herramienta para gestionarlas (ADR-006): quedan para la capa de resiliencia de integraciones.
- El MCP de PostgreSQL de solo lectura que menciona el roadmap.
- El framework E2E completo: fixtures y factories por dominio, flujos de varias pantallas y pruebas visuales de regresión. Aquí solo hay configuración, el Page Object base y la prueba de humo.
- La resiliencia de integraciones: cliente HTTP con timeouts, reintentos e idempotencia.
- La internacionalización: los textos van solo en español.

## Preguntas abiertas
Ninguna.

## Decisiones tomadas (15-10-2026, dueño)
- **Entrega en 3 hitos dentro de esta spec** (no specs separadas). Cada hito es demostrable y lleva su propio PR:
  1. **Hito 1 — Base y calidad:** A, B, C, D, E y J (apps, CI, contrato, errores, logs, configuración, base de datos, healthcheck).
  2. **Hito 2 — Seguridad:** F y G (hash, sesión, CSRF, guard por rol, límite de peticiones).
  3. **Hito 3 — Interfaz y E2E:** H e I (tokens, componentes accesibles, catálogo, Playwright, Page Object base).
- **Cobertura:** 80 % de líneas por paquete, con exclusiones documentadas (código generado y configuración).
- **Límite de peticiones:** 100 por minuto y por IP en general; 10 por minuto en las rutas de autenticación.
- **Frontera con la 001:**
  - La 002 crea el modelo mínimo de cuenta: identificador, rol, estado y hash.
  - La 001 añade el nombre de usuario con sus reglas, el contador de intentos, el bloqueo y la semilla de `HaroldAdmin`.
- **Los roles se guardan en la base de datos** como datos (no como valores fijos en el código); la cuenta referencia su rol.
- **Roles iniciales:** «administrador» y «comprador». El comprador solo se usa para probar el 403 hasta que llegue su rebanada.
- **Sesiones simultáneas permitidas** y independientes. Cerrar sesión revoca solo la actual; desactivar la cuenta revoca todas.
- **Marca:** no hay manual. Los colores se extraen del mockup de la 001 y se usan fuentes libres de Google Fonts lo más parecidas posible. Se ajustará cuando exista el manual.
- **OpenAPI:** el documento y su visor solo se exponen fuera de producción.
- **Excepciones del escaneo de dependencias:** las aprueba el dueño, con un máximo de 30 días.
- **Alertas:** se aplazan a la capa de resiliencia de integraciones.
- **Cabeceras de seguridad HTTP** (CSP, HSTS, X-Content-Type-Options, Referrer-Policy, frame-ancestors): entran en la 002 por su bajo coste; los valores se fijan en el diseño.
- **Dependencia:** la 000 y los ADR-001, ADR-003 y ADR-006 siguen en `borrador` o `propuesta`. Si cambian, se revisa esta spec.
