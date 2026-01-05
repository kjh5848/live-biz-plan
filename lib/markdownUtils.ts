import { JSONContent } from '@tiptap/react';

// Simplified Markdown Serializer for TipTap JSON
// Note: In a production app, use 'tiptap-markdown' extension. 
// Here we implement a basic serializer for the requested block types to avoid complex peer dependencies in this demo environment.

export function serializeToMarkdown(json: JSONContent): string {
  if (!json.content) return '';

  return json.content.map(node => {
    switch (node.type) {
      case 'heading':
        const level = node.attrs?.level || 1;
        const text = node.content?.map(c => c.text).join('') || '';
        return `${'#'.repeat(level)} ${text}\n\n`;
      
      case 'paragraph':
        const pText = node.content?.map(c => {
          if (c.type === 'text') {
            let t = c.text || '';
            if (c.marks) {
              c.marks.forEach(m => {
                if (m.type === 'bold') t = `**${t}**`;
                if (m.type === 'italic') t = `*${t}*`;
                if (m.type === 'code') t = `\`${t}\``;
              });
            }
            return t;
          }
          return '';
        }).join('') || '';
        return pText ? `${pText}\n\n` : '\n';

      case 'bulletList':
        return (node.content?.map(li => `- ${(li.content?.[0] as any)?.content?.[0]?.text || ''}`).join('\n') || '') + '\n\n';
      
      case 'orderedList':
        return (node.content?.map((li, i) => `${i + 1}. ${(li.content?.[0] as any)?.content?.[0]?.text || ''}`).join('\n') || '') + '\n\n';
      
      case 'codeBlock':
         return `\`\`\`\n${node.content?.[0]?.text || ''}\n\`\`\`\n\n`;

      case 'blockquote':
         return `> ${node.content?.[0]?.content?.[0]?.text || ''}\n\n`;
      
      case 'horizontalRule':
        return '---\n\n';

      default:
        return '';
    }
  }).join('').trim();
}

// Basic Parser: Markdown String -> TipTap JSON
// This is a naive parser for the demo. 
export function parseMarkdownToJSON(markdown: string): JSONContent {
  const lines = markdown.split('\n');
  const content: JSONContent[] = [];
  
  let currentList: JSONContent | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    
    if (!line) continue;

    // Heading
    if (line.startsWith('#')) {
      const level = line.match(/^#+/)?.[0].length || 1;
      content.push({
        type: 'heading',
        attrs: { level },
        content: [{ type: 'text', text: line.replace(/^#+\s/, '') }]
      });
      continue;
    }

    // Bullet List
    if (line.startsWith('- ') || line.startsWith('* ')) {
      if (!currentList || currentList.type !== 'bulletList') {
        currentList = { type: 'bulletList', content: [] };
        content.push(currentList);
      }
      currentList.content?.push({
        type: 'listItem',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: line.replace(/^[-*]\s/, '') }] }]
      });
      continue;
    }
    
    // Ordered List
    if (/^\d+\.\s/.test(line)) {
       if (!currentList || currentList.type !== 'orderedList') {
        currentList = { type: 'orderedList', content: [] };
        content.push(currentList);
      }
       currentList.content?.push({
        type: 'listItem',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: line.replace(/^\d+\.\s/, '') }] }]
      });
      continue;
    }

    // Reset list if not a list item
    currentList = null;

    // Blockquote
    if (line.startsWith('> ')) {
       content.push({
        type: 'blockquote',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: line.replace(/^>\s/, '') }] }]
      });
      continue;
    }

    // Code Block (Simplified)
    if (line.startsWith('```')) {
       // Naive consume until next ```
       let codeContent = '';
       i++;
       while(i < lines.length && !lines[i].startsWith('```')) {
         codeContent += lines[i] + '\n';
         i++;
       }
       content.push({
         type: 'codeBlock',
         content: [{ type: 'text', text: codeContent.trim() }]
       });
       continue;
    }

    // HR
    if (line === '---' || line === '***') {
      content.push({ type: 'horizontalRule' });
      continue;
    }

    // Paragraph
    content.push({
      type: 'paragraph',
      content: [{ type: 'text', text: line }]
    });
  }

  return {
    type: 'doc',
    content
  };
}

export function extractSections(markdown: string): string[] {
  const lines = markdown.split('\n');
  return lines
    .filter(l => l.startsWith('# ')) // Only H1 for main sections
    .map(l => l.replace(/^#\s/, '').trim());
}
