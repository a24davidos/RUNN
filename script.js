'use strict'

// ==================== Configuración ====================

//Latitude y Longitud por defecto (Santiago de Compostela)
const LATITUDE = 42.88235
const LONGITUDE = -8.54586
const ZOOM = 13
const MAXZOOM = 18
const ICONSIZE = 25
const ICONANCHOR = 15
const COLOR = '#000'
const WEIGHT = 4

const SEARCH_DEBOUNCE_MS = 350
const SEARCH_MIN_CHARS = 3
const SEARCH_MAX_RESULTS = 4

//Espera a que la ruta deje de cambiar antes de llamar al IGN, así no disparamos una petición por cada punto que muevas
const ELEVATION_DEBOUNCE_MS = 600

const RUN_THRESHOLD = 8
const MAX_SLOPE = 35
const SMOOTH_WINDOW = 1
//Suavizado extra que solo se aplica a la línea del gráfico, no al cálculo de desnivel
const CHART_SMOOTH_RADIUS_RATIO = 0.04 //% de la distancia total, a cada lado
const CHART_SMOOTH_RADIUS_MIN = 80 //metros
const CHART_SMOOTH_RADIUS_MAX = 400 //metros
const CHART_SMOOTH_PASSES = 3

//Padding vertical del gráfico, para que no exagere visualmente desniveles pequeños
const CHART_Y_PADDING_RATIO = 0.5
const CHART_Y_PADDING_MIN = 8

const popCanvas = document.getElementById("graphic").getContext("2d");

