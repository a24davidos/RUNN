# RUNN

RUNN es una aplicación web para diseñar rutas de running de forma rápida: se dibuja la ruta punto a punto sobre un mapa, se ajusta automáticamente a calles y caminos, y se puede descargar en GPX para llevarla a un GPS o reloj deportivo.

No requiere registro ni cuenta, no guarda datos en ningún servidor y es gratuita.

**Demo:** https://a24davidos.github.io/RUNN/

## Funcionalidades

- Trazado de ruta mediante clics sobre el mapa, con ajuste automático a la red de caminos peatonales.
- Búsqueda de direcciones y lugares para centrar el mapa rápidamente.
- Cálculo de distancia total y perfil de elevación de la ruta en tiempo real.
- Descarga de la ruta en formato GPX, compatible con la mayoría de relojes GPS y apps de running.
- Deshacer el último punto añadido o limpiar la ruta por completo.

## Tecnologías

El proyecto es JavaScript vanilla (ES modules) sin framework ni proceso de build: se sirve tal cual como archivos estáticos.

- **[Leaflet](https://leafletjs.com/)** para el mapa, con capas de OpenStreetMap.
- **[Chart.js](https://www.chartjs.org/)** para el gráfico de perfil de elevación.
- **[Nominatim](https://nominatim.org/)** y **[Photon](https://photon.komoot.io/)** para el buscador de direcciones.
- **OSRM** ([routing.openstreetmap.de](https://routing.openstreetmap.de/)), perfil `foot`, para calcular el trazado sobre calles y senderos reales.
- **[Servicio WCS del IGN/IDEE](https://www.idee.es/)** (Instituto Geográfico Nacional) para los datos de elevación del terreno.

Todas las dependencias externas (Leaflet, Chart.js, fuentes) están vendorizadas en el repositorio, por lo que la app no depende de ningún CDN para funcionar.

## Desarrollo local

No hace falta build ni instalar dependencias: basta con servir la carpeta del proyecto con cualquier servidor estático.

```bash
git clone https://github.com/a24davidos/RUNN.git
cd RUNN
python3 -m http.server 8000
```

Y abrir `http://localhost:8000` en el navegador.

## Próximas mejoras

- Sistema de notificaciones/toast para dar feedback más claro de las acciones.
- Mostrar el nombre de la calle en la lista de puntos en lugar de las coordenadas.
- Historial de deshacer con una pila de hasta 20 acciones (actualmente solo permite deshacer el último punto).
- Rediseño de la interfaz en móvil para mejorar la usabilidad.

## Licencia

MIT © a24davidos
