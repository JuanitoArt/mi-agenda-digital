<?php

session_start();

require_once __DIR__ . '/config/zonahoraria.php';
require_once __DIR__ . '/config/Csrf.php';
require_once __DIR__ . '/controllers/TareaController.php';
require_once __DIR__ . '/controllers/ActividadController.php';
require_once __DIR__ . '/controllers/AuthController.php';

$tareaController = new TareaController();
$actividadController = new ActividadController();
$authController = new AuthController();

// FIX: protección CSRF. Cualquier petición POST debe traer el mismo token
// que se generó para esta sesión (ver Csrf::campoOculto() en las vistas).
// Sin esto, una página externa podría enviar formularios "a nombre" de un
// usuario que tiene la sesión abierta en este sitio.
if ($_SERVER['REQUEST_METHOD'] === 'POST' && !Csrf::validar($_POST['csrf_token'] ?? '')) {
    http_response_code(403);
    die('Token de seguridad inválido o expirado. Vuelve atrás, recarga la página e inténtalo de nuevo.');
}

$accion = $_GET['accion'] ?? 'inicio';

// Rutas que cualquiera puede visitar sin haber iniciado sesión
$accionesPublicas = ['login', 'registro', 'procesarLogin', 'procesarRegistro'];

// Si no hay sesión activa pero existe una cookie válida de "Recordarme",
// esto reconstruye la sesión automáticamente.
$authController->intentarAutoLogin();

if (!isset($_SESSION['usuario_id']) && !in_array($accion, $accionesPublicas)) {
    header('Location: index.php?accion=login');
    exit;
}

// Si ya inició sesión, no tiene sentido que vuelva a ver login/registro
if (isset($_SESSION['usuario_id']) && in_array($accion, $accionesPublicas)) {
    header('Location: index.php?accion=inicio');
    exit;
}

$usuarioId = $_SESSION['usuario_id'] ?? null;

// FIX: helper para leer 'id' de la URL de forma segura. Antes cada case
// hacía $_GET['id'] directo, y si el parámetro faltaba o no era numérico,
// PHP lanzaba un warning de "undefined array key" y el flujo seguía con
// un id vacío/inválido.
function obtenerIdDeUrl()
{
    if (!isset($_GET['id']) || !is_numeric($_GET['id'])) {
        return null;
    }

    return (int) $_GET['id'];
}

// Las acciones que cambian datos o cierran sesión solo se aceptan por POST
// (el router ya valida el token CSRF en todos los POST).
function exigirPost()
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        header('Allow: POST');
        die('Método no permitido: esta acción solo acepta POST.');
    }
}

