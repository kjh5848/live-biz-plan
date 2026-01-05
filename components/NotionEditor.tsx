import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { CommandList, SlashCommand, SuggestionOptions } from './SlashCommand';
import { parseMarkdownToJSON, serializeToMarkdown } from '../lib/markdownUtils';
import { GripVertical } from 'lucide-react';

interface NotionEditorProps {
  contentMarkdown: string;
  onUpdate: (markdown: string, json: any) => void;
  readOnly?: boolean;
}

export const NotionEditor: React.FC<NotionEditorProps> = ({ contentMarkdown, onUpdate, readOnly }) => {
  // We use a ref to track if the update comes from external (LLM) or internal (User)
  // to avoid loop issues or overwriting user work while typing.
  const isInternalUpdate = useRef(false);
  const [slashProps, setSlashProps] = useState<any>(null);
  const [dragHandlePos, setDragHandlePos] = useState<{ top: number; left: number; active: boolean, nodePos: number } | null>(null);
  
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: 'Type \'/\' for commands...',
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      SlashCommand.configure({
          suggestion: SuggestionOptions
      })
    ],
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose-base lg:prose-lg xl:prose-2xl m-5 focus:outline-none max-w-none',
      },
      handleDOMEvents: {
          mouseover: (view, event) => {
             // Simple Drag Handle Logic
             const target = event.target as HTMLElement;
             const nodeElement = target.closest('.ProseMirror > *'); // Direct children of editor are blocks
             
             if (nodeElement && !readOnly) {
                 const coords = nodeElement.getBoundingClientRect();
                 const editorCoords = view.dom.getBoundingClientRect();
                 const pos = view.posAtDOM(nodeElement, 0);
                 
                 setDragHandlePos({
                     top: coords.top - editorCoords.top + nodeElement.scrollTop,
                     left: -24, // Position in gutter
                     active: true,
                     nodePos: pos
                 });
             }
             return false;
          }
      }
    },
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      isInternalUpdate.current = true;
      const json = editor.getJSON();
      const md = serializeToMarkdown(json);
      onUpdate(md, json);
      setTimeout(() => { isInternalUpdate.current = false; }, 0);
    },
  });

  // Sync content when markdown changes externally (e.g. LLM update), but NOT when user is typing
  useEffect(() => {
    if (editor && !isInternalUpdate.current && contentMarkdown) {
        // Compare to avoid unnecessary re-renders or cursor jumps
        const currentMD = serializeToMarkdown(editor.getJSON());
        if (currentMD.trim() !== contentMarkdown.trim()) {
            // Smart update: Try to preserve selection if possible, or just set content
            const { from, to } = editor.state.selection;
            editor.commands.setContent(parseMarkdownToJSON(contentMarkdown));
            // Try to restore selection if within bounds (simplified)
            try {
                editor.commands.setTextSelection({ from, to });
            } catch(e) {/* ignore */}
        }
    }
  }, [contentMarkdown, editor]);

  // Slash Menu Events
  useEffect(() => {
    const onOpen = (e: any) => setSlashProps(e.detail);
    const onUpdate = (e: any) => setSlashProps(e.detail);
    const onClose = () => setSlashProps(null);

    window.addEventListener('slash-menu-open', onOpen);
    window.addEventListener('slash-menu-update', onUpdate);
    window.addEventListener('slash-menu-close', onClose);

    return () => {
      window.removeEventListener('slash-menu-open', onOpen);
      window.removeEventListener('slash-menu-update', onUpdate);
      window.removeEventListener('slash-menu-close', onClose);
    };
  }, []);
  
  // Drag Handle Click
  const handleDragStart = (e: React.DragEvent) => {
      if (!editor || !dragHandlePos) return;
      e.dataTransfer.effectAllowed = 'move';
      // We set a custom format to identify the node
      // Note: Full drag and drop reordering requires complex schema handling in ProseMirror
      // For this simplified version, we'll implement "Click to Select" which allows standard keyboard shortcuts (Alt+Up/Down) to move.
      // Or we can just use the handle to select the node row.
      
      const { nodePos } = dragHandlePos;
      editor.commands.setNodeSelection(nodePos - 1); // Adjust for 1-based index if needed, usually direct mapping works for block start
  };

  const handleDragClick = () => {
      if(!editor || !dragHandlePos) return;
      // Select the block
      try {
        const node = editor.view.domAtPos(dragHandlePos.nodePos).node as HTMLElement;
        if(node) {
             // Basic implementation: Select the whole node
             // Finding exact pos is tricky without view helper, but we can try:
             const resolve = editor.state.doc.resolve(dragHandlePos.nodePos);
             // Select the node at this position
             editor.commands.setNodeSelection(dragHandlePos.nodePos - 1); // Often -1 handles the wrapper
        }
      } catch(e) {
          // Fallback
      }
  };

  if (!editor) return null;

  return (
    <div className="relative w-full max-w-6xl mx-auto border rounded-lg shadow-sm bg-white min-h-[600px] flex flex-row">
       {/* Gutter for Drag Handle */}
       <div className="w-12 bg-gray-50 border-r border-gray-100 relative shrink-0">
           {dragHandlePos && !readOnly && (
               <div 
                  className="absolute left-0 w-full flex justify-center cursor-grab hover:bg-gray-200 rounded p-1 transition-all"
                  style={{ top: dragHandlePos.top, transform: 'translateY(4px)' }}
                  draggable
                  onDragStart={handleDragStart}
                  onClick={handleDragClick}
                  title="Click to select block, Drag to move (native)"
               >
                   <GripVertical size={18} className="text-gray-400" />
               </div>
           )}
       </div>

       {/* Editor Area */}
       <div className="flex-1 relative">
          <EditorContent editor={editor} className="min-h-full" />
          
          {/* Slash Menu Popup */}
          {slashProps && (
             <div 
               className="absolute z-50 transition-all duration-200"
               style={{ 
                   top: slashProps.clientRect?.()?.top - editor.view.dom.getBoundingClientRect().top + 20 ?? 0,
                   left: slashProps.clientRect?.()?.left - editor.view.dom.getBoundingClientRect().left ?? 0
               }}
             >
                <CommandList 
                    {...slashProps} 
                    items={slashProps.items} 
                    command={(item) => {
                        slashProps.command(item);
                        setSlashProps(null);
                    }}
                    editor={editor}
                />
             </div>
          )}
       </div>
    </div>
  );
};