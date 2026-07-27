/**
 * lib/canvaRender.js
 *
 * Convierte una plantilla JSON tipo "Canva design spec" (rectángulos,
 * elipses, texto) en un SVG. No depende de ninguna librería nativa
 * de imágenes (canvas, sharp, etc.) — solo genera texto SVG, así que
 * funciona en cualquier arquitectura, incluida arm7/32-bit.
 *
 * Soporta: RECTANGLE, ELLIPSE, TEXT.
 * ICON e IMAGE se dibujan como un recuadro gris de marcador de
 * posición (dibujar iconos/imágenes reales requeriría descargar
 * assets externos, que no siempre están disponibles).
 */

function escaparXML(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderRectangulo(el) {
  const rx = el.cornerRadius || 0
  const sombra = el.shadow
    ? `filter="drop-shadow(${el.shadow.offsetX || 0}px ${el.shadow.offsetY || 0}px ${el.shadow.blur || 0}px rgba(0,0,0,${el.shadow.opacity ?? 0.2}))"`
    : ''
  const stroke = el.stroke ? `stroke="${el.stroke}" stroke-width="${el.strokeWidth || 1}"` : ''
  return `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" rx="${rx}" fill="${el.fill || 'none'}" opacity="${el.opacity ?? 1}" ${stroke} ${sombra} />`
}

function renderElipse(el) {
  const cx = el.x + el.width / 2
  const cy = el.y + el.height / 2
  const stroke = el.stroke ? `stroke="${el.stroke}" stroke-width="${el.strokeWidth || 1}"` : ''
  return `<ellipse cx="${cx}" cy="${cy}" rx="${el.width / 2}" ry="${el.height / 2}" fill="${el.fill || 'none'}" opacity="${el.opacity ?? 1}" ${stroke} />`
}

function renderTexto(el) {
  const anclaje = { left: 'start', center: 'middle', right: 'end' }[el.align] || 'start'
  const x = el.align === 'center' ? el.x + el.width / 2 : el.align === 'right' ? el.x + el.width : el.x
  const y = el.y + (el.fontSize || 22)
  return `<text x="${x}" y="${y}" font-family="${el.fontFamily || 'sans-serif'}" font-weight="${el.fontWeight || 400}" font-size="${el.fontSize || 22}" fill="${el.fill || '#000'}" text-anchor="${anclaje}" opacity="${el.opacity ?? 1}">${escaparXML(el.text)}</text>`
}

function renderMarcador(el) {
  // Placeholder gris para ICON / IMAGE (no descargamos assets externos)
  return `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" fill="#cccccc" opacity="${el.opacity ?? 0.3}" /><text x="${el.x + 4}" y="${el.y + 14}" font-size="10" fill="#666">${escaparXML(el.type)}</text>`
}

/**
 * @param {object} diseño - JSON con { width, height, elements: [...] }
 * @returns {string} SVG completo como texto
 */
export function renderizarASvg(diseño) {
  const w = diseño.width || 1080
  const h = diseño.height || 1920
  const elementos = Array.isArray(diseño.elements) ? diseño.elements : []

  const partes = elementos.map(el => {
    try {
      if (el.type === 'RECTANGLE') return renderRectangulo(el)
      if (el.type === 'ELLIPSE') return renderElipse(el)
      if (el.type === 'TEXT') return renderTexto(el)
      if (el.type === 'ICON' || el.type === 'IMAGE') return renderMarcador(el)
      return ''
    } catch {
      return ''
    }
  })

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    partes.join('\n') +
    `</svg>`
  )
}
