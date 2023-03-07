export interface AppConfig {
  // Desired MySQL Database Admin User
  dbAdminUser: string;
  // Desired MySQL Database Name
  defaultDbName: string;
  // Desired DB Secret Name in Secrets Manager
  dbSecretName: string;
  // Desired MySql Table Name
  dbTableName: string;
  // Desired MySQL Database Port
  dbPort: number;
  // Local Path to Shell Script to Initialize Bastion Host (relative to **lib** directory)
  bastionHostInitScriptPath: string;
  // Desired Name of Key Pair to use for Bastion Host (private and public key will be available in Secrets Manager)
  bastionhostKeyPairName: string;
  // Local Path to Lambda Functions (relative to **lib** directory)
  lambdaApisDirectory: string;
  // Name of Lambda Function to Initialize Database (always <function-code-file-name>.handler) Note: *.js is dropped
  defaultHandler: string;
}
