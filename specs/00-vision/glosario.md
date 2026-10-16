# Glosario del dominio

Términos del negocio con un único significado en todo el proyecto. Specs, planes y código deben usar estos términos.

| Término | Definición | Nombre en código |
|---------|------------|------------------|
| Cuenta | Identidad con la que una persona accede al sistema; tiene un rol, un estado (activa o desactivada) y una contraseña guardada solo como hash | `Account` |
| Rol | Tipo de cuenta que determina a qué partes del sistema puede acceder. Valores iniciales propuestos: administrador y comprador [POR ACLARAR en la spec 002] | `Role` |
| Administrador | Cuenta con rol de administración que accede al panel para gestionar la tienda | `Role.ADMIN` |
| Responsable de la tienda | Persona que crea cuentas de administrador y restablece contraseñas | — |
| Sesión | Periodo autenticado de una cuenta en un navegador; caduca a las 8 h de iniciarse y puede revocarse (cierre de sesión o cuenta desactivada) | `Session` |
| Cuenta desactivada | Cuenta que ya no puede iniciar sesión; sus sesiones abiertas quedan revocadas | `Account.status = DISABLED` |
