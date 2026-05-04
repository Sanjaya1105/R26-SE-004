import { createElement } from 'react';
import LabeledDiagramPreview from './renderLabeledDiagram';

/**
 * Programmatic entry matching renderLabeledDiagram(topic, labels, diagramData).
 * @param {string} topic
 * @param {Array} labels
 * @param {object} [diagramData]
 */
export function renderLabeledDiagram(topic, labels, diagramData) {
  return createElement(LabeledDiagramPreview, { topic, labels, diagramData });
}
