// ==================== Menú inferior (móvil): arrastre táctil ====================

import { SHEET_EXPANDED_RATIO, SHEET_BOTTOM_BREATHING_ROOM } from './config.js'

let sidebar = document.getElementById('sidebar')
let sheetHandle = document.getElementById('sheet-handle')

let sheetHeights = { collapsed: 130, expanded: 0 }
let sheetState = 'collapsed'

let sheetDragStartY = 0
let sheetDragStartHeight = 0
let sheetDragMoved = false
let isDraggingSheet = false

export function initSheetEvents() {

    //Tirador inferior en móvil
    sheetHandle.addEventListener('pointerdown', onSheetDragStart)
    sheetHandle.addEventListener('pointermove', onSheetDragMove)
    sheetHandle.addEventListener('pointerup', onSheetDragEnd)
    sheetHandle.addEventListener('pointercancel', onSheetDragEnd)

    sheetHandle.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        e.preventDefault()
        setSheetState(sheetState === 'expanded' ? 'collapsed' : 'expanded')
    })

    window.addEventListener('resize', measureSheetHeights)

    //Alturas iniciales del menú móvil
    measureSheetHeights()
}

function isMobileLayout() {
    return window.matchMedia('(max-width: 768px)').matches
}

function measureSheetHeights() {
    if (!isMobileLayout()) {
        sidebar.style.height = ''
        return
    }

    let sidebarTop = sidebar.getBoundingClientRect().top

    //Solo hasta las tarjetas de Distancia/Desnivel, la de la gráfica va oculta por CSS
    let visibleCards = document.querySelectorAll(
        '.stats-row > .stat-card:not(.elevation-mini-card)',
    )
    let lastVisibleBottom = Math.max(
        ...Array.from(visibleCards, (card) => card.getBoundingClientRect().bottom),
    )

    sheetHeights.collapsed = lastVisibleBottom - sidebarTop + SHEET_BOTTOM_BREATHING_ROOM
    sheetHeights.expanded = window.innerHeight * SHEET_EXPANDED_RATIO

    setSheetState(sheetState, false)
}

function setSheetState(state, animate = true) {
    if (!isMobileLayout()) {
        sidebar.style.height = ''
        return
    }

    sheetState = state
    sidebar.style.transition = animate ? '' : 'none'
    sidebar.style.height = `${sheetHeights[state]}px`
    sidebar.classList.toggle('is-expanded', state === 'expanded')
    sheetHandle.setAttribute('aria-expanded', state === 'expanded')

    if (!animate) {
        sidebar.offsetHeight
        sidebar.style.transition = ''
    }
}

function onSheetDragStart(e) {
    if (!isMobileLayout()) return

    isDraggingSheet = true
    sheetDragMoved = false
    sheetDragStartY = e.clientY
    sheetDragStartHeight = sidebar.getBoundingClientRect().height
    sidebar.style.transition = 'none'
    sheetHandle.setPointerCapture(e.pointerId)
}

function onSheetDragMove(e) {
    if (!isDraggingSheet) return

    let delta = sheetDragStartY - e.clientY
    if (Math.abs(delta) > 4) sheetDragMoved = true

    let newHeight = sheetDragStartHeight + delta
    newHeight = Math.min(
        sheetHeights.expanded,
        Math.max(sheetHeights.collapsed, newHeight),
    )
    sidebar.style.height = `${newHeight}px`
}

function onSheetDragEnd(e) {
    if (!isDraggingSheet) return
    isDraggingSheet = false

    //Sin apenas arrastre: se interpreta como un tap y alterna collapsed/expanded
    if (!sheetDragMoved) {
        setSheetState(sheetState === 'expanded' ? 'collapsed' : 'expanded')
        return
    }

    //Arrastre real: nos quedamos con la parada más cercana a donde se soltó
    let currentHeight = sidebar.getBoundingClientRect().height
    let closest = Object.entries(sheetHeights).reduce((best, [state, h]) =>
        Math.abs(h - currentHeight) < Math.abs(best[1] - currentHeight)
            ? [state, h]
            : best,
    )

    setSheetState(closest[0])
}
