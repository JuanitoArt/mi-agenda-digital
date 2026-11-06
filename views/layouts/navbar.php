<?php
$accionActual = $_GET['accion'] ?? 'inicio';
$temaActual = $_SESSION['tema'] ?? 'indigo';

// Colores de vista previa para cada paleta (deben coincidir con las
// variables --color-primary definidas por tema en assets/css/style.css)
$temasDisponibles = [
    'indigo' => '#4F46E5',
    'azul' => '#2563EB',
    'verde' => '#16A34A',
    'rosa' => '#DB2777',
    'naranja' => '#EA580C',
];
?>

<nav class="navbar navbar-expand-lg navbar-dark bg-primary rounded shadow-sm mb-4">

    <div class="container-fluid">

        <a class="navbar-brand fw-bold" href="index.php?accion=inicio">
            <i class="bi bi-check2-square"></i>
            Mi Agenda
        </a>

        <button class="navbar-toggler"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target="#navbarMenu">

            <span class="navbar-toggler-icon"></span>

        </button>

        <div class="collapse navbar-collapse" id="navbarMenu">

            <ul class="navbar-nav ms-auto">

                <li class="nav-item">

                    <a class="nav-link <?= $accionActual == 'inicio' ? 'active' : '' ?>"
                       href="index.php?accion=inicio">

                        <i class="bi bi-house-fill"></i>
                        Inicio

                    </a>

                </li>

                <li class="nav-item">

                    <a class="nav-link <?= $accionActual == 'tareas' ? 'active' : '' ?>"
                       href="index.php?accion=tareas">

                        <i class="bi bi-list-check"></i>
                        Tareas

                    </a>

                </li>

                <li class="nav-item">

                    <a class="nav-link <?= ($accionActual == 'actividades' || $accionActual == 'miDia') ? 'active' : '' ?>"
                       href="index.php?accion=actividades">

                        <i class="bi bi-calendar-event"></i>
                        Actividades

                    </a>

                </li>

                <li class="nav-item dropdown">

                    <a class="nav-link dropdown-toggle"
                       href="#"
                       role="button"
                       data-bs-toggle="dropdown"
                       aria-expanded="false">

                        <i class="bi bi-palette-fill"></i>
                        Tema

                    </a>

                    <div class="dropdown-menu dropdown-menu-end p-3">

                        <p class="small text-muted mb-2">Elige un color</p>

                        <form method="POST" action="index.php?accion=actualizarTema" class="d-flex gap-2">

                            <?= Csrf::campoOculto() ?>

                            <input type="hidden" name="volver_a" value="<?= htmlspecialchars($accionActual) ?>">

                            <?php foreach ($temasDisponibles as $clave => $colorVistaPrevia): ?>

                                <button
                                    type="submit"
                                    name="tema"
                                    value="<?= $clave ?>"
                                    class="tema-swatch <?= $temaActual === $clave ? 'tema-activo' : '' ?>"
                                    style="background: <?= $colorVistaPrevia ?>;"
                                    title="<?= ucfirst($clave) ?>"
                                    aria-label="Tema <?= ucfirst($clave) ?>"
                                ></button>

                            <?php endforeach; ?>

                        </form>

                    </div>

                </li>

                <li class="nav-item">

                    <form action="index.php?accion=logout" method="POST" class="d-inline"
      onsubmit="return confirm('¿Seguro que quieres cerrar sesión?')">

    <?= Csrf::campoOculto() ?>

    <button type="submit" class="nav-link btn btn-link">

        <i class="bi bi-box-arrow-right"></i>
        <?= htmlspecialchars($_SESSION['nombre_usuario'] ?? '') ?> · Salir

    </button>

</form>

                </li>

            </ul>

        </div>

    </div>

</nav>

<!-- Barra inferior para móviles -->

<nav class="bottom-nav d-md-none">

    <a href="index.php?accion=inicio"
       class="<?= $accionActual == 'inicio' ? 'active' : '' ?>">

        <i class="bi bi-house-fill"></i>
        <span>Inicio</span>

    </a>

    <a href="index.php?accion=tareas"
       class="<?= $accionActual == 'tareas' ? 'active' : '' ?>">

        <i class="bi bi-list-task"></i>
        <span>Tareas</span>

    </a>

    <a href="index.php?accion=miDia"
       class="<?= ($accionActual == 'miDia' || $accionActual == 'actividades') ? 'active' : '' ?>">

        <i class="bi bi-calendar-event"></i>
        <span>Mi Día</span>

    </a>

    <div class="dropup">

    <a href="#"
       class="dropdown-toggle text-decoration-none"
       data-bs-toggle="dropdown"
       aria-expanded="false">

        <i class="bi bi-plus-circle-fill"></i>
        <span>Nueva</span>

    </a>

    <ul class="dropdown-menu shadow">

        <li>

            <a class="dropdown-item"
               href="index.php?accion=crearTarea">

                <i class="bi bi-list-task me-2"></i>
                Nueva tarea

            </a>

        </li>

        <li>

            <a class="dropdown-item"
               href="index.php?accion=crearActividad">

                <i class="bi bi-calendar-plus me-2"></i>
                Nueva actividad

            </a>

        </li>

    </ul>

