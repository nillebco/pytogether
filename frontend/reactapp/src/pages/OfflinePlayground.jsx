import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { saveAs } from 'file-saver';
import { jsPDF } from "jspdf";
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { Send, Edit2, Check, X, Pencil, Eraser, Highlighter, RotateCcw, RotateCw, Trash2, Eye, EyeOff, FileDown } from "lucide-react";

// CodeMirror
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { StateField, StateEffect } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";

// API
import api from "../../axiosConfig";

// Components & Hooks
import CodeLayout from "../components/CodeLayout";
import { usePyRunner } from "../hooks/usePyRunner";
import { useTsRunner } from "../hooks/useTsRunner";
import { useLocalCanvas } from "../hooks/useLocalCanvas";

// Error line decoration
const errorLineDeco = Decoration.line({ class: "cm-error-line" });
const addErrorEffect = StateEffect.define();
const removeErrorEffect = StateEffect.define();
const errorLineField = StateField.define({
  create() { return Decoration.none; },
  update(value, tr) {
    value = value.map(tr.changes);
    for (let e of tr.effects) {
      if (e.is(addErrorEffect)) value = Decoration.set([errorLineDeco.range(tr.state.doc.line(e.value).from)]);
      else if (e.is(removeErrorEffect)) value = Decoration.none;
    }
    return value;
  },
  provide: f => EditorView.decorations.from(f)
});

// Default text for new users
const DEFAULT_PYTHON_CODE = `# Welcome to the Offline Playground!
# You can write and run Python code right here in your browser.
# Data is saved to your browser's local storage.

name = input("Whats your name? ")
print(f"Hello, {name}!")`;

const DEFAULT_TS_CODE = `// Welcome to the Offline Playground!
// You can write and run TypeScript code right here in your browser.
// Data is saved to your browser's local storage.

interface Person {
  name: string;
  age: number;
}

const greet = (person: Person): string => {
  return \`Hello, \${person.name}! You are \${person.age} years old.\`;
};

const user: Person = { name: "World", age: 25 };
console.log(greet(user));

// Try some TypeScript features:
const numbers: number[] = [1, 2, 3, 4, 5];
const doubled = numbers.map(n => n * 2);
console.log("Doubled:", doubled);`;

