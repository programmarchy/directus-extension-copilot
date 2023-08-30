import { OpenAI } from "langchain/llms/openai";
import { PromptTemplate } from "langchain/prompts";
import { LLMChain } from "langchain/chains";

// We can construct an LLMChain from a PromptTemplate and an LLM.
const model = new OpenAI({ temperature: 0 });
const prompt = PromptTemplate.fromTemplate(
  "What is a good name for a company that makes {product}?"
);
const chainA = new LLMChain({ llm: model, prompt });

// The result is an object with a `text` property.
const resA = await chainA.call({ product: "colorful socks" });
console.log({ resA });
// { resA: { text: '\n\nSocktastic!' } }

// Since this LLMChain is a single-input, single-output chain, we can also `run` it.
// This convenience method takes in a string and returns the value
// of the output key field in the chain response. For LLMChains, this defaults to "text".
const resA2 = await chainA.run("colorful socks");
console.log({ resA2 });
// { resA2: '\n\nSocktastic!' }
