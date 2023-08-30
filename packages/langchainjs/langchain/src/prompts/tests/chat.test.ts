import { expect, test } from "@jest/globals";
import {
  AIMessagePromptTemplate,
  ChatPromptTemplate,
  ChatMessagePromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
  MessagesPlaceholder,
} from "../chat.js";
import { PromptTemplate } from "../prompt.js";
import {
  AIMessage,
  ChatMessage,
  HumanMessage,
  SystemMessage,
} from "../../schema/index.js";

function createChatPromptTemplate() {
  const systemPrompt = new PromptTemplate({
    template: "Here's some context: {context}",
    inputVariables: ["context"],
  });
  const userPrompt = new PromptTemplate({
    template: "Hello {foo}, I'm {bar}. Thanks for the {context}",
    inputVariables: ["foo", "bar", "context"],
  });
  const aiPrompt = new PromptTemplate({
    template: "I'm an AI. I'm {foo}. I'm {bar}.",
    inputVariables: ["foo", "bar"],
  });
  const genericPrompt = new PromptTemplate({
    template: "I'm a generic message. I'm {foo}. I'm {bar}.",
    inputVariables: ["foo", "bar"],
  });
  // return new ChatPromptTemplate({
  //   promptMessages: [
  //     new SystemMessagePromptTemplate(systemPrompt),
  //     new HumanMessagePromptTemplate(userPrompt),
  //     new AIMessagePromptTemplate({ prompt: aiPrompt }),
  //     new ChatMessagePromptTemplate(genericPrompt, "test"),
  //   ],
  //   inputVariables: ["context", "foo", "bar"],
  // });
  return ChatPromptTemplate.fromPromptMessages<{
    foo: string;
    bar: string;
    context: string;
  }>([
    new SystemMessagePromptTemplate(systemPrompt),
    new HumanMessagePromptTemplate(userPrompt),
    new AIMessagePromptTemplate({ prompt: aiPrompt }),
    new ChatMessagePromptTemplate(genericPrompt, "test"),
  ]);
}

test("Test format", async () => {
  const chatPrompt = createChatPromptTemplate();
  const messages = await chatPrompt.formatPromptValue({
    context: "This is a context",
    foo: "Foo",
    bar: "Bar",
    unused: "extra",
  });
  expect(messages.toChatMessages()).toEqual([
    new SystemMessage("Here's some context: This is a context"),
    new HumanMessage("Hello Foo, I'm Bar. Thanks for the This is a context"),
    new AIMessage("I'm an AI. I'm Foo. I'm Bar."),
    new ChatMessage("I'm a generic message. I'm Foo. I'm Bar.", "test"),
  ]);
});

test("Test format with invalid input values", async () => {
  const chatPrompt = createChatPromptTemplate();
  await expect(
    // @ts-expect-error TS compiler should flag missing input variables
    chatPrompt.formatPromptValue({
      context: "This is a context",
      foo: "Foo",
    })
  ).rejects.toThrow("Missing value for input variable `bar`");
});

test("Test format with invalid input variables", async () => {
  const systemPrompt = new PromptTemplate({
    template: "Here's some context: {context}",
    inputVariables: ["context"],
  });
  const userPrompt = new PromptTemplate({
    template: "Hello {foo}, I'm {bar}",
    inputVariables: ["foo", "bar"],
  });
  expect(
    () =>
      new ChatPromptTemplate({
        promptMessages: [
          new SystemMessagePromptTemplate(systemPrompt),
          new HumanMessagePromptTemplate(userPrompt),
        ],
        inputVariables: ["context", "foo", "bar", "baz"],
      })
  ).toThrow(
    "Input variables `baz` are not used in any of the prompt messages."
  );

  expect(
    () =>
      new ChatPromptTemplate({
        promptMessages: [
          new SystemMessagePromptTemplate(systemPrompt),
          new HumanMessagePromptTemplate(userPrompt),
        ],
        inputVariables: ["context", "foo"],
      })
  ).toThrow(
    "Input variables `bar` are used in prompt messages but not in the prompt template."
  );
});

test("Test fromPromptMessages", async () => {
  const systemPrompt = new PromptTemplate({
    template: "Here's some context: {context}",
    inputVariables: ["context"],
  });
  const userPrompt = new PromptTemplate({
    template: "Hello {foo}, I'm {bar}",
    inputVariables: ["foo", "bar"],
  });
  // TODO: Fix autocomplete for the fromPromptMessages method
  const chatPrompt = ChatPromptTemplate.fromPromptMessages([
    new SystemMessagePromptTemplate(systemPrompt),
    new HumanMessagePromptTemplate(userPrompt),
  ]);
  expect(chatPrompt.inputVariables).toEqual(["context", "foo", "bar"]);
  const messages = await chatPrompt.formatPromptValue({
    context: "This is a context",
    foo: "Foo",
    bar: "Bar",
  });
  expect(messages.toChatMessages()).toEqual([
    new SystemMessage("Here's some context: This is a context"),
    new HumanMessage("Hello Foo, I'm Bar"),
  ]);
});

