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

const RUN_THRESHOLD = 8
const MAX_SLOPE = 35
// ==================== Estado ====================
let userPosition = null
let map = null

let routeLine = L.polyline([], { color: COLOR, weight: WEIGHT })

//Aquí guardo los puntos que se dibujan
let routeGeometry = []

let pointDict = {}

// ==================== Referencias al DOM ====================
let pointList = document.getElementById('point-list')
let pointItems = pointList.getElementsByTagName('li')

let spanCounterPoints = document.getElementById('counter')
let spanCounterKm = document.getElementById('counter-km')

let btnClearRoute = document.getElementById('btn-clear-route')
let btnElevation = document.getElementById('btn-elevation')
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
        routeGeometry = []
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
    routeGeometry = routeCoords

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

    //Botón para limpiar la ruta
    btnClearRoute.addEventListener('click', clearRoute)
    //Botón para calcular la elevación
    btnElevation.addEventListener('click', calculateElevation)
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
    routeGeometry = []
    updateSpanCounter(0)
    updateSpanKm(0)
}

// ==================== Elevación ====================

// Calcula el desnivel del inicio al final de la ruta
async function calculateElevation() {
    //No se puede calcular la elevación de algo que no hay dibujado
    if (routeGeometry.length == 0) return

    let measured = calculateCumulativeDistance()
    let interval = calculateIntervalPoints(measured)
    let dataPoints = calculateSelectedPoints(measured, interval)

    //Open-Meteo espera dos listas separadas por comas: latitudes y longitudes
    let latitude = dataPoints.map((x) => x.lat).join(',')
    let longitude = dataPoints.map((x) => x.lng).join(',')

    let fetchedElevation = await fetchElevation(latitude, longitude)

    let elevationDict = dataPoints.map((x, index) => {
        return {
            lat: x.lat,
            lng: x.lng,
            cD: x.cD,
            elevation: fetchedElevation[index],
        }
    })

    let resultado = calculateElevationChange(elevationDict)

    console.log(resultado);
    return resultado
    
}

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
    let realInterval = Math.max(20, Math.min(50, idealInterval))

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

async function fetchElevation(locations) {
    if (locations == '') return

    const response = await fetch(
        `https://api.opentopodata.org/v1/eudem25m?locations=${locations}`,
    )

    if (!response.ok) {
        //VER COMO CONTROLARLO MAS ADELANTE ⚠️!!!
        alert('Algo esta fallando en la api')
        return
    }
    const data = await response.json()

    //Open Topo Data devuelve results[].elevation, lo aplano para dejarlo como antes
    return data.results.map((x) => x.elevation)
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

function calculateElevationChange(data) {
    // Suavizado: cada punto pasa a ser el promedio con sus vecinos.
    // Ej: 254, 253, 256, 254 -> los saltos pequeños se diluyen y
    // solo sobreviven las subidas/bajadas sostenidas del terreno.

    let cleanedData = filterUnrealisticSlopes(data)

    let smoothedData = cleanedData.map((x, i) => {
        x = x.elevation

        if (i == 0) {
            return (x + cleanedData[i + 1].elevation) / 2
        } else if (i == cleanedData.length - 1) {
            return (x + cleanedData[i - 1].elevation) / 2
        } else {
            return (
                (cleanedData[i - 1].elevation +
                    x +
                    cleanedData[i + 1].elevation) /
                3
            )
        }
    })

    // Agrupo el desnivel en "rachas" (run): mientras la diferencia siga el mismo signo, se acumula.
    // Al cambiar de sentido, se cierra la racha y solo cuenta si supera RUN_THRESHOLD.
    // Ej: run de +12m -> se suma a totalGain; run de +3m -> se descarta.
    let result = smoothedData.reduce(
        (acc, current, i) => {
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

    return result = {
        totalGain: Math.round(result.totalGain),
        totalLoss: Math.round(result.totalLoss),
    }
}

init()
