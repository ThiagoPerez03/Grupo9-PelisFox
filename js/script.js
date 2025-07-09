// --- CONFIGURACIÓN ---
const TMDB_API_KEY = 'c12576ed5d6ba4ec1644ced83a60a545';
const FOX_COMPANY_ID = 25;
const STRAPI_API_URL = 'https://gestionweb.frlp.utn.edu.ar/api/g9-peliculas-foxes';
const STRAPI_API_TOKEN = '099da4cc6cbb36bf7af8de6f1f241f8c81e49fce15709c4cfcae1313090fa2c1ac8703b0179863b4eb2739ea65ae435e90999adb870d49f9f94dcadd88999763119edca01a6b34c25be92a80ed30db1bcacb20df40e4e7f45542bd501f059201ad578c18a11e4f5cd592cb25d6c31a054409caa99f11b6d2391440e9c72611ea';

// --- ELEMENTOS DEL DOM ---
const btnCargar = document.getElementById('btnCargarDatos');
const btnVisualizar = document.getElementById('btnVisualizarDatos');
const feedbackArea = document.getElementById('feedback-area');
const chartCanvas = document.getElementById('moviesChart');
const listaPeliculasDiv = document.getElementById('lista-peliculas');

let myMoviesChart = null; 

// --- EVENT LISTENERS ---
btnCargar.addEventListener('click', cargarYGuardarPeliculas);
btnVisualizar.addEventListener('click', obtenerYVisualizarPeliculas);

// --- LÓGICA PRINCIPAL ---

