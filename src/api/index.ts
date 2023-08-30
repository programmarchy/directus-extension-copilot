import { defineEndpoint } from '@directus/extensions-sdk';
import { Accountability, SchemaOverview } from '@directus/types';
import { InvalidPayloadError } from './errors';
import { getDirectusOpenAPISpec } from './utils/get-directus-oas';

export default defineEndpoint({
	id: "copilot",
	handler: (router, { env, services, database: knex, logger }) => {
		const { SpecificationService } = services;

		router.get('/', async (req: unknown, res) => {
			try {
				console.log(req);
				const {
					accountability,
					schema,
					query: {
						question,
						openai_api_key,
					},
				} = parseRequest(req);
				const openaiApiKey = getOpenAIAPIKey({ env, openai_api_key });
				const specService = new SpecificationService({
					accountability,
					schema,
					knex,
				});
				const spec = await getDirectusOpenAPISpec({ specService });
				res.json({
					question,
					spec,
					openaiApiKey,
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

type CopilotGetRequest = {
	accountability: Accountability;
	schema: SchemaOverview;
	query: {
		question: string;
		openai_api_key?: string;
	};
};

function parseRequest(req: any): CopilotGetRequest {
	// These properties are injected by the Directus API.
	const { accountability, schema } = req;
	// These properties need to be parsed from the request.
	const question = parseStringParam('q', req);
	const openai_api_key = parseOptionalStringParam('openai_api_key', req);
	return {
		accountability,
		schema,
		query: {
			question,
			openai_api_key,
		},
	};
}

function parseOptionalStringParam(key: string, req: any, defaultValue?: string): string | undefined {
	const value = req.query?.[key];
	if (value === undefined) {
		return defaultValue;
	} else if (typeof value === 'string') {
		return value;
	} else {
		throw new InvalidPayloadError({ reason: `Expected "${key}" to be a string.`});
	}
}

function parseStringParam(key: string, req: any, defaultValue?: string): string {
	const value = parseOptionalStringParam(key, req, defaultValue);
  if (value === undefined) {
    throw new InvalidPayloadError({ reason: `"${key}" is required.`});
  } else {
    return value;
  }
}

function encodeErrorResponse(err: any): [ number, any ] {
	const status: number = err.status ?? 500;
	const message: string = err.message ?? 'An unexpected error occurred.';
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

function getOpenAIAPIKey({
	env,
	openai_api_key
}: {
	env: Record<string, string>,
	openai_api_key?: string
}): string {
	if (openai_api_key) {
		return openai_api_key;
	}
	if (env.OPENAI_API_KEY) {
		return env.OPENAI_API_KEY;
	}
	throw new InvalidPayloadError({
		reason: 'No OpenAI API key was provided.'
	});
}
