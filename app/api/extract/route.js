import { NextResponse } from "next/server";

export async function POST(request) {
  const { image } = await request.json();

  // If OPENAI_API_KEY is set, use GPT-4o Vision for real extraction
  if (process.env.OPENAI_API_KEY) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: 'Extract invoice data from this image. Return ONLY a JSON object with these keys: company (string), amount (number, no currency symbols), date (YYYY-MM-DD), invoiceNumber (string). If a field is not found, use an empty string or 0.',
                },
                {
                  type: "image_url",
                  image_url: { url: image },
                },
              ],
            },
          ],
          max_tokens: 300,
        }),
      });

      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content?.trim() ?? "";
      // Strip markdown code fences if present
      const json = raw.replace(/^```json\s*|^```\s*|\s*```$/g, "").trim();
      const extracted = JSON.parse(json);
      return NextResponse.json(extracted);
    } catch (err) {
      console.error("OpenAI extraction error:", err);
    }
  }

  // Fallback: return blanks so the user can fill in manually
  return NextResponse.json({
    company: "",
    amount: 0,
    date: new Date().toISOString().split("T")[0],
    invoiceNumber: "",
  });
}
