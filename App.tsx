import React, { useState, useEffect, useCallback } from 'react';
import { Send, FileText, Code, Layout, Download, AlertTriangle, HelpCircle, CheckCircle2, Plus, ArrowDown } from 'lucide-react';
import { Message, DocumentState, EditorMode, ReviewFinding, SectionMeta } from './types';
import { INITIAL_MARKDOWN, INITIAL_SECTION_META, INITIAL_SECTIONS } from './constants';
import { NotionEditor } from './components/NotionEditor';
import { processChatAndDoc } from './services/gemini';
import { extractSections, parseMarkdownToJSON } from './lib/markdownUtils';

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: '안녕하세요! 사업계획서 작성을 도와드릴게요. 어떤 사업을 구상 중이신가요?', timestamp: Date.now() }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Document State
  const [docState, setDocState] = useState<DocumentState>({
    markdown: INITIAL_MARKDOWN,
    json: parseMarkdownToJSON(INITIAL_MARKDOWN),
    sections: INITIAL_SECTION_META,
    lastUpdated: Date.now()
  });

  const [editorMode, setEditorMode] = useState<EditorMode>('notion');
  const [findings, setFindings] = useState<ReviewFinding[]>([]);
  const [nextQuestion, setNextQuestion] = useState<string>('');

  // --- Handlers ---

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const result = await processChatAndDoc(
          [...messages, userMsg], 
          docState.markdown,
          docState.sections
      );

      const assistantMsg: Message = { 
          id: (Date.now() + 1).toString(), 
          role: 'assistant', 
          content: result.assistantMessage, 
          timestamp: Date.now() 
      };

      setMessages(prev => [...prev, assistantMsg]);
      
      if (result.updatedDocumentMarkdown) {
          // Note: We use handleDocUpdate via effect or direct set logic here
          // But to ensure we don't break the section meta sync, we'll manually sync here or rely on the editor to update.
          // Since we are updating directly from AI, we should use the same logic as manual update for section tracking.
          const newMarkdown = result.updatedDocumentMarkdown;
          const currentHeaders = extractSections(newMarkdown);
          
          setDocState(prev => {
              const now = Date.now();
              const newSections = currentHeaders.map(header => {
                  const existing = prev.sections.find(s => s.id === header);
                  return existing 
                      ? { ...existing } // Don't update timestamp for AI edits (keep them "unlocked" or as is?) -> Actually AI edits should probably not lock it against ITSELF, but locking is mostly about User vs AI. 
                      : { id: header, editedAt: now, locked: false };
              });

              return {
                  ...prev,
                  markdown: newMarkdown,
                  json: parseMarkdownToJSON(newMarkdown),
                  lastUpdated: now,
                  sections: newSections
              };
          });
      }

      setFindings(result.reviewFindings || []);
      setNextQuestion(result.nextQuestion || '');

    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: '오류가 발생했습니다. 다시 시도해주세요.', timestamp: Date.now() }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDocUpdate = useCallback((newMarkdown: string, newJson: any) => {
    const now = Date.now();
    const currentHeaders = extractSections(newMarkdown);
    
    setDocState(prev => {
        // Optimization
        if (prev.markdown === newMarkdown) return prev;
        
        // Dynamic Section Metadata Tracking
        // We map the currently found headers to metadata.
        const newSectionsMeta = currentHeaders.map(header => {
            const existing = prev.sections.find(s => s.id === header);
            return existing 
                ? { ...existing, editedAt: now } // Update timestamp because doc changed (simple assumption)
                : { id: header, editedAt: now, locked: false }; // New section found
        });

        return {
            ...prev,
            markdown: newMarkdown,
            json: newJson,
            lastUpdated: now,
            sections: newSectionsMeta
        };
    });
  }, []);

  const handleNextSection = () => {
    const currentSections = extractSections(docState.markdown);
    if (currentSections.length >= INITIAL_SECTIONS.length) return;
    
    // Find the next section based on current count
    const nextSectionTitle = INITIAL_SECTIONS[currentSections.length];
    const newMarkdown = `${docState.markdown.trim()}\n\n# ${nextSectionTitle}\n\n`;
    
    // We update state directly. NotionEditor will sync when it receives new markdown prop.
    const now = Date.now();
    setDocState(prev => ({
        ...prev,
        markdown: newMarkdown,
        json: parseMarkdownToJSON(newMarkdown),
        lastUpdated: now,
        sections: [...prev.sections, { id: nextSectionTitle, editedAt: 0, locked: false }] // 0 timestamp so it's not locked immediately
    }));

    // Optional: Add a system message to chat
    setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: `새로운 항목 '${nextSectionTitle}'을(를) 추가했습니다. 내용을 작성하거나 저에게 요청해주세요.`,
        timestamp: Date.now()
    }]);
  };

  const downloadMarkdown = () => {
    const blob = new Blob([docState.markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'business_plan.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Determine next section for button
  const currentSections = extractSections(docState.markdown);
  const nextSectionTitle = currentSections.length < INITIAL_SECTIONS.length 
      ? INITIAL_SECTIONS[currentSections.length] 
      : null;

  return (
    <div className="flex h-screen bg-white overflow-hidden font-sans">
      
      {/* LEFT: Chat Panel */}
      <div className="w-1/3 min-w-[350px] flex flex-col border-r border-slate-200 bg-white">
        <div className="p-4 border-b border-slate-100 bg-white">
          <h1 className="text-xl font-bold text-slate-800">LiveBizPlan</h1>
          <p className="text-xs text-slate-500">AI Business Plan Generator</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-br-none' 
                  : 'bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
             <div className="flex justify-start">
               <div className="bg-slate-50 text-slate-500 rounded-2xl px-4 py-2 text-xs animate-pulse">
                 Thinking & Writing...
               </div>
             </div>
          )}
          {nextQuestion && !isLoading && (
              <div className="mt-4 p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
                  <div className="flex items-center gap-2 mb-1 text-indigo-700 font-semibold text-xs uppercase">
                      <HelpCircle size={14} /> Suggested Question
                  </div>
                  <p className="text-sm text-indigo-900">{nextQuestion}</p>
              </div>
          )}
        </div>

        <div className="p-4 bg-white border-t border-slate-100">
          <div className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="사업 아이디어를 이야기해주세요..."
              className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm"
            />
            <button 
              onClick={handleSendMessage}
              disabled={isLoading || !input.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT: Document Panel */}
      <div className="flex-1 flex flex-col bg-white h-full overflow-hidden">
        
        {/* Toolbar */}
        <div className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
             <button 
               onClick={() => setEditorMode('notion')}
               className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${editorMode === 'notion' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
               <Layout size={14} /> Editor
             </button>
             <button 
               onClick={() => setEditorMode('render')}
               className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${editorMode === 'render' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
               <FileText size={14} /> Preview
             </button>
             <button 
               onClick={() => setEditorMode('raw')}
               className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${editorMode === 'raw' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
               <Code size={14} /> Raw
             </button>
          </div>

          <div className="flex items-center gap-3">
             <span className="text-xs text-slate-400">
               {docState.lastUpdated > 0 ? `Saved ${new Date(docState.lastUpdated).toLocaleTimeString()}` : 'Unsaved'}
             </span>
             <button 
               onClick={downloadMarkdown}
               className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900 transition-colors"
             >
               <Download size={14} /> Export .md
             </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 scroll-smooth bg-gray-50/50">
           
           {/* Review Findings Banner */}
           {findings.length > 0 && (
             <div className="mb-6 max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
                 {findings.map((finding, idx) => (
                    <div key={idx} className={`p-3 rounded-lg border text-sm flex items-start gap-3 ${
                        finding.type === 'weakness' ? 'bg-red-50 border-red-100 text-red-700' :
                        finding.type === 'missing' ? 'bg-amber-50 border-amber-100 text-amber-700' :
                        'bg-blue-50 border-blue-100 text-blue-700'
                    }`}>
                        <span className="mt-0.5 shrink-0">
                            {finding.type === 'weakness' ? <AlertTriangle size={16}/> : 
                             finding.type === 'missing' ? <HelpCircle size={16}/> : <CheckCircle2 size={16}/>}
                        </span>
                        <span>{finding.content}</span>
                    </div>
                 ))}
             </div>
           )}

           {/* Editors */}
           {editorMode === 'notion' && (
             <NotionEditor 
               contentMarkdown={docState.markdown} 
               onUpdate={handleDocUpdate} 
             />
           )}

           {editorMode === 'render' && (
             <div className="prose prose-slate max-w-6xl mx-auto bg-white p-10 rounded-lg shadow-sm min-h-[600px] border border-slate-100">
                <div dangerouslySetInnerHTML={{ __html: 'Preview Mode: (For full fidelity, use Editor mode or Export). <br/><br/>' + docState.markdown.replace(/\n/g, '<br/>') }} />
             </div>
           )}

           {editorMode === 'raw' && (
             <textarea 
               className="w-full max-w-6xl mx-auto h-[600px] p-6 font-mono text-sm bg-slate-900 text-slate-50 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
               value={docState.markdown}
               onChange={(e) => handleDocUpdate(e.target.value, parseMarkdownToJSON(e.target.value))}
             />
           )}
           
           {/* Next Section Button */}
           {editorMode === 'notion' && nextSectionTitle && (
              <div className="max-w-6xl mx-auto mt-8 mb-16 flex flex-col items-center justify-center gap-2">
                 <div className="h-8 border-l border-dashed border-slate-300"></div>
                 <button 
                   onClick={handleNextSection}
                   className="group relative flex items-center gap-3 pl-4 pr-6 py-3 bg-white border border-slate-200 rounded-full shadow-sm hover:shadow-md hover:border-blue-300 transition-all"
                 >
                    <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <Plus size={18} />
                    </div>
                    <div className="text-left">
                        <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Next Step</div>
                        <div className="text-slate-800 font-semibold">{nextSectionTitle} 추가하기</div>
                    </div>
                 </button>
              </div>
           )}

        </div>

      </div>
    </div>
  );
}