'use strict'

// ==================== Configuración ====================

//Latitude y Longitud por defecto (Santiago de Compostela)
const LATITUDE = 42.88235
const LONGITUDE = -8.54586
const ZOOM = 13
const MAXZOOM = 18
const ICONSIZE = 25
const ICONANCHOR = 15
const COLOR = 'blue'
const WEIGHT = 4

// ==================== Estado ====================
let userPosition = null
let map = null

let routeLine = L.polyline([], { color: COLOR, weight: WEIGHT })

let pointDict = {}

// ==================== Referencias al DOM ====================
let pointList = document.getElementById('point-list')
let pointItems = pointList.getElementsByTagName('li')
let spanCounterPoints = document.getElementById('counter')
let spanCounterKm = document.getElementById('counter-km')

let btnClearRoute = document.getElementById('btn-clear-route')

// ==================== Arranque / Geolocalización ====================
function init() {
    navigator.geolocation.getCurrentPosition(showPosition, showErrorLocation)
}

function showPosition(pos) {
    //Guardamos la posición del usuario
    userPosition = pos
    //Renderizamos el mapa con su posición
    renderMap(userPosition.coords.latitude, userPosition.coords.longitude)
}

function showErrorLocation(err) {
    console.log(err)
    // ESTO DEBERIA DE MEJORARLO ⚠️
    if (err.code === 1) {
        console.log('Porfavor activa la geolocalización!')
    } else {
        console.log('No hemos podido encontrar tu localización')
    }

    renderMap(LATITUDE, LONGITUDE)
}

function onMapClick(e) {
    addPoint(e.latlng.lat, e.latlng.lng)
}

// ==================== Utilidades de formato ====================
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

async function fetchRoute() {
    let coords = getRouteCoords()

    //Tiene que haber mínimo 2 puntos para hacer una llamada a la Api
    if (coords.length < 2) {
        updateSpanKm(0)
        return routeLine.setLatLngs([])
    }

    const str = coords.map((x) => `${x[0]},${x[1]}`).join(';')

    const response = await fetch(
        `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${str}?overview=full&geometries=geojson`,
    )

    if (!response.ok) {
        //VER COMO CONTROLARLO MAS ADELANTE ⚠️!!!
        alert('Algo esta fallando en la api')
        return
    }

    const data = await response.json()

    let routeCoords = data.routes[0].geometry.coordinates.map((x) => [
        x[1],
        x[0],
    ])

    routeLine.setLatLngs(routeCoords)

    //Actualizo el contador de Km
    updateSpanKm(data.routes[0].distance)
}

// ==================== Setup del mapa ====================

function renderMap(lat, lon) {
    map = L.map('map').setView([lat, lon], ZOOM)

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: MAXZOOM,
        attribution:
            '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)

    routeLine.addTo(map)

    initEvents()
}

function initEvents() {
    map.on('click', onMapClick)

    //Evento para eliminar puntos
    pointList.addEventListener('click', (e) => {
        if (e.target.className == 'delete-btn') {
            deletePoint(e)
        }
    })

    //Evento para limpiar la ruta
    btnClearRoute.addEventListener('click', clearRoute)
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

    let li = document.createElement('li')
    li.classList.add('point-item')
    li.dataset.pointId = point._leaflet_id

    li.innerHTML = `
        <span>${pointNumber}</span>
        <span>${point.getLatLng().lat.toFixed(4)}, ${point.getLatLng().lng.toFixed(4)}</span>
        <button class="delete-btn">🗑️</button>
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
    //Eliminamos el nodo de la lista
    pointList.querySelector(`[data-point-id="${id}"]`).remove()

    //Eliminamos la referencia dentro de leaflet
    pointDict[id].remove()

    //Eliminamos la referencia de la lista
    delete pointDict[id]

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
    updateSpanCounter(0)
    updateSpanKm(0)
}

init()
