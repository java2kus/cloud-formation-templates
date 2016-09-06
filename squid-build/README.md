#EMM Squid Proxy Build

Bakes the EMM Squid Proxy into an AMI. Based on the pattern presented [https://blogs.aws.amazon.com/application-management/post/Tx38Z5CAM5WWRXW/Faster-Auto-Scaling-in-AWS-CloudFormation-Stacks-with-Lambda-backed-Custom-Resou](here). 


##Usage

For default Stack

```
make package && create
```

or

```
make create NAME=<stack-name>
```

For a complete list of options use

```
make list
```

