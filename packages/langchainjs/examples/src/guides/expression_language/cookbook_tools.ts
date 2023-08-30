import { SerpAPI } from "langchain/tools";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { PromptTemplate } from "langchain/prompts";
import { StringOutputParser } from "langchain/schema/output_parser";

const search = new SerpAPI();

const prompt =
  PromptTemplate.fromTemplate(`Turn the following user input into a search query for a search engine:

{input}`);

const model = new ChatOpenAI({});

const chain = prompt.pipe(model).pipe(new StringOutputParser()).pipe(search);

const result = await chain.invoke({
  input: "Who is the current prime minister of Malaysia?",
});

console.log(result);
/*
  Anwar Ibrahim
*/
