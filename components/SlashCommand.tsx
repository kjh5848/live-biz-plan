import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { Editor, Range } from '@tiptap/react';
import { Heading1, Heading2, Heading3, Type, List, ListOrdered, CheckSquare, Quote, Code, Minus } from 'lucide-react';

// --- Types ---
interface CommandItemProps {
  title: string;
  icon: React.ReactNode;
  command: (editor: { chain: () => any }) => void;
}

// --- Menu Component ---
interface CommandListProps {
  items: CommandItemProps[];
  command: (item: CommandItemProps) => void;
  editor: Editor;
  range: Range;
}

export const CommandList: React.FC<CommandListProps> = ({ items, command }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = useCallback((index: number) => {
    const item = items[index];
    if (item) command(item);
  }, [command, items]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  useEffect(() => {
    const navigationHandler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
        setSelectedIndex((selectedIndex + items.length - 1) % items.length);
        return true;
      }
      if (e.key === 'ArrowDown') {
        setSelectedIndex((selectedIndex + 1) % items.length);
        return true;
      }
      if (e.key === 'Enter') {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    };

    document.addEventListener('keydown', navigationHandler);
    return () => document.removeEventListener('keydown', navigationHandler);
  }, [items, selectedIndex, selectItem]);

  if (items.length === 0) return null;

  return (
    <div className="z-50 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden min-w-[200px] p-1">
      {items.map((item, index) => (
        <button
          key={index}
          className={`flex items-center w-full px-2 py-1.5 text-sm rounded-md text-left transition-colors ${
            index === selectedIndex ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
          }`}
          onClick={() => selectItem(index)}
        >
          <span className="mr-2 text-gray-500">{item.icon}</span>
          {item.title}
        </button>
      ))}
    </div>
  );
};

// --- Suggestion Logic ---
const getSuggestionItems = ({ query }: { query: string }) => {
  const items: CommandItemProps[] = [
    {
      title: 'Heading 1',
      icon: <Heading1 size={16} />,
      command: ({ chain }) => chain().toggleHeading({ level: 1 }).run(),
    },
    {
      title: 'Heading 2',
      icon: <Heading2 size={16} />,
      command: ({ chain }) => chain().toggleHeading({ level: 2 }).run(),
    },
    {
      title: 'Heading 3',
      icon: <Heading3 size={16} />,
      command: ({ chain }) => chain().toggleHeading({ level: 3 }).run(),
    },
    {
      title: 'Paragraph',
      icon: <Type size={16} />,
      command: ({ chain }) => chain().setParagraph().run(),
    },
    {
      title: 'Bullet List',
      icon: <List size={16} />,
      command: ({ chain }) => chain().toggleBulletList().run(),
    },
    {
      title: 'Ordered List',
      icon: <ListOrdered size={16} />,
      command: ({ chain }) => chain().toggleOrderedList().run(),
    },
    {
      title: 'Task List',
      icon: <CheckSquare size={16} />,
      command: ({ chain }) => chain().toggleTaskList().run(),
    },
    {
      title: 'Blockquote',
      icon: <Quote size={16} />,
      command: ({ chain }) => chain().toggleBlockquote().run(),
    },
    {
      title: 'Code Block',
      icon: <Code size={16} />,
      command: ({ chain }) => chain().toggleCodeBlock().run(),
    },
    {
        title: 'Divider',
        icon: <Minus size={16} />,
        command: ({ chain }) => chain().setHorizontalRule().run(),
    }
  ];

  return items.filter(item => item.title.toLowerCase().includes(query.toLowerCase()));
};

export const renderItems = () => {
  let component: any;
  let popup: any;

  return {
    onStart: (props: any) => {
      component = props.editor.options.element.parentElement.querySelector('.slash-menu-container');
      // In a real implementation with React, usually we render using a Portal or separate root.
      // For this simplified version within TipTap architecture, we'll pass props to a global handler or use a ReactRenderer if available.
      // However, to keep it self-contained without tiptap-react-renderer dependency, we will emit an event.
      
      const event = new CustomEvent('slash-menu-open', { detail: props });
      window.dispatchEvent(event);
    },
    onUpdate: (props: any) => {
      const event = new CustomEvent('slash-menu-update', { detail: props });
      window.dispatchEvent(event);
    },
    onKeyDown: (props: any) => {
      if (props.event.key === 'Escape') {
        const event = new CustomEvent('slash-menu-close');
        window.dispatchEvent(event);
        return true;
      }
      return false; // Let the React component handle arrows/enter via event listeners on window or similar
    },
    onExit: () => {
      const event = new CustomEvent('slash-menu-close');
      window.dispatchEvent(event);
    },
  };
};

export const SlashCommand = Extension.create({
  name: 'slashCommand',
  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({ editor, range, props }: any) => {
          props.command({ chain: () => editor.chain().focus().deleteRange(range) });
        },
      },
    };
  },
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

export const SuggestionOptions = {
    items: getSuggestionItems,
    render: renderItems,
};
