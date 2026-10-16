---
name: expo-router-mvvm
description: Convenciones de este proyecto para apps/mobile (Expo Router + MVVM ligero). Úsala al crear o modificar pantallas, hooks, navegación, acceso a datos, permisos, estados sin conexión o pruebas Maestro de la app móvil de compradores. Complementa, no sustituye, la skill oficial de Expo.
user-invocable: false
---

# Expo Router + MVVM ligero (`apps/mobile`)

Esta skill dice **cómo se hace en este proyecto**. Complementa la skill oficial de Expo (que se instalará después); ante una duda de API de Expo o de librerías, consulta esa skill o Context7. La app móvil es para **compradores**; el panel de administración es solo web (spec 001).

## Estructura
```
apps/mobile/src/
├── app/                      Rutas de Expo Router (solo archivos de ruta, finos)
├── features/<nombre>/
│   ├── screens/              Pantallas: pintan, no deciden
│   ├── hooks/                useXxxViewModel y otros hooks
│   ├── components/           Componentes propios de la feature
│   └── api/                  Hooks de TanStack Query sobre packages/api-client
└── shared/                   Componentes, hooks y utilidades transversales
```
- Las rutas en `src/app` solo importan y exportan la pantalla de la feature.
- Una feature no importa de otra; lo común sube a `shared/` (o `packages/ui` si también lo usa web). Busca antes en `specs/02-memoria/registro-componentes.md`.

## MVVM ligero
La pantalla pinta; el hook `useXxxViewModel` orquesta datos y acciones y devuelve un objeto simple (datos, estados, callbacks).

```tsx
// ❌ La pantalla llama a la API, decide y formatea
export function GarmentScreen({ id }: { id: string }) {
  const [g, setG] = useState<any>(null);
  useEffect(() => { fetch(`https://api.x.com/garments/${id}`).then(r => r.json()).then(setG); }, [id]);
  return <Text>{g?.price * 1.21}</Text>;
}

// ✅ La pantalla pinta lo que le da el view-model
export function GarmentScreen({ id }: { id: string }) {
  const vm = useGarmentViewModel(id);
  if (vm.status === 'loading') return <GarmentSkeleton />;
  if (vm.status === 'error') return <ErrorState onRetry={vm.retry} testID="garment-error" />;
  return (
    <View>
      <Text>{vm.title}</Text>
      <Text>{vm.priceLabel}</Text>
      <Button label="Comprar" onPress={vm.buy} disabled={!vm.canBuy} testID="garment-buy" />
    </View>
  );
}
```

## Datos y estado
- La API se consume **solo** con `packages/api-client` y tipos de `packages/contracts`. Nada de `fetch` directo ni URLs sueltas.
- Lectura con **TanStack Query**; la caché de lectura se **persiste** (catálogo ya visto disponible sin conexión).
- **Zustand** solo para estado local de UI (filtros, borradores); nunca para copiar datos del servidor.
- Sin lógica de negocio en el cliente (precios, disponibilidad, reglas): las decide la API.
- **Sin SDK de pagos.** El checkout se abre por URL en el navegador del sistema (ADR-002).

```tsx
// ❌ SDK de pago y cálculo en el cliente
import { MercadoPago } from 'mercadopago-sdk';
const total = items.reduce((s, i) => s + i.price, 0) * 0.9;

// ✅ Pide la URL de checkout a la API y la abre fuera de la app
const { checkoutUrl } = await api.checkout.create({ orderId });
await Linking.openURL(checkoutUrl);
```

## Sin conexión y red lenta
- Estado "sin conexión" visible (banner) a partir de la conectividad del dispositivo.
- Estados de carga, vacío y error siempre presentes; reintentos con backoff.
- Con caché: se muestra lo ya visto, marcado como posiblemente desactualizado.
- **Nunca se compra ni se publica sin conexión**: la acción se bloquea con un mensaje claro.

```tsx
// ❌ El botón sigue activo sin red
<Button label="Comprar" onPress={vm.buy} testID="garment-buy" />
// ✅
<Button label="Comprar" onPress={vm.buy} disabled={!vm.isOnline}
  hint={vm.isOnline ? undefined : 'Necesitas conexión para comprar'} testID="garment-buy" />
```

## Permisos del dispositivo
- Mínimos y **en contexto**, con una explicación previa. Cámara/galería solo al publicar; notificaciones con opt-in; sin ubicación salvo que la spec lo pida.
- El permiso denegado siempre tiene un camino alternativo.

```tsx
// ❌ Al abrir la app
useEffect(() => { Camera.requestCameraPermissionsAsync(); }, []);
// ✅ Al tocar "Añadir foto", con alternativa
const onAddPhoto = async () => {
  const { granted } = await requestCamera();
  if (granted) openCamera(); else openGallery();
};
```

## Accesibilidad y pruebas
- Todo elemento interactivo: `accessibilityLabel` (y `accessibilityRole`), área táctil **≥ 44 pt**.
- `testID` estable y en kebab-case en todo elemento interactivo de los flujos críticos; Maestro selecciona por `testID`, nunca por texto o posición.

```tsx
// ❌ Sin etiqueta, área pequeña, sin testID
<Pressable onPress={fav}><Icon name="heart" size={16} /></Pressable>
// ✅
<Pressable onPress={vm.toggleFavorite} accessibilityRole="button"
  accessibilityLabel="Añadir a favoritos" style={{ minWidth: 44, minHeight: 44 }}
  testID="garment-favorite"><Icon name="heart" size={16} /></Pressable>
```

## Pruebas
- Hooks (view-models) y componentes con pruebas junto al código; flujos críticos con Maestro en iOS y Android.
- Los view-models se prueban con la API simulada (`api-client` con fake), sin red real.

## Binario ≤ 40 MB (ADR-006)
- Descarga ≤ 40 MB por plataforma. Una dependencia nativa nueva se justifica en `diseno.md`.
- Imágenes optimizadas y tamaños declarados; sin librerías pesadas para tareas triviales.

## Reglas generales
- Sin `any`, sin `TODO` sin tarea, sin código comentado, sin supresiones sin justificación.
- Checklist completo: skill `requisitos-plataforma` (sección Móvil).
