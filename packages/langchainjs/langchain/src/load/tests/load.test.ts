import { test, expect } from "@jest/globals";
import { stringify } from "yaml";
import { z } from "zod";

import { load } from "../index.js";
import { OpenAI } from "../../llms/openai.js";
import { PromptTemplate } from "../../prompts/prompt.js";
import { LLMChain } from "../../chains/llm_chain.js";
import { Cohere } from "../../llms/cohere.js";
import {
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
  ChatPromptTemplate,
} from "../../prompts/chat.js";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { LangChainTracer } from "../../callbacks/index.js";
import {
  FewShotPromptTemplate,
  LengthBasedExampleSelector,
} from "../../prompts/index.js";
import { initializeAgentExecutorWithOptions } from "../../agents/initialize.js";
import { Calculator } from "../../tools/calculator.js";
import { RequestsGetTool } from "../../tools/requests.js";
import { JsonListKeysTool, JsonSpec } from "../../tools/json.js";
import { AgentExecutor } from "../../agents/executor.js";
import { CommaSeparatedListOutputParser } from "../../output_parsers/list.js";
import { StructuredOutputParser } from "../../output_parsers/structured.js";
import { Serializable } from "../serializable.js";
import { RegexParser } from "../../output_parsers/regex.js";
import { OutputFixingParser } from "../../output_parsers/fix.js";
import { CombiningOutputParser } from "../../output_parsers/combining.js";

