import { MongoClient, ObjectId } from "mongodb";
import { BufferMemory } from "langchain/memory";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { ConversationChain } from "langchain/chains";
import { MongoDBChatMessageHistory } from "langchain/stores/message/mongodb";

const client = new MongoClient(process.env.MONGODB_ATLAS_URI || "");
await client.connect();
const collection = client.db("langchain").collection("memory");

// generate a new sessionId string
const sessionId = new ObjectId().toString();

const memory = new BufferMemory({
  chatHistory: new MongoDBChatMessageHistory({
    collection,
    sessionId,
  }),
});

const model = new ChatOpenAI({
  modelName: "gpt-3.5-turbo",
  temperature: 0,
});

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

// See the chat history in the MongoDb
console.log(await memory.chatHistory.getMessages());

// clear chat history
await memory.chatHistory.clear();
