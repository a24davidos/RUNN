let userPosition = null
let map = null

function showPosition(pos) {
    //Guardamos la posición del usuario
    userPosition = pos

    //Inicializamos la posición del mapa
    map = L.map('map').setView(
        [userPosition.coords.latitude, userPosition.coords.longitude],
        13,
    )

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution:
            '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)
}

function showErrorLocation(err) {
    console.log(err)
    // ESTO DEBERIA DE MEJORARLO ⚠️
    if (err.code === 1) {
        console.log('Porfavor activa la geolocalización!')
    } else {
        console.log('No hemos podido encontrar tu localización')
    }
}

//Llamamos a la geolocalización
if (navigator.geolocation) {
    //Si funciona mostramos la posición
    navigator.geolocation.getCurrentPosition(showPosition, showErrorLocation)
}
