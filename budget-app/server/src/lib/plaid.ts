import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { config } from '../config';

const plaidConfig = new Configuration({
  basePath: PlaidEnvironments[config.plaidEnv as keyof typeof PlaidEnvironments],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': config.plaidClientId,
      'PLAID-SECRET': config.plaidSecret,
    },
  },
});

export const plaidClient = new PlaidApi(plaidConfig);
