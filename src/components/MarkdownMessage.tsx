"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useState } from "react";

interface MarkdownMessageProps {
  content: string;
}

function CodeBlock({ language, children }: { language?: string; children: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-2 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800 text-xs text-slate-400 border-b border-slate-700">
        <span>{language || "code"}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              تم النسخ
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              نسخ
            </>
          )}
        </button>
      </div>
      <SyntaxHighlighter
        style={oneDark}
        language={language || "text"}
        PreTag="div"
        customStyle={{
          margin: 0,
          borderRadius: 0,
          fontSize: "0.8rem",
          padding: "0.75rem",
        }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
}

export default function MarkdownMessage({ content }: MarkdownMessageProps) {
  return (
    <div className="text-sm leading-relaxed prose prose-slate dark:prose-invert max-w-none
      prose-pre:p-0 prose-pre:bg-transparent
      prose-code:before:content-[''] prose-code:after:content-['']
      prose-code:bg-slate-100 dark:prose-code:bg-slate-700 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
      prose-table:border-collapse prose-th:border prose-th:border-slate-300 dark:prose-th:border-slate-600 prose-th:px-3 prose-th:py-1.5
      prose-td:border prose-td:border-slate-300 dark:prose-td:border-slate-600 prose-td:px-3 prose-td:py-1.5
      prose-a:text-orange-500 prose-a:no-underline hover:prose-a:underline
      prose-blockquote:border-orange-500 prose-blockquote:bg-orange-50 dark:prose-blockquote:bg-orange-900/10 prose-blockquote:py-1 prose-blockquote:px-3 prose-blockquote:rounded-r-lg
    ">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const isInline = !match && !className;
            
            if (isInline) {
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            }

            return (
              <CodeBlock language={match?.[1]}>
                {String(children).replace(/\n$/, "")}
              </CodeBlock>
            );
          },
          p({ children }) {
            return <p className="mb-2 last:mb-0">{children}</p>;
          },
          ul({ children }) {
            return <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>;
          },
          li({ children }) {
            return <li className="text-sm">{children}</li>;
          },
          h1({ children }) {
            return <h1 className="text-lg font-bold mt-3 mb-1">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-base font-bold mt-2 mb-1">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-sm font-bold mt-2 mb-1">{children}</h3>;
          },
          a({ href, children }) {
            return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
