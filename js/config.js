// ==================== Configuración ====================

//Latitude y Longitud por defecto (Santiago de Compostela)
export const LATITUDE = 42.88235
export const LONGITUDE = -8.54586
export const ZOOM = 14
export const MAXZOOM = 18
export const ICONSIZE = 25
export const ICONANCHOR = 15
export const COLOR = '#000'
export const WEIGHT = 4

export const SEARCH_DEBOUNCE_MS = 350
export const SEARCH_MIN_CHARS = 3
export const SEARCH_MAX_RESULTS = 4

//Espera a que la ruta deje de cambiar antes de llamar al IGN, así no disparamos una petición por cada punto que muevas
export const ELEVATION_DEBOUNCE_MS = 600

//Resoluciones (en metros) que ofrece el WCS del IGN, de más a menos detalle
export const ELEVATION_RESOLUTIONS = [5, 25, 200, 500, 1000]
//Límite de ancho/alto en píxeles que admite el servicio
export const ELEVATION_MAX_PIXELS = 4096
//Metros por grado de latitud, usado para estimar el tamaño del bbox en píxeles
export const METERS_PER_DEGREE = 111320

export const RUN_THRESHOLD = 8
export const MAX_SLOPE = 35
export const SMOOTH_WINDOW = 1
//Suavizado extra que solo se aplica a la línea del gráfico, no al cálculo de desnivel
export const CHART_SMOOTH_RADIUS_RATIO = 0.04 //% de la distancia total, a cada lado
export const CHART_SMOOTH_RADIUS_MIN = 80 //metros
export const CHART_SMOOTH_RADIUS_MAX = 400 //metros
export const CHART_SMOOTH_PASSES = 3

//Padding vertical del gráfico, para que no exagere visualmente desniveles pequeños
export const CHART_Y_PADDING_RATIO = 0.5
export const CHART_Y_PADDING_MIN = 8

//Panel inferior móvil (sheet)
export const SHEET_EXPANDED_RATIO = 0.82 //% de la altura de la pantalla cuando está expandida
export const SHEET_BOTTOM_BREATHING_ROOM = 12 //px extra bajo las estadísticas en el estado "collapsed"
