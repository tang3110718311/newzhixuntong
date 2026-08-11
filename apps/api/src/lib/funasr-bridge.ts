import WebSocket from "ws";

const WS_SEND_CHUNK_SIZE = 1024 * 16;

/**
 * 通过智训通自有 FunASR 桥接服务(旧版语音服务,wss://host:8765)转写。
 * 协议(与旧版 H5/App 一致):连接后分块发送 16kHz/16bit PCM 二进制,
 * 服务端回传 JSON {"asr_result": "...", "status": "complete"},
 * 发送 {"command":"stop"} 通知停止并取完整结果。
 * 依赖 ws 包(已加入根 package.json dependencies)。
 */
export async function transcribeViaFunasrBridge(bridgeUrl: string, audio: Buffer, timeoutMs = 45000): Promise<string> {
  return new Promise((resolve, reject) => {
    let ws: WebSocket | null = null;
    let settled = false;
    let finalText = "";

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { ws?.close(); } catch { /* noop */ }
      reject(new Error("连接 FunASR 桥接服务超时。"));
    }, timeoutMs);

    const finish = (text: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws?.close(); } catch { /* noop */ }
      resolve(text);
    };

    try {
      ws = new WebSocket(bridgeUrl);
    } catch (error) {
      clearTimeout(timer);
      reject(error instanceof Error ? error : new Error("创建 WebSocket 失败。"));
      return;
    }

    ws.onopen = () => {
      try {
        for (let i = 0; i < audio.length; i += WS_SEND_CHUNK_SIZE) {
          const chunk = audio.subarray(i, Math.min(i + WS_SEND_CHUNK_SIZE, audio.length));
          ws?.send(chunk);
        }
        // 追加 1 秒静音,帮助 FunASR 检测语音结束并触发 offline 完整结果
        ws?.send(Buffer.alloc(16000));
        // 关键:不能立即发 stop!桥接服务收到 stop 会立刻结束连接,
        // 导致在 FunASR 返回结果前客户端就断开。延迟 ~3s 给识别留时间。
        setTimeout(() => {
          try {
            ws?.send(JSON.stringify({ command: "stop" }));
          } catch { /* noop */ }
        }, 3000);
      } catch {
        finish("");
      }
    };

    ws.onmessage = (event: WebSocket.MessageEvent) => {
      const raw = typeof event.data === "string" ? event.data : event.data.toString("utf8");
      try {
        const msg = JSON.parse(raw) as { asr_result?: string; status?: string };
        if (typeof msg.asr_result === "string" && msg.asr_result.length > 0) {
          // 桥接服务每个中间结果都带 status:"complete",只能取最后一个收敛文本
          finalText = msg.asr_result;
        }
      } catch {
        // 非 JSON 消息(如二进制)忽略
      }
    };

    ws.onerror = (event: WebSocket.ErrorEvent) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws?.close(); } catch { /* noop */ }
      reject(event.error || new Error("连接 FunASR 桥接服务失败。"));
    };

    ws.onclose = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(finalText || "");
    };
  });
}
