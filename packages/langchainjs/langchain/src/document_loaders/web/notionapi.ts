import {
  APIResponseError,
  Client,
  isFullBlock,
  isFullPage,
  iteratePaginatedAPI,
  APIErrorCode,
  isNotionClientError,
  isFullDatabase,
} from "@notionhq/client";
import { NotionToMarkdown } from "notion-to-md";
import { getBlockChildren } from "notion-to-md/build/utils/notion.js";
import type {
  ListBlockChildrenResponseResults,
  MdBlock,
} from "notion-to-md/build/types";

import { Document } from "../../document.js";
import { BaseDocumentLoader } from "../base.js";
import { AsyncCaller } from "../../util/async_caller.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GuardType<T> = T extends (x: any, ...rest: any) => x is infer U
  ? U
  : never;

type GetBlockResponse = Parameters<typeof isFullBlock>[0];
type GetPageResponse = Parameters<typeof isFullPage>[0];
type GetDatabaseResponse = Parameters<typeof isFullDatabase>[0];

type BlockObjectResponse = GuardType<typeof isFullBlock>;
type PageObjectResponse = GuardType<typeof isFullPage>;
type DatabaseObjectResponse = GuardType<typeof isFullDatabase>;

type GetResponse =
  | GetBlockResponse
  | GetPageResponse
  | GetDatabaseResponse
  | APIResponseError;

const isPageResponse = (res: GetResponse): res is GetPageResponse =>
  !isNotionClientError(res) && res.object === "page";
const isDatabaseResponse = (res: GetResponse): res is GetDatabaseResponse =>
  !isNotionClientError(res) && res.object === "database";
const isErrorResponse = (res: GetResponse): res is APIResponseError =>
  isNotionClientError(res);

const isPage = (res: GetResponse): res is PageObjectResponse =>
  isPageResponse(res) && isFullPage(res);
const isDatabase = (res: GetResponse): res is DatabaseObjectResponse =>
  isDatabaseResponse(res) && isFullDatabase(res);

const getTitle = (obj: GetResponse) => {
  if (isPage(obj) && obj.properties.title.type === "title") {
    return obj.properties.title.title[0]?.plain_text;
  }
  if (isDatabase(obj)) return obj.title[0]?.plain_text;
  return null;
};

/**
 * Represents the type of Notion API to load documents from. The options
 * are "database" or "page".
 */
// @deprecated `type` property is now automatically determined.
export type NotionAPIType = "database" | "page";

export type OnDocumentLoadedCallback = (
  current: number,
  total: number,
  currentTitle?: string,
  rootTitle?: string
) => void;

export type NotionAPILoaderOptions = {
  clientOptions: ConstructorParameters<typeof Client>[0];
  id: string;
  type?: NotionAPIType; // @deprecated `type` property is now automatically determined.
  callerOptions?: ConstructorParameters<typeof AsyncCaller>[0];
  onDocumentLoaded?: OnDocumentLoadedCallback;
};

/**
 * A class that extends the BaseDocumentLoader class. It represents a
 * document loader for loading documents from Notion using the Notion API.
 */
export class NotionAPILoader extends BaseDocumentLoader {
  private caller: AsyncCaller;

  private notionClient: Client;

  private n2mClient: NotionToMarkdown;

  private id: string;

  private pageQueue: string[];

  private pageCompleted: string[];

  public pageQueueTotal: number;

  private documents: Document[];

  private rootTitle: string;

  private onDocumentLoaded: OnDocumentLoadedCallback;

  constructor(options: NotionAPILoaderOptions) {
    super();

    this.caller = new AsyncCaller({
      maxConcurrency: 64,
      ...options.callerOptions,
    });
    this.notionClient = new Client({
      logger: () => {}, // Suppress Notion SDK logger
      ...options.clientOptions,
    });
    this.n2mClient = new NotionToMarkdown({
      notionClient: this.notionClient,
      config: { parseChildPages: false, convertImagesToBase64: false },
    });
    this.id = options.id;
    this.pageQueue = [];
    this.pageCompleted = [];
    this.pageQueueTotal = 0;
    this.documents = [];
    this.rootTitle = "";
    this.onDocumentLoaded = options.onDocumentLoaded ?? ((_ti, _cu) => {});
  }

