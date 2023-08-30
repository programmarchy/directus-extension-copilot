import { BaseLanguageModel } from "../../../base_language/index.js";
import { Tool } from "../../../tools/base.js";
import { DynamicTool } from "../../../tools/dynamic.js";
import { JsonSpec } from "../../../tools/json.js";
import { AgentExecutor } from "../../executor.js";
import {
  OPENAPI_PREFIX,
  OPENAPI_SUFFIX,
  JSON_EXPLORER_DESCRIPTION,
} from "./prompt.js";
import { LLMChain } from "../../../chains/llm_chain.js";
import { ZeroShotCreatePromptArgs, ZeroShotAgent } from "../../mrkl/index.js";
import { Toolkit } from "../base.js";
import {
  Headers,
  RequestsGetTool,
  RequestsPostTool,
} from "../../../tools/requests.js";
import { createJsonAgent, JsonToolkit } from "../json/json.js";

/**
 * Represents a toolkit for making HTTP requests. It initializes the
 * request tools based on the provided headers.
 */
export class RequestsToolkit extends Toolkit {
  tools: Tool[];

  constructor(headers?: Headers) {
    super();
    this.tools = [new RequestsGetTool(headers), new RequestsPostTool(headers)];
  }
}

/**
 * Extends the `RequestsToolkit` class and adds a dynamic tool for
 * exploring JSON data. It creates a JSON agent using the `JsonToolkit`
 * and the provided language model, and adds the JSON explorer tool to the
 * toolkit.
 */
export class OpenApiToolkit extends RequestsToolkit {
  constructor(jsonSpec: JsonSpec, llm: BaseLanguageModel, headers?: Headers) {
    super(headers);
    const jsonAgent = createJsonAgent(llm, new JsonToolkit(jsonSpec));
    this.tools = [
      ...this.tools,
      new DynamicTool({
        name: "json_explorer",
        func: async (input: string) => {
          const result = await jsonAgent.call({ input });
          return result.output as string;
        },
        description: JSON_EXPLORER_DESCRIPTION,
      }),
    ];
  }
}

/**
 * Creates an OpenAPI agent using a language model, an OpenAPI toolkit,
 * and optional prompt arguments. It creates a prompt for the agent using
 * the OpenAPI tools and the provided prefix and suffix. It then creates a
 * ZeroShotAgent with the prompt and the OpenAPI tools, and returns an
 * AgentExecutor for executing the agent with the tools.
 * @param llm The language model to use.
 * @param openApiToolkit The OpenAPI toolkit to use.
 * @param args Optional arguments for creating the prompt.
 * @returns An AgentExecutor for executing the agent with the tools.
 */
export function createOpenApiAgent(
  llm: BaseLanguageModel,
  openApiToolkit: OpenApiToolkit,
  args?: ZeroShotCreatePromptArgs
) {
  const {
    prefix = OPENAPI_PREFIX,
    suffix = OPENAPI_SUFFIX,
    inputVariables = ["input", "agent_scratchpad"],
  } = args ?? {};

  const { tools } = openApiToolkit;
  const prompt = ZeroShotAgent.createPrompt(tools, {
    prefix,
    suffix,
    inputVariables,
  });
  const chain = new LLMChain({
    prompt,
    llm,
  });
  const toolNames = tools.map((tool) => tool.name);
  const agent = new ZeroShotAgent({ llmChain: chain, allowedTools: toolNames });
  return AgentExecutor.fromAgentAndTools({
    agent,
    tools,
    returnIntermediateSteps: true,
  });
}
