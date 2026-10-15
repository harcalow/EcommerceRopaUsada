---
name: dominio-ropa-usada
description: Conocimiento del dominio de ecommerce de ropa de segunda mano (unicidad de prendas, estado, tallas y medidas, fotos, reservas, devoluciones). Úsalo al redactar specs, planes o pruebas que involucren prendas, carrito, compra o publicación.
user-invocable: false
---

# Dominio: ecommerce de ropa usada

Este documento lista **las particularidades del dominio y las preguntas que toda spec debe resolver**.
NO son reglas de negocio decididas: las decisiones viven en `specs/00-vision/producto.md` y en cada `spec.md`.
Si una spec no responde a una pregunta relevante, márcala como `[POR ACLARAR]`.

## 1. Unicidad del artículo
Casi siempre hay **una sola unidad** de cada prenda. Esto cambia el modelo clásico de ecommerce:
- No hay "stock": una prenda está disponible, reservada o vendida.
- Dos compradores pueden intentar comprar la misma prenda a la vez → hace falta una estrategia de concurrencia.
- Preguntas: ¿añadir al carrito reserva la prenda? ¿Durante cuánto tiempo? ¿Qué ve otro usuario mientras tanto?

## 2. Estado de la prenda
El comprador no puede tocarla, así que el estado debe describirse de forma objetiva.
- Usa una escala cerrada y definida en el glosario (p. ej. nuevo con etiqueta / como nuevo / muy bueno / bueno / con detalles).
- Los defectos (manchas, roturas, desgaste) se declaran explícitamente y con foto.

## 3. Tallas y medidas
Las tallas varían entre marcas, épocas y países.
- Además de la talla etiquetada, suelen hacer falta medidas reales (pecho, largo, cintura, tiro…) que dependen del tipo de prenda.
- Preguntas: ¿qué medidas son obligatorias según la categoría? ¿En qué unidad?

## 4. Fotos
Son el principal argumento de venta.
- Fotos reales de la prenda concreta, nunca de catálogo.
- Preguntas: número mínimo y máximo, foto obligatoria de la etiqueta y de los defectos, tamaño, formato y moderación.

## 5. Modelo de negocio (define muchas reglas)
- **Tienda propia:** un único vendedor (el negocio) publica las prendas.
- **Marketplace:** varios vendedores; aparecen comisiones, reputación, mediación y pagos divididos.
- **Consignación:** terceros entregan las prendas y el negocio las vende.

## 6. Precio
- ¿Precio fijo, ofertas o negociación?
- ¿Descuentos por antigüedad de la publicación?

## 7. Devoluciones y disputas
- ¿Se aceptan devoluciones? ¿En qué plazo y en qué casos (no coincide con la descripción, talla…)?
- Al devolverse, ¿la prenda vuelve a publicarse?

## 8. Confianza y seguridad
- Verificación de vendedores y valoraciones (si es marketplace).
- Detección de falsificaciones en prendas de marca.
- Datos personales (direcciones) y de pago: mínimo necesario.

## 9. Sostenibilidad (diferenciador habitual)
- Mensajes de impacto (CO₂ o agua ahorrados) solo si hay una fuente de datos fiable.

## Casos límite que las pruebas deben cubrir
- Prenda vendida mientras otro usuario la tiene en el carrito.
- Pago aprobado sobre una prenda que ya no está disponible.
- Publicación con fotos inválidas o sin las medidas obligatorias.
- Vendedor que intenta editar una prenda ajena o ya vendida.
