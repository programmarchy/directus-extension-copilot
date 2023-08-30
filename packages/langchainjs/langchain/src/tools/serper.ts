import { getEnvironmentVariable } from "../util/env.js";
import { Tool } from "./base.js";

/**
 * Defines the parameters that can be passed to the Serper class during
 * instantiation. It includes `gl` and `hl` which are optional.
 */
export type SerperParameters = {
  gl?: string;
  hl?: string;
};

/**
 * Wrapper around serper.
 *
 * You can create a free API key at https://serper.dev.
 *
 * To use, you should have the SERPER_API_KEY environment variable set.
 */
export class Serper extends Tool {
  static lc_name() {
    return "Serper";
  }

  /**
   * Converts the Serper instance to JSON. This method is not implemented
   * and will throw an error if called.
   * @returns Throws an error.
   */
  toJSON() {
    return this.toJSONNotImplemented();
  }

  protected key: string;

  protected params: Partial<SerperParameters>;

  constructor(
    apiKey: string | undefined = getEnvironmentVariable("SERPER_API_KEY"),
    params: Partial<SerperParameters> = {}
  ) {
    super();

    if (!apiKey) {
      throw new Error(
        "Serper API key not set. You can set it as SERPER_API_KEY in your .env file, or pass it to Serper."
      );
    }

    this.key = apiKey;
    this.params = params;
  }

  name = "search";

  /** @ignore */
  async _call(input: string) {
    const options = {
      method: "POST",
      headers: {
        "X-API-KEY": this.key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: input,
        ...this.params,
      }),
    };

    const res = await fetch("https://google.serper.dev/search", options);

    if (!res.ok) {
      throw new Error(`Got ${res.status} error from serper: ${res.statusText}`);
    }

    const json = await res.json();

    if (json.answerBox?.answer) {
      return json.answerBox.answer;
    }

    if (json.answerBox?.snippet) {
      return json.answerBox.snippet;
    }

    if (json.answerBox?.snippet_highlighted_words) {
      return json.answerBox.snippet_highlighted_words[0];
    }

    if (json.sportsResults?.game_spotlight) {
      return json.sportsResults.game_spotlight;
    }

    if (json.knowledgeGraph?.description) {
      return json.knowledgeGraph.description;
    }

    if (json.organic?.[0]?.snippet) {
      return json.organic[0].snippet;
    }

    return "No good search result found";
  }

  description =
    "a search engine. useful for when you need to answer questions about current events. input should be a search query.";
}
