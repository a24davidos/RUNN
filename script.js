// === Configuración ===
const LATITUDE = 42.88235
const LONGITUDE = -8.54586
const ZOOM = 13
const MAXZOOM = 18
const ICONSIZE = 25
const ICONANCHOR = 15
const COLOR = 'blue'
const WEIGHT = 4

// === Estado ===
let userPosition = null
let map = null

let routeLine = L.polyline([], { color: COLOR, weight: WEIGHT })

let pointDict = {}

// === Referencias al DOM ===
let pointList = document.getElementById('point-list')
let pointItems = pointList.getElementsByTagName('li')
let spanCounter = document.getElementById('counter')

// let routeLine = L.polyline(
//     [
//         [42.882, -8.545],
//         [42.883, -8.546],
//         [42.884, -8.547],
//     ],
//     {
//         color: 'blue',
//         weight: 4,
//     }
// )

// === Eventos ===
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

// === Lógica / Render ===
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
}

function updateSpanCounter(count) {
    spanCounter.innerHTML = count
}

function updatePolyLine() {
    routeLine.setLatLngs(getRouteCoords())
}

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
    if (coords.length < 2) return

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
}

function addPoint(lat, lng) {
    let pointNumber = Object.keys(pointDict).length + 1

    let point = L.marker([lat, lng], {
        icon: L.divIcon({
            className: 'numbered-marker',
            html: `${pointNumber}`,
            iconSize: [ICONSIZE, ICONSIZE],
            iconAnchor: [ICONANCHOR, ICONANCHOR],
        }),
    })

    point.addTo(map)
    point.getElement().dataset.pointId = point._leaflet_id

    pointDict[point._leaflet_id] = point
    console.log(point)

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

    arrPointItems.forEach((item, index) => {
        item.children[0].innerHTML = index + 1
        let marker = pointDict[item.dataset.pointId]
        marker.getElement().innerHTML = index + 1
    })

    //Recalculamos el contador de puntos
    updateSpanCounter(arrPointItems.length)
    updatePolyLine()
}

init()
