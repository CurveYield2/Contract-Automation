import fs from 'node:fs/promises';
import { postBridgeFailure, runGithubBridge } from './index.mjs';

async function main() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) throw new Error('GITHUB_EVENT_PATH is not set');
  const event = JSON.parse(await fs.readFile(eventPath, 'utf8'));
  const repository = process.env.GITHUB_REPOSITORY;
  const issueNumber = event.issue?.number;
  try {
    const result = await runGithubBridge({
      issue: event.issue,
      repository,
      allowedUsers: process.env.PREFLIGHTSIM_ALLOWED_GITHUB_USERS,
      apiUrl: process.env.PREFLIGHTSIM_API_URL,
      apiKey: process.env.PREFLIGHTSIM_CLIENT_API_KEY,
      githubToken: process.env.GITHUB_TOKEN
    });
    console.log(JSON.stringify(result));
  } catch (cause) {
    await postBridgeFailure({
      repository,
      issueNumber,
      githubToken: process.env.GITHUB_TOKEN,
      message: cause?.stack ?? cause?.message ?? String(cause)
    }).catch((failure) => console.error('Could not post bridge failure comment', failure));
    throw cause;
  }
}

await main();
