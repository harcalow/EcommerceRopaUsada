# Glosario del dominio

Términos del negocio con un único significado en todo el proyecto. Specs, planes y código deben usar estos términos.

| Término | Definición | Nombre en código |
|---------|------------|------------------|
| Cuenta | Identidad con la que una persona accede al sistema; tiene un rol, un estado (activa o desactivada) y una contraseña guardada solo como hash | `Account` |
| Rol | Tipo de cuenta que determina a qué partes del sistema puede acceder. Se guarda en la base de datos. Valor inicial: administrador (spec 001, RF-019 y RF-023); comprador llegará con su funcionalidad | `Role` |
| Administrador | Cuenta con rol de administración que accede al panel para gestionar la tienda | `Role.ADMIN` |
| Responsable de la tienda | Persona que crea cuentas de administrador y restablece contraseñas | — |
| Sesión | Periodo autenticado de una cuenta en un navegador; caduca a las 8 h de iniciarse y puede revocarse (cierre de sesión o cuenta desactivada) | `Session` |
| Cuenta bloqueada | Cuenta que no puede iniciar sesión durante 30 minutos tras 5 intentos fallidos consecutivos; se desbloquea sola | `Account.lockedUntil` |
| Cuenta desactivada | Cuenta que ya no puede iniciar sesión; sus sesiones abiertas quedan revocadas | `Account.status = DISABLED` |
