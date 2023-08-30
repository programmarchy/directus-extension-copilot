import { BufferMemory } from "langchain/memory";
import { PlanetScaleChatMessageHistory } from "langchain/stores/message/planetscale";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { ConversationChain } from "langchain/chains";
import { Client } from "@planetscale/database";

// Create your own Planetscale database client
const client = new Client({
  url: "ADD_YOURS_HERE", // Override with your own database instance's URL
});

const memory = new BufferMemory({
  chatHistory: new PlanetScaleChatMessageHistory({
    tableName: "stored_message",
    sessionId: "lc-example",
    client, // You can reuse your existing database client
  }),
});

const model = new ChatOpenAI();
const chain = new ConversationChain({ llm: model, memory });

const res1 = await chain.call({ input: "Hi! I'm Jim." });
console.log({ res1 });
/*
{
  res1: {
    text: "Hello Jim! It's nice to meet you. My name is AI. How may I assist you today?"
  }
}
*/

const res2 = await chain.call({ input: "What did I just say my name was?" });
console.log({ res2 });

/*
{
  res1: {
    text: "You said your name was Jim."
  }
}
*/
