# GameVault 1.8 — Informe de pruebas y errores corregidos

## Versión 1.8 (20-10-2026)

| Batería | Resultado |
|---|---|
| Pruebas unitarias | ✅ 43/43. Nueva: borrar por partes (solo deseos, solo juegos), plataformas que arrastran sus juegos, vuelta al asistente y conservación de los ajustes |
| Escritorio E2E | ✅ 35/35. Nuevas: el tema cambia desde la barra de título, se recuerda al reabrir y vuelve a oscuro desde el interruptor lateral; borrado con aviso, casillas premarcadas, Juegos fijo con Plataformas, botón desactivado hasta escribir BORRAR, borrado parcial (solo juegos) y total |
| Android E2E | ✅ 16/16. Nuevas: interruptor de tema en *Más*; borrar toda la colección y comprobar que sigue borrada tras recargar |
| iPhone E2E | ✅ 8/8 |
| Repaso visual del tema claro | Bienvenida, asistente, Dashboard, Plataformas, detalle de consola, Juegos, panel de juego, Nuevo juego, Lista de deseos, Estadísticas y ventana de borrado, en escritorio y en móvil |
| Instalador Windows / APK | ✅ Versión 1.8.0 instalada en limpio; APK con firma v2/v3 verificada |

Errores encontrados y corregidos:
1. Móvil: el título «GAMEVAULT» de la pantalla de bienvenida tocaba el borde de la pantalla; ahora se reduce en pantallas estrechas.
2. Ventana de borrado: la palabra «BORRAR» quedaba en una línea aparte del texto «Para confirmar, escribe».
3. «Master System 2» no recibía su imagen por defecto; se añade como nombre alternativo.

---


## Versión 1.7 (19-10-2026)

| Batería | Resultado |
|---|---|
| Pruebas unitarias del núcleo + importador | ✅ 42/42 |
| Escritorio E2E (Electron) | ✅ 33/33. Paso nuevo: las consolas del asistente guardan su imagen por defecto y esta se ve en la app; además se comprueba que la imagen llega al PDF |
| Android E2E | ✅ 14/14 |
| iPhone E2E (web servida con PHP y `proxy.php` real) | ✅ 8/8. Pasos nuevos: la guía «Añadir a pantalla de inicio» aparece en Safari y no vuelve a salir al cerrarla; las consolas guardan su imagen por defecto |
| Asistente con las 53 consolas (escritorio y móvil) | ✅ 53 tarjetas, 53 imágenes cargadas, ninguna rota; filtros SNK, Atari, Ordenadores y Otras comprobados |
| PDF | ✅ Gráficas al final; cabeceras «Consola (n de N)»; 30 páginas, ningún bloque partido ni fuera de página |
| Instalador Windows | ✅ Instalación silenciosa en Windows limpio (Wine): versión 1.7.0, con las 53 imágenes |
| APK | ✅ Firma v2/v3 verificada; incluye las 53 imágenes |

Imágenes de consola: las 53 originales sumaban **unos 310 MB** y ahora ocupan **1,8 MB** en total (entre 15 y 60 KB cada una). Para ello se recorta el borde transparente, se reduce a 480 px como máximo, se aplica cuantización de paleta con pngquant (como TinyPNG), se quitan los metadatos y se recomprime con optipng. A las fotos con fondo blanco se les quitó el fondo, conservando las partes blancas de la propia consola.

Errores encontrados y corregidos:
1. Al buscar la imagen por nombre, «Nintendo 64» y «Commodore 64» se confundían porque, al quitar la marca, ambos quedaban como «64». Ahora la marca no se quita cuando solo queda un número.
2. PC.png traía un cuadriculado «falso» pintado en la propia imagen en lugar de transparencia. Se limpió el fondo exterior; queda un resto bajo el monitor.
3. Neo Geo CD (versión de Wikipedia): quedaba un hueco blanco entre el cable y la consola. Se resolvió con el modo `--huecos` del script y, finalmente, se sustituyó por tu PNG transparente.
4. optipng fallaba con la imagen del Amiga por una tabla de transparencias mal formada; ahora el script usa `-fix`.
5. La guía de instalación en iPhone tapaba el final de la lista de juegos. Queda por debajo de los diálogos y se puede cerrar.

---


## Versión 1.6 (19-10-2026)