// 1. FUNCIÓN PARA CARGAR DATOS (CON LÓGICA "LEER Y COMPARAR")
async function cargarYGuardarPeliculas() {
    feedbackArea.textContent = "Iniciando proceso... Obteniendo películas ya guardadas en Strapi...";
    try {
        // --- PASO 1: OBTENER DATOS EXISTENTES DE STRAPI ---
        const getResponse = await fetch(STRAPI_API_URL, {
            headers: { 'Authorization': `Bearer ${STRAPI_API_TOKEN}` }
        });
        if (!getResponse.ok) throw new Error(`No se pudo obtener la lista de películas existentes (Error ${getResponse.status}).`);
        
        const strapiData = await getResponse.json();
        
        // **CORRECCIÓN 1: Accedemos a strapiData.data para obtener el array,
        // y luego a p.attributes.titulo para obtener el título de cada película.**
        const peliculasExistentes = strapiData.data.map(p => p.titulo); 

        console.log("Películas existentes en Strapi:", peliculasExistentes); 

        feedbackArea.textContent = `Se encontraron ${peliculasExistentes.length} películas en Strapi. Obteniendo datos de TMDB...`;

        // --- PASO 2: OBTENER DATOS NUEVOS DE TMDB ---
        const discoverUrl = `https://api.themoviedb.org/3/discover/movie?with_companies=${FOX_COMPANY_ID}&sort_by=popularity.desc&api_key=${TMDB_API_KEY}`;
        const discoverResponse = await fetch(discoverUrl);
        if (!discoverResponse.ok) throw new Error('No se pudo obtener la lista de películas de TMDB.');
        const discoverData = await discoverResponse.json();
        const top10Movies = discoverData.results.slice(0, 10);

        feedbackArea.textContent = `Comparando y guardando películas nuevas...`;
        
        // --- PASO 3: COMPARAR Y GUARDAR SOLO LAS QUE NO EXISTEN ---
        let peliculasNuevasGuardadas = 0;
        const savePromises = top10Movies.map(async (movie) => {
            if (!peliculasExistentes.includes(movie.title)) {
                // Si la película NO existe, la guardamos
                const movieDetailsUrl = `https://api.themoviedb.org/3/movie/${movie.id}?api_key=${TMDB_API_KEY}`;
                const detailsResponse = await fetch(movieDetailsUrl);
                const movieDetails = await detailsResponse.json();

                const generos = movieDetails.genres.map(g => g.name).join(', ');

                // Al hacer POST a Strapi v4, los datos van dentro de un objeto "data"
                const dataParaStrapi = {
                    data: {
                        titulo: movieDetails.title,
                        genero: generos,
                        fecha_estreno: movieDetails.release_date,
                        cantidad_votos: movieDetails.vote_count,
                        promedio_votos: movieDetails.vote_average
                    }
                };

                const postResponse = await fetch(STRAPI_API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${STRAPI_API_TOKEN}`
                    },
                    body: JSON.stringify(dataParaStrapi)
                });
                
                if (postResponse.ok) {
                    peliculasNuevasGuardadas++;
                } else {
                    const errorBody = await postResponse.text();
                    console.error(`Error al guardar '${movieDetails.title}' en Strapi: ${postResponse.statusText}`, errorBody);
                }
            } else {
                // Si la película YA existe, la omitimos
                console.log(`La película '${movie.title}' ya existe en Strapi. Se omitió.`);
            }
        });

        await Promise.all(savePromises);
        
        if (peliculasNuevasGuardadas > 0) {
            feedbackArea.textContent = `¡Proceso completado! Se guardaron ${peliculasNuevasGuardadas} películas nuevas.`;
        } else {
            feedbackArea.textContent = "Proceso completado. No se encontraron películas nuevas para guardar (probablemente ya existían todas).";
        }
        
    } catch (error) {
        feedbackArea.textContent = `Error en el proceso de carga: ${error.message}`;
        console.error("Error detallado en cargarYGuardarPeliculas:", error);
    }
}

// 2. FUNCIÓN PARA OBTENER DATOS DE STRAPI Y VISUALIZARLOS
async function obtenerYVisualizarPeliculas() {
    feedbackArea.textContent = "Obteniendo datos desde Strapi para visualizarlos...";
    if (listaPeliculasDiv) listaPeliculasDiv.innerHTML = ''; // Limpiar lista anterior

    try {
        const response = await fetch(STRAPI_API_URL, {
            headers: { 'Authorization': `Bearer ${STRAPI_API_TOKEN}` }
        });

        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
        }

        const strapiData = await response.json();

        // Verificación de la estructura de datos
        if (!strapiData || !Array.isArray(strapiData.data)) {
            console.error("Respuesta inesperada de Strapi:", strapiData);
            throw new Error("El formato de los datos recibidos de Strapi no es el esperado.");
        }
        
        // **CORRECCIÓN 2: Accedemos a strapiData.data para obtener el array**
        const peliculas = strapiData.data;

        if (peliculas.length === 0) {
            feedbackArea.textContent = "No hay películas guardadas para visualizar. Carga los datos primero.";
            return;
        }

        feedbackArea.textContent = `Datos obtenidos. Mostrando gráfico y lista de películas.`;
        
        // **CORRECCIÓN 3: Usamos p.attributes.titulo y p.attributes.promedio_votos**
        const labels = peliculas.map(p => p.titulo);
        const promedios = peliculas.map(p => p.promedio_votos);

        if (myMoviesChart) {
            myMoviesChart.destroy();
        }

        myMoviesChart = new Chart(chartCanvas, {
            type: 'bar', 
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
                indexAxis: 'y', 
                scales: { x: { beginAtZero: true, max: 10 } },
                plugins: { legend: { display: true } }
            }
        });

        // **NUEVO: Llenar la lista de películas**
        if (listaPeliculasDiv) {
            listaPeliculasDiv.innerHTML = '';
            
            peliculas.forEach(pelicula => {
                const p = pelicula;
                const movieCard = document.createElement('div');
                movieCard.className = 'movie-card';
                movieCard.innerHTML = `
                    <h3>${p.titulo}</h3>
                    <p><strong>Géneros:</strong> ${p.genero || 'No especificado'}</p>
                    <p><strong>Fecha de Estreno:</strong> ${p.fecha_estreno || 'No especificada'}</p>
                    <p><strong>Votos:</strong> ${p.cantidad_votos !== undefined ? p.cantidad_votos.toLocaleString('es-AR') : 'N/A'}</p>
                    <p><strong>Promedio:</strong> ${p.promedio_votos !== undefined ? p.promedio_votos.toFixed(2) : 'N/A'} / 10</p>
                `;
                listaPeliculasDiv.appendChild(movieCard);
            });
        }

    } catch (error) {
        feedbackArea.textContent = `Error al visualizar: ${error.message}`;
        console.error("Error en obtenerYVisualizarPeliculas:", error);
    }
}