// ==================== Buscador ====================

import {
    SEARCH_DEBOUNCE_MS,
    SEARCH_MIN_CHARS,
    SEARCH_MAX_RESULTS,
    SEARCH_PROVIDER,
    ZOOM,
} from './config.js'
import { state } from './state.js'

let searchInput = document.getElementById('search-place')
let searchClearBtn = document.getElementById('search-clear')
let searchResultsList = document.getElementById('search-results')

let searchDebounceTimer = null
let searchAbortController = null

export function initSearchEvents() {
    //Botón para borrar el texto del buscador
    searchClearBtn.addEventListener('click', () => {
        searchInput.value = ''
        searchInput.focus()
        hideSearchResults()
    })

    searchInput.addEventListener('input', handleSearchInput)
    searchInput.addEventListener('keydown', handleSearchKeydown)
    searchResultsList.addEventListener('click', handleSearchResultClick)

    //Cerramos el dropdown si se hace click fuera del buscador
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-box')) {
            hideSearchResults()
        }
    })
}

function handleSearchInput() {
    let query = searchInput.value.trim()

    clearTimeout(searchDebounceTimer)

    if (query.length < SEARCH_MIN_CHARS) {
        hideSearchResults()
        return
    }

    searchDebounceTimer = setTimeout(() => {
        fetchSearchResults(query)
    }, SEARCH_DEBOUNCE_MS)
}

async function fetchSearchResults(query) {
    //Si había una petición anterior en vuelo, la cancelamos: solo nos interesa la última
    if (searchAbortController) {
        searchAbortController.abort()
    }
    searchAbortController = new AbortController()

    try {
        let results =
            SEARCH_PROVIDER === 'nominatim'
                ? await fetchNominatim(query, searchAbortController.signal)
                : await fetchPhoton(query, searchAbortController.signal)

        renderSearchResults(results)
    } catch (error) {
        //Si el error es por abort, es esperado (petición cancelada por una más reciente)
        if (error.name !== 'AbortError') {
            console.error(error)
        }
    }
}

//Photon (komoot): a veces muy lento o caído, se deja como alternativa vía SEARCH_PROVIDER
async function fetchPhoton(query, signal) {
    let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=${SEARCH_MAX_RESULTS}`
    let response = await fetch(url, { signal })
    let data = await response.json()

    return (data.features || []).map((feature) => ({
        lat: feature.geometry.coordinates[1],
        lon: feature.geometry.coordinates[0],
        label: formatPhotonLabel(feature.properties),
    }))
}

function formatPhotonLabel(props) {
    //Photon separa el nombre del resto de la jerarquía (ciudad, estado, país...)
    let parts = [props.name, props.city, props.state, props.country].filter(Boolean)
    //Quitamos duplicados consecutivos (p.ej. cuando name === city)
    return [...new Set(parts)].join(', ')
}

//Nominatim (OSM): misma fuente que los tiles del mapa, mucho más rápido en pruebas
async function fetchNominatim(query, signal) {
    let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=${SEARCH_MAX_RESULTS}`
    let response = await fetch(url, { signal })
    let data = await response.json()

    return data.map((item) => ({
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        label: formatNominatimLabel(item),
    }))
}

function formatNominatimLabel(item) {
    let address = item.address || {}
    //Nominatim no separa "nombre" del resto, así que usamos el primer trozo del display_name
    let name = item.display_name.split(',')[0].trim()
    let city = address.city || address.town || address.village
    let parts = [name, city, address.state, address.country].filter(Boolean)
    //Quitamos duplicados consecutivos (p.ej. cuando name === city)
    return [...new Set(parts)].join(', ')
}

function renderSearchResults(results) {
    searchResultsList.innerHTML = ''

    if (results.length === 0) {
        searchResultsList.innerHTML = '<li class="search-result-empty">Sin resultados</li>'
        searchResultsList.hidden = false
        return
    }

    results.forEach((result) => {
        let li = document.createElement('li')
        li.classList.add('search-result-item')
        li.textContent = result.label
        li.dataset.lat = result.lat
        li.dataset.lon = result.lon
        searchResultsList.appendChild(li)
    })

    searchResultsList.hidden = false
}

function handleSearchResultClick(e) {
    let item = e.target.closest('.search-result-item')
    if (!item || !item.dataset.lat) return

    let lat = parseFloat(item.dataset.lat)
    let lon = parseFloat(item.dataset.lon)

    state.map.setView([lat, lon], ZOOM)

    searchInput.value = item.textContent
    hideSearchResults()
}

function handleSearchKeydown(e) {
    if (e.key === 'Escape') {
        hideSearchResults()
    }
}

function hideSearchResults() {
    searchResultsList.hidden = true
    searchResultsList.innerHTML = ''
}
