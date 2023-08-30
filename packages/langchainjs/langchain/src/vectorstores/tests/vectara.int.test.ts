/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-process-env */
import fs from "fs";
import { expect, beforeAll } from "@jest/globals";
import { FakeEmbeddings } from "../../embeddings/fake.js";
import { Document } from "../../document.js";
import { VectaraLibArgs, VectaraStore } from "../vectara.js";

const getDocs = (): Document[] => {
  const hashCode = (s: string) =>
    s.split("").reduce((a, b) => {
      // eslint-disable-next-line no-param-reassign
      a = ((a << 5) - a + b.charCodeAt(0)) | 0;
      return a;
    }, 0);

  // Some text from Lord of the Rings
  const englishOne = `It all depends on what you want. You can trust us to stick to you through thick and thin to the
    bitter end. And you can trust us to keep any secret of yours - closer than you keep it yourself.
    But you cannot trust us to let you face trouble alone, and go off without a word. We are your
    friends, Frodo. Anyway: there it is. We know most of what Gandalf has told you. We know a good
    deal about the Ring. We are horribly afraid - but we are coming with you; or following you
    like hounds.`;
  const englishTwo = `Sam lay back, and stared with open mouth, and for a moment, between bewilderment and great joy,
    he could not answer. At last he gasped: “Gandalf! I thought you were dead! But then I thought I
    was dead myself. Is everything sad going to come untrue? What's happened to the world?`;
  const frenchOne = `Par exemple, sur la planète Terre, l'homme a toujours supposé qu'il était plus intelligent que les dauphins
    parce qu'il avait accompli tant de choses - la roue, New York, les guerres, etc. passer du
    bon temps. Mais à l'inverse, les dauphins ont toujours cru qu'ils étaient bien plus
    intelligents que l'homme, pour les mêmes raisons précisément.`;

  const documents = [
    new Document({
      pageContent: englishOne,
      metadata: {
        document_id: hashCode(englishOne).toString(), // Generate a hashcode for document id based on the text
        title: "Lord of the Rings",
        author: "Tolkien",
        genre: "fiction",
        lang: "eng",
      },
    }),
    new Document({
      pageContent: englishTwo,
      metadata: {
        document_id: hashCode(englishTwo).toString(), // Generate a hashcode for document id based on the text
        title: "Lord of the Rings",
        author: "Tolkien",
        genre: "fiction",
        lang: "eng",
      },
    }),
    new Document({
      pageContent: frenchOne,
      metadata: {
        document_id: hashCode(frenchOne).toString(), // Generate a hashcode for document id based on the text
        title: "The hitchhiker's guide to the galaxy",
        author: "Douglas Adams",
        genre: "fiction",
        lang: "fra",
      },
    }),
  ];
  return documents;
};

describe("VectaraStore", () => {
  ["VECTARA_CUSTOMER_ID", "VECTARA_CORPUS_ID", "VECTARA_API_KEY"].forEach(
    (envVar) => {
      if (!process.env[envVar]) {
        throw new Error(`${envVar} not set`);
      }
    }
  );

  describe("fromTexts", () => {
    const args: VectaraLibArgs = {
      customerId: Number(process.env.VECTARA_CUSTOMER_ID) || 0,
      corpusId: Number(process.env.VECTARA_CORPUS_ID) || 0,
      apiKey: process.env.VECTARA_API_KEY || "",
    };

    test.skip("with fakeEmbeddings doesn't throw error", () => {
      expect(() =>
        VectaraStore.fromTexts([], [], new FakeEmbeddings(), args)
      ).not.toThrow();
    });
  });

  describe("fromDocuments", () => {
    const args: VectaraLibArgs = {
      customerId: Number(process.env.VECTARA_CUSTOMER_ID) || 0,
      corpusId: Number(process.env.VECTARA_CORPUS_ID) || 0,
      apiKey: process.env.VECTARA_API_KEY || "",
    };

    test.skip("with fakeEmbeddings doesn't throw error", async () => {
      await expect(
        VectaraStore.fromDocuments(getDocs(), new FakeEmbeddings(), args)
      ).resolves.toBeDefined();
    });
  });

  describe("access operations", () => {
    let store: VectaraStore;

    beforeAll(async () => {
      store = new VectaraStore({
        customerId: Number(process.env.VECTARA_CUSTOMER_ID) || 0,
        corpusId: Number(process.env.VECTARA_CORPUS_ID) || 0,
        apiKey: process.env.VECTARA_API_KEY || "",
      });
    });

    test.skip("addDocuments", async () => {
      await store.addDocuments(getDocs());
    });

    test.skip("similaritySearchWithScore", async () => {
      const resultsWithScore = await store.similaritySearchWithScore(
        "What did Sam do?",
        10, // Number of results needed
        { lambda: 0.025 }
      );
      expect(resultsWithScore.length).toBeGreaterThan(0);
      expect(resultsWithScore[0][0].pageContent.length).toBeGreaterThan(0);
      expect(resultsWithScore[0][0].metadata.length).toBeGreaterThan(0);
      expect(
        resultsWithScore[0][0].metadata.find(
          (item: { name: string }) => item.name === "title"
        ).value
      ).toBe("Lord of the Rings");
      expect(resultsWithScore[0][1]).toBeGreaterThan(0);
    });

    test.skip("similaritySearch", async () => {
      const results = await store.similaritySearch(
        "Was Gandalf dead?",
        10, // Number of results needed
        {
          lambda: 0.025,
          contextConfig: {
            sentencesAfter: 1,
            sentencesBefore: 1,
          },
        }
      );
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].pageContent.length).toBeGreaterThan(0);
      expect(results[0].metadata.length).toBeGreaterThan(0);
    });

    test.skip("similaritySearch with filter", async () => {
      const results = await store.similaritySearch(
        "Was Gandalf dead?",
        10, // Number of results needed
        { filter: "part.lang = 'fra'", lambda: 0.025 } // Filter on the language of the document
      );
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].pageContent.length).toBeGreaterThan(0);
      // Query filtered on French, so we expect only French results
      const hasEnglish = results.some(
        (result) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result.metadata.lang === "eng"
      );
      expect(hasEnglish).toBe(false);
    });

    it("addFiles", async () => {
      const docs = getDocs();
      const englishOneContent = docs[0].pageContent;
      const frenchOneContent = docs[2].pageContent;

      const files = [
        { filename: "englishOne.txt", content: englishOneContent },
        { filename: "frenchOne.txt", content: frenchOneContent },
      ];

      const blobs = [];
      for (const file of files) {
        fs.writeFileSync(file.filename, file.content);

        const buffer = fs.readFileSync(file.filename);
        blobs.push(new Blob([buffer], { type: "text/plain" }));
      }

      const bitcoinBuffer = fs.readFileSync(
        "../examples/src/document_loaders/example_data/bitcoin.pdf"
      );
      blobs.push(new Blob([bitcoinBuffer], { type: "application/pdf" }));

      const results = await store.addFiles(blobs);

      for (const file of files) {
        fs.unlinkSync(file.filename);
      }

      expect(results).toEqual(3);
      const searchResults = await store.similaritySearch("What is bitcoin");
      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchResults[0].pageContent).toContain(
        "A Peer-to-Peer Electronic Cash System"
      );
    });
  });
});
