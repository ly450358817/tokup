// 流式调用 /api/v1/test/chat（SSE）：边生成边回调，首个字秒出。
// 兼容降级：若后端返回非流式 JSON（旧版本/异常），自动按原格式解析。
export interface StreamTestResult {
  ok: boolean;
  content: string;
  reasoning: string;
  error?: string;
  warning?: string;
  rechargeUrl?: string;
}

export async function streamTestChat(opts: {
  model: string;
  messages: { role: string; content: string }[];
  token: string;
  onDelta?: (content: string, reasoning: string) => void;
}): Promise<StreamTestResult> {
  const { model, messages, token, onDelta } = opts;
  let res: Response;
  try {
    res = await fetch('/api/v1/test/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ model, messages, stream: true }),
    });
  } catch (e: any) {
    return { ok: false, content: '', reasoning: '', error: e?.message || '网络错误' };
  }

  if (!res.ok) {
    let detail = '请求失败';
    try {
      const j = await res.json();
      detail = j?.detail || j?.error?.message || detail;
    } catch { /* 忽略解析失败 */ }
    return { ok: false, content: '', reasoning: '', error: detail };
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('text/event-stream')) {
    // 降级：后端返回了非流式 JSON
    try {
      const j = await res.json();
      if (j?.success) {
        const content = j.data?.choices?.[0]?.message?.content || '';
        return { ok: true, content, reasoning: '' };
      }
      return { ok: false, content: '', reasoning: '', error: j?.detail || '请求失败' };
    } catch (e: any) {
      return { ok: false, content: '', reasoning: '', error: e?.message || '响应解析失败' };
    }
  }

  const reader = res.body?.getReader();
  if (!reader) {
    return { ok: false, content: '', reasoning: '', error: '浏览器不支持流式读取' };
  }

  const decoder = new TextDecoder();
  let buf = '';
  let content = '';
  let reasoning = '';
  let warning = '';
  let rechargeUrl = '';
  let streamError = '';

  const handleData = (payload: string) => {
    if (!payload || payload === '[DONE]') return;
    try {
      const obj = JSON.parse(payload);
      const delta = obj?.choices?.[0]?.delta || {};
      if (delta.content) content += delta.content;
      if (delta.reasoning_content) reasoning += delta.reasoning_content;
      else if (delta.reasoning) reasoning += delta.reasoning;
      if (obj.warning) warning = obj.warning;
      if (obj.recharge_url) rechargeUrl = obj.recharge_url;
      if (obj.error) streamError = obj.error;
      onDelta?.(content, reasoning);
    } catch { /* 忽略无法解析的行 */ }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      handleData(trimmed.slice(5).trim());
    }
  }
  // 流结束时处理可能没有换行结尾的最后一段
  if (buf.trim()) {
    const trimmed = buf.trim();
    if (trimmed.startsWith('data:')) {
      handleData(trimmed.slice(5).trim());
    }
  }

  if (streamError) {
    return { ok: false, content, reasoning, error: streamError };
  }
  return { ok: true, content, reasoning, warning, rechargeUrl };
}
