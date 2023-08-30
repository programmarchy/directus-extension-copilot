import { expect, test } from "@jest/globals";
import { PromptTemplate } from "../prompt.js";

test("Test using partial", async () => {
  const prompt = new PromptTemplate({
    template: "{foo}{bar}",
    inputVariables: ["foo"],
    partialVariables: { bar: "baz" },
  });
  expect(await prompt.format({ foo: "foo" })).toBe("foobaz");
});

test("Test using partial with an extra variable", async () => {
  const prompt = new PromptTemplate({
    template: "{foo}{bar}",
    inputVariables: ["foo"],
    partialVariables: { bar: "baz" },
  });
  expect(await prompt.format({ foo: "foo", unused: "nada" })).toBe("foobaz");
});

test("Test fromTemplate", async () => {
  const prompt = PromptTemplate.fromTemplate("{foo}{bar}");
  expect(await prompt.format({ foo: "foo", bar: "baz", unused: "eee" })).toBe(
    "foobaz"
  );
});

test("Test fromTemplate with escaped strings", async () => {
  const prompt = PromptTemplate.fromTemplate("{{foo}}{{bar}}");
  expect(await prompt.format({ unused: "eee" })).toBe("{foo}{bar}");
});

test("Test fromTemplate with type parameter", async () => {
  const prompt = PromptTemplate.fromTemplate<{ foo: string }>("test");
  // @ts-expect-error TS compiler should flag
  expect(await prompt.format({ unused: "eee" })).toBe("test");
});

test("Test using full partial", async () => {
  const prompt = new PromptTemplate({
    template: "{foo}{bar}",
    inputVariables: [],
    partialVariables: { bar: "baz", foo: "boo" },
  });
  expect(await prompt.format({})).toBe("boobaz");
});

test("Test partial", async () => {
  const prompt = new PromptTemplate({
    template: "{foo}{bar}",
    inputVariables: ["foo", "bar"],
  });
  expect(prompt.inputVariables).toEqual(["foo", "bar"]);
  const partialPrompt = await prompt.partial({ foo: "foo" });
  // original prompt is not modified
  expect(prompt.inputVariables).toEqual(["foo", "bar"]);
  // partial prompt has only remaining variables
  expect(partialPrompt.inputVariables).toEqual(["bar"]);
  expect(await partialPrompt.format({ bar: "baz" })).toBe("foobaz");
});

test("Test partial with function", async () => {
  const prompt = new PromptTemplate({
    template: "{foo}{bar}",
    inputVariables: ["foo", "bar"],
  });
  const partialPrompt = await prompt.partial({
    foo: () => Promise.resolve("boo"),
  });
  expect(await partialPrompt.format({ bar: "baz" })).toBe("boobaz");
});
