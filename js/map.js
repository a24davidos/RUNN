// ==================== Mapa / Geolocalización ====================

import { LATITUDE, LONGITUDE, ZOOM, MAXZOOM } from './config.js'
import { state, routeLine } from './state.js'
import { addPoint } from './points.js'

export function initMap() {
    //Renderizamos el mapa con Santiago de Compostela por defecto, sin esperar al permiso de geolocalización
    renderMap(LATITUDE, LONGITUDE)
    navigator.geolocation.getCurrentPosition(showPosition, showErrorLocation)
}

function renderMap(lat, lon) {
    state.map = L.map('map').setView([lat, lon], ZOOM)

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: MAXZOOM,
        attribution:
            '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(state.map)

    //Quitamos el "Leaflet" del footer, ya que no aporta nada y ocupa espacio en móvil
    state.map.attributionControl.setPrefix(false)

    routeLine.addTo(state.map)

    initMapEvents()
}

function initMapEvents() {
    state.map.on('click', onMapClick)

    //Desactivamos el menú contextual por defecto del navegador sobre el mapa
    state.map.getContainer().addEventListener('contextmenu', (e) => e.preventDefault())

    window.addEventListener('resize', () => state.map.invalidateSize())
}

function onMapClick(e) {
    addPoint(e.latlng.lat, e.latlng.lng)
}

function showPosition(pos) {
    //Centramos el mapa en la posición real del usuario en cuanto la tenemos
    state.map.setView([pos.coords.latitude, pos.coords.longitude], ZOOM)
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