export default function OfflinePlayground() {
  const navigate = useNavigate();
  const { token } = useParams(); // Capture the token from the URL if present
  
  // Language selection state
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem("offline_language") || "python";
  });

  const [code, setCode] = useState(() => {
    // If we are loading a specific snippet (token exists), start with loading text
    if (token) return "# Loading snippet...";
    const savedLang = localStorage.getItem("offline_language") || "python";
    const savedCode = localStorage.getItem(`offline_code_${savedLang}`);
    return savedCode || (savedLang === "python" ? DEFAULT_PYTHON_CODE : DEFAULT_TS_CODE);
  });

  const [projectName, setProjectName] = useState(() => {
    if (token) return "Loading...";
    return localStorage.getItem("offline_project_name") || "Offline Project";
  });

  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(projectName);
  // If token exists, we are in "Snippet Mode" and need to fetch data
  const [isLoadingSnippet, setIsLoadingSnippet] = useState(!!token);
  
  // Refs
  const editorViewRef = useRef(null);
  
  // Hooks - initialize both runners
  const pyRunner = usePyRunner();
  const tsRunner = useTsRunner();
  const canvas = useLocalCanvas();

  // Select the active runner based on language
  const runner = language === "python" ? pyRunner : tsRunner;

  // Get the appropriate CodeMirror language extension
  const languageExtension = useMemo(() => {
    return language === "python" ? python() : javascript({ typescript: true });
  }, [language]);

  // Handle language switch
  const handleLanguageChange = (newLang) => {
    if (newLang === language) return;
    
    // Save current code for current language
    localStorage.setItem(`offline_code_${language}`, code);
    
    // Load code for new language
    const savedCode = localStorage.getItem(`offline_code_${newLang}`);
    const defaultCode = newLang === "python" ? DEFAULT_PYTHON_CODE : DEFAULT_TS_CODE;
    setCode(savedCode || defaultCode);
    
    // Update language
    setLanguage(newLang);
    localStorage.setItem("offline_language", newLang);
    
    // Clear console on language switch
    runner.clearConsole();
  };

  useEffect(() => {
    if (token) {
        const fetchSnippet = async () => {
            setIsLoadingSnippet(true);
            try {
                const res = await api.get(`/api/public/snippet/${token}/`);
                
                setCode(res.data.code || "# No content in this project");
                setProjectName(`Copy of ${res.data.name}`);
                setTempName(`Copy of ${res.data.name}`);
                
                runner.clearConsole();
            } catch (err) {
                console.error("Failed to load snippet", err);
                setCode("# Error: Could not load snippet. It may be invalid or expired.");
                setProjectName("Error Loading");
            } finally {
                setIsLoadingSnippet(false);
            }
        };
        fetchSnippet();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!isLoadingSnippet && !token) {
        localStorage.setItem(`offline_code_${language}`, code);
    }
  }, [code, isLoadingSnippet, token, language]);

  useEffect(() => {
    if (!isLoadingSnippet && !token) {
        localStorage.setItem("offline_project_name", projectName);
    }
  }, [projectName, isLoadingSnippet, token]);


  // --- SHORTCUTS & HANDLERS ---
  useEffect(() => {
    const handleKeyDown = (e) => {
        const isCtrl = e.ctrlKey || e.metaKey;
        
        if (isCtrl && !e.shiftKey && e.key.toLowerCase() === 'z') {
            if (canvas.drawingMode !== 'none') {
                e.preventDefault(); e.stopPropagation();
                canvas.undo();
            }
        }

        const isCtrlY = isCtrl && e.key.toLowerCase() === 'y';
        const isCtrlShiftZ = isCtrl && e.shiftKey && e.key.toLowerCase() === 'z';

        if (isCtrlY || isCtrlShiftZ) {
            if (canvas.drawingMode !== 'none') {
                e.preventDefault(); e.stopPropagation();
                canvas.redo();
            }
        }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [canvas.drawingMode, canvas.undo, canvas.redo]);

  useEffect(() => {
    if (runner.errorLine) {
      editorViewRef.current?.dispatch({ effects: addErrorEffect.of(runner.errorLine) });
    } else {
      editorViewRef.current?.dispatch({ effects: removeErrorEffect.of() });
    }
  }, [runner.errorLine]);

  const handleDownload = (ext) => {
    const content = code;
    // Use language-appropriate extension for source files
    let actualExt = ext;
    if (ext === '.py' && language === 'typescript') actualExt = '.ts';
    if (ext === '.ts' && language === 'python') actualExt = '.py';
    
    const filename = (projectName || 'offline').replace(/[^a-z0-9]/gi, '_').toLowerCase() + actualExt;
    
    if (actualExt === '.py') saveAs(new Blob([content], {type: 'text/python'}), filename);
    else if (actualExt === '.ts') saveAs(new Blob([content], {type: 'text/typescript'}), filename);
    else if (ext === '.txt') saveAs(new Blob([content], {type: 'text/plain'}), filename);
    else if (ext === '.pdf') {
      const doc = new jsPDF();
      doc.setFontSize(10);
      doc.text(doc.splitTextToSize(content, 180), 10, 10);
      doc.save(filename);
    } else if (ext === '.docx') {
      const doc = new Document({ 
        sections: [{ children: content.split('\n').map(l => new Paragraph({ children: [new TextRun({ text: l, font: "Courier New" })] })) }] 
      });
      Packer.toBlob(doc).then(b => saveAs(b, filename));
    }
  };

  const handleSaveName = () => {
    if (tempName.trim() && tempName !== projectName) {
      setProjectName(tempName);
    }
    setIsEditingName(false);
  };

  // --- RENDER SLOTS ---

  // Language selector component
  const languageSelector = (
    <div className="flex items-center gap-1 p-1 bg-gray-700 rounded-lg">
      <button
        onClick={() => handleLanguageChange('python')}
        disabled={runner.isRunning || runner.isLoading}
        className={`px-3 py-1.5 rounded text-sm font-medium transition-all duration-200 flex items-center gap-1.5 ${
          language === 'python'
            ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-600'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <span className="text-base">🐍</span>
        Python
      </button>
      <button
        onClick={() => handleLanguageChange('typescript')}
        disabled={runner.isRunning || runner.isLoading}
        className={`px-3 py-1.5 rounded text-sm font-medium transition-all duration-200 flex items-center gap-1.5 ${
          language === 'typescript'
            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-600'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <span className="text-base">📘</span>
        TypeScript
      </button>
    </div>
  );

  const headerSlot = isEditingName ? (
    <>
      <input 
        value={tempName} 
        onChange={e => setTempName(e.target.value)} 
        className="bg-gray-700 text-white px-2 py-1 rounded text-center w-full" 
      />
      <button onClick={handleSaveName} className="p-1 text-green-400"><Check className="h-4 w-4"/></button>
      <button onClick={() => setIsEditingName(false)} className="p-1 text-red-400"><X className="h-4 w-4"/></button>
    </>
  ) : (
    <div className="flex flex-col items-start gap-2">
        <div className="flex items-center gap-2">
            <h2 className="text-lg font-medium text-white truncate">{projectName}</h2>
            <button onClick={() => { setTempName(projectName); setIsEditingName(true); }} className="p-1 text-gray-400 hover:text-gray-200"><Edit2 className="h-4 w-4"/></button>
        </div>
        <div className="flex items-center gap-2">
            {languageSelector}
            {token && (
                <span className="text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full flex items-center gap-1 border border-blue-500/20">
                    <FileDown className="h-3 w-3" /> Read-Only Snippet (Edits are local)
                </span>
            )}
        </div>
    </div>
  );

  const drawingSlot = (
      <div className="flex items-center space-x-1 p-1 bg-gray-700 rounded-lg">
          <input type="color" value={canvas.drawColor} onChange={e => canvas.setDrawColor(e.target.value)} className="w-9 h-9 p-1 bg-transparent border-none cursor-pointer hover:bg-gray-600 rounded transition-colors" />
          <button onClick={() => canvas.setDrawingMode(canvas.drawingMode === 'pen' ? 'none' : 'pen')} className={`p-2 rounded ${canvas.drawingMode === 'pen' ? 'bg-blue-500 text-white' : 'hover:bg-gray-600'}`}><Pencil className="h-4 w-4"/></button>
          <button onClick={() => canvas.setDrawingMode(canvas.drawingMode === 'highlight' ? 'none' : 'highlight')} className={`p-2 rounded ${canvas.drawingMode === 'highlight' ? 'bg-blue-500 text-white' : 'hover:bg-gray-600'}`}><Highlighter className="h-4 w-4"/></button>
          <button onClick={() => canvas.setDrawingMode(canvas.drawingMode === 'erase' ? 'none' : 'erase')} className={`p-2 rounded ${canvas.drawingMode === 'erase' ? 'bg-blue-500 text-white' : 'hover:bg-gray-600'}`}><Eraser className="h-4 w-4"/></button>
          <div className="w-px h-4 bg-gray-600 mx-1"></div>
          <button onClick={canvas.undo} disabled={!canvas.canUndo} className="p-2 hover:bg-gray-600 rounded disabled:opacity-30 text-gray-300"><RotateCcw className="h-4 w-4"/></button>
          <button onClick={canvas.redo} disabled={!canvas.canRedo} className="p-2 hover:bg-gray-600 rounded disabled:opacity-30 text-gray-300"><RotateCw className="h-4 w-4"/></button>
          <div className="w-px h-4 bg-gray-600 mx-1"></div>
          <button onClick={() => canvas.setShowDrawings(!canvas.showDrawings)} className="p-2 hover:bg-gray-600 rounded text-gray-300">{canvas.showDrawings ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}</button>
          <button onClick={canvas.clearDrawings} className="p-2 hover:bg-red-500/50 rounded text-red-400"><Trash2 className="h-4 w-4"/></button>
      </div>
  );

  const editorSlot = (
    <div className="h-full relative flex flex-col" ref={canvas.containerRef}>
      
      {/* Loading Overlay for Snippets */}
      {isLoadingSnippet && (
         <div className="absolute inset-0 z-50 bg-gray-900 flex items-center justify-center">
            <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
                <p className="text-gray-400 text-sm">Loading Snippet...</p>
            </div>
         </div>
      )}

      {/* CANVAS OVERLAY */}
      <canvas
        ref={canvas.canvasRef}
        {...canvas.handlers}
        className="absolute inset-0 z-10 w-full h-full"
        style={{ 
            pointerEvents: canvas.drawingMode === 'none' ? 'none' : 'auto',
            cursor: canvas.drawingMode === 'none' ? 'default' : 'crosshair'
        }}
      />

      <CodeMirror
        value={code}
        height="100%"
        className="h-full text-sm"
        theme={oneDark}
        extensions={[languageExtension, errorLineField]}
        onChange={(value) => {
          setCode(value);
          if (runner.errorLine) runner.setErrorLine(null);
        }}
        onCreateEditor={(view) => { editorViewRef.current = view; }}
        basicSetup={{
          lineNumbers: true, foldGutter: true, dropCursor: false, allowMultipleSelections: false, indentOnInput: true, bracketMatching: true, closeBrackets: true, autocompletion: true, highlightSelectionMatches: true, searchKeymap: true,
        }}
      />
    </div>
  );

  const consoleSlot = runner.consoleOutput.length === 0 ? (
    <div className="text-gray-500 italic">Console output will appear here...</div>
  ) : (
    runner.consoleOutput.map(e => (
      <div key={e.id} className="flex items-start space-x-2 py-1">
        <span className="text-gray-500 text-xs mt-0.5 min-w-[60px]">{e.timestamp.toLocaleTimeString([], {hour12:false, hour:'2-digit', minute:'2-digit', second:'2-digit'})}</span>
        <span className="text-xs mt-0.5">{e.type==='error'?'❌':e.type==='input'?'▶️':e.type==='system'?'⚙️':''}</span>
        <pre className={`flex-1 whitespace-pre-wrap break-words ${e.type === 'error' ? 'text-red-400' : e.type === 'input' ? 'text-blue-400' : e.type === 'system' ? 'text-yellow-400' : 'text-white'}`}>{e.content}</pre>
      </div>
    ))
  );

  const inputSlot = runner.waitingForInput && (
    <div className="border-t border-gray-700 bg-gray-800 p-3">
      <div className="flex items-center space-x-2">
        <input 
          ref={runner.inputRef} 
          onKeyDown={e => e.key === 'Enter' && (runner.submitInput(e.target.value), e.target.value='')} 
          className="flex-1 bg-gray-700 text-white px-3 py-2 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" 
          placeholder="Enter input..." 
        />
        <button 
          onClick={() => { if(runner.inputRef.current) runner.submitInput(runner.inputRef.current.value); }} 
          className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
        >
          <Send className="h-4 w-4"/>
        </button>
      </div>
      <div className="text-xs text-gray-400 mt-1">Press Enter to send input</div>
    </div>
  );

  return (
    <CodeLayout 
      // Mode
      isOfflineMode={true}
      
      // Header
      headerContent={headerSlot}
      // If viewing snippet (token present), 'Back' should probably go to login/home instead of just browser back
      onBack={() => navigate(token ? '/login' : -1)} 
      isConnected={true}
      connectionText={token ? "Snippet Mode" : "Local Mode"}
      
      // Editor
      editorContent={editorSlot}
      
      // Drawing Controls
      drawingControls={drawingSlot}
      
      // Console
      consoleContent={consoleSlot}
      onClearConsole={runner.clearConsole}
      inputContent={inputSlot}
      
      // Plot
      plotContent={runner.plotSrc ? (
        <img 
          src={runner.plotSrc} 
          alt="Plot" 
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', background: 'white' }} 
        />
      ) : null}
      
      // No chat/voice in offline mode
      chatContent={null}
      chatInputContent={null}
      voiceControls={null}
      connectedUsers={[]}
    
      // Execution
      isLoading={runner.isLoading}
      isRunning={runner.isRunning}
      onRun={() => runner.runCode(code)}
      onStop={runner.stopCode}
      onDownloadOption={handleDownload}
      
      // Language
      language={language}
    />
  );
}