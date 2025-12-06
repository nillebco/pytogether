/* eslint-disable */
import * as Comlink from 'comlink';
import ts from 'typescript';

let initialized = false;

// Capture console output for the sandboxed environment
// Returns both the console object and a function to flush pending outputs
function createSandboxedConsole(outputCallback) {
  const pendingOutputs = [];
  
  const formatArgs = (args) => args.map(arg => {
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg, null, 2);
      } catch {
        return String(arg);
      }
    }
    return String(arg);
  }).join(' ');

  const queueOutput = (parts) => {
    const promise = outputCallback(parts);
    pendingOutputs.push(promise);
    return promise;
  };

  const console = {
    log: (...args) => queueOutput([{ type: 'output', text: formatArgs(args) + '\n' }]),
    error: (...args) => queueOutput([{ type: 'internal_error', text: formatArgs(args) + '\n' }]),
    warn: (...args) => queueOutput([{ type: 'output', text: '⚠️ ' + formatArgs(args) + '\n' }]),
    info: (...args) => queueOutput([{ type: 'output', text: 'ℹ️ ' + formatArgs(args) + '\n' }]),
    debug: (...args) => queueOutput([{ type: 'output', text: '🐛 ' + formatArgs(args) + '\n' }]),
    table: (data) => queueOutput([{ type: 'output', text: JSON.stringify(data, null, 2) + '\n' }]),
    clear: () => {},
    assert: (condition, ...args) => {
      if (!condition) {
        queueOutput([{ type: 'internal_error', text: 'Assertion failed: ' + formatArgs(args) + '\n' }]);
      }
    },
  };

  const flush = () => Promise.all(pendingOutputs);

  return { console, flush };
}

async function init() {
  if (initialized) return;
  console.log("Initializing TypeScript runtime...");
  initialized = true;
  console.log("TypeScript runtime ready.");
}

async function runCode(extras, entry, outputCallback, inputCallback) {
  const tsCode = entry.input;

  try {
    // 1. Transpile TypeScript to JavaScript
    const result = ts.transpileModule(tsCode, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2020,
        strict: false, // Less strict for playground use
        esModuleInterop: true,
        skipLibCheck: true,
        noEmit: false,
        sourceMap: false,
      },
      reportDiagnostics: true,
    });

    // 2. Check for TypeScript errors
    if (result.diagnostics && result.diagnostics.length > 0) {
      const errors = result.diagnostics.map(d => {
        const message = ts.flattenDiagnosticMessageText(d.messageText, '\n');
        const line = d.file ? d.file.getLineAndCharacterOfPosition(d.start).line + 1 : '?';
        return `Line ${line}: ${message}`;
      }).join('\n');
      
      outputCallback([{ type: 'internal_error', text: `TypeScript Errors:\n${errors}\n` }]);
      return;
    }

    const jsCode = result.outputText;

    // 3. Create sandboxed console with flush capability
    const { console: sandboxConsole, flush } = createSandboxedConsole(outputCallback);

    // 4. Create a sandboxed execution environment
    // We wrap the code in an async IIFE to support top-level await
    const wrappedCode = `
      return (async () => {
        ${jsCode}
      })();
    `;

    // 5. Execute with limited globals
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    const fn = new AsyncFunction(
      'console',
      'setTimeout',
      'setInterval',
      'clearTimeout',
      'clearInterval',
      'fetch',
      'Math',
      'Date',
      'JSON',
      'Array',
      'Object',
      'String',
      'Number',
      'Boolean',
      'Map',
      'Set',
      'Promise',
      'RegExp',
      'Error',
      'TypeError',
      'RangeError',
      'SyntaxError',
      wrappedCode
    );

    await fn(
      sandboxConsole,
      setTimeout,
      setInterval,
      clearTimeout,
      clearInterval,
      fetch,
      Math,
      Date,
      JSON,
      Array,
      Object,
      String,
      Number,
      Boolean,
      Map,
      Set,
      Promise,
      RegExp,
      Error,
      TypeError,
      RangeError,
      SyntaxError
    );

    // 6. Wait for all console outputs to be sent
    await flush();

  } catch (err) {
    // Extract line number from error if possible
    const errorText = err.stack || err.toString();
    await outputCallback([{ type: 'internal_error', text: errorText + '\n' }]);
  }
}

Comlink.expose({ init, runCode });