  private addToQueue(...items: string[]) {
    const deDuped = items.filter(
      (item) => !this.pageCompleted.concat(this.pageQueue).includes(item)
    );
    this.pageQueue.push(...deDuped);
    this.pageQueueTotal += deDuped.length;
  }

  /**
   * Parses the properties of a Notion page and returns them as key-value
   * pairs.
   * @param page The Notion page to parse.
   * @returns An object containing the parsed properties as key-value pairs.
   */
  private parsePageProperties(page: PageObjectResponse): {
    [key: string]: string;
  } {
    return Object.fromEntries(
      Object.entries(page.properties).map(([_, prop]) => {
        switch (prop.type) {
          case "number":
            return [prop.type, prop[prop.type]];
          case "url":
            return [prop.type, prop[prop.type]];
          case "select":
            return [prop.type, prop[prop.type]?.name ?? ""];
          case "multi_select":
            return [
              prop.type,
              prop[prop.type].map((select) => select.name).join(", "),
            ];
          case "status":
            return [prop.type, prop[prop.type]?.name ?? ""];
          case "date":
            return [
              prop.type,
              `${prop[prop.type]?.start ?? ""}${
                prop[prop.type]?.end ? `-  ${prop[prop.type]?.end}` : ""
              }`,
            ];
          case "email":
            return [prop.type, prop[prop.type]];
          case "phone_number":
            return [prop.type, prop[prop.type]];
          case "checkbox":
            return [prop.type, prop[prop.type].toString()];
          // case "files":
          case "created_by":
            return [prop.type, prop[prop.type]];
          case "created_time":
            return [prop.type, prop[prop.type]];
          case "last_edited_by":
            return [prop.type, prop[prop.type]];
          case "last_edited_time":
            return [prop.type, prop[prop.type]];
          // case "formula":
          case "title":
            return [
              prop.type,
              prop[prop.type].map((v) => v.plain_text).join(""),
            ];
          case "rich_text":
            return [
              prop.type,
              prop[prop.type].map((v) => v.plain_text).join(""),
            ];
          case "people":
            return [prop.type, prop[prop.type]];
          // case "relation":
          // case "rollup":

          default:
            return [prop.type, "Unsupported type"];
        }
      })
    );
  }

  /**
   * Parses the details of a Notion page and returns them as an object.
   * @param page The Notion page to parse.
   * @returns An object containing the parsed details of the page.
   */
  private parsePageDetails(page: PageObjectResponse) {
    const metadata = Object.fromEntries(
      Object.entries(page).filter(([key, _]) => key !== "id")
    );
    return {
      ...metadata,
      notionId: page.id,
      properties: this.parsePageProperties(page),
    };
  }

  /**
   * Loads a Notion block and returns it as an MdBlock object.
   * @param block The Notion block to load.
   * @returns A Promise that resolves to an MdBlock object.
   */
  private async loadBlock(block: BlockObjectResponse): Promise<MdBlock> {
    const mdBlock: MdBlock = {
      type: block.type,
      blockId: block.id,
      parent: await this.caller.call(() =>
        this.n2mClient.blockToMarkdown(block)
      ),
      children: [],
    };

    if (block.has_children) {
      const block_id =
        block.type === "synced_block" &&
        block.synced_block?.synced_from?.block_id
          ? block.synced_block.synced_from.block_id
          : block.id;

      const childBlocks = await this.loadBlocks(
        await this.caller.call(() =>
          getBlockChildren(this.notionClient, block_id, null)
        )
      );

      mdBlock.children = childBlocks;
    }

    return mdBlock;
  }

