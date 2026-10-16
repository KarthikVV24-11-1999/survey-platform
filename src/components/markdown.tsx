import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Raw HTML and images are dropped, and only http(s) and mailto links are kept.
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-poll">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        disallowedElements={["img"]}
        unwrapDisallowed
        urlTransform={(url) => (/^(https?:|mailto:)/i.test(url) ? url : "")}
        components={{
          a: ({ href, children }) =>
            href ? (
              <a href={href} target="_blank" rel="nofollow ugc noopener noreferrer">
                {children}
              </a>
            ) : (
              <span>{children}</span>
            ),
          h1: ({ children }) => <h3 className="text-lg">{children}</h3>,
          h2: ({ children }) => <h3 className="text-base">{children}</h3>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
