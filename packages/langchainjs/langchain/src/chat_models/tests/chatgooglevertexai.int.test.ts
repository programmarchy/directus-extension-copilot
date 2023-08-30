import { test } from "@jest/globals";
import { ChatMessage, HumanMessage } from "../../schema/index.js";
import {
  PromptTemplate,
  ChatPromptTemplate,
  MessagesPlaceholder,
  AIMessagePromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "../../prompts/index.js";
import { ConversationChain } from "../../chains/conversation.js";
import { BufferMemory } from "../../memory/buffer_memory.js";
import { ChatGoogleVertexAI } from "../googlevertexai.js";

test.skip("Test ChatGoogleVertexAI", async () => {
  const chat = new ChatGoogleVertexAI();
  const message = new HumanMessage("Hello!");
  const res = await chat.call([message]);
  console.log({ res });
});

test.skip("Test ChatGoogleVertexAI generate", async () => {
  const chat = new ChatGoogleVertexAI();
  const message = new HumanMessage("Hello!");
  const res = await chat.generate([[message]]);
  console.log(JSON.stringify(res, null, 2));
});

test.skip("Google code messages with custom messages", async () => {
  const chat = new ChatGoogleVertexAI();
  const res = await chat.call([new ChatMessage("Hello!", "user")]);
  console.log(JSON.stringify(res, null, 2));
});

test.skip("ChatGoogleVertexAI, prompt templates", async () => {
  const chat = new ChatGoogleVertexAI();

  // PaLM doesn't support translation yet
  const systemPrompt = PromptTemplate.fromTemplate(
    "You are a helpful assistant who must always respond like a {job}."
  );

  const chatPrompt = ChatPromptTemplate.fromPromptMessages([
    new SystemMessagePromptTemplate(systemPrompt),
    HumanMessagePromptTemplate.fromTemplate("{text}"),
  ]);

  const responseA = await chat.generatePrompt([
    await chatPrompt.formatPromptValue({
      job: "pirate",
      text: "What would be a good company name a company that makes colorful socks?",
    }),
  ]);

  console.log(responseA.generations);
});

test.skip("ChatGoogleVertexAI, longer chain of messages", async () => {
  const chat = new ChatGoogleVertexAI();

  const chatPrompt = ChatPromptTemplate.fromPromptMessages([
    HumanMessagePromptTemplate.fromTemplate(`Hi, my name is Joe!`),
    AIMessagePromptTemplate.fromTemplate(`Nice to meet you, Joe!`),
    HumanMessagePromptTemplate.fromTemplate("{text}"),
  ]);

  const responseA = await chat.generatePrompt([
    await chatPrompt.formatPromptValue({
      text: "What did I just say my name was?",
    }),
  ]);

  console.log(responseA.generations);
});

test.skip("ChatGoogleVertexAI, with a memory in a chain", async () => {
  const chatPrompt = ChatPromptTemplate.fromPromptMessages([
    SystemMessagePromptTemplate.fromTemplate(
      "You are a helpful assistant who must always respond like a pirate"
    ),
    new MessagesPlaceholder("history"),
    HumanMessagePromptTemplate.fromTemplate("{input}"),
  ]);

  const chain = new ConversationChain({
    memory: new BufferMemory({ returnMessages: true, memoryKey: "history" }),
    prompt: chatPrompt,
    llm: new ChatGoogleVertexAI(),
  });

  const response = await chain.call({
    input: "Hi, my name is afirstenberg!",
  });

  console.log(response);

  const response2 = await chain.call({
    input: "What did I say my name was?",
  });

  console.log(response2);
});

test.skip("CodechatGoogleVertexAI, chain of messages", async () => {
  const chat = new ChatGoogleVertexAI({ model: "codechat-bison" });

  const chatPrompt = ChatPromptTemplate.fromPromptMessages([
    SystemMessagePromptTemplate.fromTemplate(
      `Answer all questions using Python and just show the code without an explanation.`
    ),
    HumanMessagePromptTemplate.fromTemplate("{text}"),
  ]);

  const responseA = await chat.generatePrompt([
    await chatPrompt.formatPromptValue({
      text: "How can I write a for loop counting to 10?",
    }),
  ]);

  console.log(JSON.stringify(responseA.generations, null, 1));
});