</div>

<div class="dropup">

    <a href="#"
       class="dropdown-toggle text-decoration-none"
       data-bs-toggle="dropdown"
       aria-expanded="false">

        <i class="bi bi-palette-fill"></i>
        <span>Tema</span>

    </a>

    <div class="dropdown-menu shadow p-3">

        <p class="small text-muted mb-2">Elige un color</p>

        <form method="POST" action="index.php?accion=actualizarTema" class="d-flex gap-2">

            <?= Csrf::campoOculto() ?>

            <input type="hidden" name="volver_a" value="<?= htmlspecialchars($accionActual) ?>">

            <?php foreach ($temasDisponibles as $clave => $colorVistaPrevia): ?>

                <button
                    type="submit"
                    name="tema"
                    value="<?= $clave ?>"
                    class="tema-swatch <?= $temaActual === $clave ? 'tema-activo' : '' ?>"
                    style="background: <?= $colorVistaPrevia ?>;"
                    title="<?= ucfirst($clave) ?>"
                    aria-label="Tema <?= ucfirst($clave) ?>"
                ></button>

            <?php endforeach; ?>

        </form>

    </div>

</div>

</nav>

<style>

.bottom-nav{

    position:fixed;
    bottom:0;
    left:0;
    width:100%;

    background:#fff;

    border-top:1px solid #ddd;

    display:flex;

    justify-content:space-around;

    align-items:center;

    padding:8px 0;

    z-index:999;

    box-shadow:0 -2px 10px rgba(0,0,0,.08);

}

/* ===== FAB ===== */

.fab-container{

    position:relative;

    display:flex;

    flex-direction:column;

    align-items:center;

}

.fab-button{

    width:60px;

    height:60px;

    border:none;

    border-radius:50%;

    background:var(--color-primary);

    color:white;

    font-size:1.6rem;

    display:flex;

    align-items:center;

    justify-content:center;

    box-shadow:0 8px 20px rgba(var(--color-primary-rgb),.35);

    cursor:pointer;

    transition:.3s;

}

.fab-button:hover{

    transform:scale(1.08);

}

.fab-button:active{

    transform:scale(.95);

}

.fab-menu{

    position:absolute;

    bottom:75px;

    display:flex;

    flex-direction:column;

    gap:12px;

    opacity:0;

    visibility:hidden;

    pointer-events:none;

}

.fab-item{

    width:240px;

    background:white;

    border-radius:18px;

    padding:14px 18px;

    text-decoration:none;

    color:#212529;

    display:flex;

    justify-content:space-between;

    align-items:center;

    box-shadow:0 10px 25px rgba(0,0,0,.12);

    transition:.25s;

}

.fab-item:hover{

    transform:translateY(-2px);

}

.fab-icon{

    width:42px;

    height:42px;

    border-radius:50%;

    background:#f1f3f5;

    display:flex;

    justify-content:center;

    align-items:center;

    color:var(--color-primary);

    font-size:1.2rem;

}

.fab-text{

    font-weight:600;

}

.bottom-nav a{

    color:#6c757d;

    text-decoration:none;

    display:flex;

    flex-direction:column;

    align-items:center;

    justify-content:center;

    font-size:.75rem;

    padding:6px 12px;

    border-radius:12px;

    transition:.25s;

}

.bottom-nav i{

    font-size:1.35rem;

    margin-bottom:3px;

}

.bottom-nav a.active{

    background:var(--color-primary-light);

    color:var(--color-primary);

}

.bottom-nav a.active i{

    color:var(--color-primary);

}

.bottom-nav a:hover{

    color:var(--color-primary);

}

body{

    padding-bottom:90px;

}

.bottom-nav .dropup{

    display:flex;

    flex-direction:column;

    align-items:center;

}

.bottom-nav .dropdown-toggle{

    color:#6c757d;

    display:flex;

    flex-direction:column;

    align-items:center;

    text-decoration:none;

    border-radius:12px;

    padding:6px 12px;

}

.bottom-nav .dropdown-toggle::after{

    display:none;

}

.bottom-nav .dropdown-menu{

    border:none;

    border-radius:18px;

    margin-bottom:12px;

    min-width:220px;

    box-shadow:0 10px 30px rgba(0,0,0,.15);

}

.bottom-nav .dropdown-item{

    padding:12px 18px;

    font-size:.95rem;

}

/* ===== Selector de paleta de colores ===== */

