# AWS [CloudFormation](https://aws.amazon.com/cloudformation/) Templates

CloudFormation is a great way to to automate AWS infrastructure and service setup. One of it's best features is that it is extensible using AWS [Lambda](https://aws.amazon.com/lambda/) as describe [here](http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/template-custom-resources-lambda.html). This technique is used in places with these templates.

The templates follow CloudFromation [best practices](http://www.slideshare.net/AmazonWebServices/app304-aws-cloudformation-best-practices-aws-reinvent-2014).

**Note**
In some cases, one stack may depend on another. For example, you need to setup a VPC before launching an SSH/NAT instance.



