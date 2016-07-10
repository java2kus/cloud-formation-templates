# AWS [CloudFormation](https://aws.amazon.com/cloudformation/) Templates

CloudFormation is a great way to to automate AWS infrastructure and service setup. One of it's best features is that it is extensible using AWS [Lambda](https://aws.amazon.com/lambda/) as describe [here](http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/template-custom-resources-lambda.html). This technique is used in places with these templates.

The templates follow CloudFromation [best practices](http://www.slideshare.net/AmazonWebServices/app304-aws-cloudformation-best-practices-aws-reinvent-2014).

## Usage

These CloudFormation templates are designed to be used in multiple accounts, in multiple "environments", and are designed with the ability to be launched multiple times in the same environment and/or VPC where appropriate. To accomplish this some extra variables are stored in the `~/.aws/config` using the `aws configure set` command. For example to set the current environment `aws configure set env Default` could be used. A complete config for building with these templates might therefore look like:

```
[profile zollie]
region = us-east-1
output = json
name = test
mnemonic = zollie
env = Default
```

This means the `Default` environment in the `test` account with mnemonic `zollie` in the `us-east-1` region. The mnemonic is used in a naming standard. Parameters can be stored in JSON files correspinding to this config. For example: `zollie-test-Default-us-east-1.json`


All templates have a Makefile with some common tasks. This is a non-exhaustive list. 

To list all targets:

`make ` or `make list`

To validate stack:

`make validate`

To create stack:

`make create`

To delete stack:

`make delete`

To update stack:

`make update`

To estimate the cost of the stack using the [AWS Simple Monthly Calculator](https://calculator.s3.amazonaws.com/index.html):

`make estimate-cost`

To describe stack:

`make describe`

To list the resources created by the stack:

`make resources`

To list the events that have happend on stack create/delete/update:

`make events`


### Service Catalog

The `AWS::StackName` variable is avoided where possible. This makes it easier to use these templates as services in [AWS Service Catalog](https://aws.amazon.com/servicecatalog/). 

**Note**

In some cases, one stack may depend on another. For example, you need to setup a VPC before launching an SSH/NAT instance.



