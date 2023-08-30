import { test } from "@jest/globals";
import { OpenAI } from "../../../llms/openai.js";
import { loadSummarizationChain } from "../load.js";
import { Document } from "../../../document.js";

test("Test loadSummzationChain stuff", async () => {
  const model = new OpenAI({ modelName: "text-ada-001" });
  const chain = loadSummarizationChain(model, { type: "stuff" });
  const docs = [
    new Document({ pageContent: "foo" }),
    new Document({ pageContent: "bar" }),
    new Document({ pageContent: "baz" }),
  ];
  const res = await chain.call({ input_documents: docs, question: "Whats up" });
  console.log({ res });
});

test("Test loadSummarizationChain map_reduce", async () => {
  const model = new OpenAI({ modelName: "text-ada-001" });
  const chain = loadSummarizationChain(model, { type: "map_reduce" });
  const docs = [
    new Document({ pageContent: "foo" }),
    new Document({ pageContent: "bar" }),
    new Document({ pageContent: "baz" }),
  ];
  const res = await chain.call({ input_documents: docs, question: "Whats up" });
  console.log({ res });
});

test("Test loadSummarizationChain refine", async () => {
  const model = new OpenAI({ modelName: "text-ada-001" });
  const chain = loadSummarizationChain(model, { type: "refine" });
  const docs = [
    new Document({ pageContent: "foo" }),
    new Document({ pageContent: "bar" }),
    new Document({ pageContent: "baz" }),
  ];
  const res = await chain.call({ input_documents: docs, question: "Whats up" });
  console.log({ res });
});
