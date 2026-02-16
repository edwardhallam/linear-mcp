const LINEAR_API_KEY = process.env.LINEAR_API_KEY;

if (!LINEAR_API_KEY) {
  console.error(
    "ERROR: LINEAR_API_KEY environment variable is required.\n" +
    "Generate a personal API key at: Linear Settings > Account > API > Personal API Keys\n" +
    "The key should start with 'lin_api_'"
  );
  process.exit(1);
}

if (!LINEAR_API_KEY.startsWith("lin_api_")) {
  console.error(
    "WARNING: LINEAR_API_KEY does not start with 'lin_api_'. " +
    "Verify you're using a Personal API Key, not an OAuth token."
  );
}

export { LINEAR_API_KEY };
