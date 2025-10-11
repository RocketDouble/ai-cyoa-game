import React from 'react';

interface MarkdownParserProps {
    text: string;
    className?: string;
}

/**
 * Simple markdown parser that handles basic formatting:
 * - *italic* and _italic_ text (rendered in darker gray)
 * - **bold** and __bold__ text
 * - "quoted text" and "smart quoted text" (rendered in darker orange)
 * - Basic line breaks and paragraphs
 */
export const MarkdownParser: React.FC<MarkdownParserProps> = ({ text, className = '' }) => {
    const parseMarkdown = (input: string): React.ReactNode[] => {
        const elements: React.ReactNode[] = [];
        let elementKey = 0;

        // Split by lines to handle paragraphs
        const lines = input.split('\n');

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];

            if (line.trim() === '') {
                // Empty line creates paragraph break
                if (lineIndex < lines.length - 1) {
                    elements.push(<br key={`br-${elementKey++}`} />);
                }
                continue;
            }

            const lineElements = parseLineMarkdown(line, elementKey);
            elements.push(...lineElements.elements);
            elementKey = lineElements.nextKey;

            // Add line break if not the last line
            if (lineIndex < lines.length - 1) {
                elements.push(<br key={`br-${elementKey++}`} />);
            }
        }

        return elements;
    };

    const parseLineMarkdown = (line: string, startKey: number): { elements: React.ReactNode[], nextKey: number } => {
        const elements: React.ReactNode[] = [];
        let elementKey = startKey;

        // Normalize smart quotes to regular quotes first
        const normalizedLine = line.replace(/[“”]/g, '"');

        // Regex patterns for different markdown elements
        const patterns = [
            // Bold patterns (**text** or __text__)
            { regex: /\*\*(.*?)\*\*/g, type: 'bold' },
            { regex: /__(.*?)__/g, type: 'bold' },
            // Italic patterns (*text* or _text_) - must come after bold
            { regex: /\*(.*?)\*/g, type: 'italic' },
            { regex: /_(.*?)_/g, type: 'italic' },
            // Quote patterns - match quotes that are likely intentional dialogue/quotes
            // Avoid matching apostrophes by requiring quotes to be at word boundaries or after spaces/punctuation
            { regex: /(?:^|[\s.,!?;:])"([^"]*?)"(?=[\s.,!?;:]|$)/g, type: 'quote' },
        ];

        // Find all matches and their positions
        const matches: Array<{
            start: number;
            end: number;
            content: string;
            type: string;
            fullMatch: string;
        }> = [];

        patterns.forEach(pattern => {
            let match;
            const regex = new RegExp(pattern.regex.source, pattern.regex.flags);

            while ((match = regex.exec(normalizedLine)) !== null) {
                matches.push({
                    start: match.index,
                    end: match.index + match[0].length,
                    content: match[1],
                    type: pattern.type,
                    fullMatch: match[0]
                });
            }
        });

        // Sort matches by start position
        matches.sort((a, b) => a.start - b.start);

        // Remove overlapping matches (keep the first one)
        const filteredMatches: typeof matches = [];
        for (const match of matches) {
            const hasOverlap = filteredMatches.some(existing =>
                (match.start < existing.end && match.end > existing.start)
            );
            if (!hasOverlap) {
                filteredMatches.push(match);
            }
        }

        // Build elements
        let lastIndex = 0;

        for (const match of filteredMatches) {
            // Add text before the match
            if (match.start > lastIndex) {
                const beforeText = normalizedLine.substring(lastIndex, match.start);
                if (beforeText) {
                    elements.push(<span key={`text-${elementKey++}`}>{beforeText}</span>);
                }
            }

            // Add the formatted match
            const content = match.content;
            switch (match.type) {
                case 'bold':
                    elements.push(
                        <strong key={`bold-${elementKey++}`} className="font-semibold">
                            {content}
                        </strong>
                    );
                    break;
                case 'italic':
                    elements.push(
                        <em key={`italic-${elementKey++}`} className="italic text-gray-600 dark:text-gray-400">
                            {content}
                        </em>
                    );
                    break;
                case 'quote':
                    elements.push(
                        <span key={`quote-${elementKey++}`} className="text-orange-700 dark:text-orange-400">
                            "{content}"
                        </span>
                    );
                    break;
            }

            lastIndex = match.end;
        }

        // Add remaining text
        if (lastIndex < normalizedLine.length) {
            const remainingText = normalizedLine.substring(lastIndex);
            if (remainingText) {
                elements.push(<span key={`text-${elementKey++}`}>{remainingText}</span>);
            }
        }

        // If no matches found, return the whole line as text
        if (elements.length === 0) {
            elements.push(<span key={`text-${elementKey++}`}>{normalizedLine}</span>);
        }

        return { elements, nextKey: elementKey };
    };

    const parsedElements = parseMarkdown(text);

    return (
        <span className={className}>
            {parsedElements}
        </span>
    );
};

export default MarkdownParser;