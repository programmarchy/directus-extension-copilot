import { BaseLanguageModel } from "../../base_language/index.js";
import { LLMChain } from "../../chains/llm_chain.js";
import { PromptTemplate } from "../../prompts/prompt.js";
import { renderTemplate } from "../../prompts/template.js";
import { Tool } from "../../tools/base.js";
import { Optional } from "../../types/type-utils.js";
import { Agent, AgentArgs, OutputParserArgs } from "../agent.js";
import { deserializeHelper } from "../helpers.js";
import {
  AgentInput,
  SerializedFromLLMAndTools,
  SerializedZeroShotAgent,
} from "../types.js";
import { ZeroShotAgentOutputParser } from "./outputParser.js";
import { FORMAT_INSTRUCTIONS, PREFIX, SUFFIX } from "./prompt.js";

/**
 * Interface for creating a prompt for the ZeroShotAgent.
 */
export interface ZeroShotCreatePromptArgs {
  /** String to put after the list of tools. */
  suffix?: string;
  /** String to put before the list of tools. */
  prefix?: string;
  /** List of input variables the final prompt will expect. */
  inputVariables?: string[];
}

/**
 * Type for the input to the ZeroShotAgent, with the 'outputParser'
 * property made optional.
 */
export type ZeroShotAgentInput = Optional<AgentInput, "outputParser">;

/**
 * Agent for the MRKL chain.
 * @augments Agent
 */
export class ZeroShotAgent extends Agent {
  static lc_name() {
    return "ZeroShotAgent";
  }

  lc_namespace = ["langchain", "agents", "mrkl"];

  declare ToolType: Tool;

  constructor(input: ZeroShotAgentInput) {
    const outputParser =
      input?.outputParser ?? ZeroShotAgent.getDefaultOutputParser();
    super({ ...input, outputParser });
  }

  _agentType() {
    return "zero-shot-react-description" as const;
  }

  observationPrefix() {
    return "Observation: ";
  }

  llmPrefix() {
    return "Thought:";
  }

  /**
   * Returns the default output parser for the ZeroShotAgent.
   * @param fields Optional arguments for the output parser.
   * @returns An instance of ZeroShotAgentOutputParser.
   */
  static getDefaultOutputParser(fields?: OutputParserArgs) {
    return new ZeroShotAgentOutputParser(fields);
  }

  /**
   * Validates the tools for the ZeroShotAgent. Throws an error if any tool
   * does not have a description.
   * @param tools List of tools to validate.
   */
  static validateTools(tools: Tool[]) {
    const descriptionlessTool = tools.find((tool) => !tool.description);
    if (descriptionlessTool) {
      const msg =
        `Got a tool ${descriptionlessTool.name} without a description.` +
        ` This agent requires descriptions for all tools.`;
      throw new Error(msg);
    }
  }

  /**
   * Create prompt in the style of the zero shot agent.
   *
   * @param tools - List of tools the agent will have access to, used to format the prompt.
   * @param args - Arguments to create the prompt with.
   * @param args.suffix - String to put after the list of tools.
   * @param args.prefix - String to put before the list of tools.
   * @param args.inputVariables - List of input variables the final prompt will expect.
   */
  static createPrompt(tools: Tool[], args?: ZeroShotCreatePromptArgs) {
    const {
      prefix = PREFIX,
      suffix = SUFFIX,
      inputVariables = ["input", "agent_scratchpad"],
    } = args ?? {};
    const toolStrings = tools
      .map((tool) => `${tool.name}: ${tool.description}`)
      .join("\n");

    const toolNames = tools.map((tool) => tool.name);

    const formatInstructions = renderTemplate(FORMAT_INSTRUCTIONS, "f-string", {
      tool_names: toolNames,
    });

    const template = [prefix, toolStrings, formatInstructions, suffix].join(
      "\n\n"
    );

    return new PromptTemplate({
      template,
      inputVariables,
    });
  }

  /**
   * Creates a ZeroShotAgent from a Large Language Model and a set of tools.
   * @param llm The Large Language Model to use.
   * @param tools The tools for the agent to use.
   * @param args Optional arguments for creating the agent.
   * @returns A new instance of ZeroShotAgent.
   */
  static fromLLMAndTools(
    llm: BaseLanguageModel,
    tools: Tool[],
    args?: ZeroShotCreatePromptArgs & AgentArgs
  ) {
    ZeroShotAgent.validateTools(tools);
    const prompt = ZeroShotAgent.createPrompt(tools, args);
    const outputParser =
      args?.outputParser ?? ZeroShotAgent.getDefaultOutputParser();
    const chain = new LLMChain({
      prompt,
      llm,
      callbacks: args?.callbacks ?? args?.callbackManager,
    });

    return new ZeroShotAgent({
      llmChain: chain,
      allowedTools: tools.map((t) => t.name),
      outputParser,
    });
  }

  static async deserialize(
    data: SerializedZeroShotAgent & { llm?: BaseLanguageModel; tools?: Tool[] }
  ): Promise<ZeroShotAgent> {
    const { llm, tools, ...rest } = data;
    return deserializeHelper(
      llm,
      tools,
      rest,
      (
        llm: BaseLanguageModel,
        tools: Tool[],
        args: SerializedFromLLMAndTools
      ) =>
        ZeroShotAgent.fromLLMAndTools(llm, tools, {
          prefix: args.prefix,
          suffix: args.suffix,
          inputVariables: args.input_variables,
        }),
      (args) => new ZeroShotAgent(args)
    );
  }
}
