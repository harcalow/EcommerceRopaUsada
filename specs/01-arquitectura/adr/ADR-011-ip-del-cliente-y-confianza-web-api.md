---
id: ADR-011
estado: aceptada   # propuesta | aceptada | reemplazada por ADR-XXX
aprobacion: dueño (Harold) el 2026-10-18, aplicada por el orquestador con su autorización explícita en el chat
fecha: 2026-10-18
---

# ADR-011 — IP del cliente y confianza entre la web y la API

## Contexto
El límite de peticiones (ADR-006, ADR-008) cuenta por IP. La API recibe peticiones por dos caminos (ADR-007): el navegador directo y el servidor Next (SSR, p. ej. `GET /v1/auth/session` en cada carga de `/login` y `/panel`).

La revisión de la etapa 6 de la 001 encontró que la web reenviaba el `X-Forwarded-For` del cliente tal cual. Con `TRUST_PROXY=false` todas las llamadas SSR compartían el cubo de la IP del servidor web: unas 100 cargas/min de `/login` por cualquiera daban 429 al panel y expulsaban al administrador (denegación de servicio). Confiar en la cabecera sin más dejaría que el atacante eligiera su IP y esquivara el límite.

Hechos:
- Next.js (servidor Node) rellena `x-forwarded-for` con el socket **solo si no viene**, y `NextRequest` ya no expone `ip`: sin un proxy delante que escriba la cabecera, la web no puede conocer la IP real cuando el cliente manda una falsa.
- En Docker Desktop el tráfico publicado llega a los contenedores desde la pasarela de la red, la misma subred que la web: la confianza por red no distingue a la web del navegador.
- El despliegue aún no está definido (`stack.md`); el dueño acepta (2026-10-18) como restricción un proxy de borde con TLS delante de web y API.

## Opciones consideradas
1. **Confianza por red:** `TRUST_PROXY` con el CIDR de la web; la web sobrescribe `X-Forwarded-For`.
   - ➕ Sin secretos.
   - ➖ Depende de la topología (IPs dinámicas de Docker, pasarela compartida): en local y Docker el navegador también quedaría «de confianza». Difícil de probar.
2. **Exención de las SSR del límite** (o cubo propio de la web), autenticada con un secreto.
   - ➕ Simple.
   - ➖ Las SSR quedan sin límite por cliente: cualquiera amplifica consultas a la BD cargando `/login`; o, con cubo propio, se repite el DoS.
3. **Secreto interno + IP del cliente resuelta en el borde** (elegida): la web resuelve la IP con los saltos de confianza que tiene delante y la envía en una cabecera propia junto con un secreto compartido; la API solo la usa si el secreto coincide; las SSR cuentan en el cubo del cliente.
   - ➕ No suplantable, independiente de la topología, igual en local, Docker, CI y producción; fácil de probar; las SSR siguen limitadas por cliente.
   - ➖ Un secreto más (`INTERNAL_API_SECRET`) y una restricción de despliegue (borde que añade `X-Forwarded-For`).

## Decisión
**Opción 3.**
- **Web:** nunca reenvía el `X-Forwarded-For` recibido. Con `WEB_TRUST_PROXY_HOPS = n ≥ 1`, la IP del cliente es la entrada `n`-ésima por la derecha de `X-Forwarded-For` (semántica de `trust proxy` de Express); con `n = 0` o un valor no IP, no hay IP. Envía `X-Perchados-Internal-Token` (= `INTERNAL_API_SECRET`) y, si la hay, `X-Perchados-Client-Ip`. El módulo es `server-only`.
- **API:** el rastreador del límite es `X-Perchados-Client-Ip` solo si el token coincide (tiempo constante) y el valor es una IP válida; en otro caso, `req.ip` según `TRUST_PROXY`. `TRUST_PROXY` describe solo el borde delante de la API, nunca la web. El token no concede ningún otro privilegio y se oculta en los logs.
- **Cubo:** las llamadas SSR cuentan en el cubo global de la IP del cliente final; no hay exención.
- **Producción:** `TRUST_PROXY ≠ false` y `WEB_TRUST_PROXY_HOPS ≥ 1` son obligatorias; el borde añade la dirección del par TCP a `X-Forwarded-For`; web y API solo son alcanzables a través del borde y de la red privada.
- **Local, Docker y CI:** sin borde (`0` / `false`); las SSR cuentan en el cubo de la web, aceptable sin atacantes externos.

## Consecuencias
- ➕ Se elimina el DoS del panel sin abrir la suplantación de IP.
- ➕ El mismo mecanismo servirá a cualquier llamada servidor → API futura.
- ➖ Restricción para la futura CD: proxy de borde con TLS que añade `X-Forwarded-For` y puertos de web y API no publicados fuera de él.
- ➖ `INTERNAL_API_SECRET` debe existir en todos los entornos (también en el `.env` local) y rotarse reiniciando web y API. Su fuga solo permite elegir la IP del límite.
- La app móvil llamará directa a la API (como el navegador): no le afecta.
