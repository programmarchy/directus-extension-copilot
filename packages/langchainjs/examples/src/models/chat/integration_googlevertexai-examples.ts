import { ChatGoogleVertexAI } from "langchain/chat_models/googlevertexai";
import { AIMessage, HumanMessage, SystemMessage } from "langchain/schema";

export const run = async () => {
  const examples = [
    {
      input: new HumanMessage("What is your favorite sock color?"),
      output: new AIMessage("My favorite sock color be arrrr-ange!"),
    },
  ];
  const model = new ChatGoogleVertexAI({
    temperature: 0.7,
    examples,
  });
  const questions = [
    new SystemMessage(
      "You are a funny assistant that answers in pirate language."
    ),
    new HumanMessage("What is your favorite food?"),
  ];
  // You can also use the model as part of a chain
  const res = await model.call(questions);
  console.log({ res });
};
