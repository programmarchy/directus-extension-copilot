import { Memory, Message, NotFoundError, ZepClient } from "@getzep/zep-js";
import {
  getBufferString,
  getInputValue,
  getOutputValue,
  InputValues,
  MemoryVariables,
  OutputValues,
} from "./base.js";
import { BaseChatMemory, BaseChatMemoryInput } from "./chat_memory.js";
import {
  AIMessage,
  BaseMessage,
  ChatMessage,
  HumanMessage,
  SystemMessage,
} from "../schema/index.js";

/**
 * Interface defining the structure of the input data for the ZepMemory
 * class. It includes properties like humanPrefix, aiPrefix, memoryKey,
 * baseURL, sessionId, and apiKey.
 */
export interface ZepMemoryInput extends BaseChatMemoryInput {
  humanPrefix?: string;

  aiPrefix?: string;

  memoryKey?: string;

  baseURL: string;

  sessionId: string;

  // apiKey is optional.
  apiKey?: string;
}

/**
 * Class used to manage the memory of a chat session, including loading
 * and saving the chat history, and clearing the memory when needed. It
 * uses the ZepClient to interact with the Zep service for managing the
 * chat session's memory.
 */
export class ZepMemory extends BaseChatMemory implements ZepMemoryInput {
  humanPrefix = "Human";

  aiPrefix = "AI";

  memoryKey = "history";

  baseURL: string;

  sessionId: string;

  zepClientPromise: Promise<ZepClient>;

  private readonly zepInitFailMsg = "ZepClient is not initialized";

  constructor(fields: ZepMemoryInput) {
    super({
      returnMessages: fields?.returnMessages ?? false,
      inputKey: fields?.inputKey,
      outputKey: fields?.outputKey,
    });

    this.humanPrefix = fields.humanPrefix ?? this.humanPrefix;
    this.aiPrefix = fields.aiPrefix ?? this.aiPrefix;
    this.memoryKey = fields.memoryKey ?? this.memoryKey;
    this.baseURL = fields.baseURL;
    this.sessionId = fields.sessionId;
    this.zepClientPromise = ZepClient.init(this.baseURL, fields.apiKey);
  }

  get memoryKeys() {
    return [this.memoryKey];
  }

  /**
   * Method that retrieves the chat history from the Zep service and formats
   * it into a list of messages.
   * @param values Input values for the method.
   * @returns Promise that resolves with the chat history formatted into a list of messages.
   */
  async loadMemoryVariables(values: InputValues): Promise<MemoryVariables> {
    // use either lastN provided by developer or undefined to use the
    // server preset.

    // Wait for ZepClient to be initialized
    const zepClient = await this.zepClientPromise;
    if (!zepClient) {
      throw new Error(this.zepInitFailMsg);
    }

    const lastN = values.lastN ?? undefined;

    let memory: Memory | null = null;
    try {
      memory = await zepClient.memory.getMemory(this.sessionId, lastN);
    } catch (error) {
      // eslint-disable-next-line no-instanceof/no-instanceof
      if (error instanceof NotFoundError) {
        const result = this.returnMessages
          ? { [this.memoryKey]: [] }
          : { [this.memoryKey]: "" };
        return result;
      } else {
        throw error;
      }
    }

    let messages: BaseMessage[] =
      memory && memory.summary?.content
        ? [new SystemMessage(memory.summary.content)]
        : [];

    if (memory) {
      messages = messages.concat(
        memory.messages.map((message) => {
          const { content, role } = message;
          if (role === this.humanPrefix) {
            return new HumanMessage(content);
          } else if (role === this.aiPrefix) {
            return new AIMessage(content);
          } else {
            // default to generic ChatMessage
            return new ChatMessage(content, role);
          }
        })
      );
    }

    if (this.returnMessages) {
      return {
        [this.memoryKey]: messages,
      };
    }
    return {
      [this.memoryKey]: getBufferString(
        messages,
        this.humanPrefix,
        this.aiPrefix
      ),
    };
  }

  /**
   * Method that saves the input and output messages to the Zep service.
   * @param inputValues Input messages to be saved.
   * @param outputValues Output messages to be saved.
   * @returns Promise that resolves when the messages have been saved.
   */
  async saveContext(
    inputValues: InputValues,
    outputValues: OutputValues
  ): Promise<void> {
    const input = getInputValue(inputValues, this.inputKey);
    const output = getOutputValue(outputValues, this.outputKey);

    // Create new Memory and Message instances
    const memory = new Memory({
      messages: [
        new Message({
          role: this.humanPrefix,
          content: `${input}`,
        }),
        new Message({
          role: this.aiPrefix,
          content: `${output}`,
        }),
      ],
    });

    // Wait for ZepClient to be initialized
    const zepClient = await this.zepClientPromise;
    if (!zepClient) {
      throw new Error(this.zepInitFailMsg);
    }

    // Add the new memory to the session using the ZepClient
    if (this.sessionId) {
      try {
        await zepClient.memory.addMemory(this.sessionId, memory);
      } catch (error) {
        console.error("Error adding memory: ", error);
      }
    }

    // Call the superclass's saveContext method
    await super.saveContext(inputValues, outputValues);
  }

  /**
   * Method that deletes the chat history from the Zep service.
   * @returns Promise that resolves when the chat history has been deleted.
   */
  async clear(): Promise<void> {
    // Wait for ZepClient to be initialized
    const zepClient = await this.zepClientPromise;
    if (!zepClient) {
      throw new Error(this.zepInitFailMsg);
    }

    try {
      await zepClient.memory.deleteMemory(this.sessionId);
    } catch (error) {
      console.error("Error deleting session: ", error);
    }

    // Clear the superclass's chat history
    await super.clear();
  }
}
