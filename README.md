# CDK Example Consuming and Building Custom Constructs

This is an example CDK app for the purposes of demonstrating how to build, consume, and deploy custom constructs.

This CDK application creates a custom L3 construct called RdsWithBastionHost. This construct creates the following:

- A VPC with public, private and isolated subnets
- A RDS Aurara MySQL cluster
- A bastion host in the public subnet so that we can connect from our local machine to the RDS cluster
- A keypair to be used for SSH access to the bastion host (this uses an L3 construct from npm package cdk-ec2-key-pair)
- A security group to allow SSH access to the bastion host

Additonally it deploys a host of other abstracted resources since it usese L2 constructs from the CDK.

## Prerequisites

- aws-cli installed and configured with credentials for your account
- nodejs installed
- npm installed
- aws-cdk installed

## Deploying

```
npm install
cdk synth # not required but it will output the CloudFormation template you're about to deploy
cdk deploy
```

## Connecting to the RDS cluster
```bash
# Get your private key
aws secretsmanager get-secret-value \                                                                                                                                                                                                                                                                                                                                ─╯
  --secret-id ec2-ssh-key/rds-bastion-host-key-pair/private \
  --query SecretString \
  --output text > rds-bastion-host-key-pair.pem
# Connect to bastion host
ssh -i rds-bastion-host-key-pair.pem ec2-user@3.14.145.59
# Connect to mysql server - password and cluster id are available in AWS Secrets Manager
mysql -h rds-bastion-host-cluster.cluster-<cluster-id>.<region>.rds.amazonaws.com -u admin -p
```

## Cleanup
`cdk destroy`