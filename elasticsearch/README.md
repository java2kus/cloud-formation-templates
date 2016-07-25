#Create an ElasticSearch Domain

Elasticsearch is a fairly new AWS service. It is not directly supported in CloudFormation yet. This uses a Lambda [CustomeResource](http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-cfn-customresource.html) to create the Elasticsearch domain. It can take about 10 minutes to setup the Domain, and the Domain Endpoint is not available until the Domain is active. [WaitConditions](http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-waitcondition.html) are used to ensure the Domain Endpoint is available for output.

**Update**

AWS added support for Elasticsearch to CloudFormation but it does not wait for the DomainEndpoint making it harder to automate Route53 updates. Therefore not updating this to use the standard CloudFormation Resources just yet.

**Note**

The AWS SDK bundled with the AWS Node [runtime](http://docs.aws.amazon.com/lambda/latest/dg/current-supported-versions.html) is not the latest and has not been updated with ES support
so the `aws-sdk` module is bundled here. When AWS updates the Node SDK this can be removed.

##Usage
For default Stack and Domain name

```
make create
```

or

```
make create NAME=<stack-name> DOMAIN_NAME=<domain-name>
```

For a complete list of options use

```
make list
```

You can export Kibana dashboards with 

```
make kibana-export
```

This requires [elasticdump](https://www.npmjs.com/package/elasticdump)

You can import saved Kibana dashboards with 

```
make kibana-import
```


You must copy a saved Kibana export file to the name `kibana-import.json` in the current directory before running this command
