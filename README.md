# 🎮 GameVault 2.1 — Guía de uso

Tu colección de videojuegos y consolas: duración (HowLongToBeat), ventas, estadísticas y catálogo en PDF. Para Windows, Android e iPhone.

## ⬇️ Descargar e instalar (recomendado)

Ve a **[Descargas → última versión](https://github.com/doambroa/gamevault/releases/latest)** y baja el fichero de tu dispositivo. No hace falta nada más.

| Dispositivo | Fichero | Cómo |
|---|---|---|
| **Windows 10 / 11** | `GameVault-Setup-1.9.2.exe` | Doble clic → Siguiente → Instalar. No pide permisos de administrador. Crea acceso directo en el escritorio y en el menú Inicio. Se desinstala desde *Configuración → Aplicaciones*. |
| **Android 7 o superior** (probado para Android 14/15) | `GameVault-1.9.2.apk` | Cópialo al móvil (o descárgalo allí) y ábrelo. Android pedirá permitir *"Instalar aplicaciones desconocidas"* para el navegador o gestor de archivos: acéptalo solo para esta instalación. |
| **iPhone / iPad** | `GameVault-web-1.9.2.zip` | No es un instalador: es la versión web, que se sirve desde tu servidor y se añade a la pantalla de inicio. Ver *«Versión para iPhone»* más abajo. |

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

## Novedades de la 2.4.3

- **Borrar juegos y consolas, a la vista**:
  - La ficha del juego (la que se abre al pulsarlo) tiene «Eliminar» junto a «Editar».
  - En la tabla de Juegos, la columna de editar/borrar queda fija a la derecha (antes estaba al final y había que desplazarse para verla).
  - En pantallas táctiles, los iconos de editar/borrar de las tarjetas de juegos y consolas se ven siempre (antes solo salían al pasar el ratón).
  - El aviso de borrar dice qué juego vas a eliminar.
- **Formato Físico / Digital** en el formulario del juego, a la vista. Antes «Digital» estaba escondido como una opción de «Estado». Los juegos que ya tenías como digitales siguen igual; en digital no se pide estado (nuevo, usado…).
- La casilla «No tiene final» de la ficha queda alineada con el resto.

## Novedades de la 2.4.2

- «Añadir consolas»: las tarjetas ya no se aplastan al pasar el ratón, y la etiqueta «Ya la tienes» se lee bien sobre la foto.

## Novedades de la 2.4.1

- **Nueva plataforma**: abre la misma rejilla de consolas que la bienvenida, con las que ya tienes marcadas como «Ya la tienes». Eliges una o varias y se añaden con su imagen y datos. Si no está, «¿No es ninguna de estas? Añádela a mano» abre el formulario de siempre (que sigue siendo el de editar).
- **Playlist**: el vídeo final va en una tarjeta horizontal más pequeña, centrada en la cabecera; el título y los botones quedan centrados en vertical.

## Novedades de la 2.4

- **Bienvenida para quien ya tiene juegos apuntados**: si alguien tiene juegos en la tabla de préstamos o en Créditos Finales, la bienvenida se lo dice («¡Oye! Ya tienes juegos apuntados, así que esos se te dan de alta solos») y pasa igualmente por elegir sus consolas:
  - Las consolas de la tabla salen ya marcadas (con cuántos juegos trae cada una) y sus juegos se suman al terminar.
  - Los de Créditos Finales salen en un paso aparte para elegir en qué consola tiene cada uno (allí no consta); se propone la consola según dónde salió el juego, y los que no tenga se dejan en «No lo tengo». Los que ya están en la tabla no se repiten.
  - Vale tanto para el aviso «¿Eres …?» como para el enlace de reclamar abierto en un aparato sin colección.
- **Switch 2** en las sugerencias de «Nueva plataforma» (ya estaba en la bienvenida). Switch y Switch 2 son consolas distintas, con su catálogo cada una.
- **Formulario de juego**: si eliges antes la plataforma, la búsqueda en RAWG trae solo juegos de esa consola (si no hay ninguno con ese nombre, enseña los de todas y lo avisa). Los juegos de Switch 2 se buscan en «Nintendo Switch», que es donde los tiene RAWG.
- **Playlist**: el vídeo final sale destacado en la cabecera con su miniatura y su título, y el texto del reto va en su propio apartado.
- Préstamos: un préstamo apuntado hoy ya muestra «fuera desde hoy» aunque sea antes del mediodía.

## Novedades de la 2.3.2

- **Las colecciones nunca se mezclan**: si en un aparato entra otra cuenta (un amigo en tu ordenador o tú en el suyo), se carga la colección de esa cuenta (o vacía) y la anterior no se sube a la nueva. Si la anterior tenía cambios sin subir, se pregunta qué hacer.
- **Enlaces para reclamar perfiles**: dicen claramente para quién son y con qué cuenta has entrado («Sí, soy Andrés Vieira» / «No soy Andrés Vieira: salir»). El administrador no puede aceptar el enlace de otra persona (ni desde la app ni desde el servidor): solo copiarlo para mandárselo.

## Novedades de la 2.3.1

- El tema por defecto ahora es **oscuro** (antes seguía al del sistema). Con «Auto», junto al interruptor de tema, vuelve a seguir al del sistema.
- La primera vez que alguien abre la app le sale un aviso de que puede cambiar a tema claro (en el ordenador, junto al interruptor; en el móvil, sobre «Más»). No tapa nada y deja de salir al pulsar «Entendido», al cambiar el tema o tras tres aperturas.
- En el móvil, el menú «Más» se desplaza si no cabe en la pantalla, y la entrada «Avisos» ya no se sale del menú.

## Novedades de la 2.3 · Retos Switcherino

Apartado nuevo en el menú, **Retos Switcherino**, con dos retos:

- **Playlist de la estación**: cada día una frase y cada uno pone el tema de videojuego que le evoca (enlace de YouTube; el título se coge solo).
  - El día de hoy sale resaltado; al poner tu tema aparece el de mañana sombreado para ir pensándolo (el resto se descubre día a día, salvo que el administrador elija enseñarlas todas).
  - Cada día, a quien no haya puesto su tema le sale un aviso con la frase.
  - «Escuchar todo» crea al momento una lista de YouTube con los temas (de 50 en 50); «Copiar como documento» saca el texto con el formato del Drive.
  - El administrador crea la playlist pegando las frases (una por línea), elige el día de inicio y la arranca cuando quiera. Puede añadir los temas que le pasen por el grupo (también de gente sin cuenta, con su apodo) y unir apodos con cuentas en «Quién es quién».
  - Ya están cargadas «Veranito del amor» y «Otoño marrón» con todos sus temas, y el borrador de «Invierno Festivo Switcherino» con las 22 propuestas.
- **Porra de los Game Awards**: categoría a categoría, con las tarjetas de los nominados y su portada. Al pulsar se guarda y pasa a la siguiente; se puede volver atrás y cambiar hasta el cierre. Al final, un resumen con lo elegido.
  - Lo que vota cada uno no se ve hasta que se cierra la porra.
  - Durante la gala, el administrador marca los ganadores («Marcar ganadores») y la clasificación se calcula sola para todos.
  - La de 2026 viene preparada con las 30 categorías y los 155 nominados (Juego del año vale 3 puntos).

## Novedades de la 2.2.1

- Seleccionar texto arrastrando dentro de una ventana y soltar fuera ya no la cierra.

## Novedades de la 2.2

- **La pila de la vergüenza** (menú «La pila»): los juegos que tienes y aún no te has pasado, cuántas horas suman y cuánto tardarías a 2 h al día. Cada mes propone un **reto** con dos de los más cortos, enseña los más olvidados y los agrupa por duración. Los que no tienen final (Mario Kart, FIFA…) se marcan con «No tiene final» en la ficha del juego y salen de la pila.
- **Avisos** (campana junto a tu cuenta): te piden un juego, te contestan a una petición o te recuerdan una devolución. Si quieres, también como notificación del sistema mientras GameVault está abierto o en segundo plano.
- **Recordatorios de préstamo**: en Préstamos se ve cuánto tiempo lleva fuera cada juego (ámbar al mes, rojo a los 3 meses) y el botón «Recordar» (como mucho uno cada 3 días). Si se lo dejaste a alguien sin cuenta, te prepara un mensaje para enviarle.
- **Historial de préstamos** de cada juego (a quién se lo dejaste y cuánto tiempo).
- **Lista de deseos cruzada**: si alguien de la comunidad tiene un juego de tu lista de deseos, sale en Préstamos y en tu lista, con «Pedir».
- **Juegos en común** en el perfil de cada persona: los que tenéis los dos, los que solo tiene él/ella y los que solo tienes tú.
- **Copia de seguridad semanal**: el servidor guarda cada semana una copia de todas las colecciones en `data/backups` (las 8 últimas; el administrador puede hacer una al momento y descargarla desde Comunidad). La versión de Windows guarda también una copia semanal de tu base de datos en la carpeta `copias` de tus datos.

## Novedades de la 2.1.1

- Línea temporal mucho más ligera y despejada (miniaturas, 3 carátulas por año y «+N» para ver el año entero; los años vacíos se juntan).
- Las carátulas se descargan reducidas en toda la app: va bastante más rápida.
- «Pedir» también a quien aún no tiene cuenta (le llega al unirse).
- **Tamaño del texto** en Ajustes: Automático (más grande en pantallas 2K/4K), 90 %, 100 %, 110 %, 125 % o 140 %.

## Novedades de la 2.1

- **Estadísticas**: vuelven las burbujas por consola (su tamaño depende de los juegos; el aro verde es la parte terminada) con el selector Burbujas / Barras / Tarjetas. Al pulsar una consola se abre su **línea temporal**: carátulas sobre sus años (con los años vacíos), se desliza con el dedo o la rueda, al pasar por encima se ve título y fecha y al pulsar se abre la ficha (editable). Los juegos sin fecha salen al final. Debajo siguen «Año a año», duración y géneros.
- **Listados plegables**: en Juegos, Préstamos y la colección de otra persona cada consola se pliega con un clic (o «Plegar todo / Desplegar todo») y queda solo su línea. Vale igual para carátulas y tabla, y se recuerda.
- **Pedir un juego**: en la Zona de préstamos, junto a cada persona que tiene el juego en casa, botón **Pedir** (con un mensaje opcional); también en la ficha de un juego ajeno. Al dueño le sale «Te piden» arriba y un aviso en el menú; con «Prestárselo» queda apuntado en su colección. Quien lo pidió ve si se lo dejan.
- **Préstamos en tabla**: además de las fichas.
- **Créditos Finales** en el menú (abre la web).
- **PDF en la web, iPhone y Android**: «Exportar PDF» abre el catálogo y el cuadro de imprimir, donde se elige «Guardar como PDF».
- Icono «Vitrina» con la cruceta del mando en su sitio, y propuestas nuevas mitad cartucho de 64, mitad disco en `buildres/propuestas-2/`.

## Novedades de la 2.0

- **Cuentas de usuario** (las mismas que Créditos Finales si está instalada al lado en el servidor). Con cuenta, la colección se guarda en el servidor y es la misma en Windows, Android, iPhone y la web: cada cambio se sube solo a los pocos segundos. Si dos aparatos cambian a la vez, la app pregunta cuál conservar (nunca pisa nada sin avisar). Sin conexión se sigue usando y sube los cambios al volver.
- **Comunidad**: lista de gente con foto y nombre; pulsando en alguien ves su colección (solo lectura) con buscador, sus consolas, su lista de deseos y lo que se ha pasado. En «Mi cuenta» cada uno elige si enseña precios, comentarios y deseos (por defecto, todo visible).
- **Zona de préstamos**: los juegos de todos agrupados por consola y juego, con la ficha de cada persona que lo tiene, si está en casa o quién lo tiene. Pestaña «Préstamos en curso» con la tabla de quién tiene el juego de quién. Puedes prestar tus juegos a alguien de la comunidad o a cualquier otra persona y marcar las devoluciones.
- **Perfiles por reclamar**: colecciones cargadas antes de que su dueño tenga cuenta (p. ej. de una tabla compartida). El administrador (en `config.php`) ve en Comunidad un enlace para cada uno; al abrirlo y entrar, los juegos pasan a su colección con los préstamos que tuvieran.
- **Créditos Finales integrado**: cada juego sabe si te lo has pasado (etiqueta «Terminado», nota, horas, comentario y canción en la ficha), filtro «Terminados / Sin terminar», «Tu año en Créditos Finales» y «¿Y si te pasas este?» en el Inicio, y «Cuándo me los pasé» en Estadísticas.
- **Carátulas grandes**: Juegos se ve por defecto como cuadrícula de carátulas (la tabla sigue a un clic), la ficha muestra la imagen entera y se puede ver a pantalla completa.
- **Estadísticas nuevas**: cifras de cabecera, juegos por consola (con la parte terminada en verde), «Año a año» con escala de tiempo real, duración por tramos y géneros. Todo se pulsa y lo pulsado se abre debajo con sus carátulas.
- **Tema según el sistema** por defecto; el interruptor sigue ahí y «Auto» vuelve al del sistema.
- **Icono nuevo** («Vitrina»). Las otras propuestas están en `buildres/propuestas-2/`; para cambiarlo: `sh scripts/aplicar-icono.sh buildres/propuestas-2/C2-intercambio.svg`.

### Servidor de cuentas (XAMPP)

Copia `dist/web` a `htdocs/gamevault` (la versión web incluye `api.php`). Los datos se guardan en `htdocs/gamevault/data` (se crea sola y está bloqueada desde el navegador) y las fotos subidas en `uploads/`. Si existe `htdocs/creditos`, las cuentas son las de Créditos Finales. Opcional, `htdocs/gamevault/config.php`:

```php
<?php return [
  'admins' => ['soiber'],        // quién ve los enlaces de «perfiles por reclamar»
  'invite_code' => '',           // si lo rellenas, hace falta para registrarse
];
```

Las apps de Windows y Android usan el servidor puesto en `.env.local` al compilar (`GV_SERVER=https://midominio.es/gamevault/`); en la pantalla de entrar se puede cambiar.

## Novedades de la 1.9.2

- **Desinstalar con asistente.** El menú Inicio tiene una carpeta *GameVault* con el acceso **«Desinstalar GameVault»**, y *Ajustes* tiene el botón **«Desinstalar…»**. Los dos abren directamente el asistente de desinstalación (en español y con la imagen de GameVault), no la configuración de Windows. Desinstalar no borra tu colección.
- El desinstalador borra también la copia de 80 MB del instalador que se quedaba en `AppData\Local\gamevault-updater`.
- Se quita del Dashboard la tarjeta «Nota media».

> El «Desinstalar» del botón derecho sobre GameVault en el menú Inicio lo controla Windows, que siempre abre *Configuración → Aplicaciones*. Desde ahí, al pulsar *Desinstalar* también se abre este asistente.

## Novedades de la 1.9.1

- Las tarjetas de *Plataformas* muestran la foto de cada consola en grande, no como un icono pequeño.
- Las consolas sin imagen reciben sola su imagen por defecto, y se completan su marca y su tipo si estaban vacíos. Esto pasa al abrir la app y después de cada *Importar JSON*. Si quitas una imagen a propósito, no vuelve a aparecer en cada arranque.

## Novedades de la 1.9

- **Accesorios de cada consola.** En el detalle de cada consola hay una sección *Accesorios* para mandos, memorias, periféricos, cables o discos de limpieza. Cada uno puede llevar tipo, unidades, estado, precio, fecha y comentarios. Las tarjetas de *Plataformas* muestran cuántos accesorios tiene cada consola.
- Los accesorios se exportan e importan junto con el resto de la colección. Si eliminas una consola, también se eliminan sus accesorios.

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

1. Descomprime `GameVault-web-1.9.2.zip` de forma que `index.html` quede **directamente** en `C:\xampp\htdocs\gamevault\`, no dentro de otra subcarpeta.
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
