# directus-extension-copilot

A Directus extension that provides an Insights panel and API endpoint allowing you to chat with your data using OpenAI.

## Details

- This extension allows users to quickly find out useful information about their data using a chat interface. For example:
  - How many customers do I have?
  - How many sales did I have last month?
  - List all of my customer's emails in the state of Texas.
  - What is my top selling product this week?
- I used [langchain.js](https://js.langchain.com) (a modified version) to access the OpenAI API.
  - A local copy resides in `packages` folder and can be built using `pnpm build:langchain`.
- I built a bundle extension that provides an Insight panel (named 'Copilot') and an API endpoint (`POST /copilot/ask`).
- If given longer, I would make many improvements:
  - Store the chat history so it remains when the user navigates away from their dashboard.
  - Ask the AI for richer data (like tables, markdown, etc.) that could be displayed in a companion side drawer alongside the chat.
  - Enhance its capabilities by building an "Agent" that could plan multiple API calls instead of relying on a one-shot API call.
  - Would allow the AI to explore more endpoints, and possibly even perform POST and PATCH operations!
  - Support Llama and other LLMs, especially self-hosted ones.
  - Allow users to fine-tune the LLM parameters, like temperature and which model.
  - Remove the dependency on langchain in favor of something simpler, more lightweight.
  - Smooth out the build process.

## Screenshots

<img width="1241" alt="screenshot-1" src="https://github.com/programmarchy/directus-extension-copilot/assets/622192/de911a27-7ffb-4d7a-9f1e-3129489308f7">

## Build

Building this extension is a bit wonky because of issues I had with langchain.js. I made [some hacks](https://github.com/programmarchy/langchainjs/commit/5259940ea9e2f23d6761f21f912d46dfe640bf5e), and copied the package locally to reference as a local package. To build this extension:

```
pnpm build:langchain
pnpm i
pnpm build
```

## Installation

The easiest way to install this extension is to clone it directly into your Directus project's `extensions` path. Directus should then load it as a bundle extension.

## Collaborators

- [programmarchy](https://github.com/programmarchy)
