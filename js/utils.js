// ==================== Utility ====================

export function formatKm(meters) {
    if (meters < 1000) {
        return `${meters} m`
    } else
        return (meters / 1000).toLocaleString('es-ES', {
            style: 'unit',
            unit: 'kilometer',
            maximumFractionDigits: 2,
        })
}

//Distancia real entre dos coordenadas (en metros)
export function haversine(lat1, lng1, lat2, lng2) {
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

//Utilidad para descargar
export function triggerDownload(content, filename, mimeType) {
    let blob = new Blob([content], { type: mimeType })
    let url = URL.createObjectURL(blob)

    let link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()

    URL.revokeObjectURL(url)
}
