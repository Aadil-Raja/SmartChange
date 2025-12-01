// src/components/ui/MarkdownMessage.jsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const MarkdownMessage = ({ content, isUser = false }) => {
  return (
    <div className={`markdown-content text-sm leading-relaxed ${
      isUser ? 'text-white' : 'text-gray-800'
    }`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        // Headings
        h1: ({ node, ...props }) => (
          <h1 className={`text-2xl font-bold mb-3 mt-4 ${isUser ? 'text-white' : 'text-gray-900'}`} {...props} />
        ),
        h2: ({ node, ...props }) => (
          <h2 className={`text-xl font-bold mb-2 mt-3 ${isUser ? 'text-white' : 'text-gray-900'}`} {...props} />
        ),
        h3: ({ node, ...props }) => (
          <h3 className={`text-lg font-semibold mb-2 mt-3 ${isUser ? 'text-white' : 'text-gray-900'}`} {...props} />
        ),
        h4: ({ node, ...props }) => (
          <h4 className={`text-base font-semibold mb-2 mt-2 ${isUser ? 'text-white' : 'text-gray-900'}`} {...props} />
        ),
        h5: ({ node, ...props }) => (
          <h5 className={`text-sm font-semibold mb-1 mt-2 ${isUser ? 'text-white' : 'text-gray-900'}`} {...props} />
        ),
        h6: ({ node, ...props }) => (
          <h6 className={`text-sm font-semibold mb-1 mt-2 ${isUser ? 'text-white' : 'text-gray-900'}`} {...props} />
        ),

        // Paragraphs
        p: ({ node, ...props }) => (
          <p className="mb-3 last:mb-0" {...props} />
        ),

        // Lists
        ul: ({ node, ...props }) => (
          <ul className={`list-disc list-inside mb-3 space-y-1 ${isUser ? 'text-white' : 'text-gray-800'}`} {...props} />
        ),
        ol: ({ node, ...props }) => (
          <ol className={`list-decimal list-inside mb-3 space-y-1 ${isUser ? 'text-white' : 'text-gray-800'}`} {...props} />
        ),
        li: ({ node, ...props }) => (
          <li className="ml-2" {...props} />
        ),

        // Emphasis
        strong: ({ node, ...props }) => (
          <strong className={`font-bold ${isUser ? 'text-white' : 'text-gray-900'}`} {...props} />
        ),
        em: ({ node, ...props }) => (
          <em className="italic" {...props} />
        ),

        // Code blocks
        code: ({ node, inline, className, children, ...props }) => {
          if (inline) {
            return (
              <code
                className={`px-1.5 py-0.5 rounded text-xs font-mono ${
                  isUser
                    ? 'bg-white/20 text-white'
                    : 'bg-gray-100 text-[#F58220] border border-gray-200'
                }`}
                {...props}
              >
                {children}
              </code>
            );
          }
          return (
            <code
              className={`block px-4 py-3 rounded-lg text-xs font-mono overflow-x-auto my-3 ${
                isUser
                  ? 'bg-white/10 text-white border border-white/20'
                  : 'bg-gray-900 text-gray-100 border border-gray-700'
              }`}
              {...props}
            >
              {children}
            </code>
          );
        },
        pre: ({ node, ...props }) => (
          <pre className="my-3 overflow-x-auto" {...props} />
        ),

        // Blockquotes
        blockquote: ({ node, ...props }) => (
          <blockquote
            className={`border-l-4 pl-4 py-2 my-3 italic ${
              isUser
                ? 'border-white/40 text-white/90'
                : 'border-[#F58220] text-gray-700 bg-gray-50 rounded-r-lg'
            }`}
            {...props}
          />
        ),

        // Links
        a: ({ node, ...props }) => (
          <a
            className={`underline hover:no-underline ${
              isUser ? 'text-white font-semibold' : 'text-[#00ADEF] hover:text-[#0090C5]'
            }`}
            target="_blank"
            rel="noopener noreferrer"
            {...props}
          />
        ),

        // Horizontal rule
        hr: ({ node, ...props }) => (
          <hr
            className={`my-4 ${isUser ? 'border-white/30' : 'border-gray-300'}`}
            {...props}
          />
        ),

        // Tables
        table: ({ node, ...props }) => (
          <div className="overflow-x-auto my-3">
            <table
              className={`min-w-full border-collapse ${
                isUser ? 'border-white/30' : 'border-gray-300'
              }`}
              {...props}
            />
          </div>
        ),
        thead: ({ node, ...props }) => (
          <thead
            className={isUser ? 'bg-white/10' : 'bg-gray-100'}
            {...props}
          />
        ),
        tbody: ({ node, ...props }) => <tbody {...props} />,
        tr: ({ node, ...props }) => (
          <tr
            className={`border-b ${isUser ? 'border-white/20' : 'border-gray-200'}`}
            {...props}
          />
        ),
        th: ({ node, ...props }) => (
          <th
            className={`px-3 py-2 text-left text-xs font-semibold ${
              isUser ? 'text-white' : 'text-gray-900'
            }`}
            {...props}
          />
        ),
        td: ({ node, ...props }) => (
          <td className="px-3 py-2 text-sm" {...props} />
        ),

        // Images
        img: ({ node, ...props }) => (
          <img
            className="max-w-full h-auto rounded-lg my-3"
            {...props}
          />
        ),
      }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownMessage;
