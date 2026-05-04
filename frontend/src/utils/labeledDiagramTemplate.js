/**
 * Which built-in SVG template to use, if any.
 * @param {string} topic
 * @param {object} [diagramData]
 * @returns {'plant_cell' | null}
 */
export function resolveLabeledDiagramTemplate(topic, diagramData) {
  if (diagramData?.svg_template === 'plant_cell') return 'plant_cell';
  const t = String(topic || '').toLowerCase();
  if (/\bplant\s*cell\b|plant-cell|plantcell/.test(t)) return 'plant_cell';
  return null;
}
