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

const UMBRAL_METROS = 5

// ==================== Estado ====================
let userPosition = null
let map = null

let routeLine = L.polyline([], { color: COLOR, weight: WEIGHT })

//Aquí guardo los puntos que se dibujan
let routeGeometry = []
//Aquí guardo un array de diccionarios
let measuredRouteGeometry = []
// [
//     {
//         "lat": 42.898858,
//         "lng": -8.530336,
//         "cD": 0
//     }
// ]

let pointDict = {}

let datosSim = [
    {
        lat: 42.887025,
        lng: -8.547616,
        cD: 0,
        elevation: 233,
    },
    {
        lat: 42.886886,
        lng: -8.54771,
        cD: 22.26273523046138,
        elevation: 233,
    },
    {
        lat: 42.886733,
        lng: -8.547744,
        cD: 43.487846544478984,
        elevation: 233,
    },
    {
        lat: 42.886576,
        lng: -8.547789,
        cD: 61.35081256440578,
        elevation: 234,
    },
    {
        lat: 42.886393,
        lng: -8.547809,
        cD: 81.76706041835023,
        elevation: 234,
    },
    {
        lat: 42.886114,
        lng: -8.547795,
        cD: 112.82934594571715,
        elevation: 234,
    },
    {
        lat: 42.885838,
        lng: -8.54777,
        cD: 143.58666253729857,
        elevation: 234,
    },
    {
        lat: 42.885663,
        lng: -8.547688,
        cD: 169.08282414415913,
        elevation: 232,
    },
    {
        lat: 42.885483,
        lng: -8.547686,
        cD: 189.10901894211176,
        elevation: 232,
    },
    {
        lat: 42.885253,
        lng: -8.547751,
        cD: 215.22640693688973,
        elevation: 232,
    },
    {
        lat: 42.884537,
        lng: -8.548134,
        cD: 300.7388976870891,
        elevation: 228,
    },
    {
        lat: 42.884373,
        lng: -8.548278,
        cD: 323.7978964055548,
        elevation: 228,
    },
    {
        lat: 42.884103,
        lng: -8.548315,
        cD: 353.9971219852428,
        elevation: 228,
    },
    {
        lat: 42.88393,
        lng: -8.548357,
        cD: 373.53584155138515,
        elevation: 228,
    },
    {
        lat: 42.883638,
        lng: -8.548429,
        cD: 406.53045051775825,
        elevation: 228,
    },
    {
        lat: 42.883361,
        lng: -8.548498,
        cD: 437.8404048143519,
        elevation: 228,
    },
    {
        lat: 42.883295,
        lng: -8.548519,
        cD: 445.38034937173694,
        elevation: 229,
    },
    {
        lat: 42.883046,
        lng: -8.548602,
        cD: 473.88179926149576,
        elevation: 229,
    },
    {
        lat: 42.882807,
        lng: -8.5487,
        cD: 501.6340599159045,
        elevation: 229,
    },
    {
        lat: 42.882491,
        lng: -8.548857,
        cD: 541.2749259803196,
        elevation: 229,
    },
    {
        lat: 42.88229,
        lng: -8.548916,
        cD: 565.6217439318424,
        elevation: 229,
    },
    {
        lat: 42.881957,
        lng: -8.54905,
        cD: 604.225784789947,
        elevation: 229,
    },
    {
        lat: 42.881838,
        lng: -8.549141,
        cD: 621.0536571451611,
        elevation: 229,
    },
    {
        lat: 42.881648,
        lng: -8.549136,
        cD: 644.7188683315961,
        elevation: 230,
    },
    {
        lat: 42.881248,
        lng: -8.549335,
        cD: 694.5061417739701,
        elevation: 227,
    },
    {
        lat: 42.880934,
        lng: -8.549453,
        cD: 732.516646038704,
        elevation: 227,
    },
    {
        lat: 42.880734,
        lng: -8.549544,
        cD: 755.9591383622775,
        elevation: 233,
    },
    {
        lat: 42.880673,
        lng: -8.549573,
        cD: 763.1418306867696,
        elevation: 233,
    },
    {
        lat: 42.880579,
        lng: -8.549622,
        cD: 781.0368466118535,
        elevation: 233,
    },
    {
        lat: 42.880445,
        lng: -8.549749,
        cD: 800.4987695320732,
        elevation: 233,
    },
    {
        lat: 42.880337,
        lng: -8.550129,
        cD: 837.330021937869,
        elevation: 233,
    },
    {
        lat: 42.880325,
        lng: -8.550187,
        cD: 842.240682910294,
        elevation: 233,
    },
    {
        lat: 42.880127,
        lng: -8.550213,
        cD: 873.4039434669354,
        elevation: 233,
    },
    {
        lat: 42.880008,
        lng: -8.550135,
        cD: 890.0421874544782,
        elevation: 233,
    },
    {
        lat: 42.879582,
        lng: -8.550022,
        cD: 938.2993011258504,
        elevation: 239,
    },
    {
        lat: 42.879566,
        lng: -8.550018,
        cD: 940.1080280115109,
        elevation: 239,
    },
    {
        lat: 42.879011,
        lng: -8.549874,
        cD: 1002.9267462774725,
        elevation: 254,
    },
    {
        lat: 42.878846,
        lng: -8.549988,
        cD: 1027.6535866183729,
        elevation: 254,
    },
    {
        lat: 42.878818,
        lng: -8.55014,
        cD: 1041.3252196423098,
        elevation: 244,
    },
    {
        lat: 42.878673,
        lng: -8.550426,
        cD: 1069.6707231042149,
        elevation: 244,
    },
    {
        lat: 42.878559,
        lng: -8.550663,
        cD: 1092.7714924024945,
        elevation: 244,
    },
    {
        lat: 42.878479,
        lng: -8.550768,
        cD: 1105.113802571416,
        elevation: 244,
    },
    {
        lat: 42.878368,
        lng: -8.550732,
        cD: 1121.3024865516634,
        elevation: 244,
    },
    {
        lat: 42.878237,
        lng: -8.550886,
        cD: 1140.875510201174,
        elevation: 244,
    },
    {
        lat: 42.878129,
        lng: -8.551083,
        cD: 1160.9295284111245,
        elevation: 244,
    },
    {
        lat: 42.877544,
        lng: -8.551382,
        cD: 1230.537111898331,
        elevation: 244,
    },
    {
        lat: 42.877425,
        lng: -8.551377,
        cD: 1243.878632077848,
        elevation: 246,
    },
    {
        lat: 42.877177,
        lng: -8.551358,
        cD: 1272.7215925862502,
        elevation: 246,
    },
    {
        lat: 42.876498,
        lng: -8.550762,
        cD: 1362.4940818721643,
        elevation: 252,
    },
    {
        lat: 42.876147,
        lng: -8.550631,
        cD: 1412.274606431978,
        elevation: 252,
    },
    {
        lat: 42.876067,
        lng: -8.550562,
        cD: 1422.7981564149427,
        elevation: 252,
    },
    {
        lat: 42.875656,
        lng: -8.5502,
        cD: 1477.1991854186497,
        elevation: 249,
    },
    {
        lat: 42.875612,
        lng: -8.550158,
        cD: 1483.1706359673783,
        elevation: 249,
    },
    {
        lat: 42.875465,
        lng: -8.55019,
        cD: 1509.0839985511504,
        elevation: 249,
    },
    {
        lat: 42.87541,
        lng: -8.550313,
        cD: 1520.8254554183686,
        elevation: 249,
    },
    {
        lat: 42.875113,
        lng: -8.550031,
        cD: 1561.0585611668578,
        elevation: 249,
    },
    {
        lat: 42.874625,
        lng: -8.550755,
        cD: 1641.2158472475458,
        elevation: 246,
    },
    {
        lat: 42.874465,
        lng: -8.550959,
        cD: 1665.5839141277688,
        elevation: 245,
    },
]

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