let elevationChart = new Chart(popCanvas, {
  type: 'line',
  data: {
    datasets: [{
        data: [],
        cubicInterpolationMode: 'monotone',
        pointRadius: 0,
        pointHoverRadius: 4,
        borderColor: 'oklch(0.7 0.19 145)',
        backgroundColor: 'oklch(0.7 0.19 145 / 0.18)',
        borderWidth: 1.6,
        fill: true
    }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins:{
            legend: {display: false},
            //No necesitamos el popup nativo de Chart.js, ya tenemos el marcador en el mapa
            tooltip: {enabled: false}
        },
        scales: {
            //Sin ejes ni rejilla, la gráfica es solo la silueta del perfil
            x: { type: 'linear', bounds: 'data', display: false },
            y: { display: false }
        },
        //Pintamos circulos en los puntos de la gráfica al pasar el ratón por encima, y no solo en el punto más cercano
        interaction: {
            mode: 'index',
            intersect: false
        },
        onHover: handleChartHover
    }
});

// ==================== Estado ====================
let userPosition = null
let map = null

//Guarda lat/lng de cada punto del perfil, en el mismo orden/índice que los datos del chart
let elevationProfile = []

//Marcador que se mueve por la ruta al pasar el ratón por la gráfica
let elevationMarker = null

let routeLine = L.polyline([], { color: COLOR, weight: WEIGHT })

//Aquí guardo los puntos que se dibujan
let routeGeometry = []

let pointDict = {}

// ==================== Referencias al DOM ====================
let pointList = document.getElementById('point-list')
let pointItems = pointList.getElementsByTagName('li')

let spanCounterPoints = document.getElementById('counter')
let spanCounterKm = document.getElementById('counter-km')
let spanCounterElevation = document.getElementById('counter-elevation')

let btnClearRoute = document.getElementById('btn-clear-route')
let btnUndoPoint = document.getElementById('btn-undo-point')
let btnDownloadGpx = document.getElementById('btn-download-gpx')
//Atajos flotantes sobre el mapa en móvil
let btnClearRouteFab = document.getElementById('btn-clear-route-fab')
let btnUndoPointFab = document.getElementById('btn-undo-point-fab')
let btnDownloadGpxFab = document.getElementById('btn-download-gpx-fab')
let searchInput = document.getElementById('search-place')
let searchClearBtn = document.getElementById('search-clear')
let searchResultsList = document.getElementById('search-results')

let searchDebounceTimer = null
let searchAbortController = null

let elevationDebounceTimer = null

let sidebar = document.getElementById('sidebar')
let sheetHandle = document.getElementById('sheet-handle')
// ==================== Arranque / Geolocalización ====================
function init() {
    //Renderizamos el mapa con Santiago de Compostela por defecto, sin esperar al permiso de geolocalización
    renderMap(LATITUDE, LONGITUDE)
    navigator.geolocation.getCurrentPosition(showPosition, showErrorLocation)
}

function showPosition(pos) {
    //Guardamos la posición del usuario
    userPosition = pos
    map.setView([userPosition.coords.latitude, userPosition.coords.longitude], ZOOM)
}

function showErrorLocation(err) {
    console.log(err)
    // ESTO DEBERIA DE MEJORARLO ⚠️
    if (err.code === 1) {
        console.log('Porfavor activa la geolocalización!')
    } else {
        console.log('No hemos podido encontrar tu localización')
    }
}

function onMapClick(e) {
    addPoint(e.latlng.lat, e.latlng.lng)
}

// ==================== Utility ====================
function formatKm(meters) {
    if (meters < 1000) {
        return `${meters} m`
    } else
        return (meters / 1000).toLocaleString('es-ES', {
            style: 'unit',
            unit: 'kilometer',
            maximumFractionDigits: 2,
        })
}

// ==================== Actualización de UI ====================
function setPointNumber(li, marker, number) {
    li.children[0].innerHTML = number
    marker.getElement().innerHTML = number
}

function updateSpanKm(meters) {
    spanCounterKm.innerText = formatKm(meters)
}

function updateSpanElevation(elevationChange) {
    if (!elevationChange) {
        spanCounterElevation.innerText = '—'
        return
    }
    spanCounterElevation.innerText = `+${elevationChange.totalGain}/-${elevationChange.totalLoss} m`
}

function updateSpanCounter(count) {
    spanCounterPoints.innerHTML = count
}

function updateLi(id, lat, lng) {
    let target = Array.from(pointItems).find((x) => x.dataset.pointId == id)
    target.children[1].innerText = `${lat.toFixed(4)}, ${lng.toFixed(4)}`
}

// ==================== Datos de la ruta ====================
function getRouteCoords() {
    return Array.from(pointItems).map((li) => {
        let marker = pointDict[li.dataset.pointId]
        let { lat, lng } = marker.getLatLng()
        return [lng, lat]
    })
}

let routeRequestId = 0

async function fetchRoute() {
    let coords = getRouteCoords()
    let requestId = ++routeRequestId

    //Tiene que haber mínimo 2 puntos para hacer una llamada a la Api
    if (coords.length < 2) {
        clearTimeout(elevationDebounceTimer)
        updateSpanKm(0)
        routeGeometry = []
        routeLine.setLatLngs([])
        return resetElevationDisplay()
    }

    try {
        const str = coords.map((x) => `${x[0]},${x[1]}`).join(';')

        const response = await fetch(
            `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${str}?overview=full&geometries=geojson`,
        )

        if (!response.ok) {
            const err = new Error(
                `No se pudo calcular la ruta (OSRM ${response.status})`,
            )
            err.status = response.status
            throw err
        }

        const data = await response.json()

        //Si hay una llamada más nueva en marcha, esta respuesta ya no vale
        if (requestId !== routeRequestId) return

        let routeCoords = data.routes[0].geometry.coordinates.map((x) => [
            x[1],
            x[0],
        ])

        routeLine.setLatLngs(routeCoords)
        routeGeometry = routeCoords

        //Actualizo el contador de Km
        updateSpanKm(data.routes[0].distance)

        //Antes había que darle a un botón; ahora el desnivel se recalcula solo en cada cambio de ruta
        scheduleElevationCalculation()
    } catch (error) {
        console.error(error)
        // Futura función a implementar que muestre el error al usuario
        //showError("No se pudo calcular la ruta")
    }
}

//Si llega otro cambio de ruta antes de que salte el timer, se cancela y se reinicia la cuenta
function scheduleElevationCalculation() {
    clearTimeout(elevationDebounceTimer)
    elevationDebounceTimer = setTimeout(calculateElevation, ELEVATION_DEBOUNCE_MS)
}

// ==================== Exportar ruta ====================


function buildGPX() {
    if (routeGeometry.length < 2) return null

    let points =
        elevationProfile.length > 0
            ? elevationProfile
            : routeGeometry.map(([lat, lng]) => ({ lat, lng, elevation: null }))

    let trkpts = points
        .map((point) => {
            let ele =
                point.elevation != null
                    ? `\n                <ele>${point.elevation.toFixed(1)}</ele>`
                    : ''
            return `            <trkpt lat="${point.lat.toFixed(6)}" lon="${point.lng.toFixed(6)}">${ele}
            </trkpt>`
        })
        .join('\n')

    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RUNN" xmlns="http://www.topografix.com/GPX/1/1">
    <trk>
        <name>Ruta RUNN</name>
        <trkseg>
${trkpts}
        </trkseg>
    </trk>
</gpx>
`
}

//Genera el fichero .gpx y dispara la descarga en el navegador.
//El desnivel se recalcula con un debounce tras cada cambio de ruta, así que si
//se descarga justo después de tocar un punto, elevationProfile puede estar
//todavía desactualizado o vacío. Por eso cancelamos el debounce pendiente y
//forzamos el cálculo aquí, esperando a que termine antes de construir el GPX.
async function downloadGPX() {
    if (routeGeometry.length < 2) return //No hay ruta que exportar

    clearTimeout(elevationDebounceTimer)
    await calculateElevation()

    let gpx = buildGPX()
    if (!gpx) return

    let blob = new Blob([gpx], { type: 'application/gpx+xml' })
    let url = URL.createObjectURL(blob)

    let link = document.createElement('a')
    link.href = url
    link.download = `runn-ruta-${new Date().toISOString().slice(0, 10)}.gpx`
    link.click()

    URL.revokeObjectURL(url)
}

// ==================== Setup del mapa ====================

function renderMap(lat, lon) {
    map = L.map('map').setView([lat, lon], ZOOM)

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: MAXZOOM,
        attribution:
            '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)

    //Quitamos el "Leaflet" del footer, ya que no aporta nada y ocupa espacio en móvil
    map.attributionControl.setPrefix(false)

    routeLine.addTo(map)

    initEvents()
}

function initEvents() {
    map.on('click', onMapClick)

    //Evento para eliminar puntos
    pointList.addEventListener('click', (e) => {
        if (e.target.closest('.delete-btn')) {
            deletePoint(e)
        }
    })

    //Eventos para reordenar los puntos con drag & drop
    pointList.addEventListener('dragstart', handleDragStart)
    pointList.addEventListener('dragover', handleDragOver)
    pointList.addEventListener('dragend', handleDragEnd)
    pointList.addEventListener('drop', handleDrop)

    //Botón para limpiar la ruta
    btnClearRoute.addEventListener('click', clearRoute)
    //Botón para deshacer: borra el último punto añadido
    btnUndoPoint.addEventListener('click', undoLastPoint)
    //Botón para descargar la ruta en formato GPX (importable en reloj/móvil)
    btnDownloadGpx.addEventListener('click', downloadGPX)
    //Mismos botones pero flotando sobre el mapa, para móvil
    btnClearRouteFab.addEventListener('click', clearRoute)
    btnUndoPointFab.addEventListener('click', undoLastPoint)
    btnDownloadGpxFab.addEventListener('click', downloadGPX)
    //Botón para borrar el texto del buscador
    searchClearBtn.addEventListener('click', () => {
        searchInput.value = ''
        searchInput.focus()
        hideSearchResults()
    })

    //Buscador de lugares (Photon)
    searchInput.addEventListener('input', handleSearchInput)
    searchInput.addEventListener('keydown', handleSearchKeydown)
    searchResultsList.addEventListener('click', handleSearchResultClick)

    //Cerramos el dropdown si se hace click fuera del buscador
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-box')) {
            hideSearchResults()
        }
    })

    //Tirador inferior en móvil: arrastre táctil real
    sheetHandle.addEventListener('pointerdown', onSheetDragStart)
    sheetHandle.addEventListener('pointermove', onSheetDragMove)
    sheetHandle.addEventListener('pointerup', onSheetDragEnd)
    sheetHandle.addEventListener('pointercancel', onSheetDragEnd)

    sheetHandle.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        e.preventDefault()
        setSheetState(sheetState === 'expanded' ? 'collapsed' : 'expanded')
    })

    window.addEventListener('resize', onWindowResize)

    //Alturas iniciales del menú móvil
    measureSheetHeights()
}

// ==================== Menu inferior (móvil): arrastre táctil ====================

const SHEET_EXPANDED_RATIO = 0.82 //% de la altura de la pantalla cuando está expandida
const SHEET_BOTTOM_BREATHING_ROOM = 12 //px extra bajo las estadísticas en el estado "collapsed"

let sheetHeights = { collapsed: 130, expanded: 0 }
let sheetState = 'collapsed'

let sheetDragStartY = 0
let sheetDragStartHeight = 0
let sheetDragMoved = false
let isDraggingSheet = false

function isMobileLayout() {
    return window.matchMedia('(max-width: 768px)').matches
}

function measureSheetHeights() {
    if (!isMobileLayout()) {
        sidebar.style.height = ''
        return
    }

    let sidebarTop = sidebar.getBoundingClientRect().top

    //Solo hasta las tarjetas de Distancia/Desnivel, la de la gráfica va oculta por CSS
    let visibleCards = document.querySelectorAll(
        '.stats-row > .stat-card:not(.elevation-mini-card)',
    )
    let lastVisibleBottom = Math.max(
        ...Array.from(visibleCards, (card) => card.getBoundingClientRect().bottom),
    )

    sheetHeights.collapsed =
        lastVisibleBottom - sidebarTop + SHEET_BOTTOM_BREATHING_ROOM
    sheetHeights.expanded = window.innerHeight * SHEET_EXPANDED_RATIO

    setSheetState(sheetState, false)
}

function setSheetState(state, animate = true) {
    if (!isMobileLayout()) {
        sidebar.style.height = ''
        return
    }

    sheetState = state
    sidebar.style.transition = animate ? '' : 'none'
    sidebar.style.height = `${sheetHeights[state]}px`
    sidebar.classList.toggle('is-expanded', state === 'expanded')
    sheetHandle.setAttribute('aria-expanded', state === 'expanded')

    if (!animate) {
        sidebar.offsetHeight
        sidebar.style.transition = ''
    }
}

function onSheetDragStart(e) {
    if (!isMobileLayout()) return

    isDraggingSheet = true
    sheetDragMoved = false
    sheetDragStartY = e.clientY
    sheetDragStartHeight = sidebar.getBoundingClientRect().height
    sidebar.style.transition = 'none'
    sheetHandle.setPointerCapture(e.pointerId)
}

function onSheetDragMove(e) {
    if (!isDraggingSheet) return

    let delta = sheetDragStartY - e.clientY
    if (Math.abs(delta) > 4) sheetDragMoved = true

    let newHeight = sheetDragStartHeight + delta
    newHeight = Math.min(
        sheetHeights.expanded,
        Math.max(sheetHeights.collapsed, newHeight),
    )
    sidebar.style.height = `${newHeight}px`
}

function onSheetDragEnd(e) {
    if (!isDraggingSheet) return
    isDraggingSheet = false

    //Sin apenas arrastre: se interpreta como un tap y alterna collapsed/expanded
    if (!sheetDragMoved) {
        setSheetState(sheetState === 'expanded' ? 'collapsed' : 'expanded')
        return
    }

    //Arrastre real: nos quedamos con la parada más cercana a donde se soltó
    let currentHeight = sidebar.getBoundingClientRect().height
    let closest = Object.entries(sheetHeights).reduce((best, [state, h]) =>
        Math.abs(h - currentHeight) < Math.abs(best[1] - currentHeight)
            ? [state, h]
            : best,
    )

    setSheetState(closest[0])
}

function onWindowResize() {
    if (map) map.invalidateSize()
    measureSheetHeights()
}

// ==================== Buscador de lugares ====================

function handleSearchInput() {
    let query = searchInput.value.trim()

    clearTimeout(searchDebounceTimer)

    if (query.length < SEARCH_MIN_CHARS) {
        hideSearchResults()
        return
    }

    searchDebounceTimer = setTimeout(() => {
        fetchSearchResults(query)
    }, SEARCH_DEBOUNCE_MS)
}

async function fetchSearchResults(query) {
    //Si había una petición anterior en vuelo, la cancelamos: solo nos interesa la última
    if (searchAbortController) {
        searchAbortController.abort()
    }
    searchAbortController = new AbortController()

    try {
        let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=${SEARCH_MAX_RESULTS}`
        let response = await fetch(url, { signal: searchAbortController.signal })
        let data = await response.json()

        renderSearchResults(data.features || [])
    } catch (error) {
        //Si el error es por abort, es esperado (petición cancelada por una más reciente)
        if (error.name !== 'AbortError') {
            console.error(error)
        }
    }
}

