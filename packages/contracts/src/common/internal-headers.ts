/** Cabecera interna con la que la web demuestra conocer `INTERNAL_API_SECRET` (RT-022, ADR-011). No va en OpenAPI. */
export const INTERNAL_TOKEN_HEADER = 'X-Perchados-Internal-Token';

/** Cabecera interna con la IP del cliente que resolvió la web; la API solo la atiende con el token. */
export const CLIENT_IP_HEADER = 'X-Perchados-Client-Ip';
