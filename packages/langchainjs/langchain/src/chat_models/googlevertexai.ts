import { BaseChatModel } from "./base.js";
import {
  AIMessage,
  BaseMessage,
  ChatGeneration,
  ChatMessage,
  ChatResult,
  LLMResult,
} from "../schema/index.js";
import { GoogleVertexAILLMConnection } from "../util/googlevertexai-connection.js";
import {
  GoogleVertexAIBaseLLMInput,
  GoogleVertexAIBasePrediction,
  GoogleVertexAIModelParams,
} from "../types/googlevertexai-types.js";
import { BaseLanguageModelCallOptions } from "../base_language/index.js";

/**
 * Represents a single "example" exchange that can be provided to
 * help illustrate what a model response should look like.
 */
export interface ChatExample {
  input: BaseMessage;
  output: BaseMessage;
}

/**
 * Represents a single example exchange in the Google Vertex AI chat
 * model.
 */
interface GoogleVertexAIChatExample {
  input: GoogleVertexAIChatMessage;
  output: GoogleVertexAIChatMessage;
}

/**
 * Represents the author of a chat message in the Google Vertex AI chat
 * model.
 */
export type GoogleVertexAIChatAuthor =
  | "user" // Represents the human for Code and CodeChat models
  | "bot" // Represents the AI for Code models
  | "system" // Represents the AI for CodeChat models
  | "context"; // Represents contextual instructions

export type GoogleVertexAIChatMessageFields = {
  author?: GoogleVertexAIChatAuthor;
  content: string;
  name?: string;
};

/**
 * Represents a chat message in the Google Vertex AI chat model.
 */
export class GoogleVertexAIChatMessage {
  public author?: GoogleVertexAIChatAuthor;

  public content: string;

  public name?: string;

  constructor(fields: GoogleVertexAIChatMessageFields) {
    this.author = fields.author;
    this.content = fields.content;
    this.name = fields.name;
  }

  /**
   * Extracts the role of a generic message and maps it to a Google Vertex
   * AI chat author.
   * @param message The chat message to extract the role from.
   * @returns The role of the message mapped to a Google Vertex AI chat author.
   */
  static extractGenericMessageCustomRole(message: ChatMessage) {
    if (
      message.role !== "system" &&
      message.role !== "bot" &&
      message.role !== "user" &&
      message.role !== "context"
    ) {
      console.warn(`Unknown message role: ${message.role}`);
    }

    return message.role as GoogleVertexAIChatAuthor;
  }

  /**
   * Maps a message type to a Google Vertex AI chat author.
   * @param message The message to map.
   * @param model The model to use for mapping.
   * @returns The message type mapped to a Google Vertex AI chat author.
   */
  static mapMessageTypeToVertexChatAuthor(
    message: BaseMessage,
    model: string
  ): GoogleVertexAIChatAuthor {
    const type = message._getType();
    switch (type) {
      case "ai":
        return model.startsWith("codechat-") ? "system" : "bot";
      case "human":
        return "user";
      case "system":
        throw new Error(
          `System messages are only supported as the first passed message for Google Vertex AI.`
        );
      case "generic": {
        if (!ChatMessage.isInstance(message))
          throw new Error("Invalid generic chat message");
        return GoogleVertexAIChatMessage.extractGenericMessageCustomRole(
          message
        );
      }
      default:
        throw new Error(`Unknown / unsupported message type: ${message}`);
    }
  }

  /**
   * Creates a new Google Vertex AI chat message from a base message.
   * @param message The base message to convert.
   * @param model The model to use for conversion.
   * @returns A new Google Vertex AI chat message.
   */
  static fromChatMessage(message: BaseMessage, model: string) {
    return new GoogleVertexAIChatMessage({
      author: GoogleVertexAIChatMessage.mapMessageTypeToVertexChatAuthor(
        message,
        model
      ),
      content: message.content,
    });
  }
}

/**
 * Represents an instance of the Google Vertex AI chat model.
 */
export interface GoogleVertexAIChatInstance {
  context?: string;
  examples?: GoogleVertexAIChatExample[];
  messages: GoogleVertexAIChatMessage[];
}

/**
 * Defines the prediction output of the Google Vertex AI chat model.
 */
export interface GoogleVertexAIChatPrediction
  extends GoogleVertexAIBasePrediction {
  candidates: GoogleVertexAIChatMessage[];
}

/**
 * Defines the input to the Google Vertex AI chat model.
 */
export interface GoogleVertexAIChatInput extends GoogleVertexAIBaseLLMInput {
  /** Instructions how the model should respond */
  context?: string;

  /** Help the model understand what an appropriate response is */
  examples?: ChatExample[];
}

