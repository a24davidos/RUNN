// Ajustes por defecto
const LATITUDE = 42.88235
const LONGITUDE = -8.54586
const ZOOM = 13
const MAXZOOM = 18

let userPosition = null
let map = null

let pArray = []

let pointList = document.getElementById('point-list')

function init() {
    navigator.geolocation.getCurrentPosition(showPosition, showErrorLocation)
}

function showPosition(pos) {
    //Guardamos la posición del usuario
    userPosition = pos

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
    console.log(e)
    console.log(e.latlng.lat)
    console.log(e.latlng.lng)

    let point = L.marker([e.latlng.lat, e.latlng.lng], {
        icon: L.divIcon({
            className: 'numbered-marker',
            html: `${pArray.length + 1}`,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
        }),
    })

    addPoint(point)
}


function addPoint(point) {
    point.addTo(map)
    point.getElement().dataset.pointId = point._leaflet_id

    pArray.push(point)
    console.log(point)

    let li = document.createElement('li')
    li.classList.add("point-item")
    li.dataset.pointId = point._leaflet_id

    li.innerHTML = `
        <span>${pArray.length}</span>
        <span>${point.getLatLng().lat.toFixed(4)}, ${point.getLatLng().lng.toFixed(4)}</span>
        <span>🗑️</span>
    `

    pointList.appendChild(li)
}

function initEvents() {
    map.on('click', onMapClick)
}

function renderMap(lat, lon) {
    map = L.map('map').setView([lat, lon], ZOOM)

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: MAXZOOM,
        attribution:
            '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)

    initEvents()
}

init()
