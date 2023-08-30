import { Embeddings } from "../../embeddings/base.js";
import { VectorStore } from "../../vectorstores/base.js";
import { Document } from "../../document.js";
import { Example } from "../../schema/index.js";
import { BaseExampleSelector } from "../base.js";

function sortedValues<T>(values: Record<string, T>): T[] {
  return Object.keys(values)
    .sort()
    .map((key) => values[key]);
}

/**
 * Interface for the input data of the SemanticSimilarityExampleSelector
 * class.
 */
export interface SemanticSimilarityExampleSelectorInput {
  vectorStore: VectorStore;
  k?: number;
  exampleKeys?: string[];
  inputKeys?: string[];
}

/**
 * Class that selects examples based on semantic similarity. It extends
 * the BaseExampleSelector class.
 */
export class SemanticSimilarityExampleSelector extends BaseExampleSelector {
  vectorStore: VectorStore;

  k = 4;

  exampleKeys?: string[];

  inputKeys?: string[];

  constructor(data: SemanticSimilarityExampleSelectorInput) {
    super(data);
    this.vectorStore = data.vectorStore;
    this.k = data.k ?? 4;
    this.exampleKeys = data.exampleKeys;
    this.inputKeys = data.inputKeys;
  }

  /**
   * Method that adds a new example to the vectorStore. The example is
   * converted to a string and added to the vectorStore as a document.
   * @param example The example to be added to the vectorStore.
   * @returns Promise that resolves when the example has been added to the vectorStore.
   */
  async addExample(example: Example): Promise<void> {
    const inputKeys = this.inputKeys ?? Object.keys(example);
    const stringExample = sortedValues(
      inputKeys.reduce(
        (acc, key) => ({ ...acc, [key]: example[key] }),
        {} as Example
      )
    ).join(" ");

    await this.vectorStore.addDocuments([
      new Document({
        pageContent: stringExample,
        metadata: { example },
      }),
    ]);
  }

  /**
   * Method that selects which examples to use based on semantic similarity.
   * It performs a similarity search in the vectorStore using the input
   * variables and returns the examples with the highest similarity.
   * @param inputVariables The input variables used for the similarity search.
   * @returns Promise that resolves with an array of the selected examples.
   */
  async selectExamples<T>(
    inputVariables: Record<string, T>
  ): Promise<Example[]> {
    const inputKeys = this.inputKeys ?? Object.keys(inputVariables);
    const query = sortedValues(
      inputKeys.reduce(
        (acc, key) => ({ ...acc, [key]: inputVariables[key] }),
        {} as Record<string, T>
      )
    ).join(" ");

    const exampleDocs = await this.vectorStore.similaritySearch(query, this.k);

    const examples = exampleDocs.map((doc) => doc.metadata);
    if (this.exampleKeys) {
      // If example keys are provided, filter examples to those keys.
      return examples.map((example) =>
        (this.exampleKeys as string[]).reduce(
          (acc, key) => ({ ...acc, [key]: example[key] }),
          {}
        )
      );
    }
    return examples;
  }

  /**
   * Static method that creates a new instance of
   * SemanticSimilarityExampleSelector. It takes a list of examples, an
   * instance of Embeddings, a VectorStore class, and an options object as
   * parameters. It converts the examples to strings, creates a VectorStore
   * from the strings and the embeddings, and returns a new
   * SemanticSimilarityExampleSelector with the created VectorStore and the
   * options provided.
   * @param examples The list of examples to be used.
   * @param embeddings The instance of Embeddings to be used.
   * @param vectorStoreCls The VectorStore class to be used.
   * @param options The options object for the SemanticSimilarityExampleSelector.
   * @returns Promise that resolves with a new instance of SemanticSimilarityExampleSelector.
   */
  static async fromExamples<C extends typeof VectorStore>(
    examples: Record<string, string>[],
    embeddings: Embeddings,
    vectorStoreCls: C,
    options: {
      k?: number;
      inputKeys?: string[];
    } & Parameters<C["fromTexts"]>[3] = {}
  ): Promise<SemanticSimilarityExampleSelector> {
    const inputKeys = options.inputKeys ?? null;
    const stringExamples = examples.map((example) =>
      sortedValues(
        inputKeys
          ? inputKeys.reduce(
              (acc, key) => ({ ...acc, [key]: example[key] }),
              {} as Record<string, string>
            )
          : example
      ).join(" ")
    );

    const vectorStore = await vectorStoreCls.fromTexts(
      stringExamples,
      examples, // metadatas
      embeddings,
      options
    );

    return new SemanticSimilarityExampleSelector({
      vectorStore,
      k: options.k ?? 4,
      exampleKeys: options.exampleKeys,
      inputKeys: options.inputKeys,
    });
  }
}
