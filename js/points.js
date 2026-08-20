// ==================== Puntos ====================

import { ICONSIZE, ICONANCHOR } from './config.js'
import { state } from './state.js'
import { fetchRoute, resetRouteGeometry } from './route.js'

let pointList = document.getElementById('point-list')
let pointItems = pointList.getElementsByTagName('li')

let spanCounterPoints = document.getElementById('counter')

let btnClearRoute = document.getElementById('btn-clear-route')
let btnUndoPoint = document.getElementById('btn-undo-point')
let btnClearRouteFab = document.getElementById('btn-clear-route-fab')
let btnUndoPointFab = document.getElementById('btn-undo-point-fab')

let pointDict = {}

//Guarda el <li> que se está arrastrando mientras dura el drag
let draggedItem = null

export function initPointsEvents() {
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
    //Mismos botones pero flotando sobre el mapa, para móvil
    btnClearRouteFab.addEventListener('click', clearRoute)
    btnUndoPointFab.addEventListener('click', undoLastPoint)
}

//Se llama desde map.js al hacer click en el mapa
//Añadir un punto: marker + li + recalcular ruta
export function addPoint(lat, lng) {
    let pointNumber = Object.keys(pointDict).length + 1

    let marker = createPointMarker(lat, lng, pointNumber)
    wireMarkerEvents(marker)

    let li = createPointListItem(marker, pointNumber)
    pointList.appendChild(li)

    //Recalculamos el contador de puntos
    updateSpanCounter(pointNumber)

    //Calculamos la ruta
    fetchRoute(getRouteCoords())
}

//Coordenadas de la ruta en el orden de la lista, formato [lng, lat] (lo que espera OSRM)
function getRouteCoords() {
    return Array.from(pointItems).map((li) => {
        let marker = pointDict[li.dataset.pointId]
        let { lat, lng } = marker.getLatLng()
        return [lng, lat]
    })
}

//Creamos el marker numerado y lo guardamos en pointDict
function createPointMarker(lat, lng, number) {
    let marker = L.marker([lat, lng], {
        icon: L.divIcon({
            className: 'numbered-marker',
            html: `${number}`,
            iconSize: [ICONSIZE, ICONSIZE],
            iconAnchor: [ICONANCHOR, ICONANCHOR],
        }),
        draggable: true,
    })

    marker.addTo(state.map)
    marker.getElement().dataset.pointId = marker._leaflet_id
    pointDict[marker._leaflet_id] = marker

    return marker
}

//Eventos del marker: arrastrar recalcula la ruta, click derecho lo borra
function wireMarkerEvents(marker) {
    marker.on('dragend', function () {
        let position = marker.getLatLng()
        fetchRoute(getRouteCoords())
        updateLi(marker._leaflet_id, position.lat, position.lng)
    })

    marker.addEventListener('contextmenu', function () {
        deletePointById(marker._leaflet_id)
    })

    //Evitamos que el click sobre el marker le cree otro marquer encima
    marker.on('click', function (e) {
        L.DomEvent.stopPropagation(e)
    })
}

//Creamos el <li> de la lista asociado a ese marker
function createPointListItem(marker, number) {
    let li = document.createElement('li')
    li.classList.add('point-item')
    li.dataset.pointId = marker._leaflet_id
    li.draggable = true

    let { lat, lng } = marker.getLatLng()
    li.innerHTML = `
        <span>${number}</span>
        <span>${lat.toFixed(4)}, ${lng.toFixed(4)}</span>
        <button class="delete-btn"><span class="icon-svg icon-svg-x"></span></button>
    `

    return li
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

//Quitamos el <li> de la lista
function removePointListItem(id) {
    let item = pointList.querySelector(`[data-point-id="${id}"]`)
    if (item) item.remove()
}

//Quitamos el marker de Leaflet y su referencia en pointDict
function removePointMarker(id) {
    if (!pointDict[id]) return
    pointDict[id].remove()
    delete pointDict[id]
}

//Borrar un punto: li + marker + renumerar + recalcular ruta
function deletePointById(id) {
    //Si el punto ya no existe (doble borrado) no hacemos nada
    if (!pointDict[id]) return

    removePointListItem(id)
    removePointMarker(id)

    syncPointsAndRoute()
}

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

    syncPointsAndRoute()
}

function recalculatePoints() {
    let arrPointItems = Array.from(pointItems)

    arrPointItems.forEach((li, index) => {
        setPointNumber(li, pointDict[li.dataset.pointId], index + 1)
    })

    //Recalculamos el contador de puntos
    updateSpanCounter(arrPointItems.length)
}

//Tras borrar un punto o reordenar la lista: renumera y vuelve a pedir la ruta
function syncPointsAndRoute() {
    recalculatePoints()
    fetchRoute(getRouteCoords())
}

//Borrar ruta: puntos + geometría/elevación
function clearRoute() {
    pointList.innerHTML = ''
    Object.values(pointDict).forEach((marker) => marker.remove())
    pointDict = {}
    updateSpanCounter(0)

    resetRouteGeometry()
}

function setPointNumber(li, marker, number) {
    li.children[0].innerHTML = number
    marker.getElement().innerHTML = number
}

function updateSpanCounter(count) {
    spanCounterPoints.innerHTML = count
}

function updateLi(id, lat, lng) {
    let target = Array.from(pointItems).find((x) => x.dataset.pointId == id)
    //Si el punto se borró justo antes de que terminara el drag, no hay li que actualizar
    if (!target) return
    target.children[1].innerText = `${lat.toFixed(4)}, ${lng.toFixed(4)}`
}
