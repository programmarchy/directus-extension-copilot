# directus-extension-copilot

A Directus extension that provides an Insights panel and API endpoint allowing you to chat with your data using OpenAI.

## Details

- This extension allows users to quickly find out useful information about their data using a chat interface. For example:
  - How many customers do I have?
  - How many sales did I have last month?
  - List all of my customer's emails in the state of Texas.
  - What is my top selling product this week?
- I used [langchain.js](https://js.langchain.com) (a modified version) to access the OpenAI API.
- I built a bundle extension that provides an Insight panel (named 'Copilot') and an API endpoint (`POST /copilot/ask`).
- If given longer, I would make many improvements:
  - Ask ChatGPT for richer data (like tables, markdown, etc.) that could be displayed in a companion side drawer alongside the chat.
  - Enhance the capabilities by building an "Agent" that could plan multiple API calls instead of relying on a one-shot API call.
  - Support Llama and other LLMs, especially self-hosted ones.
  - Allow users to fine-tune the LLM parameters, like temperature and which model.

## Screenshots

<img width="1241" alt="screenshot-1" src="https://github.com/programmarchy/directus-extension-copilot/assets/622192/de911a27-7ffb-4d7a-9f1e-3129489308f7">

## Collaborators

- [programmarchy](https://github.com/programmarchy)
