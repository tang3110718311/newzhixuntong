export function createAsyncSubmitGuard() {
  let running = false;

  return {
    isRunning() {
      return running;
    },
    run<T>(task: () => Promise<T>): Promise<T> | undefined {
      if (running) return undefined;
      running = true;
      return task().finally(() => {
        running = false;
      });
    },
  };
}
