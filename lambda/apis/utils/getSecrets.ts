import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";

const smClient = new SecretsManagerClient({
  region: process?.env.AWS_REGION,
  endpoint: process?.env.AWS_ENDPOINT,
});

export const getDbSecrets = async (secretName: string) => {
  console.info(`Getting secret ${secretName}`);
  const secretValue = await smClient.send(
    new GetSecretValueCommand({
      SecretId: secretName,
    })
  );
  return JSON.parse(secretValue.SecretString || "");
};
