import { ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate } from 'langchain/prompts';
import { createOpenAPIChain, BaseChain } from 'langchain/chains';
import { ChainValues } from 'langchain/schema';
import { CallbackManagerForChainRun } from 'langchain/callbacks';
import { createStructuredOutputChain } from 'langchain/chains/openai_functions';
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { getOperationInfoMap, OperationInfo } from '../utils/oas';
import type { Logger } from '../types';

const basePrompt = (
  `You are a helpful AI copilot. Your job is to support and help the user answer questions about their data. ` +
  `Sometimes you may need to call Directus API endpoints to get the data you need to answer the user's question. ` +
  `You will be given a context and a question. Answer the question based on the context.`
);

type AiResult = {
  state: 'api' | 'chat';
  message: string;
  api?: {
    method: string;
    path: string;
    description?: string;
    args: Record<string, any>;
  }
};

export type AiServiceOptions = {
  apiKey?: string;
  verbose?: boolean;
  headers?: Record<string, string>;
  llm?: string;
  logger?: Logger;
}

export class AiService {
  spec: any;
  apiKey?: string;
  verbose?: boolean;
  headers?: Record<string, string>;
  llm?: string;
  logger?: Logger;

  constructor(spec: any, options: AiServiceOptions = {}) {
    this.spec = spec;
    this.apiKey = options.apiKey;
    this.verbose = options.verbose;
    this.headers = options.headers;
    this.llm = options.llm;
    this.logger = options.logger;

    return this;
  }

  async ask(question: string): Promise<AiResult> {
    const openApiChain = await createOpenAPIChain(this.spec, {
      verbose: this.verbose,
      headers: this.headers,
      llm: new ChatOpenAI({
        modelName: this.llm,
        configuration: {
          apiKey: this.apiKey,
        },
      }),
      requestChain: new PassThroughChain(),
    });

    type RunOutput = {
      name: string;
      args: Record<string, any>;
    };

    const output: RunOutput = await openApiChain.run(question) as any;
    const { name, args } = output;

    const map = getOperationInfoMap(this.spec);
    const op = map.get(name);
    if (!op) {
      throw new Error(`Could not find the API to call.`);
    }

    function formatMessage(op: OperationInfo): string {
      if (op.description) {
        const  { description: s } = op;
        const formattedDescription = (s.charAt(0).toLowerCase() + s.slice(1)).replace(/\.$/, '');
        return `Calling the API to ${formattedDescription}...`;
      } else {
        return `Calling the API...`;
      }
    }

    return {
      state: 'api',
      message: formatMessage(op),
      api: {
        ...op,
        args,
      },
    };
  }

  async askCallback(question: string, apiOutput?: string): Promise<AiResult> {
    const promptTemplate = await getChatPromptTemplate({
      apiOutput,
      basePrompt,
      question,
    });
  
    const structuredOutputChain = createStructuredOutputChain({
      verbose: this.verbose,
      llm: new ChatOpenAI({
        modelName: this.llm,
        temperature: 0,
        configuration: {
          apiKey: this.apiKey,
        },
      }),
      prompt: promptTemplate,
      outputSchema: {
        type: 'object',
        properties: {
          'response': {
            type: 'string',
            description: `The answer to the user's question in plain text.`,
          },
        },
      },
    });
  
    type RunOutput = {
      response: string;
    };

    const output: RunOutput = await structuredOutputChain.run(question) as any;
    const { response } = output;
  
    return {
      state: 'chat',
      message: response,
    };
  }
}

type GetChatPromptTemplateParams = {
  basePrompt: string;
  question: string;
  apiOutput?: string;
};

async function getChatPromptTemplate({ basePrompt, question, apiOutput }: GetChatPromptTemplateParams): Promise<ChatPromptTemplate> {
  if (apiOutput) {
    return await ChatPromptTemplate.fromPromptMessages([
      SystemMessagePromptTemplate.fromTemplate(
        '{base_prompt}'
      ),
      SystemMessagePromptTemplate.fromTemplate(
        'Do not let the user know that you are calling an API endpoint. ' +
        'Do not ask follow up questions. ' +
        'Try to get the job done in one go.'
      ),
      SystemMessagePromptTemplate.fromTemplate(
        'Calling the API endpoint...'
      ),
      SystemMessagePromptTemplate.fromTemplate(
        'The API was called successfully.'
      ),
      SystemMessagePromptTemplate.fromTemplate(
        'The API response is:\n```\n{api_output}\n```'
      ),
      HumanMessagePromptTemplate.fromTemplate(
        '{user_question}'
      ),
      SystemMessagePromptTemplate.fromTemplate(
        'Based on the previous user question and the chat context, provide a helpful answer in plain text format:',
      ),
    ]).partial({
      base_prompt: basePrompt,
      api_output: apiOutput,
      user_question: question,
    });
  } else {
    return await ChatPromptTemplate.fromPromptMessages([
      SystemMessagePromptTemplate.fromTemplate(
        '{base_prompt}'
      ),
      SystemMessagePromptTemplate.fromTemplate(
        'The API output is unavailable.'
      ),
      HumanMessagePromptTemplate.fromTemplate(
        '{user_question}'
      ),
      SystemMessagePromptTemplate.fromTemplate(
        'Although the API output is unavailable, do your best to provide a helpful response:',
      ),
    ]).partial({
      base_prompt: basePrompt,
      user_question: question,
    });
  }
}

// This chain simply passes through the input to the output.
// We don't want to actually call the API endpoint in the chain,
// so instead we pass it through so it can be sent back to the
// caller to handle.
class PassThroughChain extends BaseChain {
  static lc_name() {
    return "PassThroughChain";
  }

  constructor() {
    super();
  }

  inputKey = "function";

  outputKey = "response";

  get inputKeys() {
    return [this.inputKey];
  }

  get outputKeys() {
    return [this.outputKey];
  }

  _chainType() {
    return "pass_through_chain" as const;
  }

  /** @ignore */
  async _call(
    values: ChainValues,
    _runManager?: CallbackManagerForChainRun
  ): Promise<ChainValues> {
    const inputKeyValue = values[this.inputKey];
    const response = {
      name: inputKeyValue.name,
      args: inputKeyValue.arguments,
    };
    return {
      [this.outputKey]: response,
    };
  }
}