| Batería | Resultado |
|---|---|
| Pruebas unitarias del núcleo + importador | ✅ 42/42 |
| Escritorio E2E (Electron) | ✅ 32/32: arranque con catálogo vacío, importación de una colección de ejemplo y exportación del PDF con revisión página a página |
| Android E2E | ✅ 14/14: catálogo vacío e *Importar JSON* desde el móvil |
| iPhone E2E (versión web servida con PHP y `proxy.php` real, Safari iOS 18 emulado) | ✅ 7/7: manifiesto e icono de pantalla de inicio, detección del proxy, asistente, duración y ventas a través del proxy, gráfica táctil, exportar, datos persistentes y sin desbordes horizontales |
| `proxy.php` | ✅ 8/8: ping, GET, POST con token y UTF-8, filtrado de cabeceras, rechazo de dominios no permitidos (403), de http y de métodos no válidos |
| PDF | ✅ 30 páginas HTML = 30 páginas PDF; ningún elemento sobresale de su página; gráficas, índice y bloques de consola nunca partidos |
| Instalador Windows | ✅ Instalación silenciosa en un Windows limpio (Wine): versión 1.6.0, sin colección inicial, sin pedir administrador |
| APK | ✅ zipalign y firma v2/v3 verificados |

Errores encontrados y corregidos en esta versión:
1. **Android/web:** tras *Importar JSON* la app se recargaba antes de que el navegador terminara de guardar la base de datos, y la colección importada se perdía. Ahora espera a que el guardado se complete.
2. **PDF:** las carátulas salían recortadas por arriba; ahora se ajustan desde el borde superior.
3. **PDF:** el contenido se partía entre páginas. Ahora cada página tiene altura fija y los bloques se reparten enteros.
4. **PDF:** el título de la portada, con texto en degradado, se veía como un recuadro en algunos visores. Ahora es de color sólido.
5. **PDF:** las gráficas salían demasiado pequeñas; ahora las barras y los textos se ajustan al ancho de la página.
6. **Icono:** el triángulo de «play» de la propuesta B3 no estaba centrado y se ha retirado, a petición tuya.
7. **iPhone:** en el asistente de bienvenida, el botón «Continuar sin consolas» se salía de la pantalla; en móvil ahora va debajo del título, a todo el ancho.
8. **Compilación:** la versión web no compilaba por un aviso de ESLint (uso de `location` sin `window.`).

---

## Versión 1.5 (18-10-2026, tarde)

| Batería | Resultado |
|---|---|
| Pruebas unitarias del núcleo + importador | ✅ 42/42 (5 nuevas: títulos en castellano vía Wikipedia, campo «Título original», importación masiva que no borra, nº de juegos por plataforma) |
| Escritorio E2E | ✅ 31/31 (8 pasos nuevos: título castellano → inglés, campo título original, vista «Todos» recordada, ciclo completo de orden por duración con comprobación del orden y del resaltado, contador en tarjetas, zoom ampliado, editar desde Estadísticas con actualización en vivo, importar duraciones con aviso/progreso/cancelar/resumen) |
| Android E2E | ✅ 13/13 |
| Validación en vivo | Wikipedia: *Qué preparamos hoy? Cocina conmigo* → *Cooking Guide: Can't Decide What to Eat?*, *Los Simpsons: El videojuego* → *The Simpsons Game*. HLTB: *Personal Trainer: Cooking* 10,5 h (alias *Cooking Guide…*), *The Simpsons Game* 7,7 / 12 / 17,5 h. VGChartz: 3,18 M y 4 M. |

Errores encontrados y corregidos en esta versión:
1. Al ordenar por fecha, las fechas se comparaban solo por el año (se interpretaban como número): ahora se ordenan por fecha completa.
2. Los valores vacíos se colocaban los primeros al ordenar ascendente: ahora siempre van al final.
3. Los juegos con el título en castellano no encontraban duración ni ventas (no se buscaba el título inglés en Wikipedia).
4. Para las ventas no se aprovechaba el nombre que había encontrado HLTB (p. ej. *Personal Trainer: Cooking*, que es como lo lista VGChartz).

---

# Versión 1.4

Fecha: 18-10-2026

## Qué se ha probado

