/**
 * 智谱 AI 对话补全接口封装
 * 文档: https://open.bigmodel.cn/dev/api
 */

const ZHIPU_CHAT_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

export type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };

export async function chatWithZhipu(messages: ChatMessage[]): Promise<string> {
  const apiKey = import.meta.env.VITE_ZHIPU_API_KEY;
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
    throw new Error('未配置智谱 API Key，请在项目根目录 .env 中设置 VITE_ZHIPU_API_KEY');
  }
  // 智谱要求 system 消息作为 messages 第一条，否则系统提示词可能不生效
  if (messages.length > 0 && messages[0].role !== 'system') {
    console.warn('[chatWithZhipu] 首条消息应为 role: "system"，当前为', messages[0].role);
  }

  const res = await fetch(ZHIPU_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: 'glm-4-flash',
      messages,
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`智谱 API 请求失败 (${res.status}): ${errText || res.statusText}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string }; delta?: { content?: string } }>;
    error?: { message?: string };
  };

  if (data.error?.message) {
    throw new Error(data.error.message);
  }

  const content = data.choices?.[0]?.message?.content;
  if (content == null) {
    throw new Error('智谱 API 返回内容为空');
  }
  return content;
}
