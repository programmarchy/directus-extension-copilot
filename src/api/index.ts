import { defineEndpoint } from '@directus/extensions-sdk';
import { Accountability, SchemaOverview } from '@directus/types';
import { InvalidPayloadError } from './errors';
import { getDirectusOpenAPISpec } from './utils/get-directus-oas';
import { AiService } from './services/ai';

export default defineEndpoint({
	id: "copilot",
	handler: (router, { env, services, database: knex, logger }) => {
		const { SpecificationService } = services;

		router.post('/ask', async (req: unknown, res) => {
			try {
				const {
					accountability,
					schema,
					body: {
						question,
						apiKey,
					},
				} = parseAskRequest(req);

				const specService = new SpecificationService({
					accountability,
					schema,
					knex,
				});

				const spec = await getDirectusOpenAPISpec({ specService });

				const aiService = new AiService(spec, {
					llm: 'gpt-3.5-turbo-0613',
					apiKey: resolveApiKey({ env, apiKey }),
					logger,
				});

				const { response } = await aiService.ask(question);

				res.json({
					answer: response,
				});
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

type CopilotAskRequest = {
	accountability: Accountability;
	schema: SchemaOverview;
	body: {
		question: string;
		apiKey?: string;
	};
};

function parseAskRequest(req: any): CopilotAskRequest {
	// These properties are injected by the Directus API.
	const { accountability, schema } = req;
	// These properties need to be parsed from the request.
	const question = parseStringParam('q', req.body);
	const apiKey = parseOptionalStringParam('key', req.body);
	return {
		accountability,
		schema,
		body: {
			question,
			apiKey,
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
