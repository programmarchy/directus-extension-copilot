import { ChatGooglePaLM } from "langchain/chat_models/googlepalm";
import { AIMessage, HumanMessage, SystemMessage } from "langchain/schema";

export const run = async () => {
  const model = new ChatGooglePaLM({
    apiKey: "<YOUR API KEY>", // or set it in environment variable as `GOOGLE_PALM_API_KEY`
    temperature: 0.7, // OPTIONAL
    modelName: "models/chat-bison-001", // OPTIONAL
    topK: 40, // OPTIONAL
    topP: 3, // OPTIONAL
    examples: [
      // OPTIONAL
      {
        input: new HumanMessage("What is your favorite sock color?"),
        output: new AIMessage("My favorite sock color be arrrr-ange!"),
      },
    ],
  });

  // ask questions
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
