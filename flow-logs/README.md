#VPC [Flow Logs](http://docs.aws.amazon.com/AmazonVPC/latest/UserGuide/flow-logs.html) Traffic Capture

There an EnabledKinesis flag that will enable piping the FlowLogs to Kinesis in addition to the standard CloudWatch logs sink. This allows for things like more sophisticated intrusion detection (in real time) using machine learning or similar.


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

