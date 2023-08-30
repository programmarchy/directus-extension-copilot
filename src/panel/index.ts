import { definePanel } from '@directus/extensions-sdk';
import PanelComponent from './panel.vue';

export default definePanel({
	id: 'copilot',
	name: 'Copilot',
	icon: 'box',
	description: 'Ask Copilot a question about your data.',
	component: PanelComponent,
	options: [
		{
			field: 'openai_api_key',
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
	],
	minWidth: 12,
	minHeight: 8,
});
