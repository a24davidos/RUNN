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
//Marcador que indica dónde caería el punto si soltamos ahora; ver handleDragOver
let dragPlaceholder = null
//Orden de los puntos (ids) justo antes de empezar a arrastrar en la lista lateral
let dragStartOrder = null

// ==================== Pila de undo ====================

// Máximo 20 acciones.
const MAX_UNDO = 20
let undoStack = []

//Evita que las operaciones que hace el propio undo se registren a sí mismas
let isUndoing = false

function pushUndoAction(action) {
    if (isUndoing) return

    undoStack.push(action)
    if (undoStack.length > MAX_UNDO) undoStack.shift()

    updateUndoButtonState()
}

function undoLastAction() {
    if (undoStack.length === 0) return

    let action = undoStack.pop()

    isUndoing = true
    try {
        switch (action.type) {
            case 'add':
                deletePointById(action.id)
                break
            case 'delete':
                restoreDeletedPoint(action)
                break
            case 'move':
                restoreMarkerPosition(action)
                break
            case 'reorder':
                restoreOrder(action.order)
                break
        }
    } catch (err) {
        console.error('Error al deshacer la acción:', err)
    } finally {
        isUndoing = false
    }

    updateUndoButtonState()
}

//Vuelve a crear un punto borrado, en la misma posición de la lista en la que estaba
function restoreDeletedPoint({ lat, lng, index }) {
    let marker = createPointMarker(lat, lng, 0)
    wireMarkerEvents(marker)

    let li = createPointListItem(marker, 0)
    let referenceLi = pointItems[index]
    if (referenceLi) {
        pointList.insertBefore(li, referenceLi)
    } else {
        pointList.appendChild(li)
    }

    syncPointsAndRoute()
}

//Devuelve el marker a la posición que tenía antes del drag
function restoreMarkerPosition({ id, from }) {
    let marker = pointDict[id]
    if (!marker) return

    marker.setLatLng(from)
    updateLi(id, from.lat, from.lng)
    fetchRoute(getRouteCoords())
}

//Reordena la lista según el orden de ids indicado
function restoreOrder(order) {
    order.forEach((id) => {
        let li = pointList.querySelector(`[data-point-id="${id}"]`)
        if (li) pointList.appendChild(li)
    })

    syncPointsAndRoute()
}

function getOrderIds() {
    return Array.from(pointItems).map((li) => li.dataset.pointId)
}

function updateUndoButtonState() {
    let disabled = undoStack.length === 0
    btnUndoPoint.disabled = disabled
    btnUndoPointFab.disabled = disabled
}

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
    //Botón para deshacer: revierte la última acción realizada
    btnUndoPoint.addEventListener('click', undoLastAction)
    //Mismos botones pero flotando sobre el mapa, para móvil
    btnClearRouteFab.addEventListener('click', clearRoute)
    btnUndoPointFab.addEventListener('click', undoLastAction)

    //Al arrancar no hay nada que deshacer
    updateUndoButtonState()
}

