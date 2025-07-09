// --- CONFIGURACIÓN ---
const TMDB_API_KEY = 'c12576ed5d6ba4ec1644ced83a60a545';
const FOX_COMPANY_ID = 25;
const STRAPI_API_URL = 'https://gestionweb.frlp.utn.edu.ar/api/g9-peliculas-fox'; // <-- URL PROBABLEMENTE CORRECTA
const STRAPI_API_TOKEN = '099da4cc6cbb36bf7af8de6f1f241f8c81e49fce15709c4cfcae1313090fa2c1ac8703b0179863b4eb2739ea65ae435e90999adb870d49f9f94dcadd88999763119edca01a6b34c25be92a80ed30db1bcacb20df40e4e7f45542bd501f059201ad578c18a11e4f5cd592cb25d6c31a054409caa99f11b6d2391440e9c72611ea';

// --- ELEMENTOS DEL DOM ---
const btnCargar = document.getElementById('btnCargarDatos');
const btnVisualizar = document.getElementById('btnVisualizarDatos');
const feedbackArea = document.getElementById('feedback-area');
const chartCanvas = document.getElementById('moviesChart');

// --- EVENT LISTENERS ---
btnCargar.addEventListener('click', cargarYGuardarPeliculas);
btnVisualizar.addEventListener('click', obtenerYVisualizarPeliculas);

// --- LÓGICA PRINCIPAL ---

// 1. FUNCIÓN PARA CARGAR DATOS DE TMDB Y GUARDARLOS EN STRAPI
async function cargarYGuardarPeliculas() {
    feedbackArea.textContent = "Buscando las 10 películas más populares de 20th Century Fox...";
    try {
        // Obtener las 10 películas más populares
        const discoverUrl = `https://api.themoviedb.org/3/discover/movie?with_companies=${FOX_COMPANY_ID}&sort_by=popularity.desc&api_key=${TMDB_API_KEY}`;
        const discoverResponse = await fetch(discoverUrl);
        const discoverData = await discoverResponse.json();
        const top10Movies = discoverData.results.slice(0, 10);

        feedbackArea.textContent = `Encontradas ${top10Movies.length} películas. Obteniendo detalles y guardando en Strapi...`;

        // Procesar cada película
        for (const movie of top10Movies) {
            // Obtener detalles completos para tener todos los géneros
            const movieDetailsUrl = `https://api.themoviedb.org/3/movie/${movie.id}?api_key=${TMDB_API_KEY}`;
            const detailsResponse = await fetch(movieDetailsUrl);
            const movieDetails = await detailsResponse.json();

            const generos = movieDetails.genres.map(g => g.name).join(', '); // Une los géneros en un string

            // Preparar los datos para Strapi
            const dataParaStrapi = {
                data: {
                    titulo: movieDetails.title,
                    generos: generos,
                    fecha_estreno: movieDetails.release_date,
                    cantidad_votos: movieDetails.vote_count,
                    promedio_votos: movieDetails.vote_average
                }
            };

            // Enviar los datos a Strapi usando POST
            await fetch(STRAPI_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${STRAPI_API_TOKEN}`
                },
                body: JSON.stringify(dataParaStrapi)
            });
        }
        feedbackArea.textContent = "¡Éxito! Las 10 películas fueron guardadas en Strapi.";
    } catch (error) {
        feedbackArea.textContent = `Error: ${error.message}`;
        console.error("Error en cargarYGuardarPeliculas:", error);
    }
}

// 2. FUNCIÓN PARA OBTENER DATOS DE STRAPI Y VISUALIZARLOS
async function obtenerYVisualizarPeliculas() {
    feedbackArea.textContent = "Obteniendo datos desde Strapi para visualizarlos...";
    try {
        // Obtener los datos guardados de Strapi
        const response = await fetch(STRAPI_API_URL, {
            headers: { 'Authorization': `Bearer ${STRAPI_API_TOKEN}` }
        });
        const strapiData = await response.json();
        const peliculas = strapiData.data;

        // Preparar datos para el gráfico
        const labels = peliculas.map(p => p.attributes.titulo);
        const promedios = peliculas.map(p => p.attributes.promedio_votos);

        feedbackArea.textContent = `Datos obtenidos. Mostrando gráfico de promedios de votos.`;
        
        // Renderizar el gráfico con Chart.js
        new Chart(chartCanvas, {
            type: 'bar', // Tipo de gráfico: barras
            data: {
                labels: labels,
                datasets: [{
                    label: 'Promedio de Votos (sobre 10)',
                    data: promedios,
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y', // Hacer el gráfico de barras horizontales para mejor lectura de títulos
                scales: {
                    x: {
                        beginAtZero: true,
                        max: 10 // El eje X (promedio) irá de 0 a 10
                    }
                }
            }
        });

    } catch (error) {
        feedbackArea.textContent = `Error: ${error.message}`;
        console.error("Error en obtenerYVisualizarPeliculas:", error);
    }
}