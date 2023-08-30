import { test } from "@jest/globals";
import { OpenAI } from "../../llms/openai.js";
import { ChatOpenAI } from "../../chat_models/openai.js";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  PromptTemplate,
} from "../../prompts/index.js";
import { LLMChain } from "../llm_chain.js";
import { loadChain } from "../load.js";
import { BufferMemory } from "../../memory/buffer_memory.js";

test("Test OpenAI", async () => {
  const model = new OpenAI({ modelName: "text-ada-001" });
  const prompt = new PromptTemplate({
    template: "Print {foo}",
    inputVariables: ["foo"],
  });
  const chain = new LLMChain({ prompt, llm: model });
  const res = await chain.call({ foo: "my favorite color" });
  console.log({ res });
});

test("Test OpenAI with timeout", async () => {
  const model = new OpenAI({ modelName: "text-ada-001" });
  const prompt = new PromptTemplate({
    template: "Print {foo}",
    inputVariables: ["foo"],
  });
  const chain = new LLMChain({ prompt, llm: model });
  await expect(() =>
    chain.call({
      foo: "my favorite color",
      timeout: 10,
    })
  ).rejects.toThrow();
});

test("Test run method", async () => {
  const model = new OpenAI({ modelName: "text-ada-001" });
  const prompt = new PromptTemplate({
    template: "Print {foo}",
    inputVariables: ["foo"],
  });
  const chain = new LLMChain({ prompt, llm: model });
  const res = await chain.run("my favorite color");
  console.log({ res });
});

test("Test run method", async () => {
  const model = new OpenAI({ modelName: "text-ada-001" });
  const prompt = new PromptTemplate({
    template: "{history} Print {foo}",
    inputVariables: ["foo", "history"],
  });
  const chain = new LLMChain({
    prompt,
    llm: model,
    memory: new BufferMemory(),
  });
  const res = await chain.run("my favorite color");
  console.log({ res });
});

test("Test memory + cancellation", async () => {
  const model = new OpenAI({ modelName: "text-ada-001" });
  const prompt = new PromptTemplate({
    template: "{history} Print {foo}",
    inputVariables: ["foo", "history"],
  });
  const chain = new LLMChain({
    prompt,
    llm: model,
    memory: new BufferMemory(),
  });
  await expect(() =>
    chain.call({
      foo: "my favorite color",
      signal: AbortSignal.timeout(20),
    })
  ).rejects.toThrow(/AbortError|Cancel/);
});

test("Test memory + timeout", async () => {
  const model = new OpenAI({ modelName: "text-ada-001" });
  const prompt = new PromptTemplate({
    template: "{history} Print {foo}",
    inputVariables: ["foo", "history"],
  });
  const chain = new LLMChain({
    prompt,
    llm: model,
    memory: new BufferMemory(),
  });
  await expect(() =>
    chain.call({
      foo: "my favorite color",
      timeout: 20,
    })
  ).rejects.toThrow(/AbortError|Cancel/);
});

test("Test apply", async () => {
  const model = new OpenAI({ modelName: "text-ada-001" });
  const prompt = new PromptTemplate({
    template: "Print {foo}",
    inputVariables: ["foo"],
  });
  const chain = new LLMChain({ prompt, llm: model });
  const res = await chain.apply([{ foo: "my favorite color" }]);
  console.log({ res });
});

test("Load chain from hub", async () => {
  const chain = await loadChain("lc://chains/hello-world/chain.json");
  const res = await chain.call({ topic: "my favorite color" });
  console.log({ res });
});

test("Test LLMChain with ChatOpenAI", async () => {
  const model = new ChatOpenAI({ temperature: 0.9 });
  const template = "What is a good name for a company that makes {product}?";
  const prompt = new PromptTemplate({ template, inputVariables: ["product"] });
  const humanMessagePrompt = new HumanMessagePromptTemplate(prompt);
  const chatPromptTemplate = ChatPromptTemplate.fromPromptMessages([
    humanMessagePrompt,
  ]);
  const chatChain = new LLMChain({ llm: model, prompt: chatPromptTemplate });
  const res = await chatChain.call({ product: "colorful socks" });
  console.log({ res });
});

test("Test deserialize", async () => {
  const model = new ChatOpenAI();
  const prompt = new PromptTemplate({
    template: "Print {foo}",
    inputVariables: ["foo"],
  });
  const chain = new LLMChain({ prompt, llm: model });

  const serialized = chain.serialize();
  // console.log(serialized)
  const chain2 = await LLMChain.deserialize({ ...serialized });

  const res = await chain2.run("my favorite color");
  console.log({ res });

  // chain === chain2?
});