//Se llama desde map.js al hacer click en el mapa
//Añadir un punto: marker + li + recalcular ruta
export function addPoint(lat, lng) {
    let pointNumber = Object.keys(pointDict).length + 1

    let marker = createPointMarker(lat, lng, pointNumber)
    wireMarkerEvents(marker)

    let li = createPointListItem(marker, pointNumber)
    pointList.appendChild(li)

    pushUndoAction({ type: 'add', id: marker._leaflet_id })

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
            html: `<span class="marker-number">${number}</span>`,
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
    //Posición del marker justo antes de empezar a arrastrarlo, para poder deshacer el movimiento
    let dragStartPosition = null

    marker.on('dragstart', function () {
        dragStartPosition = marker.getLatLng()
        marker.getElement().classList.add('dragging')
    })

    marker.on('dragend', function () {
        marker.getElement().classList.remove('dragging')

        let position = marker.getLatLng()
        if (dragStartPosition) {
            pushUndoAction({
                type: 'move',
                id: marker._leaflet_id,
                from: dragStartPosition,
            })
        }

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
        <span class="drag-handle"><span class="icon-svg icon-svg-drag"></span></span>
        <span class="point-number">${number}</span>
        <span class="point-coords">${lat.toFixed(4)}, ${lng.toFixed(4)}</span>
        <button class="delete-btn"><span class="icon-svg icon-svg-x"></span></button>
    `

    return li
}

function deletePoint(e) {
    let id = e.target.closest('li').dataset.pointId
    deletePointById(id)
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

    //Guardamos dónde estaba antes de borrarlo, por si hay que deshacerlo
    let li = pointList.querySelector(`[data-point-id="${id}"]`)
    let index = Array.from(pointItems).indexOf(li)
    let { lat, lng } = pointDict[id].getLatLng()

    removePointListItem(id)
    removePointMarker(id)

    pushUndoAction({ type: 'delete', lat, lng, index })

    syncPointsAndRoute()
}

function handleDragStart(e) {
    let item = e.target.closest('.point-item')
    if (!item) return

    draggedItem = item
    //Guardamos el orden de partida para poder deshacer el reordenado si cambia
    dragStartOrder = getOrderIds()
    e.dataTransfer.effectAllowed = 'move'
    //Altura de la fila real, para que el hueco ocupe justo lo mismo que ella
    let itemHeight = draggedItem.offsetHeight

    //Creamos el hueco y colapsamos la fila original juntos, en el mismo instante,
    //para que no haya un frame intermedio donde ambos ocupen espacio a la vez (ver
    //setTimeout más abajo: es el mismo delay que ya evita interferir con la foto de arrastre).
    //No movemos draggedItem directamente: si el elemento que se está arrastrando se
    //desconecta del DOM mientras dura el drag nativo, el navegador puede cancelar la
    //operación y el cursor se queda en "prohibido" de forma intermitente.
    setTimeout(() => {
        dragPlaceholder = document.createElement('li')
        dragPlaceholder.className = 'point-item drag-placeholder'
        dragPlaceholder.style.height = `${itemHeight}px`
        draggedItem.insertAdjacentElement('afterend', dragPlaceholder)

        draggedItem.classList.add('dragging')
    }, 0)
}

function handleDragOver(e) {
    //Necesario para permitir el drop, si no el navegador lo rechaza por defecto
    e.preventDefault()

    let target = e.target.closest('.point-item')
    if (!dragPlaceholder || !target || target === draggedItem || target === dragPlaceholder) return

    //Decidimos si insertar antes o después según en qué mitad del elemento estamos
    let rect = target.getBoundingClientRect()
    let isAfter = e.clientY - rect.top > rect.height / 2

    target.insertAdjacentElement(
        isAfter ? 'afterend' : 'beforebegin',
        dragPlaceholder,
    )
}

function handleDrop(e) {
    e.preventDefault()
}

function handleDragEnd() {
    //Ahora sí: movemos el punto real a la posición marcada por el hueco, de una sola vez
    if (draggedItem && dragPlaceholder) {
        pointList.insertBefore(draggedItem, dragPlaceholder)
    }
    if (dragPlaceholder) {
        dragPlaceholder.remove()
        dragPlaceholder = null
    }

    if (draggedItem) draggedItem.classList.remove('dragging')
    draggedItem = null

    //Si el orden cambió respecto al de partida, lo registramos para poder deshacerlo
    if (dragStartOrder) {
        let currentOrder = getOrderIds()
        let orderChanged = currentOrder.some((id, i) => id !== dragStartOrder[i])
        if (orderChanged) {
            pushUndoAction({ type: 'reorder', order: dragStartOrder })
        }
        dragStartOrder = null
    }

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

    //Un borrado total no es deshacible: las acciones previas dejarían de tener sentido
    undoStack = []
    updateUndoButtonState()

    resetRouteGeometry()
}

function setPointNumber(li, marker, number) {
    li.querySelector('.point-number').innerHTML = number
    marker.getElement().querySelector('.marker-number').innerHTML = number
}

function updateSpanCounter(count) {
    spanCounterPoints.innerHTML = count
}

function updateLi(id, lat, lng) {
    let target = Array.from(pointItems).find((x) => x.dataset.pointId == id)
    //Si el punto se borró justo antes de que terminara el drag, no hay li que actualizar
    if (!target) return
    target.children[2].innerText = `${lat.toFixed(4)}, ${lng.toFixed(4)}`
}