function renderSearchResults(features) {
    searchResultsList.innerHTML = ''

    if (features.length === 0) {
        searchResultsList.innerHTML = '<li class="search-result-empty">Sin resultados</li>'
        searchResultsList.hidden = false
        return
    }

    features.forEach((feature) => {
        let li = document.createElement('li')
        li.classList.add('search-result-item')
        li.textContent = formatSearchResultLabel(feature)
        li.dataset.lat = feature.geometry.coordinates[1]
        li.dataset.lon = feature.geometry.coordinates[0]
        searchResultsList.appendChild(li)
    })

    searchResultsList.hidden = false
}

function formatSearchResultLabel(feature) {
    let props = feature.properties
    //Photon separa el nombre del resto de la jerarquía (ciudad, estado, país...)
    let parts = [props.name, props.city, props.state, props.country].filter(Boolean)
    //Quitamos duplicados consecutivos (p.ej. cuando name === city)
    return [...new Set(parts)].join(', ')
}

function handleSearchResultClick(e) {
    let item = e.target.closest('.search-result-item')
    if (!item || !item.dataset.lat) return

    let lat = parseFloat(item.dataset.lat)
    let lon = parseFloat(item.dataset.lon)

    map.setView([lat, lon], ZOOM)

    searchInput.value = item.textContent
    hideSearchResults()
}

