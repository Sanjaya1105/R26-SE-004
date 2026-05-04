import PlantCellSvg from '../components/labeled/PlantCellSvg';
import { resolveLabeledDiagramTemplate } from './labeledDiagramTemplate';

/**
 * Renders the appropriate SVG labeled diagram for the topic, or a fallback message.
 * Primary entry for `/images` labeled-diagram preview (SVG/HTML text, not AI image text).
 */
export default function LabeledDiagramPreview({ topic, labels, diagramData }) {
  const template = resolveLabeledDiagramTemplate(topic, diagramData);
  if (template === 'plant_cell') {
    return <PlantCellSvg labels={labels} />;
  }
  return <LabeledDiagramFallback />;
}

function LabeledDiagramFallback() {
  return (
    <div
      style={{
        padding: '1rem 1.25rem',
        borderRadius: '10px',
        background: 'rgba(15, 23, 42, 0.55)',
        border: '1px solid rgba(148, 163, 184, 0.25)',
        color: 'var(--text-muted)',
        fontSize: '0.95rem',
        lineHeight: 1.55,
      }}
    >
      <p style={{ margin: 0 }}>
        No built-in SVG template is available for this structure yet. Use the generated base image prompt plus
        label metadata.
      </p>
    </div>
  );
}
