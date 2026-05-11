import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });
import Anthropic from "@anthropic-ai/sdk";

async function main() {
  const key = process.env.ANTHROPIC_API_KEY ?? "";
  console.log("key prefix:", key.slice(0, 20));
  console.log("key length:", key.length);
  console.log("starts with quote:", key.startsWith('"'));
  console.log("ends with quote:", key.endsWith('"'));
  const client = new Anthropic({ apiKey: key });
  const m = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 30,
    messages: [{ role: "user", content: "reply OK" }],
  });
  console.log("reply:", (m.content[0] as { text: string }).text);
}
main().catch((e) => { console.error("ERR:", e.message?.slice(0, 200)); process.exit(1); });