function handleSearchKeydown(e) {
    if (e.key === 'Escape') {
        hideSearchResults()
    }
}

function hideSearchResults() {
    searchResultsList.hidden = true
    searchResultsList.innerHTML = ''
}

// ==================== Gestión de puntos ====================

function addPoint(lat, lng) {
    let pointNumber = Object.keys(pointDict).length + 1

    let point = L.marker([lat, lng], {
        icon: L.divIcon({
            className: 'numbered-marker',
            html: `${pointNumber}`,
            iconSize: [ICONSIZE, ICONSIZE],
            iconAnchor: [ICONANCHOR, ICONANCHOR],
        }),
        draggable: true,
    })

    point.addTo(map)
    point.getElement().dataset.pointId = point._leaflet_id

    pointDict[point._leaflet_id] = point

    point.on('dragend', function (e) {
        let position = point.getLatLng()
        fetchRoute()
        updateLi(point._leaflet_id, position.lat, position.lng)
    })

    point.addEventListener('contextmenu', function (e) {
        deletePointById(point._leaflet_id)
    })

    let li = document.createElement('li')
    li.classList.add('point-item')
    li.dataset.pointId = point._leaflet_id
    li.draggable = true

    li.innerHTML = `
        <span>${pointNumber}</span>
        <span>${point.getLatLng().lat.toFixed(4)}, ${point.getLatLng().lng.toFixed(4)}</span>
        <button class="delete-btn"><span class="icon-svg icon-svg-x"></span></button>
    `
    
    //Añadimos a la lista de puntos
    pointList.appendChild(li)

    //Recalculamos el contador de puntos
    updateSpanCounter(pointNumber)

    //Calculamos la ruta
    fetchRoute()
}

