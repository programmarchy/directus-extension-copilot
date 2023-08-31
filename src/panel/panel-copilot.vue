<template>
	<div class="copilot" :class="{ 'show-header': showHeader }">
		<div class="ask-question">
			<v-input v-model="question" placeholder="Ask a question..." />
			<div v-if="loading" class="loading">
				<v-progress-circular indeterminate />
			</div>
			<v-button v-else icon rounded outlined x-small :disabled="loading" @click="ask">
				<v-icon name="arrow_upward" />
			</v-button>
		</div>
		<div class="messages">
			<template v-for="message in messages">
				<div class="message" :class="message.type">{{ message.text }}</div>
			</template>
		</div>
	</div>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue';
import { useApi } from '@directus/extensions-sdk';

type Message = {
	type: 'human' | 'bot';
	text: string;
	timestamp: number;
};

const GREETING = `Ask me a question about your data, and I'll do my best to answer!`;
const ANSWER_EMPTY_FALLBACK = `Sorry, I couldn't find an answer to that question. Could you try rephrasing it?`;
const ANSWER_ERROR_FALLBACK = `Something went wrong. Here's the error I got:`;

export default defineComponent({
	props: {
		showHeader: {
			type: Boolean,
			default: false,
		},
		key: {
			type: String,
			default: '',
		}
	},
	setup(props) {
		const api = useApi();

		const question = ref('');
		const loading = ref(false);
		const messages = ref<Message[]>([
			{
				type: 'bot',
				text: GREETING,
				timestamp: Date.now(),
			}
		]);

		function addMessage(message: Message) {
			messages.value.unshift(message);
		}

		async function ask() {
			addMessage({
				type: 'human',
				text: question.value,
				timestamp: Date.now(),
			});
			loading.value = true;
			question.value = '';
			try {
				const { data } = await api.post('copilot/ask', {
					q: question.value,
					key: props.key,
				});
				console.log(data);
				addMessage({
					type: 'bot',
					text: data?.answer ?? ANSWER_EMPTY_FALLBACK,
					timestamp: Date.now(),
				});
			} catch (err) {
				console.error(err);
				addMessage({
					type: 'bot',
					text: `${ANSWER_ERROR_FALLBACK} ${parseErrorMessage(err)}`,
					timestamp: Date.now(),
				});
			} finally {
				loading.value = false;
			}
		}

		return {
			question,
			messages,
			loading,
			ask,
		};
	},
});

function parseErrorMessage(err: any): string {
	const errors = err?.response?.data?.errors;
	if (Array.isArray(errors) && errors.length > 0) {
		const message = errors[0].message;
		if (message) {
			return String(message);
		}
	}

	if (err?.message) {
		return String(err.message);
	}

	return `Unknown error`;
}
</script>

<style scoped>
.copilot {
	display: flex;
	flex-direction: column-reverse;
	gap: 12px;
	padding: 12px;
	height: 100%;

	&.show-header {
		padding-top: 6px;
	}

	.ask-question {
		display: flex;
		flex-direction: row;
		gap: 12px;

		.loading {
			display: flex;
			justify-content: center;
			align-items: center;
		}
	}

	.messages {
		flex-direction: column-reverse;
		display: flex;
		flex: 1;
		overflow-y: auto;
		gap: 12px;

		.message {
			padding: 8px;
			border-radius: 8px;
			color: var(--text-normal);
			line-height: 1.5;
			max-width: 90%;
		}

		.message:first-child {
			max-width: 100%;
		}

		.human {
			align-self: end;
			text-align: right;
			background-color: var(--primary);
		}

		.bot {
			align-self: start;
			text-align: left;
			background-color: var(--background-normal);
		}
	}
}
</style>