test("Test fromPromptMessages with an extra input variable", async () => {
  const systemPrompt = new PromptTemplate({
    template: "Here's some context: {context}",
    inputVariables: ["context"],
  });
  const userPrompt = new PromptTemplate({
    template: "Hello {foo}, I'm {bar}",
    inputVariables: ["foo", "bar"],
  });
  // TODO: Fix autocomplete for the fromPromptMessages method
  const chatPrompt = ChatPromptTemplate.fromPromptMessages([
    new SystemMessagePromptTemplate(systemPrompt),
    new HumanMessagePromptTemplate(userPrompt),
  ]);
  expect(chatPrompt.inputVariables).toEqual(["context", "foo", "bar"]);
  const messages = await chatPrompt.formatPromptValue({
    context: "This is a context",
    foo: "Foo",
    bar: "Bar",
    unused: "No problemo!",
  });
  expect(messages.toChatMessages()).toEqual([
    new SystemMessage("Here's some context: This is a context"),
    new HumanMessage("Hello Foo, I'm Bar"),
  ]);
});

test("Test fromPromptMessages is composable", async () => {
  const systemPrompt = new PromptTemplate({
    template: "Here's some context: {context}",
    inputVariables: ["context"],
  });
  const userPrompt = new PromptTemplate({
    template: "Hello {foo}, I'm {bar}",
    inputVariables: ["foo", "bar"],
  });
  const chatPromptInner = ChatPromptTemplate.fromPromptMessages([
    new SystemMessagePromptTemplate(systemPrompt),
    new HumanMessagePromptTemplate(userPrompt),
  ]);
  const chatPrompt = ChatPromptTemplate.fromPromptMessages([
    chatPromptInner,
    AIMessagePromptTemplate.fromTemplate("I'm an AI. I'm {foo}. I'm {bar}."),
  ]);
  expect(chatPrompt.inputVariables).toEqual(["context", "foo", "bar"]);
  const messages = await chatPrompt.formatPromptValue({
    context: "This is a context",
    foo: "Foo",
    bar: "Bar",
  });
  expect(messages.toChatMessages()).toEqual([
    new SystemMessage("Here's some context: This is a context"),
    new HumanMessage("Hello Foo, I'm Bar"),
    new AIMessage("I'm an AI. I'm Foo. I'm Bar."),
  ]);
});

test("Test fromPromptMessages is composable with partial vars", async () => {
  const systemPrompt = new PromptTemplate({
    template: "Here's some context: {context}",
    inputVariables: ["context"],
  });
  const userPrompt = new PromptTemplate({
    template: "Hello {foo}, I'm {bar}",
    inputVariables: ["foo", "bar"],
  });
  const chatPromptInner = ChatPromptTemplate.fromPromptMessages([
    new SystemMessagePromptTemplate(systemPrompt),
    new HumanMessagePromptTemplate(userPrompt),
  ]);
  const chatPrompt = ChatPromptTemplate.fromPromptMessages([
    await chatPromptInner.partial({
      context: "This is a context",
      foo: "Foo",
    }),
    AIMessagePromptTemplate.fromTemplate("I'm an AI. I'm {foo}. I'm {bar}."),
  ]);
  expect(chatPrompt.inputVariables).toEqual(["bar"]);
  const messages = await chatPrompt.formatPromptValue({
    bar: "Bar",
  });
  expect(messages.toChatMessages()).toEqual([
    new SystemMessage("Here's some context: This is a context"),
    new HumanMessage("Hello Foo, I'm Bar"),
    new AIMessage("I'm an AI. I'm Foo. I'm Bar."),
  ]);
});

test("Test SimpleMessagePromptTemplate", async () => {
  const prompt = new MessagesPlaceholder("foo");
  const values = { foo: [new HumanMessage("Hello Foo, I'm Bar")] };
  const messages = await prompt.formatMessages(values);
  expect(messages).toEqual([new HumanMessage("Hello Foo, I'm Bar")]);
});

test("Test using partial", async () => {
  const userPrompt = new PromptTemplate({
    template: "{foo}{bar}",
    inputVariables: ["foo", "bar"],
  });

  const prompt = new ChatPromptTemplate({
    promptMessages: [new HumanMessagePromptTemplate(userPrompt)],
    inputVariables: ["foo", "bar"],
  });

  const partialPrompt = await prompt.partial({ foo: "foo" });

  // original prompt is not modified
  expect(prompt.inputVariables).toEqual(["foo", "bar"]);
  // partial prompt has only remaining variables
  expect(partialPrompt.inputVariables).toEqual(["bar"]);

  expect(await partialPrompt.format({ bar: "baz" })).toMatchInlineSnapshot(
    `"[{"lc":1,"type":"constructor","id":["langchain","schema","HumanMessage"],"kwargs":{"content":"foobaz","additional_kwargs":{}}}]"`
  );
});
