cform = elasticsearch.cform
name = Elasticsearch
# set with something like aws configure set mnemonic zollie
mnemonic = $(shell aws configure get mnemonic)
region = $(shell aws configure get region)
account = $(shell aws configure get name)
account_lower = $(shell echo $(account) | tr  '[A-Z]' '[a-z]')
env = $(shell aws configure get env)
resource_bucket_name = $(mnemonic)-cfn-resources-$(region)-$(account_lower)
template_bucket_name = $(mnemonic)-cfn-templates-$(region)-$(account_lower)
# ifeq ($(NAME),)
	NAME=$(name)
# endif

ifeq ($(SERVICE_NAME),)
	SERVICE_NAME=$(name)
endif

ifeq ($(ACCOUNT),)
	ACCOUNT=$(account)
endif

ifeq ($(ENV),)
	ENV=$(env)
endif

ifeq ($(RESOURCE_BUCKET_NAME),)
	RESOURCE_BUCKET_NAME=$(resource_bucket_name)
endif

ifeq ($(TEMPLATE_BUCKET_NAME),)
	TEMPLATE_BUCKET_NAME=$(template_bucket_name)
endif

root_domain=$(shell cat $(mnemonic)-$(ACCOUNT)-$(ENV)-$(region).json | jq -r '.[] \
	| select(.ParameterKey=="RootDomain") | .ParameterValue')

ifeq ($(ROOT_DOMAIN),)
	ROOT_DOMAIN=$(root_domain)
endif

domain_name=$(shell cat $(mnemonic)-$(ACCOUNT)-$(ENV)-$(region).json | jq -r '.[] \
	| select(.ParameterKey=="DomainName") | .ParameterValue')

ifeq ($(DOMAIN_NAME),)
	DOMAIN_NAME=$(domain_name)
endif


STACK_NAME=$(NAME)-$(DOMAIN_NAME)

KIBANA_EXPORT_FILE=kibana-exported-$(shell date +'%y.%m.%d %H:%M:%S').json
KIBANA_IMPORT_FILE=kibana-import.json

# lists all available targets
list:
	@echo "List of available targets:"
	@sh -c "$(MAKE) -p no_targets__ | awk -F':' '/^[a-zA-Z0-9][^\$$#\/\\t=]*:([^=]|$$)/ {split(\$$1,A,/ /);for(i in A)print A[i]}' | grep -v '__\$$' | grep -v 'make\[1\]' | grep -v 'Makefile' | sort"
# required for list
no_targets__:

estimate-cost:
	@aws cloudformation estimate-template-cost \
		--template-body=file://$(cform) --output text --query 'Url'

kibana-export:
	elasticdump --input="http://$(DOMAIN_NAME).es.$(ACCOUNT).$(region).$(ROOT_DOMAIN)/.kibana-4" \
			--output=$(KIBANA_EXPORT_FILE) \
			--type=data \
			--searchBody='{"filter": { "or": [ {"type": {"value": "dashboard"}}, {"type" : {"value":"visualization"}}] }}'

kibana-import:
	elasticdump --input=$(KIBANA_IMPORT_FILE) \
		--output="http://$(DOMAIN_NAME).es.$(ACCOUNT).$(region).$(ROOT_DOMAIN)/.kibana-4" \
		--type=data

clean:
	@rm -f *.zip \
		&& aws s3 rm s3://$(RESOURCE_BUCKET_NAME)/$(STACK_NAME).zip \
		&& aws s3 rm s3://$(RESOURCE_BUCKET_NAME)/$(STACK_NAME)-Outputs.zip

package:
	@cd cfn-elasticsearch-func && zip -r ../$(STACK_NAME).zip . -x *.git* \
		&& cd ../cfn-elasticsearch-outputs-func && zip -r ../$(STACK_NAME)-Outputs.zip . -x *.git*

upload: upload-package upload-template

upload-package:
	@aws s3 cp $(STACK_NAME).zip s3://$(RESOURCE_BUCKET_NAME) \
		&& aws s3 cp $(STACK_NAME)-Outputs.zip s3://$(RESOURCE_BUCKET_NAME)

upload-template:
	@aws s3 cp $(cform) s3://$(TEMPLATE_BUCKET_NAME)

create: package upload
	@aws cloudformation create-stack --stack-name=$(STACK_NAME) \
		--template-body=file://$(cform) --capabilities=CAPABILITY_IAM \
		--parameters=file://$(mnemonic)-$(ACCOUNT)-$(ENV)-$(region).json \
		&& ./cfn-signal.sh --logical-resource-id=WaitCondition \
		--stack-name=$(STACK_NAME) --domain-name=$(DOMAIN_NAME) \

update: package upload
	@aws cloudformation update-stack --stack-name=$(STACK_NAME) --template-body=file://$(cform) --capabilities=CAPABILITY_IAM \
		--parameters=file://$(mnemonic)-$(ACCOUNT)-$(ENV)-$(region).json \

validate:
	@aws cloudformation validate-template --template-body=file://$(cform)

delete:
	@aws cloudformation delete-stack --stack-name=$(STACK_NAME) && $(MAKE) clean \
		&& $(MAKE) kibana-exported

describe:
	@aws cloudformation describe-stacks --stack-name=$(STACK_NAME)

events:
	@aws cloudformation describe-stack-events --stack-name=$(STACK_NAME)

resources:
	@aws cloudformation describe-stack-resources --stack-name=$(STACK_NAME)