function deletePoint(e) {
    let id = e.target.closest('li').dataset.pointId
    deletePointById(id)
}

//Quitamos el último punto puesto
function undoLastPoint() {
    if (pointItems.length === 0) return

    let lastItem = pointItems[pointItems.length - 1]
    deletePointById(lastItem.dataset.pointId)
}

function deletePointById(id) {
    //Eliminamos el nodo de la lista
    pointList.querySelector(`[data-point-id="${id}"]`).remove()

    //Eliminamos la referencia dentro de leaflet
    pointDict[id].remove()

    //Eliminamos la referencia de la lista
    delete pointDict[id]

    recalculatePoints()
    fetchRoute()
}

//Guarda el <li> que se está arrastrando mientras dura el drag
let draggedItem = null

function handleDragStart(e) {
    let item = e.target.closest('.point-item')
    if (!item) return

    draggedItem = item
    e.dataTransfer.effectAllowed = 'move'
    //Pequeño delay para que el navegador capture la "foto" de arrastre antes de aplicar el estilo
    setTimeout(() => draggedItem.classList.add('dragging'), 0)
}

function handleDragOver(e) {
    //Necesario para permitir el drop, si no el navegador lo rechaza por defecto
    e.preventDefault()

    let target = e.target.closest('.point-item')
    if (!draggedItem || !target || target === draggedItem) return

    //Decidimos si insertar antes o después según en qué mitad del elemento estamos
    let rect = target.getBoundingClientRect()
    let isAfter = e.clientY - rect.top > rect.height / 2

    target.insertAdjacentElement(
        isAfter ? 'afterend' : 'beforebegin',
        draggedItem,
    )
}

function handleDrop(e) {
    e.preventDefault()
}

function handleDragEnd() {
    if (draggedItem) draggedItem.classList.remove('dragging')
    draggedItem = null

    //El orden en el DOM ya cambió, solo falta renumerar y recalcular la ruta
    recalculatePoints()
    fetchRoute()
}

function recalculatePoints() {
    let arrPointItems = Array.from(pointItems)

    arrPointItems.forEach((li, index) => {
        setPointNumber(li, pointDict[li.dataset.pointId], index + 1)
    })

    //Recalculamos el contador de puntos
    updateSpanCounter(arrPointItems.length)
}

function clearRoute() {
    pointList.innerHTML = ''
    Object.values(pointDict).forEach((marker) => marker.remove())
    pointDict = {}

    routeLine.setLatLngs([])
    routeGeometry = []
    updateSpanCounter(0)
    updateSpanKm(0)

    resetElevationDisplay()
}

//Limpia estadística, gráfica y marcador de elevación (ruta vacía o con < 2 puntos)
function resetElevationDisplay() {
    updateSpanElevation(null)

    elevationProfile = []
    elevationChart.data.datasets[0].data = []
    elevationChart.options.scales.y.min = undefined
    elevationChart.options.scales.y.max = undefined
    elevationChart.update()

    clearElevationMarker()
}

// ==================== Elevación ====================

