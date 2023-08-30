import { Collection, Document as MongoDBDocument, ObjectId } from "mongodb";
import { BaseMessage, BaseListChatMessageHistory } from "../../schema/index.js";
import {
  mapChatMessagesToStoredMessages,
  mapStoredMessagesToChatMessages,
} from "./utils.js";

export interface MongoDBChatMessageHistoryInput {
  collection: Collection<MongoDBDocument>;
  sessionId: string;
}

export class MongoDBChatMessageHistory extends BaseListChatMessageHistory {
  lc_namespace = ["langchain", "stores", "message", "mongodb"];

  private collection: Collection<MongoDBDocument>;

  private sessionId: string;

  constructor({ collection, sessionId }: MongoDBChatMessageHistoryInput) {
    super();
    this.collection = collection;
    this.sessionId = sessionId;
  }

  async getMessages(): Promise<BaseMessage[]> {
    const document = await this.collection.findOne({
      _id: new ObjectId(this.sessionId),
    });
    const messages = document?.messages || [];
    return mapStoredMessagesToChatMessages(messages);
  }

  async addMessage(message: BaseMessage): Promise<void> {
    const messages = mapChatMessagesToStoredMessages([message]);
    await this.collection.updateOne(
      { _id: new ObjectId(this.sessionId) },
      {
        $push: { messages: { $each: messages } },
      },
      { upsert: true }
    );
  }

  async clear(): Promise<void> {
    await this.collection.deleteOne({ _id: new ObjectId(this.sessionId) });
  }
}
