import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import './AssistantMarkdown.css';
import {
  normalizeAssistantMath,
  restoreBrokenEquations,
} from '../utils/assistantMath';

const assistantComponents = {
  table: ({ children, ...props }) => (
    <div className="assistant-md-table-wrap">
      <table {...props}>{children}</table>
    </div>
  ),
};

/**
 * @param {{
 *  children: string,
 *  className?: string,
 *  style?: import('react').CSSProperties,
 *  canonicalEquations?: string[],
 * }} props
 */
export default function AssistantMarkdown({
  children,
  className = '',
  style,
  canonicalEquations = [],
}) {
  const text = restoreBrokenEquations(
    normalizeAssistantMath(children),
    canonicalEquations
  );
  return (
    <div className={`assistant-md ${className}`.trim()} style={style}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm, remarkBreaks]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false }]]}
        components={assistantComponents}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