.tema-swatch{

    width:32px;

    height:32px;

    border-radius:50%;

    border:2px solid white;

    box-shadow:0 0 0 1px rgba(0,0,0,.08);

    cursor:pointer;

    padding:0;

    transition:.2s;

}

.tema-swatch:hover{

    transform:scale(1.15);

}

.tema-swatch.tema-activo{

    box-shadow:0 0 0 2px var(--color-primary);

}

/* ===== Asistente de voz ===== */

.voz-widget{

    position:fixed;

    bottom:100px;

    right:16px;

    z-index:1000;

    display:flex;

    flex-direction:column;

    align-items:flex-end;

    gap:8px;

}

.voz-btn-activar{

    display:flex;

    align-items:center;

    gap:8px;

    background:linear-gradient(135deg, var(--color-primary), var(--color-primary-accent));

    color:white;

    border:none;

    border-radius:30px;

    padding:12px 20px 12px 16px;

    font-weight:600;

    font-size:.9rem;

    box-shadow:0 10px 25px rgba(var(--color-primary-rgb),.4);

    cursor:pointer;

    transition:.25s;

}

.voz-btn-activar::before{

    content:"🎤";

    font-size:1.1rem;

}

.voz-btn-activar:hover{

    transform:translateY(-2px) scale(1.03);

    box-shadow:0 14px 30px rgba(var(--color-primary-rgb),.5);

}

.voz-btn-desactivar{

    display:flex;

    align-items:center;

    gap:6px;

    background:white;

    color:#6c757d;

    border:1.5px solid #e2e8f0;

    border-radius:30px;

    padding:8px 16px;

    font-size:.8rem;

    font-weight:600;

    box-shadow:0 4px 14px rgba(0,0,0,.08);

    cursor:pointer;

    transition:.25s;

}

.voz-btn-desactivar:hover{

    border-color:#EF4444;

    color:#EF4444;

}

.voz-confirmacion{

    background:white;

    border:none;

    border-left:4px solid var(--color-primary);

    border-radius:14px;

    padding:14px 16px;

    width:260px;

    box-shadow:0 12px 30px rgba(0,0,0,.15);

    font-size:.9rem;

}

.voz-log{

    display:flex;

    flex-direction:column;

    gap:4px;

    max-width:260px;

    max-height:150px;

    overflow-y:auto;

}

.voz-log-usuario,
.voz-log-bot{

    border-radius:14px;

    padding:8px 12px;

    font-size:.78rem;

    box-shadow:0 3px 10px rgba(0,0,0,.08);

    line-height:1.35;

}

.voz-log-usuario{

    background:var(--color-primary);

    color:white;

    align-self:flex-end;

    border-bottom-right-radius:4px;

}

.voz-log-bot{

    background:white;

    color:#1E293B;

    align-self:flex-start;

    border-bottom-left-radius:4px;

}

.voz-badge{

    display:flex;

    align-items:center;

    gap:6px;

    background:white;

    border-radius:20px;

    padding:7px 16px;

    font-size:.8rem;

    color:#6c757d;

    box-shadow:0 4px 14px rgba(0,0,0,.1);

    border:2px solid transparent;

    transition:.25s;

}

.voz-badge::before{

    content:"";

    width:8px;

    height:8px;

    border-radius:50%;

    background:#cbd5e1;

    flex-shrink:0;

}

.voz-badge.voz-activo{

    border-color:#22C55E;

    color:#16794a;

    font-weight:600;

    box-shadow:0 4px 18px rgba(34,197,94,.25);

}

.voz-badge.voz-activo::before{

    background:#22C55E;

    animation:voz-pulso 1.4s ease-in-out infinite;

}

@keyframes voz-pulso{

    0%   { box-shadow:0 0 0 0 rgba(34,197,94,.55); }
    70%  { box-shadow:0 0 0 8px rgba(34,197,94,0); }
    100% { box-shadow:0 0 0 0 rgba(34,197,94,0); }

}

@media (max-width:768px){

    .voz-widget{

        bottom:80px;

    }

}

</style>

<div class="voz-widget">

    <button id="voz-activar" class="voz-btn-activar" type="button">
        Activar asistente de voz
    </button>

    <button id="voz-desactivar" class="voz-btn-desactivar" type="button" style="display:none;">
        🔇 Desactivar asistente
    </button>

    <div id="voz-confirmacion" class="voz-confirmacion" style="display:none;">
        <p id="voz-confirmacion-texto" class="mb-2"></p>
        <div class="d-flex gap-2 justify-content-end">
            <button id="voz-confirmar-si" type="button" class="btn btn-success btn-sm">Sí</button>
            <button id="voz-confirmar-no" type="button" class="btn btn-secondary btn-sm">No</button>
        </div>
    </div>

    <div id="voz-log" class="voz-log"></div>

    <div id="voz-badge" class="voz-badge">
        <span id="voz-estado">Desactivado</span>
    </div>

</div>

<script src="assets/js/voz.js" defer></script>