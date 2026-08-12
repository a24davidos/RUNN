// ==================== Gráfica de elevación ====================

import { CHART_Y_PADDING_RATIO, CHART_Y_PADDING_MIN } from './config.js'
import { state } from './state.js'

let chartCanvas = document.getElementById('graphic')
let popCanvas = chartCanvas.getContext('2d')

//Marcador que se mueve por la ruta al pasar el ratón por la gráfica
let elevationMarker = null

//Fuente de verdad para evitar bugs con el mouseleave del chartJS
let isHoveringChart = false

let elevationChart = new Chart(popCanvas, {
    type: 'line',
    data: {
        datasets: [{
            data: [],
            cubicInterpolationMode: 'monotone',
            pointRadius: 0,
            pointHoverRadius: 4,
            borderColor: 'oklch(0.7 0.19 145)',
            backgroundColor: 'oklch(0.7 0.19 145 / 0.18)',
            borderWidth: 1.6,
            fill: true
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            //No necesitamos el popup nativo de Chart.js, ya tenemos el marcador en el mapa
            tooltip: { enabled: false }
        },
        scales: {
            //Sin ejes ni rejilla, la gráfica es solo la silueta del perfil
            x: { type: 'linear', bounds: 'data', display: false },
            y: { display: false }
        },
        //Pintamos circulos en los puntos de la gráfica al pasar el ratón por encima, y no solo en el punto más cercano
        interaction: {
            mode: 'index',
            intersect: false
        },
        onHover: handleChartHover
    }
})

export function initChartEvents() {
    //El onHover de Chart.js no dispara de forma fiable al salir del canvas (evento 'mouseout'), así que escuchamos 'mouseenter'/'mouseleave' directamente
    chartCanvas.addEventListener('mouseenter', () => {
        isHoveringChart = true
    })
    chartCanvas.addEventListener('mouseleave', () => {
        isHoveringChart = false
        clearElevationMarker()
    })
}

// Al pasar el ratón por la gráfica, movemos un marcador sobre el punto correspondiente de la ruta en el mapa. Se llama en cada evento 'hover' del chart.
function handleChartHover(event, elements) {
    if (!isHoveringChart) return

    if (elements.length == 0) {
        clearElevationMarker()
        return
    }

    let index = elements[0].index
    let point = state.elevationProfile[index]

    if (!elevationMarker) {
        elevationMarker = L.circleMarker([point.lat, point.lng], {
            radius: 8,
            color: '#000',
            weight: 2,
            fillColor: '#fff',
            fillOpacity: 1,
        }).addTo(state.map)
    } else {
        elevationMarker.setLatLng([point.lat, point.lng])
    }
}

function clearElevationMarker() {
    if (elevationMarker) elevationMarker.remove()
    elevationMarker = null
}

//Actualiza los datos y el rango del eje Y del elevationChart
export function updateElevationChart(chartProfile) {
    //Chart.js necesita {x, y} cD está en metros y lo pasamos a km
    elevationChart.data.datasets[0].data = chartProfile.map((point) => {
        return { x: point.cD / 1000, y: point.elevation }
    })

    //Le damos aire al eje Y para que no exagere el desnivel real
    let elevations = chartProfile.map((point) => point.elevation)
    let minElevation = Math.min(...elevations)
    let maxElevation = Math.max(...elevations)
    let elevationRange = maxElevation - minElevation
    let padding = Math.max(elevationRange * CHART_Y_PADDING_RATIO, CHART_Y_PADDING_MIN)

    elevationChart.options.scales.y.min = minElevation - padding
    elevationChart.options.scales.y.max = maxElevation + padding

    elevationChart.update()
}

//Limpia la gráfica y el marcador de elevación (ruta vacía o con < 2 puntos)
export function resetChart() {
    elevationChart.data.datasets[0].data = []
    elevationChart.options.scales.y.min = undefined
    elevationChart.options.scales.y.max = undefined
    elevationChart.update()

    clearElevationMarker()
}
