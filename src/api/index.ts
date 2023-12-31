import { defineEndpoint } from '@directus/extensions-sdk';
import { Accountability, SchemaOverview } from '@directus/types';
import { InvalidPayloadError } from './errors';
import { getDirectusOpenAPISpec } from './utils/oas';
import { AiService } from './services/ai';

export default defineEndpoint({
	id: "copilot",
	handler: (router, { env, services, database: knex, logger }) => {
		const { SpecificationService } = services;

		router.post('/ask/:callback?', async (req: any, res) => {
			try {
				const {
					accountability,
					schema,
					body: {
						question,
						apiKey,
						apiOutput,
						llm,
					},
				} = parseRequest(req);

				const specService = new SpecificationService({
					accountability,
					schema,
					knex,
				});

				const spec = await getDirectusOpenAPISpec({ specService });

				logger?.info('Incoming Copilot request:');
				logger?.info({
					question,
					llm,
					apiOutput,
				});

				const aiService = new AiService(spec, {
					llm: llm,
					apiKey: resolveApiKey({ env, apiKey }),
					logger,
				});

				if (!req.params.callback) {
					res.json(await aiService.ask(question));
				} else {
					res.json(await aiService.askCallback(question, apiOutput));
				}
			} catch (err) {
				// Seems like this should be handled by the error handler middleware,
				// but during testing, uncaught errors crashed the server instead.
				// Hence, some light error handling to work around this.
				const [ status, payload ] = encodeErrorResponse(err);
				res.status(status).json(payload);
				logger.error(err);
			}
		});
	},
});

type CopilotRequest = {
	accountability: Accountability;
	schema: SchemaOverview;
	body: {
		question: string;
		apiKey?: string;
		apiOutput?: string;
		llm?: string;
	};
};

function parseRequest(req: any): CopilotRequest {
	// These properties are injected by the Directus API.
	const { accountability, schema } = req;
	// These properties need to be parsed from the request.
	const question = parseStringParam('question', req.body);
	const apiKey = parseOptionalStringParam('key', req.body);
	const apiOutput = parseOptionalStringParam('output', req.body);
	const llm = parseOptionalStringParam('llm', req.body);
	return {
		accountability,
		schema,
		body: {
			question,
			apiKey,
			apiOutput,
			llm,
		},
	};
}

function parseOptionalStringParam(key: string, params?: any, defaultValue?: string): string | undefined {
	const value = params?.[key];
	if (value === undefined) {
		return defaultValue;
	} else if (typeof value === 'string') {
		return value;
	} else {
		throw new InvalidPayloadError({ reason: `Expected "${key}" to be a string`});
	}
}

function parseStringParam(key: string, params?: any, defaultValue?: string): string {
	const value = parseOptionalStringParam(key, params, defaultValue);
  if (value === undefined) {
    throw new InvalidPayloadError({ reason: `"${key}" is required`});
  } else {
    return value;
  }
}

function encodeErrorResponse(err: any): [ number, any ] {
	const status: number = err.status ?? 500;
	const message: string = err.message ?? 'An unexpected error occurred';
	const code: string = err.code ?? 'INTERNAL_SERVER_ERROR';
	return [
		status,
		{
			errors: [
				{
					message,
					extensions: {
						code,
					},
				}
			],
		}
	];
}

function resolveApiKey({
	apiKey,
	env,
}: {
	apiKey?: string,
	env: Record<string, string>,
}): string | undefined {
	if (apiKey) {
		return apiKey;
	}
	if (env.OPENAI_API_KEY) {
		return env.OPENAI_API_KEY;
	}
	throw new InvalidPayloadError({
		reason: 'No OpenAI API key was provided'
	});
}
