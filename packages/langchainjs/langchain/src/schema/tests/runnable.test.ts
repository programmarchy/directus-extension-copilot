/* eslint-disable no-promise-executor-return */

import { z } from "zod";
import { test } from "@jest/globals";
import { LLM } from "../../llms/base.js";
import {
  BaseChatModel,
  createChatMessageChunkEncoderStream,
} from "../../chat_models/base.js";
import {
  AIMessage,
  BaseMessage,
  ChatResult,
  GenerationChunk,
} from "../index.js";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  PromptTemplate,
  SystemMessagePromptTemplate,
} from "../../prompts/index.js";
import { StructuredOutputParser } from "../../output_parsers/structured.js";
import { RunnableMap, RunnableSequence, RouterRunnable } from "../runnable.js";
import { BaseRetriever } from "../retriever.js";
import { Document } from "../../document.js";
import { OutputParserException, StringOutputParser } from "../output_parser.js";

class FakeLLM extends LLM {
  response?: string;

  thrownErrorString?: string;

  constructor(fields: { response?: string; thrownErrorString?: string }) {
    super({});
    this.response = fields.response;
    this.thrownErrorString = fields.thrownErrorString;
  }

  _llmType() {
    return "fake";
  }

  async _call(prompt: string): Promise<string> {
    if (this.thrownErrorString) {
      throw new Error(this.thrownErrorString);
    }
    return this.response ?? prompt;
  }
}

class FakeStreamingLLM extends LLM {
  _llmType() {
    return "fake";
  }

  async _call(prompt: string): Promise<string> {
    return prompt;
  }

  async *_streamResponseChunks(input: string) {
    for (const c of input) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      yield { text: c, generationInfo: {} } as GenerationChunk;
    }
  }
}

class FakeChatModel extends BaseChatModel {
  _combineLLMOutput() {
    return [];
  }

  _llmType(): string {
    return "fake";
  }

  async _generate(
    messages: BaseMessage[],
    options?: this["ParsedCallOptions"]
  ): Promise<ChatResult> {
    if (options?.stop?.length) {
      return {
        generations: [
          {
            message: new AIMessage(options.stop[0]),
            text: options.stop[0],
          },
        ],
      };
    }
    const text = messages.map((m) => m.content).join("\n");
    return {
      generations: [
        {
          message: new AIMessage(text),
          text,
        },
      ],
      llmOutput: {},
    };
  }
}

class FakeRetriever extends BaseRetriever {
  lc_namespace = ["test", "fake"];

  async _getRelevantDocuments(
    _query: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<Document<Record<string, any>>[]> {
    return [
      new Document({ pageContent: "foo" }),
      new Document({ pageContent: "bar" }),
    ];
  }
}

test("Test batch", async () => {
  const llm = new FakeLLM({});
  const results = await llm.batch(["Hi there!", "Hey hey"]);
  expect(results.length).toBe(2);
});

test("Test stream", async () => {
  const llm = new FakeLLM({});
  const stream = await llm.stream("Hi there!");
  const reader = stream
    .pipeThrough(new TextEncoderStream())
    .pipeThrough(new TextDecoderStream())
    .getReader();
  let done = false;
  while (!done) {
    const chunk = await reader.read();
    done = chunk.done;
  }
});

test("Test chat model stream", async () => {
  const llm = new FakeChatModel({});
  const stream = await llm.stream("Hi there!");
  const reader = stream
    .pipeThrough(createChatMessageChunkEncoderStream())
    .pipeThrough(new TextDecoderStream())
    .getReader();
  let done = false;
  while (!done) {
    const chunk = await reader.read();
    console.log(chunk);
    done = chunk.done;
  }
});

test("Pipe from one runnable to the next", async () => {
  const promptTemplate = PromptTemplate.fromTemplate("{input}");
  const llm = new FakeLLM({});
  const runnable = promptTemplate.pipe(llm);
  const result = await runnable.invoke({ input: "Hello world!" });
  console.log(result);
  expect(result).toBe("Hello world!");
});

test("Create a runnable sequence and run it", async () => {
  const promptTemplate = PromptTemplate.fromTemplate("{input}");
  const llm = new FakeChatModel({});
  const parser = StructuredOutputParser.fromZodSchema(
    z.object({ outputValue: z.string().describe("A test value") })
  );
  const text = `\`\`\`
{"outputValue": "testing"}
\`\`\``;
  const runnable = promptTemplate.pipe(llm).pipe(parser);
  const result = await runnable.invoke({ input: text });
  console.log(result);
  expect(result).toEqual({ outputValue: "testing" });
});

test("Create a runnable sequence with a static method with invalid output and catch the error", async () => {
  const promptTemplate = PromptTemplate.fromTemplate("{input}");
  const llm = new FakeChatModel({});
  const parser = StructuredOutputParser.fromZodSchema(
    z.object({ outputValue: z.string().describe("A test value") })
  );
  const runnable = RunnableSequence.from([promptTemplate, llm, parser]);
  await expect(async () => {
    const result = await runnable.invoke({ input: "Hello sequence!" });
    console.log(result);
  }).rejects.toThrow(OutputParserException);
});

test("Create a runnable sequence with a runnable map", async () => {
  const promptTemplate = ChatPromptTemplate.fromPromptMessages<{
    documents: string;
    question: string;
  }>([
    SystemMessagePromptTemplate.fromTemplate(`You are a nice assistant.`),
    HumanMessagePromptTemplate.fromTemplate(
      `Context:\n{documents}\n\nQuestion:\n{question}`
    ),
  ]);
  const llm = new FakeChatModel({});
  const inputs = {
    question: (input: string) => input,
    documents: RunnableSequence.from([
      new FakeRetriever(),
      (docs: Document[]) => JSON.stringify(docs),
    ]),
    extraField: new FakeLLM({}),
  };
  const runnable = new RunnableMap({ steps: inputs })
    .pipe(promptTemplate)
    .pipe(llm);
  const result = await runnable.invoke("Do you know the Muffin Man?");
  console.log(result);
  expect(result.content).toEqual(
    `You are a nice assistant.\nContext:\n[{"pageContent":"foo","metadata":{}},{"pageContent":"bar","metadata":{}}]\n\nQuestion:\nDo you know the Muffin Man?`
  );
});

test("Bind kwargs to a runnable", async () => {
  const llm = new FakeChatModel({});
  const result = await llm
    .bind({ stop: ["testing"] })
    .pipe(new StringOutputParser())
    .invoke("Hi there!");
  console.log(result);
  expect(result).toEqual("testing");
});

test("Bind kwargs to a runnable with a batch call", async () => {
  const llm = new FakeChatModel({});
  const result = await llm
    .bind({ stop: ["testing"] })
    .pipe(new StringOutputParser())
    .batch(["Hi there!", "hey hey", "Hi there!", "hey hey"]);
  console.log(result);
  expect(result).toEqual(["testing", "testing", "testing", "testing"]);
});

test("Stream the entire way through", async () => {
  const llm = new FakeStreamingLLM({});
  const stream = await llm.pipe(new StringOutputParser()).stream("Hi there!");
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
    console.log(chunk);
  }
  expect(chunks.length).toEqual("Hi there!".length);
  expect(chunks.join("")).toEqual("Hi there!");
});

