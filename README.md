# CDK Example Consuming and Building Custom Constructs

This is an example CDK app for the purposes of demonstrating how to build, consume, and deploy custom constructs.
Additionally, this example is to highlight the power of the abstractions provided by the CDK, allowing us to deploy "complex"
architectures with minimal effort in our infrastructure stacks.

## Architecture

This CDK application creates a custom L3 construct called RdsWithBastionHost. This construct creates the following:

- VPC with public, private and isolated subnets
- RDS Aurara MySQL cluster
- Bastion host in the public subnet so that we can connect from our local machine to the RDS cluster
- Keypair to be used for SSH access to the bastion host (this uses an L3 construct from npm package cdk-ec2-key-pair)
- Networking config to allow the bastion host to connect to the RDS cluster

The DataStack class deploys a cloudformation stack which deploys the RdsWithBastionHost construct as well as a lambda
and corresponding API Gateway resources for each of the CRUD operations.

Additionally, it deploys a host of other abstracted resources since it usese L2 constructs from the CDK.

TODO: Add architecture diagram

## Prerequisites

- aws-cli installed and configured with credentials for your account
- nodejs installed
- npm installed
- aws-cdk installed

## Deploying

```
npm install
npm run build
cdk synth # not required but it will output the CloudFormation template you're about to deploy
cdk deploy
```
You should see multiple outputs from this deploytment. These will be used in the commands below:

Outputs are:
- Bastion Host IP
- Key Pair Private Key Secret ID (Arn)
- RDS Cluster Endpoint
- RDS Secret ID (Arn)
- API Gateway URL

## Connect to the RDS cluster and Creating a Table

```bash
# Get your private key
aws secretsmanager get-secret-value \                                                                                                                                                                                                                                                                                                                                ─╯
  --secret-id <private key ARN output> \
  --query SecretString.password \
  --output text > rds-bastion-host-key-pair.pem

# Get your mysql password and default DB name
aws secretsmanager get-secret-value \
  --secret-id rds-bastion-host-cluster \
  --query SecretString \
  --output text
  
# Connect to bastion host
ssh -i rds-bastion-host-key-pair.pem ec2-user@<bastion host IP output>

# Connect to mysql server - password and cluster id are available in AWS Secrets Manager
mysql -h <cluster endpoint output> -D mydb -u myadmin -p

# Create a table if you want to test the Lambda backed APIs
create table mytable (id int not null auto_increment, name varchar(255), primary key (id));
```

## CRUD

TODO document APIs once validated

## Disclaimer
This application deploys some non-free tier resources. You will potentially be charged for the resources created by this 
application. Ensure you destroy the resources when you're done.

## Cleanup
`cdk destroy`