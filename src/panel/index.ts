import { definePanel } from '@directus/extensions-sdk';
import PanelCopilot from './panel-copilot.vue';

export default definePanel({
	id: 'copilot',
	name: 'Copilot',
	icon: 'robot',
	description: 'Ask Copilot a question about your data.',
	component: PanelCopilot,
	options: [
		{
			field: 'apiKey',
			name: 'OpenAI API Key',
			type: 'string',
			meta: {
				interface: 'input',
				width: 'full',
				note: 'Defaults to the `OPENAI_API_KEY` defined in your project\'s <a href="https://docs.directus.io/self-hosted/config-options.html" target="_blank" title="Configuration Options">configuration options</a>.',
				options: {
					iconRight: 'vpn_key',
				},
			},
		},
		{
			field: 'llm',
			name: 'Model',
			type: 'string',
			schema: {
				default_value: 'gpt-3.5-turbo-0613',
			},
			meta: {
				interface: 'select-dropdown',
				width: 'full',
				note: 'Defaults to `gpt-3.5-turbo-0613`. See <a href="https://platform.openai.com/docs/models" target="_blank" title="OpenAI Models">OpenAI Models</a> for more information.',
				options: {
					choices: [
						{
							text: 'GPT-3.5',
							value: 'gpt-3.5-turbo-0613',
						},
						{
							text: 'GPT-4',
							value: 'gpt-4',
						},
					],
					allowOther: true,
				},
			},
		},
	],
	minWidth: 16,
	minHeight: 24,
});
