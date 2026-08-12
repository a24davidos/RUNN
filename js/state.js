// ==================== Estado compartido ====================

// Solo los campos que un módulo escribe y otro necesita leer.

// Todo lo demás vive como variable privada dentro de su propio módulo.

import { COLOR, WEIGHT } from './config.js'

//Cada campo lo escribe un único módulo; los demás solo leen.

//Object.seal impide crear propiedades nuevas por error (typos), pero permite seguir reasignando los valores existentes.
export const state = Object.seal({
    map: null, // escribe: map.js
    routeGeometry: [], // escribe: route.js
    elevationProfile: [], // escribe: elevation.js
})

//Nunca se reasigna, solo se le llaman métodos (setLatLngs, addTo...) → const, fuera de state
export const routeLine = L.polyline([], { color: COLOR, weight: WEIGHT })
