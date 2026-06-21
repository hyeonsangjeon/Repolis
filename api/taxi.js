// Repolis taxi → Azure OpenAI proxy (Vercel serverless function).
//
// The public Repolis site (GitHub Pages) cannot hold a secret key, so "AI 프록시"
// mode (Mode C) calls this tiny function instead. It forwards the visitor's
// question + the public repo catalog to Azure OpenAI and returns a repo pick.
//
// Required environment variables (set in Vercel project settings):
//   AZURE_OPENAI_ENDPOINT      e.g. https://my-resource.openai.azure.com
//   AZURE_OPENAI_DEPLOYMENT    your chat deployment name (e.g. gpt-4o-mini)
//   AZURE_OPENAI_KEY           the API key
//   AZURE_OPENAI_API_VERSION   optional (default 2024-08-01-preview)
//   ALLOW_ORIGIN               optional, e.g. https://hyeonsangjeon.github.io

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOW_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    const { question, repos } = req.body || {};
    if (!question) return res.status(400).json({ error: "question required" });

    const catalog = (repos || [])
      .map(
        (r) =>
          `- ${r.repo} | ${r.lang} | ★${r.stars} 👁${r.visitors} ⑂${r.forks} | ${(r.topics || []).join(",")} | ${r.desc || ""}`
      )
      .join("\n");

    const sys =
      "너는 Repolis(내 모든 GitHub 레포가 사는 도시)의 친절한 택시기사야. " +
      "아래 목록에서 사용자의 요청에 가장 잘 맞는 레포 하나를 골라 한국어로 짧고 상냥하게 추천해. " +
      '반드시 JSON 하나만 출력해: {"repo":"<레포이름>","message":"<추천 멘트>"}\n\n[레포목록]\n' +
      catalog;

    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const deploy = process.env.AZURE_OPENAI_DEPLOYMENT;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-08-01-preview";
    if (!endpoint || !deploy || !process.env.AZURE_OPENAI_KEY) {
      return res.status(500).json({ error: "proxy not configured (missing Azure env vars)" });
    }

    const url = `${endpoint}/openai/deployments/${deploy}/chat/completions?api-version=${apiVersion}`;
    const az = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": process.env.AZURE_OPENAI_KEY },
      body: JSON.stringify({
        messages: [
          { role: "system", content: sys },
          { role: "user", content: String(question).slice(0, 500) },
        ],
        temperature: 0.5,
        max_tokens: 320,
        response_format: { type: "json_object" },
      }),
    });

    if (!az.ok) {
      const detail = (await az.text()).slice(0, 240);
      return res.status(502).json({ error: "azure " + az.status, detail });
    }

    const data = await az.json();
    const txt = data.choices?.[0]?.message?.content || "{}";
    let parsed;
    try {
      parsed = JSON.parse(txt);
    } catch {
      parsed = { message: txt };
    }
    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
