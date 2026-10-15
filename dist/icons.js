// Lucide: crosshair, chevrons-right, shield, magnet, construction. See assets/lucide-LICENSE.txt.
// https://github.com/lucide-icons/lucide/tree/main/icons
const shapes = {
  A: '<circle cx="12" cy="12" r="10"/><line x1="22" x2="18" y1="12" y2="12"/><line x1="6" x2="2" y1="12" y2="12"/><line x1="12" x2="12" y1="6" y2="2"/><line x1="12" x2="12" y1="22" y2="18"/>',
  K: '<path d="m6 17 5-5-5-5"/><path d="m13 17 5-5-5-5"/>',
  Q: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  J: '<path d="m12 15 4 4"/><path d="M2.352 10.648a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l6.029-6.029a1 1 0 1 1 3 3l-6.029 6.029a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l6.365-6.367A1 1 0 0 0 8.716 4.282z"/><path d="m5 8 4 4"/>'
};
export function cardIcon(type) {
  return `<svg class="equipment-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[type]??''}</svg>`;
}

export function chargeIcon() {
  return '<svg class="charge-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M14 2 4 14h7l-1 8 10-12h-7z"/></svg>';
}

export function fullHpIcon() {
  return '<svg class="full-hp-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>';
}

// Pictogrammers screw-flat-top, Apache-2.0. Rotated for the game's currency mark.
// https://github.com/Templarian/MaterialDesign/blob/master/svg/screw-flat-top.svg
// See assets/pictogrammers-LICENSE.txt and assets/Apache-2.0.txt.
export function scrapIcon() {
  return '<svg class="scrap-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path transform="rotate(35 12 12)" d="M13.5,17V19L12,22L10.5,19L13.5,17M14.5,6.3L13.5,7V6H10.5V9L9.5,9.7V10.7L14.5,7.4V6.3M14.5,10.3L13.5,11V9L10.5,11V13L9.5,13.7V14.7L14.5,11.4V10.3M14.5,14.3L13.5,15V13L10.5,15V17L9.5,17.7V18.7L14.5,15.4V14.3M8,2C8,2 7,2 7,3L10,5H14L17,3C17,3 17,2 16,2C15,2 8,2 8,2Z"/></svg>';
}

export function constructionIcon() {
  return '<svg class="construction-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="2" y="6" width="20" height="8" rx="1"/><path d="M17 14v7M7 14v7M17 3v3M7 3v3M10 14 2.3 6.3m11.7-.3 7.7 7.7M8 6l8 8"/></svg>';
}
