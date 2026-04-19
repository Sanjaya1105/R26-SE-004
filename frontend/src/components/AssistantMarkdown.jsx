import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import './AssistantMarkdown.css';

/**
 * Normalize assistant text so markdown + soft breaks behave as documented:
 * - **bold**, *italic*, ***both***, headings, ---, lists, tables, `inline`, fenced blocks
 * - Literal <br> → line break (remark-breaks turns newlines in prose into breaks)
 */
function preprocessAssistantText(raw) {
  return String(raw ?? '').replace(/<br\s*\/?>/gi, '\n');
}

const assistantComponents = {
  table: ({ children, ...props }) => (
    <div className="assistant-md-table-wrap">
      <table {...props}>{children}</table>
    </div>
  ),
};

/**
 * @param {{ children: string, className?: string, style?: import('react').CSSProperties }} props
 */
export default function AssistantMarkdown({ children, className = '', style }) {
  const text = preprocessAssistantText(children);
  return (
    <div className={`assistant-md ${className}`.trim()} style={style}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={assistantComponents}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