test("serialize + deserialize custom classes", async () => {
  class Person extends Serializable {
    lc_namespace = ["langchain", "tests"];

    get lc_secrets(): { [key: string]: string } | undefined {
      return { apiKey: "PERSON_API_KEY" };
    }

    get lc_attributes(): { [key: string]: unknown } | undefined {
      return { hello: this.hello };
    }

    lc_serializable = true;

    hello = 3;

    constructor(fields: { aField: string; apiKey: string; hello?: number }) {
      super(fields);
    }
  }

  class SpecialPerson extends Person {
    get lc_secrets(): { [key: string]: string } | undefined {
      return { anotherApiKey: "SPECIAL_PERSON_API_KEY" };
    }

    get lc_attributes(): { [key: string]: unknown } | undefined {
      return { by: this.bye };
    }

    bye = 4;

    constructor(fields: {
      aField: string;
      apiKey: string;
      anotherApiKey: string;
      hello?: number;
      bye?: number;
    }) {
      super(fields);
    }
  }

  const person = new Person({ aField: "hello", apiKey: "a-key" });
  const lc_argumentsBefore = person.lc_kwargs;
  const str = JSON.stringify(person, null, 2);
  expect(person.lc_kwargs).toEqual(lc_argumentsBefore);
  expect(stringify(JSON.parse(str))).toMatchSnapshot();
  const person2 = await load<Person>(
    str,
    {
      PERSON_API_KEY: "a-key",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      "langchain/tests": { Person },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any
  );
  expect(person2).toBeInstanceOf(Person);
  expect(JSON.stringify(person2, null, 2)).toBe(str);

  const sperson = new SpecialPerson({
    aField: "hello",
    apiKey: "a-key",
    anotherApiKey: "b-key",
  });
  const sstr = JSON.stringify(sperson, null, 2);
  expect(stringify(JSON.parse(sstr))).toMatchSnapshot();
  const sperson2 = await load<Person>(
    sstr,
    {
      PERSON_API_KEY: "a-key",
      SPECIAL_PERSON_API_KEY: "b-key",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    {
      "langchain/tests": { SpecialPerson },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any
  );
  expect(sperson2).toBeInstanceOf(SpecialPerson);
  expect(JSON.stringify(sperson2, null, 2)).toBe(sstr);
});

test("serialize + deserialize llm", async () => {
  // eslint-disable-next-line no-process-env
  process.env.OPENAI_API_KEY = "openai-key";
  const llm = new OpenAI({
    temperature: 0.5,
    modelName: "davinci",
  });
  llm.temperature = 0.7;
  const lc_argumentsBefore = llm.lc_kwargs;
  const str = JSON.stringify(llm, null, 2);
  expect(llm.lc_kwargs).toEqual(lc_argumentsBefore);
  expect(stringify(JSON.parse(str))).toMatchSnapshot();
  expect(JSON.parse(str).kwargs.temperature).toBe(0.7);
  expect(JSON.parse(str).kwargs.model).toBe("davinci");
  expect(JSON.parse(str).kwargs.openai_api_key.type).toBe("secret");
  // Accept secret in secret map
  const llm2 = await load<OpenAI>(str, {
    OPENAI_API_KEY: "openai-key",
  });
  expect(llm2).toBeInstanceOf(OpenAI);
  expect(JSON.stringify(llm2, null, 2)).toBe(str);
  // Accept secret as env var
  const llm3 = await load<OpenAI>(str);
  expect(llm3).toBeInstanceOf(OpenAI);
  expect(llm.openAIApiKey).toBe(llm3.openAIApiKey);
  expect(JSON.stringify(llm3, null, 2)).toBe(str);
});

test("serialize + deserialize llm with optional deps", async () => {
  const llm = new Cohere({ temperature: 0.5, apiKey: "cohere-key" });
  const str = JSON.stringify(llm, null, 2);
  expect(stringify(JSON.parse(str))).toMatchSnapshot();
  const llm2 = await load<Cohere>(
    str,
    { COHERE_API_KEY: "cohere-key" },
    { "langchain/llms/cohere": { Cohere } }
  );
  expect(llm2).toBeInstanceOf(Cohere);
  expect(JSON.stringify(llm2, null, 2)).toBe(str);
  const llm3 = await load<Cohere>(
    str,
    { COHERE_API_KEY: "cohere-key" },
    { "langchain/llms/cohere": import("../../llms/cohere.js") }
  );
  expect(llm3).toBeInstanceOf(Cohere);
  expect(JSON.stringify(llm3, null, 2)).toBe(str);
});

test("serialize + deserialize llm chain string prompt", async () => {
  const llm = new OpenAI({
    temperature: 0.5,
    modelName: "davinci",
    openAIApiKey: "openai-key",
    verbose: true,
    callbacks: [
      new LangChainTracer(),
      {
        handleLLMEnd(output) {
          console.log(output);
        },
      },
    ],
  });
  const prompt = PromptTemplate.fromTemplate("Hello, {name}!");
  const chain = new LLMChain({ llm, prompt });
  const str = JSON.stringify(chain, null, 2);
  expect(JSON.parse(str).kwargs.callbacks).toBeUndefined();
  expect(JSON.parse(str).kwargs.verbose).toBeUndefined();
  expect(stringify(JSON.parse(str))).toMatchSnapshot();
  const chain2 = await load<LLMChain>(str, {
    OPENAI_API_KEY: "openai-key",
  });
  expect(chain2).toBeInstanceOf(LLMChain);
  expect(JSON.stringify(chain2, null, 2)).toBe(str);
});

test("serialize + deserialize llm chain chat prompt", async () => {
  // eslint-disable-next-line no-process-env
  process.env.OPENAI_API_KEY = undefined;
  const llm = new ChatOpenAI({
    temperature: 0.5,
    modelName: "gpt-4",
    streaming: true,
    azureOpenAIApiKey: "openai-key",
    azureOpenAIApiInstanceName: "openai-instance",
    azureOpenAIApiDeploymentName: "openai-deployment",
    azureOpenAIApiVersion: "openai-version",
    prefixMessages: [
      {
        role: "system",
        content: "You're a nice assistant",
      },
    ],
  });
  const prompt = ChatPromptTemplate.fromPromptMessages([
    SystemMessagePromptTemplate.fromTemplate("You are talking to {name}."),
    HumanMessagePromptTemplate.fromTemplate("Hello, nice model."),
  ]);
  const chain = new LLMChain({ llm, prompt });
  const str = JSON.stringify(chain, null, 2);
  expect(stringify(JSON.parse(str))).toMatchSnapshot();
  const chain2 = await load<LLMChain>(str, {
    AZURE_OPENAI_API_KEY: "openai-key",
  });
  expect(chain2).toBeInstanceOf(LLMChain);
  expect(JSON.stringify(chain2, null, 2)).toBe(str);
});

test("serialize + deserialize llm chain few shot prompt w/ examples", async () => {
  const llm = new OpenAI({
    temperature: 0.5,
    modelName: "davinci",
    openAIApiKey: "openai-key",
    callbacks: [new LangChainTracer()],
  });
  const prompt = new FewShotPromptTemplate({
    examples: [{ yo: "1" }, { yo: "2" }],
    prefix: "You are a nice assistant",
    examplePrompt: PromptTemplate.fromTemplate("An example about {yo}"),
    suffix: "My name is {name}",
    inputVariables: ["yo", "name"],
  });
  const chain = new LLMChain({ llm, prompt });
  const str = JSON.stringify(chain, null, 2);
  expect(stringify(JSON.parse(str))).toMatchSnapshot();
  await expect(
    load<LLMChain>(str, {
      OPENAI_API_KEY: "openai-key",
    })
  ).rejects.toThrowError(
    'Trying to load an object that doesn\'t implement serialization: $.kwargs.prompt -> {"lc":1,"type":"not_implemented","id":["langchain","prompts","few_shot","FewShotPromptTemplate"]}'
  );
});

test("serialize + deserialize llm chain few shot prompt w/ selector", async () => {
  const llm = new OpenAI({
    temperature: 0.5,
    modelName: "davinci",
    openAIApiKey: "openai-key",
  });
  const examplePrompt = PromptTemplate.fromTemplate("An example about {yo}");
  const prompt = new FewShotPromptTemplate({
    exampleSelector: await LengthBasedExampleSelector.fromExamples(
      [{ yo: "1" }, { yo: "2" }],
      { examplePrompt }
    ),
    prefix: "You are a nice assistant",
    examplePrompt,
    suffix: "My name is {name}",
    inputVariables: ["yo", "name"],
  });
  const chain = new LLMChain({ llm, prompt });
  const str = JSON.stringify(chain, null, 2);
  expect(stringify(JSON.parse(str))).toMatchSnapshot();
  await expect(
    load<LLMChain>(str, {
      OPENAI_API_KEY: "openai-key",
    })
  ).rejects.toThrow(
    'Trying to load an object that doesn\'t implement serialization: $.kwargs.prompt -> {"lc":1,"type":"not_implemented","id":["langchain","prompts","few_shot","FewShotPromptTemplate"]}'
  );
});

test("serialize + deserialize llmchain with list output parser", async () => {
  const llm = new OpenAI({
    temperature: 0.5,
    modelName: "davinci",
    openAIApiKey: "openai-key",
    callbacks: [new LangChainTracer()],
  });
  const prompt = PromptTemplate.fromTemplate(
    "An example about {yo} {format_instructions}"
  );
  const outputParser = new CommaSeparatedListOutputParser();
  const chain = new LLMChain({ llm, prompt, outputParser });
  const str = JSON.stringify(chain, null, 2);
  expect(stringify(JSON.parse(str))).toMatchSnapshot();
  const chain2 = await load<LLMChain>(str, {
    OPENAI_API_KEY: "openai-key",
  });
  expect(chain2).toBeInstanceOf(LLMChain);
  expect(JSON.stringify(chain2, null, 2)).toBe(str);
  expect(await chain2.outputParser?.parseResult([{ text: "a, b, c" }])).toEqual(
    ["a", "b", "c"]
  );
});

test("serialize + deserialize llmchain with regex output parser", async () => {
  const llm = new OpenAI({
    temperature: 0.5,
    modelName: "davinci",
    openAIApiKey: "openai-key",
    callbacks: [new LangChainTracer()],
  });
  const prompt = PromptTemplate.fromTemplate(
    "An example about {yo} {format_instructions}"
  );
  const outputParser = new RegexParser({
    regex: /Confidence: (A|B|C), Explanation: (.*)/,
    outputKeys: ["confidence", "explanation"],
  });
  const chain = new LLMChain({ llm, prompt, outputParser });
  const str = JSON.stringify(chain, null, 2);
  expect(stringify(JSON.parse(str))).toMatchSnapshot();
  const chain2 = await load<LLMChain>(str, {
    OPENAI_API_KEY: "openai-key",
  });
  expect(chain2).toBeInstanceOf(LLMChain);
  expect(JSON.stringify(chain2, null, 2)).toBe(str);
  expect(
    await chain2.outputParser?.parseResult([
      {
        text: "Confidence: A, Explanation: Because it is the capital of France.",
      },
    ])
  ).toEqual({
    confidence: "A",
    explanation: "Because it is the capital of France.",
  });
});

test("serialize + deserialize llmchain with fix + combining output parser", async () => {
  const llm = new OpenAI({
    temperature: 0.5,
    modelName: "davinci",
    openAIApiKey: "openai-key",
    callbacks: [new LangChainTracer()],
  });
  const prompt = PromptTemplate.fromTemplate(
    "An example about {yo} {format_instructions}"
  );
  const outputParser = OutputFixingParser.fromLLM(
    llm,
    new CombiningOutputParser(
      new RegexParser({
        regex: /Number: (\d+), Word: (.*)/,
        outputKeys: ["confidence", "explanation"],
      }),
      new RegexParser({
        regex: /Confidence: (A|B|C), Explanation: (.*)/,
        outputKeys: ["confidence", "explanation"],
      })
    )
  );
  const chain = new LLMChain({ llm, prompt, outputParser });
  const str = JSON.stringify(chain, null, 2);
  expect(stringify(JSON.parse(str))).toMatchSnapshot();
  const chain2 = await load<LLMChain>(str, {
    OPENAI_API_KEY: "openai-key",
  });
  expect(chain2).toBeInstanceOf(LLMChain);
  expect(JSON.stringify(chain2, null, 2)).toBe(str);
});

test("serialize + deserialize llmchain with struct output parser throws", async () => {
  const llm = new OpenAI({
    temperature: 0.5,
    modelName: "davinci",
    openAIApiKey: "openai-key",
    callbacks: [new LangChainTracer()],
  });

  const prompt = PromptTemplate.fromTemplate(
    "An example about {yo} {format_instructions}"
  );
  const outputParser = new StructuredOutputParser(
    z.object({
      a: z.string(),
    })
  );
  const chain = new LLMChain({ llm, prompt, outputParser });
  const str = JSON.stringify(chain, null, 2);
  expect(stringify(JSON.parse(str))).toMatchSnapshot();
  await expect(
    load<LLMChain>(str, {
      OPENAI_API_KEY: "openai-key",
    })
  ).rejects.toThrow(
    'Trying to load an object that doesn\'t implement serialization: $.kwargs.output_parser -> {"lc":1,"type":"not_implemented","id":["langchain","output_parsers","structured","StructuredOutputParser"]}'
  );
});

test.skip("serialize + deserialize agent", async () => {
  const llm = new ChatOpenAI({
    temperature: 0,
    modelName: "gpt-4",
    openAIApiKey: "openai-key",
  });
  const executor = await initializeAgentExecutorWithOptions(
    [
      new Calculator(),
      new RequestsGetTool(),
      new JsonListKeysTool(new JsonSpec({ a: "b" })),
    ],
    llm,
    {
      agentType: "chat-conversational-react-description",
    }
  );
  const str = JSON.stringify(executor, null, 2);
  expect(stringify(JSON.parse(str))).toMatchSnapshot();
  const executor2 = await load<AgentExecutor>(
    str,
    { OPENAI_API_KEY: "openai-key" },
    {
      "langchain/tools/calculator": { Calculator },
    }
  );
  expect(executor2).toBeInstanceOf(AgentExecutor);
  expect(JSON.stringify(executor2, null, 2)).toBe(str);
});

test("override name of objects when serialising", async () => {
  const llm = new Cohere({ temperature: 0.5, apiKey: "cohere-key" });
  const str = JSON.stringify(llm, null, 2);

  class MangledName extends Cohere {}
  const llm2 = await load<Cohere>(
    str,
    { COHERE_API_KEY: "cohere-key" },
    { "langchain/llms/cohere": { Cohere: MangledName } }
  );
  expect(JSON.stringify(llm2, null, 2)).toBe(str);
});

test("Should load traces even if the constructor name changes (minified environments)", async () => {
  const llm = new Cohere({ temperature: 0.5, apiKey: "cohere-key" });
  Object.defineProperty(llm.constructor, "name", {
    value: "x",
  });
  const str = JSON.stringify(llm, null, 2);
  console.log(str);

  const llm2 = await load<Cohere>(
    str,
    { COHERE_API_KEY: "cohere-key" },
    { "langchain/llms/cohere": { Cohere } }
  );
  console.log(JSON.stringify(llm2, null, 2));
  expect(JSON.stringify(llm2, null, 2)).toBe(str);
});
