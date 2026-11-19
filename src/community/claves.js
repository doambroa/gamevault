import { canon } from '../core/text';
import { claveConsola } from '../data/consolas';

/* Claves para reconocer el mismo juego aunque cada uno lo escriba a su manera
 * («Pokemon: Let's Go Pikachu» = «Pokémon: Let's Go, Pikachu!») */
export const claveJuego = n => canon(String(n || '').replace(/\(.*?\)/g, ' ').replace(/[®™]/g, ''))
  .replace(/\b(the|el|la|los|las|definitive edition|deluxe|remastered|edicion|edition)\b/g, ' ').replace(/\s+/g, '');

/** ¿El texto de consola de un deseo (puede venir vacío o abreviado: «N64») encaja con una consola? */
export function mismaConsola(deseo, nombre) {
  if (!deseo || !String(deseo).trim()) return true;
  return claveConsola(deseo) === claveConsola(nombre);
}
export { claveConsola };
