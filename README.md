# AGUA SEGURA

Aplicación educativa para simular la autonomía de un tanque comunitario y comparar una solución analítica con los métodos numéricos de Heun y Runge–Kutta clásico de cuarto orden (RK4).

## Objetivo

Determinar cuánto tarda un tanque en pasar de un volumen inicial a una reserva mínima, estudiar cómo cambia su volumen con el tiempo y observar cómo afecta el tamaño de paso a las aproximaciones numéricas.

Los valores iniciales (500 L, k = 0.02 √L/min, reserva de 100 L y simulación hasta 1300 min) son hipotéticos y se utilizan con fines académicos.

## Modelo matemático

La descarga se representa mediante la ecuación diferencial ordinaria no lineal de primer orden:

```text
dV/dt = -k√V,    V(0) = V₀
```

Separando variables e integrando se obtiene:

```text
V(t) = (√V₀ - kt/2)²
```

Esta expresión se limita a cero desde el instante de vaciado. El tiempo analítico hasta una reserva R, para 0 ≤ R < V₀, es:

```text
t = 2(√V₀ - √R) / k
```

La aplicación compara la solución exacta con Heun (orden 2) y RK4 clásico (orden 4). Los dos experimentos comparten parámetros y condición inicial, y permiten configurar sus respectivos tamaños de paso. El último paso se acorta si es necesario para llegar al tiempo final. Los tiempos numéricos de cruce de la reserva se estiman mediante interpolación lineal dentro del paso que la cruza.

## Tecnologías

- HTML5
- CSS3
- JavaScript (ES6+)
- Gráfica SVG generada a partir de los cálculos de la aplicación

No se requieren dependencias, cuenta ni servidor de aplicación.

## Ejecución

Abre `index.html` directamente en un navegador moderno. También puedes publicar los archivos del proyecto en un hosting estático.

## Estructura del proyecto

```text
.
├── index.html   # Contenido de la página y secciones educativas
├── styles.css   # Estilos adaptables a escritorio y móvil
├── app.js       # Validación, solución analítica y métodos numéricos
└── README.md    # Descripción e instrucciones
```

## Validaciones

Se requiere volumen inicial y constante positivos; reserva no negativa y menor que el volumen inicial; y tiempo final y pasos positivos. Cada experimento está limitado a 20 000 pasos para evitar bloquear el navegador con entradas excesivamente pequeñas. Los volúmenes se mantienen no negativos y el error relativo se muestra como no definido cuando el valor exacto es cero.
