import { Parser } from "expr-eval";

import { Tool } from "./base.js";

/**
 * The Calculator class is a tool used to evaluate mathematical
 * expressions. It extends the base Tool class.
 */
export class Calculator extends Tool {
  static lc_name() {
    return "Calculator";
  }

  get lc_namespace() {
    return [...super.lc_namespace, "calculator"];
  }

  name = "calculator";

  /** @ignore */
  async _call(input: string) {
    try {
      return Parser.evaluate(input).toString();
    } catch (error) {
      return "I don't know how to do that.";
    }
  }

  description = `Useful for getting the result of a math expression. The input to this tool should be a valid mathematical expression that could be executed by a simple calculator.`;
}
