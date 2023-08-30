import {
  Configuration,
  OpenAIApi,
  ConfigurationParameters,
  CreateModerationRequest,
  CreateModerationResponseResultsInner,
} from "openai";
import { BaseChain, ChainInputs } from "./base.js";
import { ChainValues } from "../schema/index.js";
import fetchAdapter from "../util/axios-fetch-adapter.js";
import { AsyncCaller, AsyncCallerParams } from "../util/async_caller.js";
import { getEnvironmentVariable } from "../util/env.js";

/**
 * Interface for the input parameters of the OpenAIModerationChain class.
 */
export interface OpenAIModerationChainInput
  extends ChainInputs,
    AsyncCallerParams {
  openAIApiKey?: string;
  openAIOrganization?: string;
  throwError?: boolean;
  configuration?: ConfigurationParameters;
}

/**
 * Class representing a chain for moderating text using the OpenAI
 * Moderation API. It extends the BaseChain class and implements the
 * OpenAIModerationChainInput interface.
 */
export class OpenAIModerationChain
  extends BaseChain
  implements OpenAIModerationChainInput
{
  static lc_name() {
    return "OpenAIModerationChain";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      openAIApiKey: "OPENAI_API_KEY",
    };
  }

  inputKey = "input";

  outputKey = "output";

  openAIApiKey?: string;

  openAIOrganization?: string;

  clientConfig: Configuration;

  client: OpenAIApi;

  throwError: boolean;

  caller: AsyncCaller;

  constructor(fields?: OpenAIModerationChainInput) {
    super(fields);
    this.throwError = fields?.throwError ?? false;
    this.openAIApiKey =
      fields?.openAIApiKey ?? getEnvironmentVariable("OPENAI_API_KEY");

    if (!this.openAIApiKey) {
      throw new Error("OpenAI API key not found");
    }

    this.openAIOrganization = fields?.openAIOrganization;

    this.clientConfig = new Configuration({
      ...fields?.configuration,
      apiKey: this.openAIApiKey,
      organization: this.openAIOrganization,
      baseOptions: {
        adapter: fetchAdapter,
        ...fields?.configuration?.baseOptions,
      },
    });

    this.client = new OpenAIApi(this.clientConfig);

    this.caller = new AsyncCaller(fields ?? {});
  }

  _moderate(
    text: string,
    results: CreateModerationResponseResultsInner
  ): string {
    if (results.flagged) {
      const errorStr = "Text was found that violates OpenAI's content policy.";
      if (this.throwError) {
        throw new Error(errorStr);
      } else {
        return errorStr;
      }
    }
    return text;
  }

  async _call(values: ChainValues): Promise<ChainValues> {
    const text = values[this.inputKey];
    const moderationRequest: CreateModerationRequest = {
      input: text,
    };
    let mod;
    try {
      mod = await this.caller.call(() =>
        this.client.createModeration(moderationRequest)
      );
    } catch (error) {
      // eslint-disable-next-line no-instanceof/no-instanceof
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error(error as string);
      }
    }
    const output = this._moderate(text, mod.data.results[0]);
    return {
      [this.outputKey]: output,
    };
  }

  _chainType() {
    return "moderation_chain";
  }

  get inputKeys(): string[] {
    return [this.inputKey];
  }

  get outputKeys(): string[] {
    return [this.outputKey];
  }
}