| Batería | Qué cubre | Resultado |
|---|---|---|
| **Pruebas unitarias del núcleo** (`tests/core.test.js`, 27) | Esquema y migración de BD antiguas, CRUD de plataformas/juegos/deseos, filtros, préstamos, importar/exportar JSON, unidades, borrado en cascada, persistencia, HLTB (protocolo nuevo, endpoint renombrado, token caducado, nombres con región/siglas/otro idioma), ventas (VGChartz con HTML real), cola en segundo plano | ✅ 27/27 |
| **Pruebas del importador** (`tests/parser.test.js`, 10) | CSV de *Mi Colección* y genérico, Excel real, Word (lista y tabla), TXT, JSON, agrupación de duplicados, emparejado de plataformas | ✅ 10/10 |
| **Escritorio E2E** (`tests/e2e/electron.e2e.js`, 23 pasos) | La app Electron real compilada en producción, pulsando la interfaz: asistente inicial, dashboard, plataformas, unidades, alta de juegos con HLTB y ventas automáticos, gráfica con ratón, filtros, edición, importación TXT, deseos, estadísticas, exportar JSON y PDF, importar JSON, borrado, reapertura | ✅ 23/23 |
| **Android E2E** (`tests/e2e/android.e2e.js`, 13 pasos) | La misma interfaz en modo Android (pantalla de móvil táctil): BD en el dispositivo, proxy nativo simulado con el mismo protocolo que el APK, gráfica táctil, fotos de galería, importar Excel, exportar a Descargas, persistencia tras reabrir, importar JSON | ✅ 13/13 |
| **Validación en vivo** (navegador real, webs reales) | El código de HLTB y de ventas ejecutado contra howlongtobeat.com y vgchartz.com con 12 y 10 juegos de tu colección | ✅ HLTB 11/12 a la primera; el 12º (*El Rey León*) se corrigió y se verificó con la lista real que devuelve HLTB · Ventas 9/10 (el que falta, *Alex Kidd in Miracle World*, no tiene cifras en VGChartz) |
| **Instalador Windows** | Instalación silenciosa, ficheros, accesos directos, desinstalador, icono y metadatos del `.exe`; arranque de la app empaquetada | ✅ |
| **APK Android** | Firma v2/v3 verificada, zipalign, manifiesto (minSdk 24, targetSdk 34), DEX desensamblado | ✅ (ver limitaciones) |

Resultados en vivo de HLTB (Historia / +Extras / Completista): *Grand Theft Auto: San Andreas* 30,1 / 44,3 / 69,2 h · *GTA San Andreas* (siglas) → mismo juego · *F-Zero X* 4,4 / 8,3 / 14,1 h · *Final Fantasy VII* 36 / 48,5 / 78,6 h · *Call of Duty: Les Chemins de la Victoire* → *Roads to Victory* 4,2 / 5,1 / 7,7 h · *El Rey León* → *Disney's The Lion King*.

Ventas en vivo: *GTA San Andreas* 27,5 M · *Crash Bandicoot N. Sane Trilogy* 20 M · *Super Mario Party Jamboree* 9,96 M (con historial) · *El Rey León* 3,2 M (SNES + Mega Drive) · *Burnout 2* 1,24 M · *F-Zero X* 1,1 M.

## Errores encontrados y corregidos

### Duración (HowLongToBeat)
1. **No encontraba ningún juego.** HLTB cambió su API: ya no es `/api/search/<hash>` sino `/api/search/site` con un token obtenido antes en `/api/search/site/init`. Cada búsqueda fallaba y la app decía "No se encontró el juego". Reescrito con el protocolo actual, comprobado en vivo.
2. **Se rompería en el próximo cambio de HLTB.** Ahora descubre el endpoint leyendo el JavaScript de la web, renueva el token si caduca (403) y prueba los nombres anteriores conocidos.
3. **Cogía siempre el primer resultado.** Ahora puntúa la similitud con el nombre, sus alias y el año, y descarta coincidencias dudosas en lugar de inventar.
4. **Nombres en español u otros idiomas** (*El Rey León*): si no lo encuentra, busca el título inglés en RAWG y reintenta.
5. **"No veo nada en la pestaña Red":** las peticiones salen del proceso principal de Electron. Ahora cada petición aparece en la **Consola** de DevTools (`[GameVault] [red] …`), y F12 abre DevTools también en la versión instalada.
6. **Posible bloqueo anti-bots:** si la petición directa es rechazada, se repite desde una ventana oculta con la web cargada (igual que un navegador).
7. Los juegos antiguos nunca tenían duración: ahora se consulta sola al abrir su detalle por primera vez.
8. La columna "Duración" no se actualizaba al llegar los datos en segundo plano: ahora se refresca sola.
9. Al importar muchos juegos se lanzaban todas las consultas a la vez (riesgo de bloqueo por exceso de peticiones): ahora van en cola, espaciadas.

