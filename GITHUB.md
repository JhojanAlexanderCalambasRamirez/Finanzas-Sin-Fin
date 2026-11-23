# Repositorio del proyecto

Remoto: https://github.com/JhojanAlexanderCalambasRamirez/Finanzas-Sin-Fin.git

Autor: Alexander Calambas Ramirez.

El README contiene la descripcion, instalacion, arquitectura y creditos. QA.md documenta las comprobaciones y MVP.md los criterios pendientes.

El workflow valida Windows y Linux y prepara una construccion Docker con salud HTTP. No publica imagenes ni despliega. Comprueba el resultado real en Actions.

La carpeta original configuro origin, pero este entorno bloqueo su indice Git. La copia publication-worktree conserva el historial remoto y permite preparar la entrega sin alterar datos de la aplicacion. Esta carpeta y las bases de datos se excluyen de Git.

Pendientes: licencia y confirmacion del primer resultado de CI.
## Estado de publicacion

El commit de codigo esta preparado en publication-worktree y conserva el commit inicial remoto. El envio desde este entorno no se completo: el gestor de credenciales de Git fallo al iniciarse y la conexion de GitHub devolvio 403 al crear el arbol. No se modifico main en GitHub.

Para enviar desde una sesion normal de PowerShell con tu cuenta autenticada:

```powershell
git -C .\publication-worktree push origin main
```

Despues consulta Actions. No hace falta forzar el push ni borrar el README remoto.
