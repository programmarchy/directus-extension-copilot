import { GoogleVertexAI } from "langchain/llms/googlevertexai";

/*
 * Before running this, you should make sure you have created a
 * Google Cloud Project that is permitted to the Vertex AI API.
 *
 * You will also need permission to access this project / API.
 * Typically, this is done in one of three ways:
 * - You are logged into an account permitted to that project.
 * - You are running this on a machine using a service account permitted to
 *   the project.
 * - The `GOOGLE_APPLICATION_CREDENTIALS` environment variable is set to the
 *   path of a credentials file for a service account permitted to the project.
 */

const model = new GoogleVertexAI({
  model: "code-bison",
  maxOutputTokens: 2048,
});
const res = await model.call("A Javascript function that counts from 1 to 10.");
console.log({ res });
