import { ChatCompletionRequestMessageFunctionCall } from "openai";
import { CallbackManager } from "../../callbacks/manager.js";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { BasePromptTemplate } from "../../prompts/base.js";
import {
  AIMessage,
  AgentAction,
  AgentFinish,
  AgentStep,
  BaseMessage,
  FunctionMessage,
  ChainValues,
  SystemMessage,
} from "../../schema/index.js";
import { StructuredTool } from "../../tools/base.js";
import { Agent, AgentArgs } from "../agent.js";
import { AgentInput } from "../types.js";
import { PREFIX } from "./prompt.js";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  MessagesPlaceholder,
  SystemMessagePromptTemplate,
} from "../../prompts/chat.js";
import { BaseLanguageModel } from "../../base_language/index.js";
import { LLMChain } from "../../chains/llm_chain.js";
import { OutputParserException } from "../../schema/output_parser.js";

/**
 * Type that represents an agent action with an optional message log.
 */
type FunctionsAgentAction = AgentAction & {
  messageLog?: BaseMessage[];
};

/**
 * Parses the output message into a FunctionsAgentAction or AgentFinish
 * object.
 * @param message The BaseMessage to parse.
 * @returns A FunctionsAgentAction or AgentFinish object.
 */
function parseOutput(message: BaseMessage): FunctionsAgentAction | AgentFinish {
  if (message.additional_kwargs.function_call) {
    // eslint-disable-next-line prefer-destructuring
    const function_call: ChatCompletionRequestMessageFunctionCall =
      message.additional_kwargs.function_call;
    try {
      const toolInput = function_call.arguments
        ? JSON.parse(function_call.arguments)
        : {};
      return {
        tool: function_call.name as string,
        toolInput,
        log: `Invoking "${function_call.name}" with ${
          function_call.arguments ?? "{}"
        }\n${message.content}`,
        messageLog: [message],
      };
    } catch (error) {
      throw new OutputParserException(
        `Failed to parse function arguments from chat model response. Text: "${function_call.arguments}". ${error}`
      );
    }
  } else {
    return { returnValues: { output: message.content }, log: message.content };
  }
}

/**
 * Checks if the given action is a FunctionsAgentAction.
 * @param action The action to check.
 * @returns True if the action is a FunctionsAgentAction, false otherwise.
 */
function isFunctionsAgentAction(
  action: AgentAction | FunctionsAgentAction
): action is FunctionsAgentAction {
  return (action as FunctionsAgentAction).messageLog !== undefined;
}

function _convertAgentStepToMessages(
  action: AgentAction | FunctionsAgentAction,
  observation: string
) {
  if (isFunctionsAgentAction(action) && action.messageLog !== undefined) {
    return action.messageLog?.concat(
      new FunctionMessage(observation, action.tool)
    );
  } else {
    return [new AIMessage(action.log)];
  }
}

export function _formatIntermediateSteps(
  intermediateSteps: AgentStep[]
): BaseMessage[] {
  return intermediateSteps.flatMap(({ action, observation }) =>
    _convertAgentStepToMessages(action, observation)
  );
}

/**
 * Interface for the input data required to create an OpenAIAgent.
 */
export interface OpenAIAgentInput extends AgentInput {
  tools: StructuredTool[];
}

/**
 * Interface for the arguments required to create a prompt for an
 * OpenAIAgent.
 */
export interface OpenAIAgentCreatePromptArgs {
  prefix?: string;
  systemMessage?: SystemMessage;
}

/**
 * Class representing an agent for the OpenAI chat model in LangChain. It
 * extends the Agent class and provides additional functionality specific
 * to the OpenAIAgent type.
 */
export class OpenAIAgent extends Agent {
  static lc_name() {
    return "OpenAIAgent";
  }

  lc_namespace = ["langchain", "agents", "openai"];

  _agentType() {
    return "openai-functions" as const;
  }

  observationPrefix() {
    return "Observation: ";
  }

  llmPrefix() {
    return "Thought:";
  }

