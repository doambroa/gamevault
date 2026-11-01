# 🎮 GameVault 1.8 — Guía de uso

Tu colección de videojuegos y consolas: duración (HowLongToBeat), ventas, estadísticas y catálogo en PDF. Para Windows, Android e iPhone.

## ⬇️ Descargar e instalar (recomendado)

Ve a **[Descargas → última versión](https://github.com/doambroa/gamevault/releases/latest)** y baja el fichero de tu dispositivo. No hace falta nada más.

| Dispositivo | Fichero | Cómo |
|---|---|---|
| **Windows 10 / 11** | `GameVault-Setup-1.8.0.exe` | Doble clic → Siguiente → Instalar. No pide permisos de administrador. Crea acceso directo en el escritorio y en el menú Inicio. Se desinstala desde *Configuración → Aplicaciones*. |
| **Android 7 o superior** (probado para Android 14/15) | `GameVault-1.8.0.apk` | Cópialo al móvil (o descárgalo allí) y ábrelo. Android pedirá permitir *"Instalar aplicaciones desconocidas"* para el navegador o gestor de archivos: acéptalo solo para esta instalación. |
| **iPhone / iPad** | `GameVault-web-1.8.0.zip` | No es un instalador: es la versión web, que se sirve desde tu servidor y se añade a la pantalla de inicio. Ver *«Versión para iPhone»* más abajo. |

> Windows SmartScreen puede avisar de "editor desconocido" porque el instalador no está firmado con un certificado comercial: *Más información → Ejecutar de todas formas*.

### ¿Has descargado el código? Doble clic en `GameVault.bat`

Si bajas el proyecto con *Code → Download ZIP* (o `git clone`), descomprímelo y haz **doble clic en `GameVault.bat`**. No hay nada más que lanzar:

- **La primera vez** instala lo que falta: Node.js, si no lo tienes (Windows puede pedir permiso una vez), y las dependencias. Después prepara la app. Tarda unos minutos.
- **Las siguientes veces** abre GameVault en unos segundos. Si has actualizado el código, se prepara de nuevo él solo.
- La colección se guarda en la carpeta `db\` del proyecto.

### ¿Dónde están mis datos?
- **Windows instalado:** `%APPDATA%\gamevault\gamevault.db` (la barra de título muestra la ruta; clic para abrir la carpeta).
- **Desde el código (`GameVault.bat`):** `db\gamevault.db` dentro de la carpeta del proyecto.
- **Android:** dentro de la propia app. *Más → Exportar JSON* guarda una copia en `Descargas/GameVault/`.

**Pasar la colección de un sitio a otro** (del modo desarrollo a la versión instalada, o del PC al móvil):
*Exportar JSON* en el origen → *Importar JSON* en el destino (sustituye la colección del destino).

Las bases de datos de versiones anteriores se actualizan solas al abrir la 1.8 (se añaden los campos nuevos sin perder nada).

---

## Novedades de la 1.8

- **Tema claro.** Se cambia con el icono de sol/luna de la barra de título (Windows) o con el interruptor «Tema oscuro / Tema claro» al pie de la barra lateral (en Android e iPhone, dentro de *Más*). El oscuro sigue siendo el tema por defecto y cada dispositivo recuerda su elección.
- **Borrar toda mi colección** (*Ajustes → Zona peligrosa*):
  - Muestra un aviso rojo muy visible y tres casillas premarcadas, con el número de elementos de cada una: *Borrar Plataformas*, *Borrar Juegos* y *Borrar lista de deseos*.
  - Si borras las plataformas, también se borran sus juegos.
  - Para confirmar hay que escribir **BORRAR**. Tiene un botón para *Exportar JSON* antes.
  - Si borras las plataformas, la app vuelve al asistente de bienvenida.
  - La clave de RAWG y el tema elegido se conservan.

## Novedades de la 1.7

- **53 consolas en el asistente de bienvenida, cada una con su foto:** se han añadido Amiga, Amiga CD32, Commodore 64, Amstrad CPC, ZX Spectrum, MSX, Mega-CD, 32X, Neo Geo AES, Neo Geo CD, Neo Geo Pocket Color, Atari 2600, Lynx, Jaguar, PC Engine, Virtual Boy, 3DO, CD-i, WonderSwan, WonderSwan Color, Color TV-Game y Arcade. Hay filtros nuevos: SNK, Atari, Ordenadores y Otras.
- **Imágenes por defecto incluidas en la app**, optimizadas (sin metadatos, paleta reducida y 480 px de lado como máximo; unos 30 KB cada una). Al crear una consola desde el asistente, o eligiéndola en las sugerencias de *Nueva plataforma*, se le pone su imagen. La imagen no ocupa sitio en la base de datos y se sigue viendo al pasar la colección a otro dispositivo. Siempre se puede cambiar por otra.
- **PDF:** las gráficas pasan al final y cada página indica qué parte es de cada consola, por ejemplo «Nintendo 64 (2 de 5)». Lo mismo en el Índice y en Estadísticas cuando ocupan varias páginas.
- **iPhone:** al abrirla en Safari aparece una guía para *Añadir a pantalla de inicio*, porque iOS no tiene un aviso automático de instalación.

### Dónde se guardan las imágenes
- Las que eliges de tu disco se **copian** a `%APPDATA%\gamevault\images\`, o a `db\images\` en modo desarrollo.
- Las fotos de consola de Wikipedia se guardan **dentro** de `gamevault.db`.
- Las carátulas de RAWG solo guardan su dirección web.
- Las imágenes por defecto están en `public/consolas/` del código. Para añadir o cambiar una: `sh scripts/optimizar-consolas.sh imagen.png nombre-consola`; si tiene fondo blanco, antes `python3 scripts/quitar-fondo-blanco.py foto.jpg imagen.png`.

## Novedades de la 1.6

- **Colección inicial vacía:** la app arranca sin consolas ni juegos, lista para repartirla a otras personas. El asistente de bienvenida propone las consolas; también puedes *Importar JSON* para cargar una colección existente.
- **Icono nuevo («Estantería»)**, el mismo en Windows, Android e iPhone.
- **PDF con gráficas:** portada con resumen, géneros más jugados, unidades por plataforma, juegos más caros, inversión por plataforma, juegos por década y juegos más largos o más vendidos. **Cada página es una unidad completa:** ninguna gráfica, tabla ni bloque de consola queda partido entre dos páginas (si una consola no cabe, sigue en la página siguiente con el rótulo «continuación»). Las carátulas ya no salen recortadas por arriba.
- **Versión para iPhone** (ver abajo).
- Corregido: en Android, al *Importar JSON* la colección podía perderse porque la app se recargaba antes de terminar de guardar.

### Versión para iPhone (con tu servidor XAMPP)

Apple no permite instalar apps fuera de la App Store sin un Mac, Xcode y una cuenta de desarrollador (99 €/año). La alternativa es una **app web instalable**: se ve a pantalla completa, con icono propio, y los datos se quedan en el iPhone.

1. Descomprime `GameVault-web-1.8.0.zip` de forma que `index.html` quede **directamente** en `C:\xampp\htdocs\gamevault\`, no dentro de otra subcarpeta.
2. Revisa XAMPP (viene así de serie): en `php.ini`, `extension=curl` sin `;` delante; en `httpd.conf`, `AllowOverride All` para htdocs, para que funcione el `.htaccess`. Reinicia Apache si cambias algo.
3. **HTTPS con certificado válido** (imprescindible). El certificado autofirmado que trae XAMPP no sirve: Safari no la instalará como app ni guardará los datos. Opciones con tu dominio:
   - **win-acme** (Let's Encrypt para Windows): genera el certificado para Apache y lo renueva solo. Hay que abrir en el router los puertos 80 y 443 hacia tu PC.
   - **Cloudflare Tunnel**: no hace falta abrir puertos y el certificado lo pone Cloudflare.
4. Desde un móvil **con datos** (sin tu wifi) comprueba que `https://tu-dominio/gamevault/` abre la app y que `https://tu-dominio/gamevault/proxy.php?ping=1` responde `{"gamevault":true,…}`.
5. En el iPhone: abrir esa dirección en **Safari** → **Compartir** → **Añadir a pantalla de inicio**. iOS no muestra ningún aviso automático de instalación; por eso la app muestra una guía la primera vez que se abre en Safari.

Notas:
- `proxy.php` permite a la app consultar HowLongToBeat, VGChartz, Wikipedia y RAWG desde el iPhone. Solo acepta esas cuatro webs y solo por HTTPS, así que no sirve como proxy abierto.
- Cada iPhone guarda **su propia colección**: el servidor solo entrega la app y no almacena datos.
- *Exportar JSON* abre la hoja de compartir (Guardar en Archivos, AirDrop, Mail…). *Importar JSON* acepta un fichero de Archivos.
- La exportación a PDF solo está en la versión de Windows.
- Si se usa en Safari **sin instalar**, iOS puede borrar los datos tras 7 días sin abrirla. Instalada no ocurre, pero conviene hacer *Exportar JSON* de vez en cuando.
- La app abre aunque tu PC esté apagado. Tu servidor solo hace falta para buscar duraciones, ventas y títulos.
- **Actualizar:** sustituye los ficheros de la carpeta. La nueva versión llega la próxima vez que abran la app; a veces hace falta abrirla dos veces.

### Claves de servicios externos
- **HowLongToBeat** no usa clave ni tiene un límite diario publicado. Si se hacen demasiadas búsquedas seguidas responde «demasiadas peticiones» durante un rato, así que no hay nada que configurar. *Importar duraciones* ya va espaciando las búsquedas.
- **RAWG** (carátulas y datos): la clave **no está en el código**. Crea `.env.local` (copia de `.env.example`) con `RAWG_KEY=tu_clave` y se mete en la app al compilar (`scripts/gen-keys.js`). Sin ella, cada persona pone la suya en *Ajustes* (gratis en rawg.io/apikey).

## Novedades de la 1.5

- **Títulos en castellano:** si un juego no aparece con su nombre, la app busca su título en inglés en la Wikipedia en español (p. ej. *Los Simpsons: El videojuego* → *The Simpsons Game*, *¿Qué preparamos hoy? Cocina conmigo* → *Cooking Guide / Personal Trainer: Cooking*). Para casos raros hay un campo nuevo **«Título original o en inglés»** en el formulario del juego.
- **Estadísticas:** el zoom de cada juego en la línea temporal muestra duración (Historia / +Extras / 100%), ventas, valoración y unidades. **Clic** en un juego → se abre su detalle a la derecha para verlo o editarlo, y la línea temporal se actualiza al momento.
- **Juegos:** selector **Por plataforma | Todos** (todos en una sola tabla con columna Plataforma; se recuerda la elección).
- **Ordenar por Duración:** cada clic en la cabecera avanza Historia ↑ → Historia ↓ → +Extras ↑ → +Extras ↓ → 100% ↑ → 100% ↓. La cabecera indica el criterio y en cada fila solo la cifra de esa métrica va en azul (las otras en gris). Los juegos sin dato van siempre al final. También en el detalle de cada consola.
- **Importar duraciones:** botón junto a «Importar carátulas»; avisa antes de empezar, muestra progreso, se puede cancelar y al final resume cuántos cambiaron. Si un juego no se encuentra, conserva los tiempos que tuviera.
- **Plataformas:** cada tarjeta muestra el número de juegos (y las unidades si hay duplicados).

## Novedades de la 1.4

- **Duración (HowLongToBeat) arreglada.** HLTB cambió su API (ahora `/api/search/site` con un token previo). La app lo detecta sola aunque lo vuelvan a cambiar, entiende nombres con región/paréntesis, siglas ("GTA") y, si el juego está en otro idioma, prueba con su título inglés de RAWG (p. ej. *El Rey León* → *The Lion King*). Se rellena sola al crear un juego y al abrir uno que nunca se había consultado.
- **Unidades:** nuevo campo en juegos y plataformas (por defecto 1) para los duplicados. Visible en el detalle y editable en el formulario. Al importar listas, las filas repetidas se agrupan como unidades.
- **Ventas totales** en el detalle de cada juego (fuente: VGChartz, porque RAWG no publica ventas): cifra mundial, desglose por consola y, cuando hay varias cifras a lo largo del tiempo, una **gráfica interactiva** (pasa el ratón o el dedo). Los juegos retro con un único dato no muestran gráfica.
- **Importar colección** también desde **Word (.docx)** — lista o tabla —, Excel leído directamente, y elección de plataforma para los juegos que vienen sin ella.
- **Versión Android** con la misma app, base de datos en el móvil y diseño adaptado (barra inferior, formularios a pantalla completa).
- Muchas correcciones: ver `INFORME-PRUEBAS.md`.

> ¿Por qué no veías nada en la pestaña *Red* de DevTools? Las consultas a HLTB/VGChartz las hace el proceso principal de Electron, no la página. Ahora se muestran como mensajes `[GameVault] [red] …` en la pestaña **Consola** (F12 o Ctrl+Shift+I abre DevTools también en la versión instalada).

---

## Trabajar con el código (opcional)

| Fichero | Para qué |
|---|---|
| `GameVault.bat` | Abre la app (instala lo necesario la primera vez) |
| `herramientas\Modo desarrollo.bat` | Abre la app con recarga automática al guardar cambios en el código |
| `herramientas\Crear instalador.bat` | Genera `dist\GameVault-Setup-x.y.z.exe` |
| `npm test` | Pruebas automáticas del núcleo y del importador |
| `npm run pack-android` | Genera el APK (Linux/macOS/WSL con Java 17+; descarga sus herramientas de GitHub). La clave de firma es `android/gamevault-release.jks` (contraseña `gamevault`): **guárdala**, las actualizaciones del APK deben firmarse con la misma. |

Estructura:
- `src/core/` — núcleo compartido Windows/Android: base de datos, HLTB, ventas.
- `src/platform/webApi.js` — la API de datos cuando no hay Electron (Android).
- `electron/` — proceso principal de escritorio.
- `android/` — envoltorio nativo del APK (WebView + proxy HTTP).
- `tests/` — pruebas automáticas.

## Licencia

Dominio público ([The Unlicense](LICENSE)): haz lo que quieras con este código, sin pedir permiso ni citar a nadie.

Las imágenes de consolas de `public/consolas/` proceden de Wikimedia Commons y conservan cada una su propia licencia (consulta la ficha de cada archivo en commons.wikimedia.org); no están cubiertas por esta dedicación. Las dependencias de npm tienen también sus propias licencias.

Los datos e imágenes que la app obtiene de servicios externos (RAWG, HowLongToBeat, VGChartz y Wikipedia) siguen sujetos a las condiciones de cada servicio.