// Calcula el desnivel del inicio al final de la ruta
async function calculateElevation() {
    //No se puede calcular la elevación de algo que no hay dibujado
    if (routeGeometry.length == 0) return

    try {
        let measured = calculateCumulativeDistance()
        let interval = calculateIntervalPoints(measured)
        let dataPoints = calculateSelectedPoints(measured, interval)

        //El IGN necesita los puntos para calcular el bbox que los engloba a todos
        let fetchedElevation = await fetchElevation(dataPoints)

        let elevationDict = dataPoints.map((x, index) => {
            return {
                lat: x.lat,
                lng: x.lng,
                cD: x.cD,
                elevation: fetchedElevation[index],
            }
        })

        //El perfil es la ruta ya limpia de valores extraños y suavizada. Este es el que manda
        //para el cálculo de desnivel y para el hover (lat/lng reales de cada punto).
        let profile = smoothElevations(filterUnrealisticSlopes(elevationDict))

        //Datos con la subida y bajada total en metros
        let elevationChange = calculateElevationChange(profile)
        updateSpanElevation(elevationChange)

        //Guardamos el perfil completo para poder recuperar lat/lng al pasar el ratón por el chart
        elevationProfile = profile

        //Para el dibujo aplicamos un suavizado extra sobre el perfil ya calculado, solo
        //afecta a la línea del gráfico, no al desnivel ni al hover (mismo orden/índices que profile)
        let { smoothWindow, medianWindow } = calculateChartSmoothWindow(profile)

        let chartProfile = medianSmooth(profile, medianWindow)
        for (let i = 0; i < CHART_SMOOTH_PASSES; i++) {
            chartProfile = smoothElevations(chartProfile, smoothWindow)
        }

        //Chart.js necesita {x, y} cD está en metros y lo pasamos a km
        elevationChart.data.datasets[0].data = chartProfile.map((point) => {
            return { x: point.cD / 1000, y: point.elevation }
        })

        //Le damos aire al eje Y para que no exagere el desnivel real (solo dibujo)
        let elevations = chartProfile.map((point) => point.elevation)
        let minElevation = Math.min(...elevations)
        let maxElevation = Math.max(...elevations)
        let elevationRange = maxElevation - minElevation
        let padding = Math.max(elevationRange * CHART_Y_PADDING_RATIO, CHART_Y_PADDING_MIN)

        elevationChart.options.scales.y.min = minElevation - padding
        elevationChart.options.scales.y.max = maxElevation + padding

        elevationChart.update()

        console.table(profile)
    } catch (error) {
        console.error(error)
        // Futura función a implementar que muestre el error al usuario
        //showError("No se pudo calcular la elevación")
    }
}

//Fuente de verdad para evitar bugs con el mouseleave del chartJS
let isHoveringChart = false

// Al pasar el ratón por la gráfica, movemos un marcador sobre el punto correspondiente de la ruta en el mapa. Se llama en cada evento 'hover' del chart.
function handleChartHover(event, elements) {
    if (!isHoveringChart) return

    if (elements.length == 0) {
        clearElevationMarker()
        return
    }

    let index = elements[0].index
    let point = elevationProfile[index]

    if (!elevationMarker) {
        elevationMarker = L.circleMarker([point.lat, point.lng], {
            radius: 8,
            color: '#000',
            weight: 2,
            fillColor: '#fff',
            fillOpacity: 1,
        }).addTo(map)
    } else {
        elevationMarker.setLatLng([point.lat, point.lng])
    }
}

function clearElevationMarker() {
    if (elevationMarker) elevationMarker.remove()
    elevationMarker = null
}

//El onHover de Chart.js no dispara de forma fiable al salir del canvas (evento 'mouseout'), así que escuchamos 'mouseenter'/'mouseleave' directamente

let chartCanvas = document.getElementById('graphic')
chartCanvas.addEventListener('mouseenter', () => {
    isHoveringChart = true
})
chartCanvas.addEventListener('mouseleave', () => {
    isHoveringChart = false
    clearElevationMarker()
})

function calculateCumulativeDistance() {
    return routeGeometry.reduce((acc, currentPoint, i) => {
        let cumulativeDistance

        if (i === 0) {
            cumulativeDistance = 0
        } else {
            let previousPoint = acc[i - 1]
            let distance = haversine(
                previousPoint.lat,
                previousPoint.lng,
                currentPoint[0],
                currentPoint[1],
            )
            cumulativeDistance = previousPoint.cD + distance
        }

        let newPoint = {
            lat: currentPoint[0],
            lng: currentPoint[1],
            cD: cumulativeDistance,
        }

        return [...acc, newPoint]
    }, [])
}

