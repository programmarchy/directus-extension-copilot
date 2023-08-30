/* eslint-disable @typescript-eslint/no-explicit-any */
import weaviate from "weaviate-ts-client";
import { WeaviateStore } from "langchain/vectorstores/weaviate";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";

export async function run() {
  // Something wrong with the weaviate-ts-client types, so we need to disable
  const client = (weaviate as any).client({
    scheme: process.env.WEAVIATE_SCHEME || "https",
    host: process.env.WEAVIATE_HOST || "localhost",
    apiKey: new (weaviate as any).ApiKey(
      process.env.WEAVIATE_API_KEY || "default"
    ),
  });

  // Create a store for an existing index
  const store = await WeaviateStore.fromExistingIndex(new OpenAIEmbeddings(), {
    client,
    indexName: "Test",
    metadataKeys: ["foo"],
  });

  const docs = [{ pageContent: "see ya!", metadata: { foo: "bar" } }];

  // Also supports an additional {ids: []} parameter for upsertion
  const ids = await store.addDocuments(docs);

  // Search the index without any filters
  const results = await store.similaritySearch("see ya!", 1);
  console.log(results);
  /*
  [ Document { pageContent: 'see ya!', metadata: { foo: 'bar' } } ]
  */

  // Delete documents with ids
  await store.delete({ ids });

  const results2 = await store.similaritySearch("see ya!", 1);
  console.log(results2);
  /*
  []
  */

  const docs2 = [
    { pageContent: "hello world", metadata: { foo: "bar" } },
    { pageContent: "hi there", metadata: { foo: "baz" } },
    { pageContent: "how are you", metadata: { foo: "qux" } },
    { pageContent: "hello world", metadata: { foo: "bar" } },
    { pageContent: "bye now", metadata: { foo: "bar" } },
  ];

  await store.addDocuments(docs2);

  const results3 = await store.similaritySearch("hello world", 1);
  console.log(results3);
  /*
  [ Document { pageContent: 'hello world', metadata: { foo: 'bar' } } ]
  */

  // delete documents with filter
  await store.delete({
    filter: {
      where: {
        operator: "Equal",
        path: ["foo"],
        valueText: "bar",
      },
    },
  });

  const results4 = await store.similaritySearch("hello world", 1, {
    where: {
      operator: "Equal",
      path: ["foo"],
      valueText: "bar",
    },
  });
  console.log(results4);
  /*
  []
  */
}
