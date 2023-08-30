import { load } from "@tensorflow-models/universal-sentence-encoder";
import * as tf from "@tensorflow/tfjs-core";

import { Embeddings, EmbeddingsParams } from "./base.js";

/**
 * Interface that extends EmbeddingsParams and defines additional
 * parameters specific to the TensorFlowEmbeddings class.
 */
export interface TensorFlowEmbeddingsParams extends EmbeddingsParams {}

/**
 * Class that extends the Embeddings class and provides methods for
 * generating embeddings using the Universal Sentence Encoder model from
 * TensorFlow.js.
 */
export class TensorFlowEmbeddings extends Embeddings {
  constructor(fields?: TensorFlowEmbeddingsParams) {
    super(fields ?? {});

    try {
      tf.backend();
    } catch (e) {
      throw new Error("No TensorFlow backend found, see instructions at ...");
    }
  }

  _cached: ReturnType<typeof load>;

  /**
   * Private method that loads the Universal Sentence Encoder model if it
   * hasn't been loaded already. It returns a promise that resolves to the
   * loaded model.
   * @returns Promise that resolves to the loaded Universal Sentence Encoder model.
   */
  private async load() {
    if (this._cached === undefined) {
      this._cached = load();
    }
    return this._cached;
  }

  private _embed(texts: string[]) {
    return this.caller.call(async () => {
      const model = await this.load();
      return model.embed(texts);
    });
  }

  /**
   * Method that takes a document as input and returns a promise that
   * resolves to an embedding for the document. It calls the _embed method
   * with the document as the input and processes the result to return a
   * single embedding.
   * @param document Document to generate an embedding for.
   * @returns Promise that resolves to an embedding for the input document.
   */
  embedQuery(document: string): Promise<number[]> {
    return this._embed([document])
      .then((embeddings) => embeddings.array())
      .then((embeddings) => embeddings[0]);
  }

  /**
   * Method that takes an array of documents as input and returns a promise
   * that resolves to a 2D array of embeddings for each document. It calls
   * the _embed method with the documents as the input and processes the
   * result to return the embeddings.
   * @param documents Array of documents to generate embeddings for.
   * @returns Promise that resolves to a 2D array of embeddings for each input document.
   */
  embedDocuments(documents: string[]): Promise<number[][]> {
    return this._embed(documents).then((embeddings) => embeddings.array());
  }
}