switch ($accion) {

    case 'login':

        $error = null;
        $mensaje = $_GET['mensaje'] ?? null;

        require_once __DIR__ . '/views/auth/login.php';

        break;

    case 'procesarLogin':

        $resultado = $authController->iniciarSesion(
            $_POST['identificador'] ?? '',
            $_POST['password'] ?? '',
            !empty($_POST['recordar'])
        );

        if ($resultado['exito']) {
            header('Location: index.php?accion=inicio');
            exit;
        }

        $error = $resultado['error'];
        $mensaje = null;

        require_once __DIR__ . '/views/auth/login.php';

        break;

    case 'registro':

        $error = null;

        require_once __DIR__ . '/views/auth/registro.php';

        break;

    case 'procesarRegistro':

        $resultado = $authController->registrar($_POST);

        if ($resultado['exito']) {
            header('Location: index.php?accion=login&mensaje=' . urlencode('Cuenta creada. Ya puedes iniciar sesión.'));
            exit;
        }

        $error = $resultado['error'];

        require_once __DIR__ . '/views/auth/registro.php';

        break;

    case 'logout':

        exigirPost();

        $authController->cerrarSesion();

        header('Location: index.php?accion=login');
        exit;

        break;

    case 'actualizarTema':

        exigirPost();

        $authController->actualizarTema($usuarioId, $_POST['tema'] ?? '');

        // Vuelve a la página desde donde se cambió el tema; si no viene
        // referer válido (poco común), cae al dashboard.
        $volverA = $_POST['volver_a'] ?? 'inicio';
        header('Location: index.php?accion=' . urlencode($volverA));
        exit;

        break;

    // ── Rutas para el asistente de voz ──

    case 'apiTareas':

        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($tareaController->listar($usuarioId));
        exit;

        break;

    case 'apiActividades':

        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($actividadController->listar($usuarioId));
        exit;

        break;

    case 'completarTarea':

        exigirPost();

        $id = obtenerIdDeUrl();

        if ($id === null) {
            header('Location: index.php?accion=tareas');
            exit;
        }

        $tarea = $tareaController->buscarPorId($id, $usuarioId);

        if ($tarea) {

            $datos = $tarea;
            $datos['estado'] = 'Completada';

            $tareaController->actualizar($id, $datos, $usuarioId);

        }

        header('Location: index.php?accion=tareas');
        exit;

        break;

    case 'actualizarActividad':

    $id = $_GET['id'];

    $datos = [
        'titulo' => $_POST['titulo'] ?? '',
        'descripcion' => $_POST['descripcion'] ?? '',
        'fecha' => $_POST['fecha'] ?? '',
        'hora_inicio' => $_POST['hora_inicio'] ?? '',
        'hora_fin' => $_POST['hora_fin'] ?? '',
        'lugar' => $_POST['lugar'] ?? ''
    ];

    $actividadController->actualizar($id, $datos, $usuarioId);

    header('Location: index.php?accion=actividades');
    exit;

    break;


        case 'eliminarActividad':

        exigirPost();

        $id = obtenerIdDeUrl();

        if ($id !== null) {
            $actividadController->eliminar($id, $usuarioId);
        }

        header('Location: index.php?accion=actividades');
        exit;

        break;
    case 'editarActividad':

    $id = $_GET['id'];

    $actividad = $actividadController->buscarPorId($id, $usuarioId);

    require_once __DIR__ . '/views/actividades/editar.php';

    break;

    case 'guardarActividad':

   $datos = [
    'titulo' => $_POST['titulo'] ?? '',
    'descripcion' => $_POST['descripcion'] ?? '',
    'fecha' => $_POST['fecha'] ?? '',
    'hora_inicio' => $_POST['hora_inicio'] ?? '',
    'hora_fin' => $_POST['hora_fin'] ?? '',
    'lugar' => $_POST['lugar'] ?? ''
];

    $resultado = $actividadController->crear($datos, $usuarioId);

    header('Location: index.php?accion=actividades');
    exit;

    break;

    case 'crearActividad':

    require_once __DIR__ . '/views/actividades/crear.php';

    break;

    // ── FIX: 'actividades' y 'miDia' ahora son cases independientes.
    // Antes 'actividades' caía (fallthrough) en 'miDia' y por eso la vista
    // con buscador/filtros de views/actividades/index.php nunca se mostraba.

    case 'miDia':

    $actividades = $actividadController->listar($usuarioId);

    $hoy = date('Y-m-d');

    // Solo actividades de hoy
    $actividades = array_filter($actividades, function ($actividad) use ($hoy) {

        return $actividad['fecha'] == $hoy;

    });

    // Ordenarlas por hora de inicio
    usort($actividades, function ($a, $b) {

        return strcmp($a['hora_inicio'], $b['hora_inicio']);

    });

    require_once __DIR__ . '/views/actividades/miDia.php';

    break;

    case 'actividades':

    $actividades = $actividadController->listar($usuarioId);

    // Buscar por texto
    if (!empty($_GET['buscar'])) {

        $buscar = strtolower(trim($_GET['buscar']));

        $actividades = array_filter($actividades, function ($actividad) use ($buscar) {

            return
                str_contains(strtolower($actividad['titulo']), $buscar) ||
                str_contains(strtolower($actividad['descripcion']), $buscar) ||
                str_contains(strtolower($actividad['lugar']), $buscar);

        });

    }

    // Filtrar por fecha
    if (!empty($_GET['fecha'])) {

        $hoy = date('Y-m-d');

        switch ($_GET['fecha']) {

            case 'hoy':

                $actividades = array_filter($actividades, function ($actividad) use ($hoy) {

                    return $actividad['fecha'] == $hoy;

                });

                break;

            case 'manana':

                $manana = date('Y-m-d', strtotime('+1 day'));

                $actividades = array_filter($actividades, function ($actividad) use ($manana) {

                    return $actividad['fecha'] == $manana;

                });

                break;

            case 'semana':

                $finSemana = date('Y-m-d', strtotime('+7 days'));

                $actividades = array_filter($actividades, function ($actividad) use ($hoy, $finSemana) {

                    return $actividad['fecha'] >= $hoy &&
                           $actividad['fecha'] <= $finSemana;

                });

                break;

            case 'mes':

                $mesActual = date('Y-m');

                $actividades = array_filter($actividades, function ($actividad) use ($mesActual) {

                    return substr($actividad['fecha'], 0, 7) == $mesActual;

                });

                break;
        }

    }

    require_once __DIR__ . '/views/actividades/index.php';

    break;

       case 'eliminarTarea':

        exigirPost();

        $id = obtenerIdDeUrl();

        if ($id !== null) {
            $tareaController->eliminar($id, $usuarioId);
        }

        header('Location: index.php?accion=tareas');
        exit;

        break;

    case 'actualizarTarea':

    $id = $_GET['id'];

    $datos = [
        'titulo' => $_POST['titulo'] ?? '',
        'descripcion' => $_POST['descripcion'] ?? '',
        'prioridad' => $_POST['prioridad'] ?? '',
        'fecha_limite' => $_POST['fecha_limite'] ?? '',
        'estado' => $_POST['estado'] ?? ''
    ];

    $resultado = $tareaController->actualizar($id, $datos, $usuarioId);

    header('Location: index.php?accion=tareas');
    exit;

    break;

    case 'editarTarea':

    $id = $_GET['id'];

    $tarea = $tareaController->buscarPorId($id, $usuarioId);

    require_once __DIR__ . '/views/tareas/editar.php';

    break;

    case 'guardarTarea':

       $datos = [
    'titulo' => $_POST['titulo'] ?? '',
    'descripcion' => $_POST['descripcion'] ?? '',
    'prioridad' => $_POST['prioridad'] ?? '',
    'fecha_limite' => $_POST['fecha_limite'] ?? '',
    'estado' => $_POST['estado'] ?? 'Pendiente'
];

        $resultado = $tareaController->crear($datos, $usuarioId);

        header('Location: index.php?accion=tareas');
        exit;

        break;

    case 'crearTarea':

        require_once __DIR__ . '/views/tareas/crear.php';

        break;

    case 'tareas':

    $tareas = $tareaController->listar($usuarioId);

    // Buscar por texto
    if (!empty($_GET['buscar'])) {

        $buscar = strtolower(trim($_GET['buscar']));

        $tareas = array_filter($tareas, function ($tarea) use ($buscar) {

            return
                str_contains(strtolower($tarea['titulo']), $buscar) ||
                str_contains(strtolower($tarea['descripcion']), $buscar);

        });

    }

    // Filtrar por estado
    if (!empty($_GET['estado'])) {

        $estado = $_GET['estado'];

        $tareas = array_filter($tareas, function ($tarea) use ($estado) {

            return $tarea['estado'] == $estado;

        });

    }

    // Mostrar solo tareas de hoy (si viene del Dashboard)
    if (!empty($_GET['hoy'])) {

        $hoy = date('Y-m-d');

        $tareas = array_filter($tareas, function ($tarea) use ($hoy) {

            return $tarea['fecha_limite'] == $hoy;

        });

    }

    // Filtrar por prioridad
    if (!empty($_GET['prioridad'])) {

        $prioridad = $_GET['prioridad'];

        $tareas = array_filter($tareas, function ($tarea) use ($prioridad) {

            return $tarea['prioridad'] == $prioridad;

       });

    }

    require_once __DIR__ . '/views/tareas/index.php';

    break;

    case 'inicio':

        $tareas = $tareaController->listar($usuarioId);
        $actividades = $actividadController->listar($usuarioId);

        $pendientes = 0;
        $enProgreso = 0;
        $completadas = 0;
        $canceladas = 0;

        $hoy = date('Y-m-d');

        foreach ($tareas as $tarea) {

            switch ($tarea['estado']) {

                case 'Pendiente':

                    if ($tarea['fecha_limite'] == $hoy) {
                        $pendientes++;
                    }

                    break;

                case 'En progreso':

                    if ($tarea['fecha_limite'] == $hoy) {
                        $enProgreso++;
                    }

                    break;

                case 'Completada':

                    if ($tarea['fecha_limite'] == $hoy) {
                        $completadas++;
                    }

                    break;

                case 'Cancelada':
                    $canceladas++;
                    break;
            }
        }

        // FIX: variable que faltaba definir y que usa la tarjeta "Actividades" del dashboard
        $actividadesHoy = 0;

        foreach ($actividades as $actividad) {
            if ($actividad['fecha'] == $hoy) {
                $actividadesHoy++;
            }
        }

        $nombreUsuario = $_SESSION['nombre_usuario'] ?? 'Usuario';

        $hora = (int) date('H');

        if ($hora >= 5 && $hora < 12) {

            $saludo = "🌅 Buenos días";

        } elseif ($hora >= 12 && $hora < 18) {

            $saludo = "☀️ Buenas tardes";

        } else {

            $saludo = "🌙 Buenas noches";

        }

        $dias = [
            'Sunday' => 'Domingo',
            'Monday' => 'Lunes',
            'Tuesday' => 'Martes',
            'Wednesday' => 'Miércoles',
            'Thursday' => 'Jueves',
            'Friday' => 'Viernes',
            'Saturday' => 'Sábado'
        ];

        $meses = [
            1 => 'enero',
            2 => 'febrero',
            3 => 'marzo',
            4 => 'abril',
            5 => 'mayo',
            6 => 'junio',
            7 => 'julio',
            8 => 'agosto',
            9 => 'septiembre',
            10 => 'octubre',
            11 => 'noviembre',
            12 => 'diciembre'
        ];

        $fechaActual =
            $dias[date('l')] . ", " .
            date('d') . " de " .
            $meses[(int)date('n')] . " de " .
            date('Y');

        // Contar solo las tareas pendientes o en progreso
        $tareasPendientes = 0;

        foreach ($tareas as $tarea) {

            if (
                $tarea['estado'] == 'Pendiente' ||
                $tarea['estado'] == 'En progreso'
            ) {
                $tareasPendientes++;
            }
        }

        // Buscar la próxima actividad (o la que está en curso ahora)
        // FIX: este bloque estaba duplicado (se calculaba dos veces con el mismo resultado);
        // se dejó solo una vez.
        $actividadActual = null;
        $proximaActividad = null;
        $tituloActividad = "📅 Próxima actividad";

        usort($actividades, function ($a, $b) {

            return strtotime($a['fecha'] . ' ' . $a['hora_inicio'])
                <=> strtotime($b['fecha'] . ' ' . $b['hora_inicio']);

        });

        $ahora = time();

        foreach ($actividades as $actividad) {

            $inicio = strtotime(
                $actividad['fecha'] . ' ' . $actividad['hora_inicio']
            );

            $fin = strtotime(
                $actividad['fecha'] . ' ' . $actividad['hora_fin']
            );

            // Si la actividad está en curso
            if ($ahora >= $inicio && $ahora <= $fin) {

                $actividadActual = $actividad;
                $tituloActividad = "🟢 Actividad en curso";
                break;

            }

            // Guardar la próxima actividad
            if ($inicio > $ahora && $proximaActividad == null) {

                $proximaActividad = $actividad;

            }

        }

        $actividadMostrar = $actividadActual ?? $proximaActividad;

        $horaInicio = '';
        $horaFin = '';
        $fechaActividad = '';

        if ($actividadMostrar) {

            $horaInicio = date(
                'g:i a',
                strtotime($actividadMostrar['hora_inicio'])
            );

            $horaFin = date(
                'g:i a',
                strtotime($actividadMostrar['hora_fin'])
            );

            $fecha = $actividadMostrar['fecha'];

            if ($fecha == date('Y-m-d')) {

                $fechaActividad = "Hoy";

            } elseif ($fecha == date('Y-m-d', strtotime('+1 day'))) {

                $fechaActividad = "Mañana";

            } else {

                $fechaActividad =
                    $dias[date('l', strtotime($fecha))] . ", " .
                    date('d', strtotime($fecha)) . " de " .
                    $meses[(int)date('n', strtotime($fecha))] . " de " .
                    date('Y', strtotime($fecha));
            }
        }

        // Mensaje dinámico
        if ($tareasPendientes == 0) {

            $mensaje = "🎉 Hoy estás libre. ¡Disfruta tu día!";

        } elseif ($tareasPendientes == 1) {

            $mensaje = "🎯 Solo te queda una tarea. ¡Ya casi terminas!";

        } elseif ($tareasPendientes <= 3) {

            $mensaje = "🙂 Te quedan algunas cosas por hacer. ¡Ánimo!";

        } else {

            $mensaje = "💪 Tienes mucho por hacer hoy.";
        }

        $titulo = "Inicio";
        require_once __DIR__ . '/views/layouts/header.php';
        require_once __DIR__ . '/views/layouts/navbar.php';
?>

<div class="card mb-4">

    <div class="card-body">

        <h2 class="mb-2">
            <?= $saludo ?>,
            <?= htmlspecialchars($nombreUsuario) ?> 👋
        </h2>

        <p class="mb-2 text-muted">

            📅 <?= $fechaActual ?>

        </p>

        <h5>

            <?= $mensaje ?>

        </h5>

    </div>

</div>

<div class="card mt-4">

    <div class="card-body">

        <h4 class="mb-4">
             <?= $tituloActividad ?>
        </h4>

        <?php if ($actividadMostrar): ?>

            <h3 class="fw-bold">

                <?= htmlspecialchars($actividadMostrar['titulo']) ?>

            </h3>

            <p class="mb-2">

                <i class="bi bi-calendar-event"></i>

                <?= $fechaActividad ?>

            </p>

            <p class="mb-2">

                <i class="bi bi-clock"></i>

                <?= $horaInicio ?> - <?= $horaFin ?>

            </p>

            <p class="mb-0">

                <i class="bi bi-geo-alt-fill"></i>

                <?= htmlspecialchars($actividadMostrar['lugar']) ?>

            </p>

        <?php else: ?>

            <div class="text-center py-4">

                <h2>🌴</h2>

                <h5>No tienes actividades programadas</h5>

                <p class="text-muted">

                    Aprovecha para descansar o planear algo nuevo.

                </p>

            </div>

        <?php endif; ?>

    </div>

</div>

<h3 class="mb-4">📊 Resumen de hoy</h3>

<div class="row g-4">

    <div class="col-6 col-md-3">

        <a href="index.php?accion=tareas&estado=Pendiente&hoy=1"
           class="text-decoration-none text-dark">

            <div class="card text-center h-100 resumen-card">

                <div class="card-body">

                    <h1>📋</h1>

                    <h2><?= $pendientes ?></h2>

                    <p class="mb-0">Pendientes</p>

                </div>

            </div>

        </a>

    </div>

    <div class="col-6 col-md-3">

        <a href="index.php?accion=tareas&estado=En progreso&hoy=1"
           class="text-decoration-none text-dark">

            <div class="card text-center h-100 resumen-card">

                <div class="card-body">

                    <h1>🔄</h1>

                    <h2><?= $enProgreso ?></h2>

                    <p class="mb-0">En progreso</p>

                </div>

            </div>

        </a>

    </div>

    <div class="col-6 col-md-3">

        <a href="index.php?accion=tareas&estado=Completada&hoy=1"
           class="text-decoration-none text-dark">

            <div class="card text-center h-100 resumen-card">

                <div class="card-body">

                    <h1>✅</h1>

                    <h2><?= $completadas ?></h2>

                    <p class="mb-0">Completadas</p>

                </div>

            </div>

        </a>

    </div>

    <div class="col-6 col-md-3">

        <a href="index.php?accion=miDia"
           class="text-decoration-none text-dark">

            <div class="card text-center h-100">

                <div class="card-body">

                    <h1>📅</h1>

                    <h2><?= $actividadesHoy ?></h2>

                    <p class="mb-0">Actividades</p>

                </div>

            </div>

        </a>

    </div>

</div>

<?php require_once __DIR__ . '/views/layouts/footer.php'; ?>

<?php

        break;

    default:

        echo "<h1>404</h1>";
        echo "<p>La página que buscas no existe.</p>";

        break;
}