function calculateCumulativeDistance() {
    measuredRouteGeometry = routeGeometry.reduce((acc, currentPoint, i) => {
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

    // console.log(measuredRouteGeometry)
}

//Esto nos ayuda a calcular cuantos metros deberíamos dejar entre un punto y otro
function calculateIntervalPoints() {
    let idealInterval = Math.round(measuredRouteGeometry.at(-1).cD / 100)
    let realInterval = Math.max(20, Math.min(50, idealInterval))

    console.log(idealInterval, realInterval)

    return realInterval
}

//Aquí cogemos los puntos directos de la coordenadas con la que trabajamos, es decir si calculamos que para una ruta X, el intervalo ideal son 50m de distancia entre cada punto, nosotros cogeremos los datos de geometría que ya precalculamos anteriormente en calculateCumulativeDistance, y que guardamos en la variable measuredRouteGeometry. Y de esta manera con la siguiente función cogeremos los puntos que vamos a pedir a nuestra API para calcular los desniveles.
function calculateSelectedPoints(n) {
    let data = measuredRouteGeometry.reduce(
        (acc, currentPoint, i) => {
            if (currentPoint.cD >= acc.objetivo) {
                acc.points.push(currentPoint)
                while (acc.objetivo <= currentPoint.cD) {
                    acc.objetivo += n
                }
            }
            return acc
        },
        { points: [], objetivo: 0 },
    )

    let lastPoint = measuredRouteGeometry.at(-1)
    let lastSelectedPoint = data.points.at(-1)

    if (lastPoint.cD - lastSelectedPoint.cD < n / 2) {
        data.points[data.points.length - 1] = lastPoint
    } else {
        data.points.push(lastPoint)
    }

    // console.log(data.points)
    return data.points
}

async function calculateElevation() {
    //No se puede calcular la elevación de algo que no hay dibujado
    if (routeGeometry.length == 0) return

    calculateCumulativeDistance()
    // let interval = calculateIntervalPoints()
    let dataPoints = calculateSelectedPoints(calculateIntervalPoints())

    //Así se preparan los datos para Open-Elevation 🌍
    // let openElevation = { "locations": dataPoints.map((x) => ({ "latitude": x.lat, "longitude": x.lng })) }

    //Asi se preparan los datos para Open-Meteo
    let longitude = dataPoints.map((x) => x.lng).join(',')
    let latitude = dataPoints.map((x) => x.lat).join(',')

    let fetchedElevation = await fetchElevation(longitude, latitude)

    let elevationDict = dataPoints.map((x, index) => {
        return {
            lat: x.lat,
            lng: x.lng,
            cD: x.cD,
            elevation: fetchedElevation[index],
        }
    })

    calculateSlopeHeight(elevationDict)
}

async function fetchElevation(longitude, latitude) {
    if (longitude == '' || latitude == '') return

    const response = await fetch(
        `https://api.open-meteo.com/v1/elevation?latitude=${latitude}&longitude=${longitude}`,
    )

    if (!response.ok) {
        //VER COMO CONTROLARLO MAS ADELANTE ⚠️!!!
        alert('Algo esta fallando en la api')
        return
    }
    const data = await response.json()

    return data.elevation
}

function calculateSlopeHeight(data) {
    let datos = datosSim
    console.log(datos)

    // Suavizado: cada punto pasa a ser el promedio con sus vecinos.
    // Ej: 254, 253, 256, 254 -> los saltos pequeños se diluyen y
    // solo sobreviven las subidas/bajadas sostenidas del terreno.
    let datosSuavizados = datos.map((x, i) => {
        x = x.elevation

        if (i == 0) {
            return (x + datos[i + 1].elevation) / 2
        } else if (i == datos.length - 1) {
            return (x + datos[i - 1].elevation) / 2
        } else {
            return (datos[i - 1].elevation + x + datos[i + 1].elevation) / 3
        }
    })

    // Agrupa el desnivel en "rachas": mientras la diferencia siga el mismo
    // signo, se acumula. Al cambiar de sentido, se cierra la racha y solo
    // cuenta si supera UMBRAL_METROS.
    // Ej: racha de +12m -> se suma a subidaTotal; racha de +3m -> se descarta.
    let calculo = datosSuavizados.reduce(
        (acc, current, i) => {
            if (i == 0) {
                acc.anterior = current
            } else {
                let diferencia = current - acc.anterior

                if (
                    Math.sign(diferencia) === Math.sign(acc.racha) &&
                    diferencia != 0
                ) {
                    // Si la diferencia es distinta de cero y ademas tienen el mismo signo, sumamos a la racha
                    acc.racha += diferencia
                } else if (
                    //Si la diferencia y la racha tienen distinto signo, y la diferencia es distinta de 0 quiere decir que hubo un cambio en la elevación, por tanto se rompe la racha
                    Math.sign(diferencia) !== Math.sign(acc.racha) &&
                    diferencia !== 0
                ) {
                    if (acc.racha > UMBRAL_METROS) {
                        acc.subidaTotal += acc.racha
                    } else if (acc.racha < -UMBRAL_METROS)
                        acc.bajadaTotal += Math.abs(acc.racha)

                    acc.racha = diferencia
                }
            }
            acc.anterior = current
            return acc
        },
        { subidaTotal: 0, bajadaTotal: 0, racha: 0, anterior: 0 },
    )

    if (calculo.racha > UMBRAL_METROS) {
        calculo.subidaTotal += calculo.racha
    } else if (calculo.racha < -UMBRAL_METROS) {
        calculo.bajadaTotal += Math.abs(calculo.racha)
    }

    calculo = {
        subidaTotal: Math.round(calculo.subidaTotal),
        bajadaTotal: Math.round(calculo.bajadaTotal),
    }

    console.log(datosSuavizados)
    console.log(calculo)
}

init()
