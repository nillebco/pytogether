import { useState, useEffect, useRef, useCallback } from "react";
import { runCodeTask, taskClient } from "../tsrunner/TaskClient.js";

export function useTsRunner() {
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState([]);
  const [errorLine, setErrorLine] = useState(null);

  const terminalRef = useRef(null);

  const clearConsole = useCallback(() => {
    setConsoleOutput([]);
  }, []);

  const addConsoleEntry = useCallback((content, type = 'output', timestamp = new Date()) => {
    setConsoleOutput(prev => [...prev, { id: Date.now() + Math.random(), content, type, timestamp }]);
  }, []);

  // Initialize TypeScript runtime
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      addConsoleEntry("Loading TypeScript runtime...", "system");
      try {
        await taskClient.ensureWorker();
        const proxy = await taskClient.ensureWorker();
        await proxy.init();
        addConsoleEntry("TypeScript runtime loaded.", "system");
      } catch (err) {
        addConsoleEntry(`Failed to load: ${err.message}`, "error");
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [addConsoleEntry]);

  // Configure callbacks
  useEffect(() => {
    terminalRef.current = {
      pushToStdout: (parts) => {
        parts.forEach(part => {
          if (part.type === 'internal_error') {
            addConsoleEntry(part.text, "error");
            // Try to extract line number from error
            const lineMatch = part.text.match(/Line (\d+):/);
            if (lineMatch) {
              setErrorLine(parseInt(lineMatch[1]));
            }
          } else {
            addConsoleEntry(part.text, "output");
          }
        });
      },
      clearStdout: () => {
        setConsoleOutput([]);
      },
    };
  }, [addConsoleEntry]);

  const runCode = async (codeString) => {
    if (isLoading || isRunning) return;
    setIsRunning(true);
    setErrorLine(null);
    addConsoleEntry(">>> Running...", "input");

    try {
      await runCodeTask(
        { input: codeString },
        (parts) => terminalRef.current.pushToStdout(parts),
        () => {}
      );
      addConsoleEntry(">>> Completed", "system");
    } catch (err) {
      addConsoleEntry(err.toString(), "error");
    } finally {
      setIsRunning(false);
    }
  };

  const stopCode = () => {
    taskClient.interrupt();
    setIsRunning(false);
    addConsoleEntry(">>> Stopped by user", "system");
  };

  return {
    isLoading,
    isRunning,
    waitingForInput: false, // TypeScript doesn't support input() like Python
    consoleOutput,
    plotSrc: null, // No plotting support yet
    errorLine,
    inputRef: useRef(null),
    runCode,
    stopCode,
    submitInput: () => {}, // No-op for TypeScript
    setConsoleOutput,
    setErrorLine,
    clearConsole
  };
}

