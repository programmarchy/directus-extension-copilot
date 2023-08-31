import 'crypto';
import { ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate } from 'langchain/prompts';
import { createOpenAPIChain, BaseChain } from 'langchain/chains';
import { ChainValues } from 'langchain/schema';
import { CallbackManagerForChainRun } from 'langchain/callbacks';
import { createStructuredOutputChain } from 'langchain/chains/openai_functions';
import { ChatOpenAI } from 'langchain/chat_models/openai';
import type { Logger } from '../types';

const basePrompt = (
  `You are a helpful AI copilot. Your job is to support and help the user answer questions about their data. ` +
  `Sometimes you may need to call Directus API endpoints to get the data you need to answer the user's question. ` +
  `You will be given a context and a question. Answer the question based on the context.`
);

type AskOutput = {
  response: string;
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

  async ask(question: string): Promise<AskOutput> {
    const openApiChain = await createOpenAPIChain(this.spec, {
      verbose: this.verbose,
      headers: this.headers,
      llm: new ChatOpenAI({
        modelName: this.llm,
        configuration: {
          apiKey: this.apiKey,
        },
      }),
      requestChain: new SimpleRequestChain({
        requestMethod: async (name, args) => {
          console.log(name, args);
          throw Error('Request failed.');
        }
      }),
    });

    this.logger?.info(openApiChain.chains[0]);

    let apiOutput: string | undefined;
    try {
      this.logger?.info('Calling the API endpoint...');
      const result = await openApiChain.run(question);
      if (result) {
        this.logger?.info(`Got an API result: ${result}`);
        apiOutput = JSON.stringify(JSON.parse(result));
        this.logger?.info('Parsed response.');
      }
    } catch (err) {
      this.logger?.warn(err);
    }
  
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
            description: `The answer to the user's question in Markdown.`,
          },
        },
      },
    });
  
    const output = await structuredOutputChain.run({
      question
    }) as any;
  
    return output;
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
        'Based on the previous user question and the chat context, provide a helpful answer in Markdown format:',
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

/**
 * Type representing a function for executing simple requests.
 */
type SimpleRequestChainExecutionMethod = (
  name: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  requestArgs: Record<string, any>
) => Promise<string>;

/**
 * A chain for making simple API requests.
 */
class SimpleRequestChain extends BaseChain {
  static lc_name() {
    return "SimpleRequestChain";
  }

  private requestMethod: SimpleRequestChainExecutionMethod;

  inputKey = "function";

  outputKey = "response";

  constructor(config: { requestMethod: SimpleRequestChainExecutionMethod }) {
    super();
    this.requestMethod = config.requestMethod;
  }

  get inputKeys() {
    return [this.inputKey];
  }

  get outputKeys() {
    return [this.outputKey];
  }

  _chainType() {
    return "simple_request_chain" as const;
  }

  /** @ignore */
  async _call(
    values: ChainValues,
    _runManager?: CallbackManagerForChainRun
  ): Promise<ChainValues> {
    const inputKeyValue = values[this.inputKey];
    const methodName = inputKeyValue.name;
    const args = inputKeyValue.arguments;
    const response = await this.requestMethod(methodName, args);
    return { [this.outputKey]: response };
  }
}