  /**
   * Loads Notion blocks and their children recursively.
   * @param blocksResponse The response from the Notion API containing the blocks to load.
   * @returns A Promise that resolves to an array containing the loaded MdBlocks.
   */
  private async loadBlocks(
    blocksResponse: ListBlockChildrenResponseResults
  ): Promise<MdBlock[]> {
    const blocks = blocksResponse.filter(isFullBlock);

    // Add child pages to queue
    const childPages = blocks
      .filter((block) => block.type.includes("child_page"))
      .map((block) => block.id);
    if (childPages.length > 0) this.addToQueue(...childPages);

    // Add child database pages to queue
    const childDatabases = blocks
      .filter((block) => block.type.includes("child_database"))
      .map((block) => this.caller.call(() => this.loadDatabase(block.id)));

    // Load this block and child blocks
    const loadingMdBlocks = blocks
      .filter((block) => !["child_page", "child_database"].includes(block.type))
      .map((block) => this.loadBlock(block));

    const [mdBlocks] = await Promise.all([
      Promise.all(loadingMdBlocks),
      Promise.all(childDatabases),
    ]);

    return mdBlocks;
  }

  /**
   * Loads a Notion page and its child documents, then adds it to the completed documents array.
   * @param page The Notion page or page ID to load.
   */
  private async loadPage(page: string | PageObjectResponse) {
    // Check page is a page ID or a PageObjectResponse
    const [pageData, pageId] =
      typeof page === "string"
        ? [
            this.caller.call(() =>
              this.notionClient.pages.retrieve({ page_id: page })
            ),
            page,
          ]
        : [page, page.id];

    const [pageDetails, pageBlocks] = await Promise.all([
      pageData,
      this.caller.call(() => getBlockChildren(this.notionClient, pageId, null)),
    ]);

    if (!isFullPage(pageDetails)) return;

    const mdBlocks = await this.loadBlocks(pageBlocks);
    const mdStringObject = this.n2mClient.toMarkdownString(mdBlocks);
    const pageDocument = new Document({
      pageContent: mdStringObject.parent,
      metadata: this.parsePageDetails(pageDetails),
    });

    this.documents.push(pageDocument);
    this.pageCompleted.push(pageId);
    this.onDocumentLoaded(
      this.documents.length,
      this.pageQueueTotal,
      pageDocument.metadata.properties.title,
      this.rootTitle
    );
  }

  /**
   * Loads a Notion database and adds it's pages to the queue.
   * @param id The ID of the Notion database to load.
   */
  private async loadDatabase(id: string) {
    try {
      for await (const page of iteratePaginatedAPI(
        this.notionClient.databases.query,
        {
          database_id: id,
          page_size: 50,
        }
      )) {
        this.addToQueue(page.id);
      }
    } catch (e) {
      console.log(e);
      // TODO: Catch and report api request errors
    }
  }

  /**
   * Loads the documents from Notion based on the specified options.
   * @returns A Promise that resolves to an array of Documents.
   */
  async load(): Promise<Document[]> {
    const resPagePromise = this.notionClient.pages
      .retrieve({ page_id: this.id })
      .then((res) => {
        this.addToQueue(this.id);
        return res;
      })
      .catch((error: APIResponseError) => error);

    const resDatabasePromise = this.notionClient.databases
      .retrieve({ database_id: this.id })
      .then(async (res) => {
        await this.loadDatabase(this.id);
        return res;
      })
      .catch((error: APIResponseError) => error);

    const [resPage, resDatabase] = await Promise.all([
      resPagePromise,
      resDatabasePromise,
    ]);

    // Check if both resPage and resDatabase resulted in error responses
    const errors = [resPage, resDatabase].filter(isErrorResponse);
    if (errors.length === 2) {
      if (errors.every((e) => e.code === APIErrorCode.ObjectNotFound)) {
        throw new AggregateError([
          Error(
            `Could not find object with ID: ${this.id}. Make sure the relevant pages and databases are shared with your integration.`
          ),
          ...errors,
        ]);
      }
      throw new AggregateError(errors);
    }

    this.rootTitle = getTitle(resPage) || getTitle(resDatabase) || this.id;

    let pageId = this.pageQueue.shift();
    while (pageId) {
      await this.loadPage(pageId);
      pageId = this.pageQueue.shift();
    }
    return this.documents;
  }
}
