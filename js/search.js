// ==================== Buscador ====================

import { SEARCH_DEBOUNCE_MS, SEARCH_MIN_CHARS, SEARCH_MAX_RESULTS, ZOOM } from './config.js'
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
        let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=${SEARCH_MAX_RESULTS}`
        let response = await fetch(url, { signal: searchAbortController.signal })
        let data = await response.json()

        renderSearchResults(data.features || [])
    } catch (error) {
        //Si el error es por abort, es esperado (petición cancelada por una más reciente)
        if (error.name !== 'AbortError') {
            console.error(error)
        }
    }
}

function renderSearchResults(features) {
    searchResultsList.innerHTML = ''

    if (features.length === 0) {
        searchResultsList.innerHTML = '<li class="search-result-empty">Sin resultados</li>'
        searchResultsList.hidden = false
        return
    }

    features.forEach((feature) => {
        let li = document.createElement('li')
        li.classList.add('search-result-item')
        li.textContent = formatSearchResultLabel(feature)
        li.dataset.lat = feature.geometry.coordinates[1]
        li.dataset.lon = feature.geometry.coordinates[0]
        searchResultsList.appendChild(li)
    })

    searchResultsList.hidden = false
}

function formatSearchResultLabel(feature) {
    let props = feature.properties
    //Photon separa el nombre del resto de la jerarquía (ciudad, estado, país...)
    let parts = [props.name, props.city, props.state, props.country].filter(Boolean)
    //Quitamos duplicados consecutivos (p.ej. cuando name === city)
    return [...new Set(parts)].join(', ')
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