/**
 * Enables calls to the Google Cloud's Vertex AI API to access
 * Large Language Models in a chat-like fashion.
 *
 * To use, you will need to have one of the following authentication
 * methods in place:
 * - You are logged into an account permitted to the Google Cloud project
 *   using Vertex AI.
 * - You are running this on a machine using a service account permitted to
 *   the Google Cloud project using Vertex AI.
 * - The `GOOGLE_APPLICATION_CREDENTIALS` environment variable is set to the
 *   path of a credentials file for a service account permitted to the
 *   Google Cloud project using Vertex AI.
 */
export class ChatGoogleVertexAI
  extends BaseChatModel
  implements GoogleVertexAIChatInput
{
  static lc_name() {
    return "ChatGoogleVertexAI";
  }

  lc_serializable = true;

  model = "chat-bison";

  temperature = 0.2;

  maxOutputTokens = 1024;

  topP = 0.8;

  topK = 40;

  examples: ChatExample[] = [];

  connection: GoogleVertexAILLMConnection<
    BaseLanguageModelCallOptions,
    GoogleVertexAIChatInstance,
    GoogleVertexAIChatPrediction
  >;

  constructor(fields?: GoogleVertexAIChatInput) {
    super(fields ?? {});

    this.model = fields?.model ?? this.model;
    this.temperature = fields?.temperature ?? this.temperature;
    this.maxOutputTokens = fields?.maxOutputTokens ?? this.maxOutputTokens;
    this.topP = fields?.topP ?? this.topP;
    this.topK = fields?.topK ?? this.topK;
    this.examples = fields?.examples ?? this.examples;

    this.connection = new GoogleVertexAILLMConnection(
      {
        ...fields,
        ...this,
      },
      this.caller
    );
  }

  _combineLLMOutput(): LLMResult["llmOutput"] {
    // TODO: Combine the safetyAttributes
    return [];
  }

  // TODO: Add streaming support
  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"]
  ): Promise<ChatResult> {
    const instance: GoogleVertexAIChatInstance = this.createInstance(messages);

    const parameters: GoogleVertexAIModelParams = {
      temperature: this.temperature,
      topK: this.topK,
      topP: this.topP,
      maxOutputTokens: this.maxOutputTokens,
    };

    const result = await this.connection.request(
      [instance],
      parameters,
      options
    );

    const generations =
      result?.data?.predictions?.map((prediction) =>
        ChatGoogleVertexAI.convertPrediction(prediction)
      ) ?? [];
    return {
      generations,
    };
  }

  _llmType(): string {
    return "googlevertexai";
  }

  /**
   * Creates an instance of the Google Vertex AI chat model.
   * @param messages The messages for the model instance.
   * @returns A new instance of the Google Vertex AI chat model.
   */
  createInstance(messages: BaseMessage[]): GoogleVertexAIChatInstance {
    let context = "";
    let conversationMessages = messages;
    if (messages[0]?._getType() === "system") {
      context = messages[0].content;
      conversationMessages = messages.slice(1);
    }
    // https://cloud.google.com/vertex-ai/docs/generative-ai/chat/test-chat-prompts
    if (conversationMessages.length % 2 === 0) {
      throw new Error(
        `Google Vertex AI requires an odd number of messages to generate a response.`
      );
    }
    const vertexChatMessages = conversationMessages.map((baseMessage, i) => {
      const currMessage = GoogleVertexAIChatMessage.fromChatMessage(
        baseMessage,
        this.model
      );
      const prevMessage =
        i > 0
          ? GoogleVertexAIChatMessage.fromChatMessage(
              conversationMessages[i - 1],
              this.model
            )
          : null;

      // https://cloud.google.com/vertex-ai/docs/generative-ai/chat/chat-prompts#messages
      if (prevMessage && currMessage.author === prevMessage.author) {
        throw new Error(
          `Google Vertex AI requires AI and human messages to alternate.`
        );
      }
      return currMessage;
    });

    const examples = this.examples.map((example) => ({
      input: GoogleVertexAIChatMessage.fromChatMessage(
        example.input,
        this.model
      ),
      output: GoogleVertexAIChatMessage.fromChatMessage(
        example.output,
        this.model
      ),
    }));

    const instance: GoogleVertexAIChatInstance = {
      context,
      examples,
      messages: vertexChatMessages,
    };

    return instance;
  }

  /**
   * Converts a prediction from the Google Vertex AI chat model to a chat
   * generation.
   * @param prediction The prediction to convert.
   * @returns The converted chat generation.
   */
  static convertPrediction(
    prediction: GoogleVertexAIChatPrediction
  ): ChatGeneration {
    const message = prediction?.candidates[0];
    return {
      text: message?.content,
      message: new AIMessage(message.content),
      generationInfo: prediction,
    };
  }
}
