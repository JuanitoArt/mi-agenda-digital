#  Mi Agenda Digital

Gestor personal de **tareas** y **actividades** desarrollado en PHP puro (sin framework), con arquitectura MVC simplificada, autenticación de usuarios y un asistente por comandos de voz.

Cada usuario tiene su propia cuenta y solo puede ver, crear, editar y eliminar sus propias tareas y actividades.

---

##  Características

-  **Autenticación de usuarios**: registro e inicio de sesión con contraseñas hasheadas (`password_hash` / `password_verify`).
-  **Gestión de tareas**: título, descripción, prioridad (Alta/Media/Baja), fecha límite y estado (Pendiente, En progreso, Completada, Cancelada).
-  **Gestión de actividades**: título, descripción, fecha, hora de inicio/fin y lugar.
-  **Dashboard "Inicio"**: saludo dinámico según la hora, resumen de tareas del día y la próxima actividad (o la que está en curso).
-  **Vista "Mi Día"**: línea de tiempo con las actividades del día, indicando si están pendientes, en curso o finalizadas.
-  **Búsqueda y filtros**: por texto, estado, prioridad y rango de fechas.
-  **Asistente de voz**: permite crear tareas y actividades hablando, usando la Web Speech API del navegador (reconocimiento y síntesis de voz en español).
-  **Diseño responsive**: barra de navegación inferior en móviles con botón flotante para crear tareas/actividades rápidamente.
-  **Migración de datos**: script incluido para migrar datos antiguos almacenados en JSON hacia MySQL.

---

##  Stack técnico

| Capa | Tecnología |
|---|---|
| Backend | PHP puro (sin framework), PDO |
| Base de datos | MySQL |
| Frontend | HTML, CSS, Bootstrap 5, Bootstrap Icons |
| Tipografía | Google Fonts (Poppins) |
| Voz | Web Speech API (`SpeechRecognition` / `SpeechSynthesisUtterance`) — nativa del navegador |
| Entorno recomendado | XAMPP (Apache + MySQL + PHP) |

> No se usa Composer ni ningún framework: el enrutamiento se maneja con un `switch` sobre `$_GET['accion']` en `index.php`.

---

##  Estructura del proyecto

```
GestordeTareas/
├── index.php                       # Router principal (?accion=...)
├── assets/
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── voz.js                   # Lógica del asistente de voz
├── config/
│   ├── Csrf.php                     # Tokens CSRF
│   ├── Database.php                 # Conexión PDO (singleton) a MySQL
│   ├── database.example.php         # Plantilla de credenciales
│   └── zonahoraria.php              # date_default_timezone_set('America/Bogota')
├── controllers/
│   ├── ActividadController.php      # CRUD de actividades
│   ├── AuthController.php           # Registro, login, logout
│   └── TareaController.php          # CRUD de tareas
├── database/
│   └── schema.sql                   # Esquema de la base de datos
├── models/
│   ├── Actividad.php
│   ├── Tarea.php
│   └── Usuario.php
├── scripts/

├── views/
│   ├── actividades/
│   │   ├── crear.php
│   │   ├── editar.php
│   │   ├── index.php
│   │   └── miDia.php
│   ├── auth/
│   │   ├── login.php
│   │   └── registro.php
│   ├── layouts/
│   │   ├── footer.php
│   │   ├── header.php
│   │   └── navbar.php               # Navbar + navegación móvil + widget de voz
│   └── tareas/
│       ├── crear.php
│       ├── editar.php
│       └── index.php
└── README.md
```





##  Requisitos

- PHP **8.0 o superior** (se usan tipado de propiedades como `private PDO $db`)
- MySQL / MariaDB
- Servidor web (Apache recomendado, vía XAMPP) con soporte de `mod_rewrite` no es necesario, ya que se usa `?accion=`
- Navegador Chrome o Edge si se desea usar el asistente de voz (requiere `SpeechRecognition`, no soportado en Firefox/Safari)

---

##  Instalación

1. **Clona o copia el proyecto** dentro de tu carpeta de servidor (ej. `C:\xampp\htdocs\GestordeTareas`).

2. **Crea la base de datos:** abre phpMyAdmin (`http://localhost/phpmyadmin`), entra a la pestaña **SQL**, pega el contenido de `database/schema.sql` y ejecútalo. El script crea la base `gestor_tareas` y sus tablas.

3. **Configura la conexión:** copia `config/database.example.php` como `config/database.local.php`. Si tu MySQL no usa `root` sin contraseña (lo normal en XAMPP), edita los datos en ese archivo:

   ```php
   return [
       'host' => 'localhost',
       'dbname' => 'gestor_tareas',
       'usuario' => 'root',
       'password' => '',
   ];
   ```

4. **Levanta el servidor** (Apache vía XAMPP) y abre en el navegador:

   ```
   http://localhost/GestordeTareas/index.php
   ```

5. **Regístrate** desde `index.php?accion=registro` e inicia sesión.

---

## Rutas / acciones disponibles

Todas las rutas pasan por `index.php?accion=...`:

| Acción | Método | Descripción |
|---|---|---|
| `login` / `procesarLogin` | GET / POST | Inicio de sesión |
| `registro` / `procesarRegistro` | GET / POST | Registro de nuevo usuario |
| `logout` | GET | Cierra sesión |
| `inicio` | GET | Dashboard principal |
| `tareas` | GET | Listado de tareas (con filtros) |
| `crearTarea` / `guardarTarea` | GET / POST | Formulario y guardado de nueva tarea |
| `editarTarea` / `actualizarTarea` | GET / POST | Formulario y guardado de edición de tarea |
| `eliminarTarea` | POST | Elimina una tarea |
| `completarTarea` | GET | Marca una tarea como completada |
| `actividades` | GET | Listado de actividades (con filtros) |
| `crearActividad` / `guardarActividad` | GET / POST | Formulario y guardado de nueva actividad |
| `editarActividad` / `actualizarActividad` | GET / POST | Formulario y guardado de edición de actividad |
| `eliminarActividad` | POST | Elimina una actividad |
| `miDia` | GET | Actividades de hoy en formato timeline |
| `apiTareas` / `apiActividades` | GET | Devuelven JSON (usadas por el asistente de voz) |

> Todas las rutas, salvo `login`, `procesarLogin`, `registro` y `procesarRegistro`, requieren sesión iniciada.

---

##  Asistente de voz

El proyecto incluye un asistente controlado por voz (`assets/js/voz.js`), visible como un widget flotante en la esquina inferior derecha.

**Cómo usarlo:**

1. Haz clic en **"🎤 Activar asistente de voz"** (solo funciona en Chrome/Edge, requiere dar permiso de micrófono).
2. Di una frase de activación, por ejemplo: *"veamos mi agenda"*, *"hey agenda"* o *"asistente"*.
3. Da un comando, por ejemplo crear una tarea o actividad — el asistente te irá preguntando cada dato (título, descripción, fecha, hora, etc.) y pedirá confirmación por voz antes de guardar.
4. El asistente mantiene la conversación activa entre páginas durante ~60 segundos sin necesidad de repetir la frase de activación.

---

##  Autor

Juan Andres Galvis Bejarano / JuanitoArt

##  Licencia

_Agrega aquí la licencia del proyecto (MIT, GPL, etc.) o elimina esta sección si no aplica._
