export function shouldAutoStartPractice(params: URLSearchParams): boolean {
  return Boolean(params.get("taskId"));
}

export function createAutoStartGuard() {
  let started = false;

  return {
    tryStart(): boolean {
      if (started) return false;
      started = true;
      return true;
    },
  };
}
