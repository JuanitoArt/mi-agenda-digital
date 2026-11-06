(function () {
    'use strict';

    // Frases que activan el modo "escuchando comando"
    const FRASES_ACTIVACION = [
        'veamos mi agenda', 'hey agenda', 'oye agenda',
        'abre mi agenda', 'abrir agenda', 'oye asistente', 'hola asistente', 'asistente'
    ];

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        console.warn('Este navegador no soporta reconocimiento de voz (usa Chrome o Edge).');
        return;
    }

    const btnActivar = document.getElementById('voz-activar');
    const btnDesactivar = document.getElementById('voz-desactivar');
    const estadoTexto = document.getElementById('voz-estado');
    const badge = document.getElementById('voz-badge');
    const panelConfirmacion = document.getElementById('voz-confirmacion');
    const textoConfirmacion = document.getElementById('voz-confirmacion-texto');
    const btnConfirmarSi = document.getElementById('voz-confirmar-si');
    const btnConfirmarNo = document.getElementById('voz-confirmar-no');
    const logPanel = document.getElementById('voz-log');

    // Recordamos si el usuario ya activó el asistente antes, para reactivarlo
    // solo en cada página nueva (el permiso del micrófono el navegador ya lo recuerda).
    const CLAVE_ACTIVADO = 'vozAsistenteActivado';

    // Recordamos el momento del último comando/activación para poder seguir
    // "en modo comando" en la siguiente página, sin repetir la frase clave,
    // siempre que no hayan pasado más de VENTANA_SESION_MS.
    const CLAVE_SESION_COMANDO = 'vozSesionComandoTimestamp';
    const VENTANA_SESION_MS = 60000;

    let reconocimiento = null;
    let escuchandoComando = false; // true = ya se dijo la frase de activación
    let modoCreacion = null;       // null | { tipo, paso, datos }
    let modoConfirmacion = null;   // null | { accion, id, titulo, datos? }
    let modoEdicion = null;        // null | { tipo, id, campo, datos }
    let debeReiniciar = false;
    let timeoutComando = null;
    let vozPreferida = null;

    // FIX: antes se dejaba la voz por defecto del navegador (utterance.lang
    // = 'es-ES' sin utterance.voice), que en muchos sistemas suena robótica.
    // Ahora elegimos, entre las voces en español disponibles, la que suene
    // más natural (voces "Google"/"Natural"/"Neural" si existen).
    function elegirMejorVoz() {
        if (!('speechSynthesis' in window)) return null;

        const voces = window.speechSynthesis.getVoices();
        if (!voces.length) return null;

        const esVoces = voces.filter((v) => v.lang && v.lang.toLowerCase().startsWith('es'));
        if (!esVoces.length) return null;

        const prioridad = (v) => {
            const nombre = v.name.toLowerCase();
            if (nombre.includes('google')) return 0;
            if (nombre.includes('natural') || nombre.includes('neural') || nombre.includes('online')) return 1;
            if (v.lang.toLowerCase() === 'es-es') return 2;
            return 3;
        };

        return esVoces.slice().sort((a, b) => prioridad(a) - prioridad(b))[0];
    }

    function cargarVozPreferida() {
        vozPreferida = elegirMejorVoz();
    }

    if ('speechSynthesis' in window) {
        cargarVozPreferida();
        // Algunos navegadores (Chrome) cargan la lista de voces de forma
        // asíncrona, por eso también escuchamos este evento.
        window.speechSynthesis.onvoiceschanged = cargarVozPreferida;
    }

    function hablar(texto) {
        agregarLog('bot', texto);
        if (!('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(texto);

        if (vozPreferida) {
            utterance.voice = vozPreferida;
            utterance.lang = vozPreferida.lang;
        } else {
            utterance.lang = 'es-ES';
        }

        window.speechSynthesis.speak(utterance);
    }

    function agregarLog(tipo, texto) {
        if (!logPanel) return;

        const linea = document.createElement('div');
        linea.className = tipo === 'user' ? 'voz-log-usuario' : 'voz-log-bot';
        linea.textContent = (tipo === 'user' ? '🎤 ' : '🤖 ') + texto;

        logPanel.appendChild(linea);

        while (logPanel.children.length > 4) {
            logPanel.removeChild(logPanel.firstChild);
        }

        logPanel.scrollTop = logPanel.scrollHeight;
    }

    function mostrarConfirmacionVisual(texto) {
        if (!panelConfirmacion) return;
        textoConfirmacion.textContent = texto;
        panelConfirmacion.style.display = 'block';
    }

    function ocultarConfirmacionVisual() {
        if (panelConfirmacion) panelConfirmacion.style.display = 'none';
    }

    // Preguntar algo que requiere sí/no: lo dice en voz alta Y lo muestra con botones
    function pedirConfirmacion(conf, mensaje) {
        modoConfirmacion = conf;
        actualizarEstado('❓ Esperando confirmación');
        hablar(mensaje);
        mostrarConfirmacionVisual(mensaje);
    }

    if (btnConfirmarSi) {
        btnConfirmarSi.addEventListener('click', function () {
            ocultarConfirmacionVisual();
            if (modoConfirmacion) continuarConfirmacion('sí');
        });
    }

    if (btnConfirmarNo) {
        btnConfirmarNo.addEventListener('click', function () {
            ocultarConfirmacionVisual();
            if (modoConfirmacion) continuarConfirmacion('no');
        });
    }

    function actualizarEstado(texto) {
        if (estadoTexto) estadoTexto.textContent = texto;
    }

    function marcarSesionComandoActiva() {
        sessionStorage.setItem(CLAVE_SESION_COMANDO, Date.now().toString());
    }

    function haySesionComandoActiva() {
        const ultimo = parseInt(sessionStorage.getItem(CLAVE_SESION_COMANDO) || '0', 10);
        return (Date.now() - ultimo) < VENTANA_SESION_MS;
    }

    function volverAEspera() {
        escuchandoComando = false;
        modoCreacion = null;
        modoConfirmacion = null;
        modoEdicion = null;
        ocultarConfirmacionVisual();
        sessionStorage.removeItem(CLAVE_SESION_COMANDO);
        actualizarEstado('👂 Di: "veamos mi agenda"');
        if (badge) badge.classList.remove('voz-activo');
    }

    // Reinicia el temporizador de inactividad sin pedir la frase clave de nuevo
    // (para encadenar comandos, por ejemplo tras leer una lista en voz alta).
    function seguirEscuchando() {
        marcarSesionComandoActiva();
        clearTimeout(timeoutComando);
        timeoutComando = setTimeout(() => {
            if (escuchandoComando && !modoCreacion && !modoConfirmacion && !modoEdicion) {
                volverAEspera();
            }
        }, 8000);
    }

    function iniciarReconocimiento() {
        reconocimiento = new SpeechRecognition();
        reconocimiento.lang = 'es-CO';
        reconocimiento.continuous = true;
        reconocimiento.interimResults = false;

        reconocimiento.onresult = function (evento) {
            const ultimo = evento.results[evento.results.length - 1];
            const texto = ultimo[0].transcript.trim().toLowerCase();
            agregarLog('user', texto);
            procesarTexto(texto);
        };

        reconocimiento.onerror = function (evento) {
            console.warn('Error de reconocimiento de voz:', evento.error);

            // Si el permiso fue bloqueado/revocado, dejamos de intentar reiniciar
            // solos y mostramos el botón de nuevo para que el usuario reactive a mano.
            if (evento.error === 'not-allowed' || evento.error === 'service-not-allowed') {
                debeReiniciar = false;
                localStorage.removeItem(CLAVE_ACTIVADO);
                if (btnActivar) btnActivar.style.display = 'block';
                if (btnDesactivar) btnDesactivar.style.display = 'none';
                actualizarEstado('🔴 Permiso de micrófono bloqueado');
                if (badge) badge.classList.remove('voz-activo');
            }
        };

        // El reconocimiento se corta solo tras silencios largos; lo reiniciamos
        // para simular "escucha continua".
        reconocimiento.onend = function () {
            if (debeReiniciar) {
                try {
                    reconocimiento.start();
                } catch (e) {
                    /* ya estaba iniciado, se ignora */
                }
            }
        };

        debeReiniciar = true;
        reconocimiento.start();

        // Si venimos de otra página y hace poco se activó el modo comando
        // se sigue ahí.
        if (haySesionComandoActiva()) {
            escuchandoComando = true;
            if (badge) badge.classList.add('voz-activo');
            actualizarEstado('🟢 Te escucho...');

            timeoutComando = setTimeout(() => {
                if (escuchandoComando && !modoCreacion && !modoConfirmacion && !modoEdicion) {
                    volverAEspera();
                }
            }, 8000);
        } else {
            volverAEspera();
        }
    }

    function procesarTexto(texto) {

        if (modoConfirmacion) {
            clearTimeout(timeoutComando);
            continuarConfirmacion(texto);
            return;
        }

        if (modoEdicion) {
            clearTimeout(timeoutComando);
            continuarEdicion(texto);
            return;
        }

        if (modoCreacion) {
            clearTimeout(timeoutComando);
            continuarCreacion(texto);
            return;
        }

        if (!escuchandoComando) {
            const activado = FRASES_ACTIVACION.some((frase) => texto.includes(frase));

            if (activado) {
                escuchandoComando = true;
                marcarSesionComandoActiva();
                if (badge) badge.classList.add('voz-activo');
                actualizarEstado('🟢 Te escucho...');
                hablar('Te escucho');

                // Si no dice un comando en 8 segundos, vuelve a modo espera
                timeoutComando = setTimeout(() => {
                    if (escuchandoComando && !modoCreacion && !modoConfirmacion && !modoEdicion) {
                        volverAEspera();
                    }
                }, 8000);
            }

            return;
        }

        clearTimeout(timeoutComando);
        ejecutarComando(texto);
    }

    // Listas de sinónimos: así los comandos aceptan varias formas naturales de decir lo mismo
    const SINONIMOS_ELIMINAR = 'eliminar|borrar|quitar|quita|borra|elimina';
    const SINONIMOS_COMPLETAR = 'completar|completa|terminar|termina|termin[eé]|marcar|marca';
    const SINONIMOS_EDITAR = 'editar|edita|cambiar|cambia|modificar|modifica|actualizar|actualiza';

    function regexIntento(sinonimos, sustantivo) {
        return new RegExp(`(?:${sinonimos})\\s+(?:la\\s+|el\\s+)?${sustantivo}\\s+(?:de\\s+)?(.+)`, 'i');
    }

    const RE_ELIMINAR_TAREA = regexIntento(SINONIMOS_ELIMINAR, 'tarea');
    const RE_ELIMINAR_ACTIVIDAD = regexIntento(SINONIMOS_ELIMINAR, 'actividad');
    const RE_COMPLETAR_TAREA = regexIntento(SINONIMOS_COMPLETAR, 'tarea');
    const RE_EDITAR_TAREA = regexIntento(SINONIMOS_EDITAR, 'tarea');
    const RE_EDITAR_ACTIVIDAD = regexIntento(SINONIMOS_EDITAR, 'actividad');

    async function ejecutarComando(texto) {

        marcarSesionComandoActiva();

        if (texto.includes('desactivar asistente') || texto.includes('apagar asistente') || texto.includes('apaga el asistente')) {
            hablar('Asistente desactivado');
            desactivarAsistente();
            return;
        }

        let match = texto.match(RE_ELIMINAR_TAREA);
        if (match) {
            await manejarEliminarTarea(match[1].trim());
            return;
        }

        match = texto.match(RE_ELIMINAR_ACTIVIDAD);
        if (match) {
            await manejarEliminarActividad(match[1].trim());
            return;
        }

        match = texto.match(RE_COMPLETAR_TAREA);
        if (match) {
            await manejarCompletarTarea(match[1].replace(/\s+como\s+completada$/i, '').trim());
            return;
        }

        match = texto.match(RE_EDITAR_TAREA);
        if (match) {
            await manejarEditarTarea(match[1].trim());
            return;
        }

        match = texto.match(RE_EDITAR_ACTIVIDAD);
        if (match) {
            await manejarEditarActividad(match[1].trim());
            return;
        }

        const quiereLeer = texto.includes('léeme') || texto.includes('leeme') || texto.includes('lee ') ||
            texto.includes('dime') || texto.includes('qué tengo') || texto.includes('que tengo') ||
            texto.includes('cuáles son') || texto.includes('cuales son');

        if (quiereLeer && texto.includes('actividad')) {
            await leerActividades();
            return;
        }

        if (quiereLeer && texto.includes('tarea')) {
            await leerTareas();
            return;
        }

        const quiereCrear = texto.includes('crear') || texto.includes('nueva') || texto.includes('nuevo') ||
            texto.includes('agregar') || texto.includes('agrega') || texto.includes('anota') || texto.includes('apunta');

        if (quiereCrear && texto.includes('tarea')) {
            hablar('Vamos a crear una tarea. ¿Cuál es el título?');
            modoCreacion = { tipo: 'tarea', paso: 'titulo', datos: {} };
            actualizarEstado('📝 Creando tarea: título');
            return;
        }

        if (quiereCrear && texto.includes('actividad')) {
            hablar('Vamos a crear una actividad. ¿Cuál es el título?');
            modoCreacion = { tipo: 'actividad', paso: 'titulo', datos: {} };
            actualizarEstado('📝 Creando actividad: título');
            return;
        }

        if (texto.includes('mi día') || texto.includes('mi dia') || texto.includes('qué tengo hoy') || texto.includes('que tengo hoy')) {
            hablar('Mostrando tu día');
            location.href = 'index.php?accion=miDia';
            return;
        }

        // "actividades" con filtro opcional de fecha ("de hoy", "de esta semana"...)
        if (texto.includes('actividad')) {
            const filtroFecha = detectarFiltroFecha(texto);
            let url = 'index.php?accion=actividades';

            if (filtroFecha) url += '&fecha=' + filtroFecha;

            hablar('Mostrando tus actividades' + (filtroFecha ? ' ' + describirFiltroFecha(filtroFecha) : ''));
            location.href = url;
            return;
        }

        // "tareas" con filtro opcional de prioridad/estado ("de prioridad alta", "completadas"...)
        if (texto.includes('tarea')) {
            const prioridad = detectarFiltroPrioridad(texto);
            const estado = detectarFiltroEstado(texto);

            let url = 'index.php?accion=tareas';
            const params = [];

            if (prioridad) params.push('prioridad=' + encodeURIComponent(prioridad));
            if (estado) params.push('estado=' + encodeURIComponent(estado));
            if (params.length) url += '&' + params.join('&');

            let descripcion = 'Mostrando tus tareas';
            if (prioridad) descripcion += ` de prioridad ${prioridad}`;
            if (estado) descripcion += ` ${estado.toLowerCase()}`;

            hablar(descripcion);
            location.href = url;
            return;
        }

        if (texto.includes('inicio') || texto.includes('dashboard') || texto.includes('llévame al inicio') || texto.includes('llevame al inicio')) {
            hablar('Vamos al inicio');
            location.href = 'index.php?accion=inicio';
            return;
        }

        if (texto.includes('cerrar sesión') || texto.includes('cerrar sesion') || texto.includes('salir de la cuenta') || texto === 'salir') {
            hablar('Cerrando sesión');
            enviarFormularioSimple('logout');
            return;
        }

        hablar('No entendí ese comando');
        volverAEspera();
    }

    // ── Filtros por voz (reutilizan los filtros que ya existían en tareas/actividades) ──

    function detectarFiltroPrioridad(texto) {
        if (texto.includes('prioridad alta') || texto.includes('alta prioridad')) return 'Alta';
        if (texto.includes('prioridad media') || texto.includes('media prioridad')) return 'Media';
        if (texto.includes('prioridad baja') || texto.includes('baja prioridad')) return 'Baja';
        return null;
    }

    function detectarFiltroEstado(texto) {
        if (texto.includes('completad')) return 'Completada';
        if (texto.includes('en progreso') || texto.includes('en curso')) return 'En progreso';
        if (texto.includes('pendiente')) return 'Pendiente';
        if (texto.includes('cancelad')) return 'Cancelada';
        return null;
    }

    function detectarFiltroFecha(texto) {
        if (texto.includes('hoy')) return 'hoy';
        if (texto.includes('mañana') || texto.includes('manana')) return 'manana';
        if (texto.includes('semana')) return 'semana';
        if (texto.includes('mes')) return 'mes';
        return null;
    }

    function describirFiltroFecha(filtro) {
        const mapa = { hoy: 'de hoy', manana: 'de mañana', semana: 'de esta semana', mes: 'de este mes' };
        return mapa[filtro] || '';
    }

    // ── Confirmaciones pendientes (eliminar / completar / editar) ──

    function continuarConfirmacion(texto) {
        const conf = modoConfirmacion;
        modoConfirmacion = null;
        ocultarConfirmacionVisual();

        if (texto.includes('sí') || texto.includes('si')) {
            ejecutarAccionConfirmada(conf);
        } else {
            hablar('Cancelado');
            volverAEspera();
        }
    }

    function ejecutarAccionConfirmada(conf) {
        if (conf.accion === 'eliminarTarea') {
            hablar(`Eliminando la tarea ${conf.titulo}`);
            enviarFormularioSimple('eliminarTarea', conf.id);
        } else if (conf.accion === 'eliminarActividad') {
            hablar(`Eliminando la actividad ${conf.titulo}`);
            enviarFormularioSimple('eliminarActividad', conf.id);
        } else if (conf.accion === 'completarTarea') {
            hablar(`Marcando ${conf.titulo} como completada`);
            enviarFormularioSimple('completarTarea', conf.id);
        } else if (conf.accion === 'guardarEdicionTarea') {
            hablar('Actualizando la tarea');
            enviarFormulario('actualizarTarea', conf.datos, conf.id);
        } else if (conf.accion === 'guardarEdicionActividad') {
            hablar('Actualizando la actividad');
            enviarFormulario('actualizarActividad', conf.datos, conf.id);
        }
    }

    // ── Eliminar / completar por voz ──

    async function manejarEliminarTarea(tituloHablado) {
        const tareas = await obtenerTareas();
        const encontrada = buscarPorTitulo(tareas, tituloHablado);

        if (!encontrada) {
            hablar(`No encontré una tarea llamada ${tituloHablado}`);
            seguirEscuchando();
            return;
        }

        pedirConfirmacion(
            { accion: 'eliminarTarea', id: encontrada.id, titulo: encontrada.titulo },
            `¿Seguro que quieres eliminar la tarea ${encontrada.titulo}? Di sí o no.`
        );
    }

    async function manejarEliminarActividad(tituloHablado) {
        const actividades = await obtenerActividades();
        const encontrada = buscarPorTitulo(actividades, tituloHablado);

        if (!encontrada) {
            hablar(`No encontré una actividad llamada ${tituloHablado}`);
            seguirEscuchando();
            return;
        }

        pedirConfirmacion(
            { accion: 'eliminarActividad', id: encontrada.id, titulo: encontrada.titulo },
            `¿Seguro que quieres eliminar la actividad ${encontrada.titulo}? Di sí o no.`
        );
    }

    async function manejarCompletarTarea(tituloHablado) {
        const tareas = await obtenerTareas();
        const encontrada = buscarPorTitulo(tareas, tituloHablado);

        if (!encontrada) {
            hablar(`No encontré una tarea llamada ${tituloHablado}`);
            seguirEscuchando();
            return;
        }

        pedirConfirmacion(
            { accion: 'completarTarea', id: encontrada.id, titulo: encontrada.titulo },
            `¿Marcar la tarea ${encontrada.titulo} como completada? Di sí o no.`
        );
    }

    // ── Editar por voz ──

    async function manejarEditarTarea(tituloHablado) {
        const tareas = await obtenerTareas();
        const encontrada = buscarPorTitulo(tareas, tituloHablado);

        if (!encontrada) {
            hablar(`No encontré una tarea llamada ${tituloHablado}`);
            seguirEscuchando();
            return;
        }

        modoEdicion = { tipo: 'tarea', id: encontrada.id, campo: null, datos: { ...encontrada } };
        actualizarEstado(`✏️ Editando: ${encontrada.titulo}`);
        hablar(`Editando la tarea ${encontrada.titulo}. ¿Qué quieres cambiar: título, descripción, prioridad, fecha límite o estado?`);
    }

    async function manejarEditarActividad(tituloHablado) {
        const actividades = await obtenerActividades();
        const encontrada = buscarPorTitulo(actividades, tituloHablado);

        if (!encontrada) {
            hablar(`No encontré una actividad llamada ${tituloHablado}`);
            seguirEscuchando();
            return;
        }

        modoEdicion = { tipo: 'actividad', id: encontrada.id, campo: null, datos: { ...encontrada } };
        actualizarEstado(`✏️ Editando: ${encontrada.titulo}`);
        hablar(`Editando la actividad ${encontrada.titulo}. ¿Qué quieres cambiar: título, descripción, lugar, fecha, hora de inicio o hora de fin?`);
    }

    function continuarEdicion(texto) {
        const e = modoEdicion;

        if (texto.includes('cancelar')) {
            hablar('Cancelado');
            volverAEspera();
            return;
        }

        // Paso 1: todavía no sabemos qué campo quiere cambiar
        if (!e.campo) {
            const campo = e.tipo === 'tarea' ? mapearCampoTarea(texto) : mapearCampoActividad(texto);

            if (!campo) {
                hablar('No reconocí ese campo. Intenta decir, por ejemplo: título, o fecha.');
                return;
            }

            e.campo = campo;
            actualizarEstado(`✏️ Nuevo valor para ${nombreCampoHablado(campo)}`);
            hablar(`¿Cuál es el nuevo valor para ${nombreCampoHablado(campo)}?`);
            return;
        }

        // Paso 2: ya sabemos el campo, interpretamos el nuevo valor según su tipo
        let valor;

        if (e.campo === 'prioridad') {
            valor = normalizarPrioridad(texto);
        } else if (e.campo === 'fecha_limite' || e.campo === 'fecha') {
            valor = interpretarFecha(texto);
            if (!valor) {
                hablar('No entendí la fecha. Intenta decir, por ejemplo: veinte de agosto.');
                return;
            }
        } else if (e.campo === 'hora_inicio' || e.campo === 'hora_fin') {
            valor = interpretarHora(texto);
            if (!valor) {
                hablar('No entendí la hora. Intenta de nuevo, por ejemplo: tres de la tarde.');
                return;
            }
        } else if (e.campo === 'estado') {
            valor = normalizarEstado(texto);
        } else {
            valor = capitalizar(texto);
        }

        e.datos[e.campo] = valor;

        const conf = e.tipo === 'tarea'
            ? { accion: 'guardarEdicionTarea', id: e.id, datos: e.datos }
            : { accion: 'guardarEdicionActividad', id: e.id, datos: e.datos };

        const nombreCampo = nombreCampoHablado(e.campo);
        modoEdicion = null;

        pedirConfirmacion(conf, `Voy a cambiar ${nombreCampo} a "${valor}". ¿Confirmas? Di sí o no.`);
    }

    function mapearCampoTarea(texto) {
        if (texto.includes('título') || texto.includes('titulo')) return 'titulo';
        if (texto.includes('descripción') || texto.includes('descripcion')) return 'descripcion';
        if (texto.includes('prioridad')) return 'prioridad';
        if (texto.includes('fecha')) return 'fecha_limite';
        if (texto.includes('estado')) return 'estado';
        return null;
    }

    function mapearCampoActividad(texto) {
        if (texto.includes('título') || texto.includes('titulo')) return 'titulo';
        if (texto.includes('descripción') || texto.includes('descripcion')) return 'descripcion';
        if (texto.includes('lugar')) return 'lugar';
        if (texto.includes('hora') && (texto.includes('inicio') || texto.includes('empieza'))) return 'hora_inicio';
        if (texto.includes('hora') && (texto.includes('fin') || texto.includes('termina'))) return 'hora_fin';
        if (texto.includes('fecha')) return 'fecha';
        return null;
    }

    function nombreCampoHablado(campo) {
        const mapa = {
            titulo: 'el título',
            descripcion: 'la descripción',
            prioridad: 'la prioridad',
            fecha_limite: 'la fecha límite',
            fecha: 'la fecha',
            estado: 'el estado',
            lugar: 'el lugar',
            hora_inicio: 'la hora de inicio',
            hora_fin: 'la hora de fin',
        };
        return mapa[campo] || campo;
    }

    function normalizarEstado(texto) {
        if (texto.includes('progreso') || texto.includes('curso')) return 'En progreso';
        if (texto.includes('completad')) return 'Completada';
        if (texto.includes('cancelad')) return 'Cancelada';
        return 'Pendiente';
    }

    function buscarPorTitulo(lista, tituloHablado) {
        const buscado = tituloHablado.toLowerCase();

        return lista.find((item) => {
            const titulo = item.titulo.toLowerCase();
            return titulo.includes(buscado) || buscado.includes(titulo);
        }) || null;
    }

    // ── Leer en voz alta ──

    async function leerTareas() {
        const tareas = await obtenerTareas();

        const pendientes = tareas.filter(
            (t) => t.estado === 'Pendiente' || t.estado === 'En progreso'
        );

        if (pendientes.length === 0) {
            hablar('No tienes tareas pendientes.');
        } else {
            const nombres = pendientes.map((t) => t.titulo).join(', ');
            hablar(`Tienes ${pendientes.length} tareas pendientes: ${nombres}.`);
        }

        seguirEscuchando();
    }

    async function leerActividades() {
        const actividades = await obtenerActividades();
        const hoy = fechaHoyLocal();

        const deHoy = actividades.filter((a) => a.fecha === hoy);

        if (deHoy.length === 0) {
            hablar('No tienes actividades para hoy.');
        } else {
            const detalle = deHoy
                .map((a) => `${a.titulo} a las ${a.hora_inicio.substring(0, 5)}`)
                .join(', ');
            hablar(`Tienes ${deHoy.length} actividades hoy: ${detalle}.`);
        }

        seguirEscuchando();
    }

    async function obtenerTareas() {
        const resp = await fetch('index.php?accion=apiTareas');
        return resp.json();
    }

    async function obtenerActividades() {
        const resp = await fetch('index.php?accion=apiActividades');
        return resp.json();
    }

    function fechaHoyLocal() {
        const d = new Date();
        const mes = String(d.getMonth() + 1).padStart(2, '0');
        const dia = String(d.getDate()).padStart(2, '0');
        return `${d.getFullYear()}-${mes}-${dia}`;
    }

    // FIX: protección CSRF — el router ahora exige un token válido en todo
    // POST. Lo leemos del <meta> que header.php imprime en cada página.
    function obtenerTokenCSRF() {
        const meta = document.querySelector('meta[name="csrf-token"]');
        return meta ? meta.content : '';
    }

    function agregarCampoCSRF(form) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'csrf_token';
        input.value = obtenerTokenCSRF();
        form.appendChild(input);
    }

    function enviarFormularioSimple(accion, id) {
        const form = document.createElement('form');
        form.method = 'POST';
         form.action = id !== undefined
            ? `index.php?accion=${accion}&id=${id}`
            : `index.php?accion=${accion}`;
        agregarCampoCSRF(form);
        document.body.appendChild(form);
        form.submit();
    }

    function continuarCreacion(texto) {
        const c = modoCreacion;

        if (texto.includes('cancelar')) {
            hablar('Cancelado');
            volverAEspera();
            return;
        }

        if (c.tipo === 'tarea') {
            manejarPasoTarea(c, texto);
        } else {
            manejarPasoActividad(c, texto);
        }
    }

    function manejarPasoTarea(c, texto) {
        switch (c.paso) {

            case 'titulo':
                c.datos.titulo = capitalizar(texto);
                c.paso = 'descripcion';
                actualizarEstado('📝 Creando tarea: descripción');
                hablar('¿Cuál es la descripción?');
                return;

            case 'descripcion':
                c.datos.descripcion = capitalizar(texto);
                c.paso = 'prioridad';
                actualizarEstado('📝 Creando tarea: prioridad');
                hablar('¿Prioridad: alta, media o baja?');
                return;

            case 'prioridad':
                c.datos.prioridad = normalizarPrioridad(texto);
                c.paso = 'fecha';
                actualizarEstado('📝 Creando tarea: fecha');
                hablar('¿Para qué fecha? Di, por ejemplo, veinte de agosto.');
                return;

            case 'fecha': {
                const fecha = interpretarFecha(texto);

                if (!fecha) {
                    hablar('No entendí la fecha. Intenta decir, por ejemplo: veinte de agosto.');
                    return;
                }

                c.datos.fecha_limite = fecha;
                c.paso = 'confirmar';
                actualizarEstado('📝 Confirmar tarea');
                hablar(`Voy a crear la tarea ${c.datos.titulo}, prioridad ${c.datos.prioridad}, para el ${fecha}. ¿Confirmas? Di sí o no.`);
                return;
            }

            case 'confirmar':
                if (texto.includes('sí') || texto.includes('si')) {
                    marcarSesionComandoActiva();
                    enviarFormulario('guardarTarea', {
                        titulo: c.datos.titulo,
                        descripcion: c.datos.descripcion,
                        prioridad: c.datos.prioridad,
                        fecha_limite: c.datos.fecha_limite,
                        estado: 'Pendiente',
                    });
                    hablar('Tarea creada');
                } else {
                    hablar('Cancelado');
                    volverAEspera();
                }
                return;
        }
    }

    function manejarPasoActividad(c, texto) {
        switch (c.paso) {

            case 'titulo':
                c.datos.titulo = capitalizar(texto);
                c.paso = 'descripcion';
                actualizarEstado('📝 Creando actividad: descripción');
                hablar('¿Cuál es la descripción?');
                return;

            case 'descripcion':
                c.datos.descripcion = capitalizar(texto);
                c.paso = 'lugar';
                actualizarEstado('📝 Creando actividad: lugar');
                hablar('¿En qué lugar?');
                return;

            case 'lugar':
                c.datos.lugar = capitalizar(texto);
                c.paso = 'fecha';
                actualizarEstado('📝 Creando actividad: fecha');
                hablar('¿Para qué fecha?');
                return;

            case 'fecha': {
                const fecha = interpretarFecha(texto);

                if (!fecha) {
                    hablar('No entendí la fecha. Intenta decir, por ejemplo: veinte de agosto.');
                    return;
                }

                c.datos.fecha = fecha;
                c.paso = 'hora_inicio';
                actualizarEstado('📝 Creando actividad: hora inicio');
                hablar('¿A qué hora empieza? Di, por ejemplo, tres de la tarde.');
                return;
            }

            case 'hora_inicio': {
                const hora = interpretarHora(texto);

                if (!hora) {
                    hablar('No entendí la hora. Intenta de nuevo, por ejemplo: tres de la tarde.');
                    return;
                }

                c.datos.hora_inicio = hora;
                c.paso = 'hora_fin';
                actualizarEstado('📝 Creando actividad: hora fin');
                hablar('¿A qué hora termina?');
                return;
            }

            case 'hora_fin': {
                const hora = interpretarHora(texto);

                if (!hora) {
                    hablar('No entendí la hora. Intenta de nuevo.');
                    return;
                }

                c.datos.hora_fin = hora;
                c.paso = 'confirmar';
                actualizarEstado('📝 Confirmar actividad');
                hablar(`Voy a crear la actividad ${c.datos.titulo}, el ${c.datos.fecha}, de ${c.datos.hora_inicio} a ${c.datos.hora_fin}. ¿Confirmas? Di sí o no.`);
                return;
            }

            case 'confirmar':
                if (texto.includes('sí') || texto.includes('si')) {
                    marcarSesionComandoActiva();
                    enviarFormulario('guardarActividad', {
                        titulo: c.datos.titulo,
                        descripcion: c.datos.descripcion,
                        fecha: c.datos.fecha,
                        hora_inicio: c.datos.hora_inicio,
                        hora_fin: c.datos.hora_fin,
                        lugar: c.datos.lugar,
                    });
                    hablar('Actividad creada');
                } else {
                    hablar('Cancelado');
                    volverAEspera();
                }
                return;
        }
    }

    function capitalizar(texto) {
        return texto.charAt(0).toUpperCase() + texto.slice(1);
    }

    function normalizarPrioridad(texto) {
        if (texto.includes('alta')) return 'Alta';
        if (texto.includes('media')) return 'Media';
        return 'Baja';
    }

    const MESES = {
        enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06',
        julio: '07', agosto: '08', septiembre: '09', setiembre: '09', octubre: '10',
        noviembre: '11', diciembre: '12',
    };

    // Interpreta frases como "veinte de agosto" o "el 5 de septiembre" -> "2026-08-20"
    function interpretarFecha(texto) {
        const match = texto.match(/(\d{1,2})\s*(?:de)?\s*([a-zñ]+)/i);

        if (!match) return null;

        const dia = match[1].padStart(2, '0');
        const mes = MESES[match[2].toLowerCase()];

        if (!mes) return null;

        const anio = new Date().getFullYear();

        return `${anio}-${mes}-${dia}`;
    }

    // Interpreta frases como "tres de la tarde", "3 pm" o "15:00" -> "15:00"
    function interpretarHora(texto) {
        const match = texto.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|de la tarde|de la mañana|de la noche)?/i);

        if (!match) return null;

        let hora = parseInt(match[1], 10);
        const minutos = match[2] || '00';
        const periodo = (match[3] || '').toLowerCase();

        if ((periodo.includes('pm') || periodo.includes('tarde') || periodo.includes('noche')) && hora < 12) {
            hora += 12;
        }

        if (periodo.includes('mañana') && hora === 12) {
            hora = 0;
        }

        return `${String(hora).padStart(2, '0')}:${minutos}`;
    }

    function enviarFormulario(accion, datos, id) {
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = id ? `index.php?accion=${accion}&id=${id}` : `index.php?accion=${accion}`;
        agregarCampoCSRF(form);

        Object.keys(datos).forEach(function (clave) {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = clave;
            input.value = datos[clave];
            form.appendChild(input);
        });

        document.body.appendChild(form);
        form.submit();
    }

    function activarAsistente() {
        localStorage.setItem(CLAVE_ACTIVADO, '1');
        iniciarReconocimiento();
        if (btnActivar) btnActivar.style.display = 'none';
        if (btnDesactivar) btnDesactivar.style.display = 'inline-block';
    }

    function desactivarAsistente() {
        debeReiniciar = false;

        if (reconocimiento) {
            try {
                reconocimiento.stop();
            } catch (e) {
                /* ya estaba detenido */
            }
        }

        localStorage.removeItem(CLAVE_ACTIVADO);
        sessionStorage.removeItem(CLAVE_SESION_COMANDO);

        escuchandoComando = false; 
        modoCreacion = null;
        modoConfirmacion = null;

        actualizarEstado('Desactivado');
        if (badge) badge.classList.remove('voz-activo');
        if (btnActivar) btnActivar.style.display = 'inline-block';
        if (btnDesactivar) btnDesactivar.style.display = 'none';
    }

    if (btnActivar) {
        btnActivar.addEventListener('click', activarAsistente);
    }

    if (btnDesactivar) {
        btnDesactivar.addEventListener('click', desactivarAsistente);
    }

    // Si en una página anterior ya se activó el asistente, se reactiva
    // automáticamente aquí (sin pedir clic de nuevo).
    if (localStorage.getItem(CLAVE_ACTIVADO) === '1') {
        if (btnActivar) btnActivar.style.display = 'none';
        if (btnDesactivar) btnDesactivar.style.display = 'inline-block';
        iniciarReconocimiento();
    }

})();