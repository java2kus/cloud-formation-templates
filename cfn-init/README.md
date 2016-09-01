#CloudFormation Initialization of Resource and Template Buckets

It is common for CloudFormation stacks to require resources kept in S3. This creates a bucket for those resources, and lso creates a bucket to store template files. You can nest CloudFormation stacks but they currently must be in S3 to do so. 

##Usage

For default Stack

```
make create
```

or

```
make create NAME=<stack-name>
```

For a complete list of options use

```
make list
```



