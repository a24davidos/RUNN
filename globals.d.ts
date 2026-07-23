// Este archivo solo sirve para que el editor conozca el `Chart` global  y ofrezca autocompletado; no se ejecuta ni se incluye en la web.
import { Chart as ChartJS } from 'chart.js'

declare global {
    const Chart: typeof ChartJS
}
