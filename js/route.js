// ==================== Ruta ====================

import { state, routeLine } from './state.js'
import { formatKm, triggerDownload } from './utils.js'
import { scheduleElevation, flushElevation, resetElevation } from './elevation.js'

let spanCounterKm = document.getElementById('counter-km')

let btnDownloadGpx = document.getElementById('btn-download-gpx')
let btnDownloadGpxFab = document.getElementById('btn-download-gpx-fab')

let routeRequestId = 0

export function initRouteEvents() {
    //Botón para descargar la ruta en formato GPX (importable en reloj/móvil)
    btnDownloadGpx.addEventListener('click', downloadGPX)
    //Mismo botón flotando sobre el mapa, para móvil
    btnDownloadGpxFab.addEventListener('click', downloadGPX)
}

//Pide la ruta a OSRM y la aplica. Recibe las coordenadas ya calculadas —
//este módulo no necesita saber cómo se leen los puntos de la lista.
export async function fetchRoute(coords) {
    let requestId = ++routeRequestId
    
    //Tiene que haber mínimo 2 puntos para hacer una llamada a la Api
    if (coords.length < 2) {
        return resetRouteGeometry()
    }

    try {
        let { routeCoords, distance } = await fetchRouteData(coords)

        //Si hay una llamada más nueva en marcha, esta respuesta ya no vale
        if (requestId !== routeRequestId) return

        applyRoute(routeCoords, distance)
    } catch (error) {
        console.error(error)
        // Futura función a implementar que muestre el error al usuario
        //showError("No se pudo calcular la ruta")
    }
}

//Sin ruta que calcular (menos de 2 puntos), lo dejamos todo a cero
export function resetRouteGeometry() {
    //Invalidamos cualquier petición en curso
    routeRequestId++
    updateSpanKm(0)
    state.routeGeometry = []
    routeLine.setLatLngs([])
    resetElevation()
}

//Pide la ruta a OSRM
async function fetchRouteData(coords) {
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
    let routeCoords = data.routes[0].geometry.coordinates.map((x) => [x[1], x[0]])

    return { routeCoords, distance: data.routes[0].distance }
}

//Guardamos la ruta calculada y actualizamos lo que depende de ella
function applyRoute(routeCoords, distance) {
    routeLine.setLatLngs(routeCoords)
    state.routeGeometry = routeCoords

    //Actualizo el contador de Km
    updateSpanKm(distance)

    //Antes había que darle a un botón; ahora el desnivel se recalcula solo en cada cambio de ruta
    scheduleElevation()
}

function updateSpanKm(meters) {
    spanCounterKm.innerText = formatKm(meters)
}

// ==================== Exportar ruta (GPX) ====================

function buildGPX() {
    if (state.routeGeometry.length < 2) return null

    let points =
        state.elevationProfile.length > 0
            ? state.elevationProfile
            : state.routeGeometry.map(([lat, lng]) => ({ lat, lng, elevation: null }))

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
//todavía desactualizado o vacío. Por eso forzamos el cálculo aquí (flushElevation),
//esperando a que termine antes de construir el GPX.
async function downloadGPX() {
    if (state.routeGeometry.length < 2) return //No hay ruta que exportar

    await flushElevation()

    let gpx = buildGPX()
    if (!gpx) return

    let filename = `runn-ruta-${new Date().toISOString().slice(0, 10)}.gpx`
    triggerDownload(gpx, filename, 'application/gpx+xml')
}