//Distancia real entre dos coordenadas (en metros), la usa calculateCumulativeDistance
function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371000
    const rad = (grados) => (grados * Math.PI) / 180

    const dLat = rad(lat2 - lat1)
    const dLng = rad(lng2 - lng1)

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c
}

//Esto nos ayuda a calcular cuantos metros deberíamos dejar entre un punto y otro
function calculateIntervalPoints(measured) {
    let idealInterval = Math.round(measured.at(-1).cD / 100)
    let realInterval = Math.max(10, Math.min(50, idealInterval))

    return realInterval
}

//Aquí cogemos los puntos directos de la coordenadas con la que trabajamos, es decir si calculamos que para una ruta X, el intervalo ideal son 50m de distancia entre cada punto, nosotros cogeremos los datos de geometría (measured) que ya precalculamos anteriormente en calculateCumulativeDistance. Y de esta manera con la siguiente función cogeremos los puntos que vamos a pedir a nuestra API para calcular los desniveles.
function calculateSelectedPoints(measured, n) {
    let data = measured.reduce(
        (acc, currentPoint, i) => {
            if (currentPoint.cD >= acc.target) {
                acc.points.push(currentPoint)
                while (acc.target <= currentPoint.cD) {
                    acc.target += n
                }
            }
            return acc
        },
        { points: [], target: 0 },
    )

    let lastPoint = measured.at(-1)
    let lastSelectedPoint = data.points.at(-1)

    if (lastPoint.cD - lastSelectedPoint.cD < n / 2) {
        data.points[data.points.length - 1] = lastPoint
    } else {
        data.points.push(lastPoint)
    }

    // console.log(data.points)
    return data.points
}

// Pide la elevación al WCS del IGN (Muestra 5m). Hace una sola petición con el
// bbox que engloba toda la ruta, y luego muestrea la celda de cada punto.
async function fetchElevation(points) {
    if (points.length == 0) return

    let lats = points.map((p) => p.lat)
    let lngs = points.map((p) => p.lng)

    //Margen para que ningún punto quede justo en el borde del bbox
    let margin = 0.001
    let minLat = Math.min(...lats) - margin
    let maxLat = Math.max(...lats) + margin
    let minLng = Math.min(...lngs) - margin
    let maxLng = Math.max(...lngs) + margin

    const response = await fetch(
        `https://servicios.idee.es/wcs-inspire/mdt?service=WCS&version=2.0.1&request=GetCoverage&coverageId=Elevacion4258_5&subset=lat(${minLat},${maxLat})&subset=long(${minLng},${maxLng})&format=application/asc`,
    )

    if (!response.ok) {
        const err = new Error(
            `No se pudo calcular la elevación (IGN ${response.status})`,
        )
        err.status = response.status
        throw err
    }

    let grid = parseAscGrid(await response.text())

    //Devuelvo la elevación de cada punto, en el mismo orden en que entraron
    return points.map((p) => sampleGrid(grid, p.lat, p.lng))
}

// Parsea el ASCII grid del IGN (viene envuelto en una cabecera MIME). Separa los
// metadatos (ncols, nrows, esquina inferior-izquierda, tamaño de celda) de la
// matriz de alturas.
function parseAscGrid(text) {
    const HEADER_KEYS = [
        'ncols',
        'nrows',
        'xllcorner',
        'yllcorner',
        'dx',
        'dy',
        'cellsize',
    ]
    let meta = {}
    let rows = []

    for (let line of text.split('\n')) {
        let t = line.trim()
        if (t == '' || t.startsWith('--') || t.startsWith('Content')) continue

        let p = t.split(/\s+/)
        if (HEADER_KEYS.includes(p[0])) {
            meta[p[0]] = parseFloat(p[1])
        } else if (!isNaN(parseFloat(p[0]))) {
            rows.push(p.map(Number))
        }
    }

    return { ...meta, rows }
}

// Devuelve la altura de la celda de la rejilla que contiene la coordenada (lat, lng).
function sampleGrid(grid, lat, lng) {
    //El IGN usa cellsize cuando la celda es cuadrada, o dx/dy si difieren
    let dx = grid.dx ?? grid.cellsize
    let dy = grid.dy ?? grid.cellsize

    let col = Math.floor((lng - grid.xllcorner) / dx)
    let rowFromBottom = Math.floor((lat - grid.yllcorner) / dy)

    col = Math.max(0, Math.min(grid.ncols - 1, col))
    rowFromBottom = Math.max(0, Math.min(grid.nrows - 1, rowFromBottom))

    //La primera fila del fichero es el norte (arriba), por eso hay que invertir
    let row = grid.nrows - 1 - rowFromBottom

    return grid.rows[row][col]
}