  _stop(): string[] {
    return ["Observation:"];
  }

  tools: StructuredTool[];

  constructor(input: Omit<OpenAIAgentInput, "outputParser">) {
    super({ ...input, outputParser: undefined });
    this.tools = input.tools;
  }

  /**
   * Creates a prompt for the OpenAIAgent using the provided tools and
   * fields.
   * @param _tools The tools to be used in the prompt.
   * @param fields Optional fields for creating the prompt.
   * @returns A BasePromptTemplate object representing the created prompt.
   */
  static createPrompt(
    _tools: StructuredTool[],
    fields?: OpenAIAgentCreatePromptArgs
  ): BasePromptTemplate {
    const { prefix = PREFIX } = fields || {};
    return ChatPromptTemplate.fromPromptMessages([
      SystemMessagePromptTemplate.fromTemplate(prefix),
      new MessagesPlaceholder("chat_history"),
      HumanMessagePromptTemplate.fromTemplate("{input}"),
      new MessagesPlaceholder("agent_scratchpad"),
    ]);
  }

  /**
   * Creates an OpenAIAgent from a BaseLanguageModel and a list of tools.
   * @param llm The BaseLanguageModel to use.
   * @param tools The tools to be used by the agent.
   * @param args Optional arguments for creating the agent.
   * @returns An instance of OpenAIAgent.
   */
  static fromLLMAndTools(
    llm: BaseLanguageModel,
    tools: StructuredTool[],
    args?: OpenAIAgentCreatePromptArgs & Pick<AgentArgs, "callbacks">
  ) {
    OpenAIAgent.validateTools(tools);
    if (llm._modelType() !== "base_chat_model" || llm._llmType() !== "openai") {
      throw new Error("OpenAIAgent requires an OpenAI chat model");
    }
    const prompt = OpenAIAgent.createPrompt(tools, args);
    const chain = new LLMChain({
      prompt,
      llm,
      callbacks: args?.callbacks,
    });
    return new OpenAIAgent({
      llmChain: chain,
      allowedTools: tools.map((t) => t.name),
      tools,
    });
  }

  /**
   * Constructs a scratch pad from a list of agent steps.
   * @param steps The steps to include in the scratch pad.
   * @returns A string or a list of BaseMessages representing the constructed scratch pad.
   */
  async constructScratchPad(
    steps: AgentStep[]
  ): Promise<string | BaseMessage[]> {
    return _formatIntermediateSteps(steps);
  }

  /**
   * Plans the next action or finish state of the agent based on the
   * provided steps, inputs, and optional callback manager.
   * @param steps The steps to consider in planning.
   * @param inputs The inputs to consider in planning.
   * @param callbackManager Optional CallbackManager to use in planning.
   * @returns A Promise that resolves to an AgentAction or AgentFinish object representing the planned action or finish state.
   */
  async plan(
    steps: Array<AgentStep>,
    inputs: ChainValues,
    callbackManager?: CallbackManager
  ): Promise<AgentAction | AgentFinish> {
    // Add scratchpad and stop to inputs
    const thoughts = await this.constructScratchPad(steps);
    const newInputs: ChainValues = {
      ...inputs,
      agent_scratchpad: thoughts,
    };
    if (this._stop().length !== 0) {
      newInputs.stop = this._stop();
    }

    // Split inputs between prompt and llm
    const llm = this.llmChain.llm as ChatOpenAI;
    const valuesForPrompt = { ...newInputs };
    const valuesForLLM: (typeof llm)["CallOptions"] = {
      tools: this.tools,
    };
    for (const key of this.llmChain.llm.callKeys) {
      if (key in inputs) {
        valuesForLLM[key as keyof (typeof llm)["CallOptions"]] = inputs[key];
        delete valuesForPrompt[key];
      }
    }

    const promptValue = await this.llmChain.prompt.formatPromptValue(
      valuesForPrompt
    );
    const message = await llm.predictMessages(
      promptValue.toChatMessages(),
      valuesForLLM,
      callbackManager
    );
    return parseOutput(message);
  }
}
