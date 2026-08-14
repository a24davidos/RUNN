// ==================== Elevación ====================

import {
    ELEVATION_DEBOUNCE_MS,
    ELEVATION_RESOLUTIONS,
    ELEVATION_MAX_PIXELS,
    METERS_PER_DEGREE,
    RUN_THRESHOLD,
    MAX_SLOPE,
    SMOOTH_WINDOW,
    CHART_SMOOTH_RADIUS_RATIO,
    CHART_SMOOTH_RADIUS_MIN,
    CHART_SMOOTH_RADIUS_MAX,
    CHART_SMOOTH_PASSES,
} from './config.js'
import { haversine } from './utils.js'
import { state } from './state.js'
import { updateElevationChart, resetChart } from './elevationChart.js'

let spanCounterElevation = document.getElementById('counter-elevation')

//Privado: nadie fuera de este módulo sabe que el debounce existe
let elevationDebounceTimer = null
let elevationRequestId = 0

//Si llega otro cambio de ruta antes de que salte el timer, se cancela y se reinicia la cuenta
export function scheduleElevation() {
    clearTimeout(elevationDebounceTimer)
    elevationDebounceTimer = setTimeout(calculateElevation, ELEVATION_DEBOUNCE_MS)
}

//Cancela el debounce pendiente y fuerza el cálculo ya, devolviendo la promesa para poder esperarla
export function flushElevation() {
    clearTimeout(elevationDebounceTimer)
    return calculateElevation()
}

//Limpia estadística, gráfica y marcador de elevación (ruta vacía o con < 2 puntos)
export function resetElevation() {
    //Invalidamos cualquier petición en curso
    elevationRequestId++

    clearTimeout(elevationDebounceTimer)
    updateSpanElevation(null)
    state.elevationProfile = []
    resetChart()
}

// Calcula el desnivel del inicio al final de la ruta
async function calculateElevation() {

    let requestId = ++elevationRequestId

    //No se puede calcular la elevación de algo que no hay dibujado
    if (state.routeGeometry.length == 0) return

    try {
        let profile = await computeElevationProfile()

        if (requestId === elevationRequestId){
            applyElevationProfile(profile)
        }
    } catch (error) {
        console.error(error)
        // Futura función a implementar que muestre el error al usuario
        //showError("No se pudo calcular la elevación")
    }
}

//Muestrea la ruta, pide la elevación al IGN y devuelve el perfil ya limpio de valores extraños y suavizado.
//Este es el que manda para el cálculo de desnivel y para el hover (lat/lng reales de cada punto).
async function computeElevationProfile() {
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

    return smoothElevations(filterUnrealisticSlopes(elevationDict))
}

//Guarda el perfil calculado y actualiza: contador de desnivel, estado para el hover y gráfica
function applyElevationProfile(profile) {
    //Datos con la subida y bajada total en metros
    let elevationChange = calculateElevationChange(profile)
    updateSpanElevation(elevationChange)

    //Guardamos el perfil completo para poder recuperar lat/lng al pasar el ratón por el chart
    state.elevationProfile = profile

    updateElevationChart(buildChartProfile(profile))
}

function updateSpanElevation(elevationChange) {
    if (!elevationChange) {
        spanCounterElevation.innerText = '—'
        return
    }
    spanCounterElevation.innerText = `+${elevationChange.totalGain}/-${elevationChange.totalLoss} m`
}

//Para el dibujo aplicamos un suavizado extra sobre el perfil ya calculado (solo afecta a la línea del gráfico)
function buildChartProfile(profile) {
    let { smoothWindow, medianWindow } = calculateChartSmoothWindow(profile)

    let chartProfile = medianSmooth(profile, medianWindow)
    for (let i = 0; i < CHART_SMOOTH_PASSES; i++) {
        chartProfile = smoothElevations(chartProfile, smoothWindow)
    }

    return chartProfile
}

function calculateCumulativeDistance() {
    return state.routeGeometry.reduce((acc, currentPoint, i) => {
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

    return data.points
}

// Para el bbox dado, elige la resolución más fina que no supere el MAXSIZE del IGN
function pickElevationResolution(minLat, maxLat, minLng, maxLng) {
    const heightMeters = (maxLat - minLat) * METERS_PER_DEGREE
    const widthMeters = (maxLng - minLng) * METERS_PER_DEGREE * Math.cos((minLat * Math.PI) / 180)

    const fallbackResolution = ELEVATION_RESOLUTIONS[ELEVATION_RESOLUTIONS.length - 1]

    return ELEVATION_RESOLUTIONS.find((res) => {
        const widthPixels = widthMeters / res
        const heightPixels = heightMeters / res
        return widthPixels <= ELEVATION_MAX_PIXELS && heightPixels <= ELEVATION_MAX_PIXELS
    }) ?? fallbackResolution
}

//Rectángulo que engloba todos los puntos, con margen para que ninguno quede justo en el borde
function calculateBoundingBox(points, margin = 0.001) {
    let lats = points.map((p) => p.lat)
    let lngs = points.map((p) => p.lng)

    return {
        minLat: Math.min(...lats) - margin,
        maxLat: Math.max(...lats) + margin,
        minLng: Math.min(...lngs) - margin,
        maxLng: Math.max(...lngs) + margin,
    }
}

// Pide la elevación al WCS del IGN. Hace una sola petición con el bbox que
// engloba toda la ruta, y luego muestrea la celda de cada punto. La resolución
// de la malla se adapta al tamaño de la ruta para no superar el MAXSIZE del IGN.
async function fetchElevation(points) {
    if (points.length == 0) return

    let { minLat, maxLat, minLng, maxLng } = calculateBoundingBox(points)

    let resolution = pickElevationResolution(minLat, maxLat, minLng, maxLng)
    console.log(`Elevación: usando malla de ${resolution}m`)

    const response = await fetch(
        `https://servicios.idee.es/wcs-inspire/mdt?service=WCS&version=2.0.1&request=GetCoverage&coverageId=Elevacion4258_${resolution}&subset=lat(${minLat},${maxLat})&subset=long(${minLng},${maxLng})&format=application/asc`,
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
