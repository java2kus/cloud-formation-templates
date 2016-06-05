#/bin/bash

for i in "$@"
do
case $i in
    -p=*|--prefix=*)
    PREFIX="${i#*=}"
    shift # past argument=value
    ;;
    *)
            # unknown option
    ;;
esac
done

if [ -z "$PREFIX" ]
then
	echo "Need to provide Log Group prefix to delete with --prefix flag"
    	exit 1
fi

names=$(aws logs describe-log-groups --log-group-name-prefix="$PREFIX" --query='logGroups[].logGroupName' --output=text)
for n in $names; do aws logs delete-log-group --log-group-name $n; done

