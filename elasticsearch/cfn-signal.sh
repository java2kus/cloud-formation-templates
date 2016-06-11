#!/bin/bash

for i in "$@"
do
case $i in
    -d=*|--domain-name=*)
    DOMAIN_NAME="${i#*=}"
    shift # past argument=value
    ;;
    -s=*|--stack-name=*)
    STACK_NAME="${i#*=}"
    shift # past argument=value
    ;;
    -l=*|--logical-resource-id=*)
    LOGICAL_RESOURCE_ID="${i#*=}"
    shift # past argument=value
    ;;
    *)
            # unknown option
    ;;
esac
done

sp='/-\|'
MINUTES=60
TICKER=0
printf 'Waiting for Domain endpoint   '
until endpoint=`aws es describe-elasticsearch-domain --domain-name="$DOMAIN_NAME" --query 'DomainStatus.Endpoint' 2>/dev/null` && [ ! -z "$endpoint" ] && [ "$endpoint" != "null" ] || [ $TICKER -eq $MINUTES ]
do
	for i in $(seq 60); do
  		printf '\b%.1s' "$sp"
  		sp=${sp#?}${sp%???}
  		sleep 1
	done
	(( TICKER++ ))
done

if [ -z $endpoint ]
then
	printf '\rTimeout waiting for Domain endpoint\n'
	aws cloudformation signal-resource  --logical-resource-id=WaitCondition --stack-name="$STACK_NAME" --unique-id="NA" --status=FAILURE
else
	unique_id=${endpoint:0:49}
	printf '\rDomain endpoint found, signaling CloudFormation\n'
	aws cloudformation signal-resource  --logical-resource-id="$LOGICAL_RESOURCE_ID" --stack-name="$STACK_NAME" --unique-id="$unique_id" --status=SUCCESS
fi


