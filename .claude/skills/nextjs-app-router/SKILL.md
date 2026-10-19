---
name: nextjs-app-router
description: Convenciones de apps/web (Next.js App Router) en este proyecto: rutas finas en app/ con grupos (public)/(admin), lógica en features/<nombre>/{components,hooks,api}, shared/ transversal, Server vs Client Components, datos con packages/api-client + TanStack Query, formularios accesibles, estados carga/vacío/error, data-testid, rendimiento y WCAG 2.2 AA, protección de rutas del panel. Úsala al crear o modificar cualquier cosa en apps/web.
user-invocable: false
---

# Next.js App Router en `apps/web`

Complementa `requisitos-plataforma` (sección Web, ADR-006). Los ejemplos son documentación, no código del repo.

## Estructura
```
apps/web/src/
├── app/            Solo rutas finas: page, layout, loading, error, not-found
│   ├── (public)/   Catálogo, ficha de prenda, checkout (sin sesión de admin)
│   └── (admin)/    Panel de administración (requiere sesión); /login queda fuera, en (public) o (auth)
├── features/<nombre>/
│   ├── components/ UI de la funcionalidad
│   ├── hooks/      useXxx con TanStack Query / estado de UI
│   └── api/        Funciones que llaman a packages/api-client
└── shared/         Transversal: componentes de UI comunes, utilidades, providers
```
- Una `page.tsx` solo compone: importa de `features/` y renderiza. Nada de fetch, validación ni reglas ahí.
- Las features no se importan entre sí; lo compartido sube a `shared/` (o `packages/`).
- Antes de crear un componente busca en `specs/02-memoria/registro-componentes.md` y Engram; si es reutilizable, regístralo.

```tsx
// ❌ La ruta contiene lógica y fetch directo
export default async function Page() {
  const r = await fetch('http://localhost:3000/v1/garments');
  const items = (await r.json()).filter((g: any) => g.price > 0);
  return <ul>{items.map((g: any) => <li>{g.title}</li>)}</ul>;
}
// ✅ Ruta fina que delega en la feature
import { GarmentList } from '@/features/catalog/components/garment-list';
export default function Page() { return <GarmentList />; }
```

## Server vs Client Components
- Server Component por defecto. `'use client'` solo con interacción (estado, eventos, hooks del navegador) y lo más abajo posible del árbol, para cuidar el JS inicial (≤ 200 KB gzip por ruta pública).

```tsx
// ❌ Toda la página cliente solo por un botón
'use client';
export function GarmentPage({ garment }: Props) { /* ficha estática + botón */ }
// ✅ Ficha en servidor; solo el botón es cliente
export function GarmentPage({ garment }: Props) {
  return (<article><h1>{garment.title}</h1><AddToCartButton garmentId={garment.id} /></article>);
}
```

## Datos
- Solo vía `packages/api-client` y tipos de `packages/contracts`. Sin `fetch` manual a la API, sin tipos duplicados.
- En servidor: llamada directa al cliente tipado. En cliente: TanStack Query dentro de hooks de la feature.
- Sin lógica de negocio (precios, reservas, estados de pedido) ni SDKs de pasarelas de pago en el cliente; el checkout redirige a la URL que devuelve la API.
- Sin `any`, sin `@ts-ignore` injustificado.

```tsx
// ❌ SDK de pago y regla de negocio en el cliente
import { MercadoPago } from 'mercadopago';
const total = items.reduce((s, i) => s + i.price, 0) * 0.9;
// ✅ Hook de la feature sobre el api-client
export function useGarments() {
  return useQuery({ queryKey: ['garments'], queryFn: () => apiClient.garments.list() });
}
```

## Estados de carga, vacío y error
Siempre presentes: `loading.tsx`/skeleton, mensaje de vacío con acción, `error.tsx` con reintento. Errores anunciados con `role="alert"`.

```tsx
// ❌ Solo el camino feliz
return <ul>{data.map(renderItem)}</ul>;
// ✅
if (isPending) return <GarmentListSkeleton />;
if (isError) return <ErrorMessage onRetry={refetch} />;
if (data.items.length === 0) return <EmptyState message="No hay prendas todavía" />;
return <ul>{data.items.map(renderItem)}</ul>;
```

## Formularios accesibles (p. ej. login del admin, spec 001)
- `label` asociado a cada campo, `type`/`autoComplete` correctos, errores vinculados con `aria-describedby` y anunciados, foco al primer error, botón nativo `<button>`.
- Validación de forma con el esquema de `packages/contracts`; la decisión de autenticación es de la API.
- `data-testid` estable en todo elemento interactivo de flujos críticos.

```tsx
// ❌ Sin label, sin error accesible, div como botón
<input placeholder="Email" /> <div onClick={submit}>Entrar</div>
// ✅
<label htmlFor="email">Correo electrónico</label>
<input id="email" type="email" autoComplete="username" aria-invalid={!!error}
  aria-describedby={error ? 'email-error' : undefined} data-testid="login-email" />
{error && <p id="email-error" role="alert">{error}</p>}
<button type="submit" data-testid="login-submit">Entrar</button>
```

## Accesibilidad, responsive y rendimiento (ADR-006)
- WCAG 2.2 AA: HTML semántico, contraste ≥ 4.5:1, foco visible, teclado completo.
- Mobile-first desde 360 px.
- LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1. Imágenes siempre con `next/image`, `alt` descriptivo y tamaños declarados (`width`/`height` o `sizes`); la imagen LCP con `priority`.

```tsx
// ❌
<img src={g.photo} />
// ✅
<Image src={g.photo} alt={`${g.title}, talla ${g.size}, estado ${g.condition}`} width={400} height={500} sizes="(max-width: 640px) 100vw, 400px" />
```

## Protección de rutas del panel (alto nivel)
- Un `middleware.ts` en la raíz de `src/` aplica a `/admin/**` (grupo `(admin)`): sin cookie de sesión válida redirige a `/login` (conservando la ruta de retorno). Con sesión, `/login` redirige al panel.
- La sesión es una cookie `httpOnly`, `secure`, `sameSite` emitida por la API; el cliente nunca guarda tokens en `localStorage`.
- El middleware es una barrera de experiencia, no de seguridad: la API autoriza cada petición y devuelve 401/403, que la web traduce en redirección al login.

```ts
// ❌ Comprobar el rol solo ocultando el menú en el cliente
{user.role === 'admin' && <AdminLink />}
// ✅ middleware redirige sin sesión y la API valida cada llamada
export const config = { matcher: ['/admin/:path*'] };
```

## Pruebas
Pruebas de componentes y hooks junto al código (`*.test.tsx`); selectores por rol o `data-testid`. Verificación visual con el MCP de Playwright en los flujos tocados.
