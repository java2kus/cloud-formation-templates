#Domain Name System Setup

This uses Lambdas to create Hosted Zones with a given DelegatoinSetId for more permanent and stable Name Servers than is the default with Route53. Reusable Delegatoin Sets are described [here](http://docs.aws.amazon.com/Route53/latest/APIReference/actions-on-reusable-delegation-sets.html).

##Known Issue:
On stack delete, the Route53 Zone is not deleted. This must be deleted manually. This will be fixed soon.

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