// Función de seguridad: si entre un punto y el siguiente hay una pendiente
// mayor al MAX_SLOPE (%), probablemente sea un error del dataset de elevación,
// así que sustituimos ese valor por uno interpolado entre sus vecinos.
function filterUnrealisticSlopes(data) {
    return data.map((point, i) => {
        if (i == 0) {
            return point
        } else if (i == data.length - 1) {
            return point
        } else {
            let elevationDiff = point.elevation - data[i - 1].elevation
            let distanceDiff = point.cD - data[i - 1].cD

            let slope = (elevationDiff / distanceDiff) * 100

            if (Math.abs(slope) < MAX_SLOPE) {
                return point
            } else {
                let t =
                    (point.cD - data[i - 1].cD) /
                    (data[i + 1].cD - data[i - 1].cD)
                let interpolatedElevation =
                    data[i - 1].elevation +
                    t * (data[i + 1].elevation - data[i - 1].elevation)
                return { ...point, elevation: interpolatedElevation }
            }
        }
    })
}

// Ej: 254, 253, 256, 254 -> los saltos pequeños se diluyen y
// solo sobreviven las subidas/bajadas sostenidas del terreno.
function smoothElevations(data, window = SMOOTH_WINDOW) {
    return data.map((point, i) => {
        let start = Math.max(0, i - window)
        let end = Math.min(data.length - 1, i + window)
        let neighbors = data.slice(start, end + 1)

        let elevation =
            neighbors.reduce((sum, p) => sum + p.elevation, 0) /
            neighbors.length

        return { ...point, elevation }
    })
}

// Pasa el radio de suavizado (metros) a nº de puntos, según el espaciado de esta ruta
function calculateChartSmoothWindow(profile) {
    let totalDistance = profile.at(-1).cD
    let spacing = totalDistance / (profile.length - 1)

    let radius = Math.min(
        CHART_SMOOTH_RADIUS_MAX,
        Math.max(CHART_SMOOTH_RADIUS_MIN, totalDistance * CHART_SMOOTH_RADIUS_RATIO),
    )

    let smoothWindow = Math.max(1, Math.round(radius / spacing))

    let medianWindow = Math.max(1, Math.round(smoothWindow / 3))

    return { smoothWindow, medianWindow }
}

// Filtro de mediana: elimina picos/valles de un solo punto en vez de solo diluirlos
function medianSmooth(data, window = 1) {
    return data.map((point, i) => {
        let start = Math.max(0, i - window)
        let end = Math.min(data.length - 1, i + window)
        let neighbors = data
            .slice(start, end + 1)
            .map((p) => p.elevation)
            .sort((a, b) => a - b)

        let mid = Math.floor(neighbors.length / 2)
        let elevation =
            neighbors.length % 2 == 0
                ? (neighbors[mid - 1] + neighbors[mid]) / 2
                : neighbors[mid]

        return { ...point, elevation }
    })
}

function calculateElevationChange(data) {
    // Agrupo el desnivel en rachas: mientras la diferencia siga el mismo signo, se acumula.
    // Al cambiar de sentido, se cierra la racha y solo cuenta si supera RUN_THRESHOLD.
    // Ej: run de +12m -> se suma a totalGain; run de +3m -> se descarta.
    let result = data.reduce(
        (acc, point, i) => {
            let current = point.elevation

            if (i == 0) {
                acc.previous = current
            } else {
                let diff = current - acc.previous

                if (Math.sign(diff) === Math.sign(acc.run) && diff != 0) {
                    // Si la diferencia es distinta de cero y ademas tienen el mismo signo, sumamos a la racha
                    acc.run += diff
                } else if (
                    //Si la diferencia y la racha tienen distinto signo, y la diferencia es distinta de 0 quiere decir que hubo un cambio en la elevación, por tanto se rompe la racha
                    Math.sign(diff) !== Math.sign(acc.run) &&
                    diff !== 0
                ) {
                    if (acc.run > RUN_THRESHOLD) {
                        acc.totalGain += acc.run
                    } else if (acc.run < -RUN_THRESHOLD)
                        acc.totalLoss += Math.abs(acc.run)

                    acc.run = diff
                }
            }
            acc.previous = current
            return acc
        },
        { totalGain: 0, totalLoss: 0, run: 0, previous: 0 },
    )

    if (result.run > RUN_THRESHOLD) {
        result.totalGain += result.run
    } else if (result.run < -RUN_THRESHOLD) {
        result.totalLoss += Math.abs(result.run)
    }

    return (result = {
        totalGain: Math.round(result.totalGain),
        totalLoss: Math.round(result.totalLoss),
    })
}

init()
