import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import './AssistantMarkdown.css';
import {
  normalizeAssistantMath,
  restoreBrokenEquations,
} from '../utils/assistantMath';
import {
  extractVisualSegments,
  looksLikeAsciiTable,
  looksLikeMermaid,
} from '../utils/asciiDiagram';
import MermaidChart from './MermaidChart';
import ConceptBoard from './ConceptBoard';

const STEP_HEADING_RE = /^step\s*(\d+)\s*(?:[—–:\-.]\s*)?(.*)$/i;

function flattenText(node) {
  if (node == null || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join('');
  if (node?.props?.children) return flattenText(node.props.children);
  return '';
}

function StepHeading({ as: Tag, children }) {
  const raw = flattenText(children).trim();
  const match = raw.match(STEP_HEADING_RE);
  if (!match) return <Tag>{children}</Tag>;
  const title = String(match[2] || '').trim() || `Step ${match[1]}`;
  return (
    <div className="assistant-step">
      <span className="assistant-step-index" aria-hidden="true">
        {match[1]}
      </span>
      <Tag className="assistant-step-heading">{title}</Tag>
    </div>
  );
}

function makeAssistantComponents(light) {
  return {
    pre: ({ children }) => <div className="assistant-md-pre">{children}</div>,
    table: ({ children, ...props }) => (
      <div className="assistant-md-table-wrap">
        <table {...props}>{children}</table>
      </div>
    ),
    h1: ({ children }) => <StepHeading as="h1">{children}</StepHeading>,
    h2: ({ children }) => <StepHeading as="h2">{children}</StepHeading>,
    h3: ({ children }) => <StepHeading as="h3">{children}</StepHeading>,
    ol: ({ children, ...props }) => (
      <ol className="assistant-step-list" {...props}>
        {children}
      </ol>
    ),
    code({ className, children, ...props }) {
      const language = /language-(\w+)/.exec(className || '')?.[1] || '';
      const value = String(children || '').replace(/\n$/, '');
      if (language === 'mermaid' || looksLikeMermaid(value)) {
        return <MermaidChart definition={value} light={light} />;
      }
      if (looksLikeAsciiTable(value)) {
        return <ConceptBoard block={value} />;
      }
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
  };
}

function MarkdownBlock({ text, canonicalEquations, components }) {
  const prepared = restoreBrokenEquations(
    normalizeAssistantMath(text),
    canonicalEquations
  );
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath, remarkGfm]}
      rehypePlugins={[[rehypeKatex, { throwOnError: false }]]}
      components={components}
    >
      {prepared}
    </ReactMarkdown>
  );
}

/**
 * @param {{
 *  children: string,
 *  className?: string,
 *  style?: import('react').CSSProperties,
 *  canonicalEquations?: string[],
 *  variant?: 'light' | 'dark',
 * }} props
 */
export default function AssistantMarkdown({
  children,
  className = '',
  style,
  canonicalEquations = [],
  variant = 'dark',
}) {
  const light = variant === 'light';
  const components = makeAssistantComponents(light);
  const segments = extractVisualSegments(String(children || ''));
  return (
    <div
      className={`assistant-md${light ? ' assistant-md--light' : ''} ${className}`.trim()}
      style={style}
    >
      {segments.map((segment, index) => {
        if (segment.type === 'ascii') {
          return <ConceptBoard key={`ascii-${index}`} block={segment.content} />;
        }
        if (segment.type === 'mermaid') {
          return (
            <MermaidChart
              key={`mermaid-${index}`}
              definition={segment.content}
              light={light}
            />
          );
        }
        return (
          <MarkdownBlock
            key={`md-${index}`}
            text={segment.content}
            canonicalEquations={canonicalEquations}
            components={components}
          />
        );
      })}
    </div>
  );
}