### Base de datos
10. **Borrar una plataforma dejaba sus juegos huérfanos** (SQLite no tenía activadas las claves foráneas). Corregido, y al abrir se limpian los huérfanos que ya existieran.
11. **"Importar JSON" avisaba de que sobrescribía, pero mezclaba** con lo existente. Ahora sustituye, como indica el aviso. Tampoco se aborta por un juego sin plataforma ni borra juegos en cascada al reimportar una plataforma.
12. La importación JSON ignoraba los campos que no estaban en una lista fija (se perdían duración, ventas…): ahora importa todas las columnas.
13. Guardado de la BD a prueba de cortes (escribe en un temporal y lo renombra).

### Importar colección
14. **Las fechas de Excel se perdían** (llegaban como "5/3/19").
15. Excel dependía de una función de Electron obsoleta (`file.path`): ahora se lee dentro de la app (y funciona en Android).
16. **Word no estaba soportado** aunque lo pediste: ahora acepta `.docx` (lista o tabla).
17. En CSV genérico la columna "Valoración" se tomaba como "Precio" (contiene "valor").
18. Precios con miles ("1.234,00") se leían como 1,234.
19. Comentarios con saltos de línea dentro de comillas partían las filas del CSV.
20. **Los juegos sin plataforma se descartaban en silencio** aunque el aviso decía que se podrían asignar: ahora se elige la plataforma en el paso de revisión.
21. "Nintendo Switch" no se emparejaba con tu "Switch" (ni "PlayStation 2" con "PS2"): se creaban plataformas duplicadas. Ahora usa la tabla de alias de consolas.
22. Filas repetidas → se agrupan como **unidades** del mismo juego.

### Interfaz
23. **El asistente inicial duplicaba consolas** que ya venían en tu colección (Saturn, DreamCast…): ahora salen marcadas como "Ya la tienes".
24. Pulsar un género en el Dashboard no filtraba la lista de juegos.
25. El Dashboard hacía una consulta por cada fila de plataformas (24 consultas): ahora una.
26. Deseos: el botón "Autorrellenar" se quedaba girando si no encontraba el juego; las imágenes locales no se veían.
27. PDF: las imágenes locales con ruta codificada no se cargaban (parámetro equivocado); nombres con "&" o "<" rompían el PDF; si fallaba no avisaba.
28. El panel de detalle en la vista de una consola no se refrescaba tras editar.
29. Tarjeta de plataforma con una etiqueta vacía cuando no tiene tipo.
30. Los selectores de fecha mostraban formato americano (mm/dd/aaaa): ahora español.
31. La clave de RAWG de Ajustes sólo la usaba la interfaz: ahora también la búsqueda de nombres alternativos.
32. Gráfica: el tooltip tapaba la línea y no respondía al dedo (corregido en las pruebas de Android).
33. Móvil: la barra inferior tapaba el final del panel de detalle y los botones de "Juegos" se salían de la pantalla (encontrado en las pruebas de Android).

### Instalador
34. El instalador pedía **permisos de administrador** en cada arranque (`requireAdministrator`): ahora se instala por usuario sin UAC.
35. El paquete incluía dependencias de desarrollo y mapas de código: `app.asar` pasa de 27 MB a 7,7 MB.
36. Se activa ESLint con las reglas de React (no estaba configurado) y se limpian todos los avisos.

## Limitaciones conocidas
- **APK:** se ha compilado, firmado y verificado, y su interfaz se ha probado en un navegador móvil con el mismo proxy, pero aquí no hay emulador Android para arrancar el APK en sí. Si algo falla al abrirlo, dímelo.
- **HLTB/VGChartz desde tu Windows:** el código se ha validado en vivo en un navegador real con datos reales; desde el entorno de pruebas esas webs están bloqueadas, por eso la app de escritorio se probó con respuestas grabadas de esas mismas webs. Si alguna vez falla, la Consola (F12) mostrará el motivo.
- **Ventas:** VGChartz dejó de seguir semana a semana hace años; muchos juegos retro solo tienen una cifra total (sin gráfica), y algunos no tienen ninguna.
- **PDF** solo en escritorio; en Android la app lo indica.
