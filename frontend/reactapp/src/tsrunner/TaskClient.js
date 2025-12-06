import MyTsWorker from "./Worker.js?worker";
import * as Comlink from 'comlink';

class TsClient {
  constructor() {
    this.worker = null;
    this.workerProxy = null;
  }

  async ensureWorker() {
    if (!this.worker) {
      this.worker = new MyTsWorker();
      this.workerProxy = Comlink.wrap(this.worker);
    }
    return this.workerProxy;
  }

  async call(method, ...args) {
    const proxy = await this.ensureWorker();
    return method.call(proxy, ...args);
  }

  interrupt() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.workerProxy = null;
    }
  }
}

export const taskClient = new TsClient();

export async function runCodeTask(entry, outputCallback, inputCallback) {
  let running = true;

  function wrappedOutputCallback(...args) {
    if (running) {
      outputCallback(...args);
    }
  }

  try {
    const proxy = await taskClient.ensureWorker();
    return await proxy.runCode(
      {},
      entry,
      Comlink.proxy(wrappedOutputCallback),
      Comlink.proxy(inputCallback || (() => {})),
    );
  } catch (e) {
    if (e.message?.includes('terminated')) {
      return {
        interrupted: true,
        error: null,
        passed: false,
      };
    }
    throw e;
  } finally {
    running = false;
  }
}