test("Don't use intermediate streaming", async () => {
  const llm = new FakeStreamingLLM({});
  const stream = await llm
    .pipe(new StringOutputParser())
    .pipe(new FakeLLM({}))
    .stream("Hi there!");
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
    console.log(chunk);
  }
  expect(chunks.length).toEqual(1);
  expect(chunks[0]).toEqual("Hi there!");
});

test("Router runnables", async () => {
  const mathLLM = new FakeLLM({});
  mathLLM.response = "I am a math genius!";
  const chain1 = PromptTemplate.fromTemplate(
    "You are a math genius. Answer the question: {question}"
  ).pipe(mathLLM);
  const englishLLM = new FakeLLM({});
  englishLLM.response = "I am an English genius!";
  const chain2 = PromptTemplate.fromTemplate(
    "You are an english major. Answer the question: {question}"
  ).pipe(englishLLM);
  const router = new RouterRunnable({
    runnables: { math: chain1, english: chain2 },
  });
  type RouterChainInput = {
    key: string;
    question: string;
  };
  const chain = RunnableSequence.from([
    {
      key: (x: RouterChainInput) => x.key,
      input: { question: (x: RouterChainInput) => x.question },
    },
    router,
  ]);
  const result = await chain.invoke({ key: "math", question: "2 + 2" });
  expect(result).toEqual("I am a math genius!");

  const result2 = await chain.batch([
    {
      key: "math",
      question: "2 + 2",
    },
    {
      key: "english",
      question: "2 + 2",
    },
  ]);
  expect(result2).toEqual(["I am a math genius!", "I am an English genius!"]);
});

test("RunnableWithFallbacks", async () => {
  const llm = new FakeLLM({
    thrownErrorString: "Bad error!",
  });
  await expect(async () => {
    const result1 = await llm.invoke("What up");
    console.log(result1);
  }).rejects.toThrow();
  const llmWithFallbacks = llm.withFallbacks({
    fallbacks: [new FakeLLM({})],
  });
  const result2 = await llmWithFallbacks.invoke("What up");
  expect(result2).toEqual("What up");
});

test("RunnableWithFallbacks batch", async () => {
  const llm = new FakeLLM({
    thrownErrorString: "Bad error!",
  });
  await expect(async () => {
    const result1 = await llm.batch(["What up"]);
    console.log(result1);
  }).rejects.toThrow();
  const llmWithFallbacks = llm.withFallbacks({
    fallbacks: [new FakeLLM({})],
  });
  const result2 = await llmWithFallbacks.batch([
    "What up 1",
    "What up 2",
    "What up 3",
  ]);
  expect(result2).toEqual(["What up 1", "What up 2", "What up 3"]);
});
